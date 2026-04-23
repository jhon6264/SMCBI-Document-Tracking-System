<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DocumentSession;
use App\Models\SessionActivity;
use App\Models\SessionFile;
use App\Models\SessionMember;
use App\Models\SessionPlaceholder;
use App\Models\UserSignatureAsset;
use App\Models\UserNotification;
use App\Models\User;
use App\Services\GoogleWorkspaceService;
use App\Services\SessionPlaceholderScanner;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use RuntimeException;

class UserSessionController extends Controller
{
    private const GOOGLE_RESOURCE_ID_REGEX = '/^[A-Za-z0-9_-]{10,200}$/';
    private const GOOGLE_DOC_MIME = 'application/vnd.google-apps.document';

    public function __construct(
        private readonly GoogleWorkspaceService $googleWorkspaceService,
        private readonly SessionPlaceholderScanner $placeholderScanner
    ) {
    }

    public function index(Request $request)
    {
        $sessions = DocumentSession::query()
            ->with([
                'creator:id,name,email',
                'files',
                'placeholders.assignedMember.user:id,name,email',
                'members.user:id,name,email',
            ])
            ->whereHas('members', function ($query) use ($request) {
                $query->where('user_id', $request->user()->id)
                    ->where('can_view_session', true)
                    ->where('invitation_status', 'accepted');
            })
            ->latest()
            ->get()
            ->map(fn (DocumentSession $session) => $this->formatSession($session, $request->user()->id));

        return response()->json([
            'success' => true,
            'sessions' => $sessions,
        ]);
    }

    public function show(Request $request, int $id)
    {
        $session = DocumentSession::query()
            ->with([
                'creator:id,name,email',
                'members.user:id,name,email,role,status',
                'placeholders.registryPlaceholder:id,placeholder_key,label,category',
                'placeholders.sessionFile:id,name',
                'placeholders.assignedMember.user:id,name,email',
                'files',
                'activities.user:id,name,email',
            ])
            ->find($id);

        if (!$session) {
            return response()->json([
                'success' => false,
                'message' => 'Session not found.',
            ], 404);
        }

        $membership = $session->members->firstWhere('user_id', $request->user()->id);
        if (
            !$membership
            || !$membership->can_view_session
            || $membership->invitation_status !== 'accepted'
        ) {
            return response()->json([
                'success' => false,
                'message' => 'You do not have access to this session.',
            ], 403);
        }

        return response()->json([
            'success' => true,
            'session' => $this->formatSession($session, $request->user()->id, true),
        ]);
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'title' => ['required', 'string', 'max:255'],
            'document_type' => ['nullable', 'string', 'max:120'],
            'google_doc_file_id' => ['required', 'string', 'regex:' . self::GOOGLE_RESOURCE_ID_REGEX],
            'google_drive_folder_id' => ['nullable', 'string', 'regex:' . self::GOOGLE_RESOURCE_ID_REGEX],
            'deadline_at' => ['nullable', 'date'],
            'description' => ['nullable', 'string'],
            'allow_delegated_editing' => ['nullable', 'boolean'],
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation errors.',
                'errors' => $validator->errors(),
            ], 422);
        }

        $user = $request->user();

        try {
            $fileMeta = $this->googleWorkspaceService->getDriveFileMeta(
                $user,
                (string) $request->input('google_doc_file_id')
            );

            $signableTarget = $this->resolveSignableTarget(
                $user,
                $fileMeta,
                $request->input('google_drive_folder_id')
            );

            $document = $this->googleWorkspaceService->getDocument(
                $user,
                (string) ($signableTarget['signable_meta']['id'] ?? '')
            );
        } catch (RuntimeException $exception) {
            return response()->json([
                'success' => false,
                'message' => $exception->getMessage(),
            ], 422);
        }

        $scanResults = $this->placeholderScanner->matchRegisteredPlaceholders($document);

        $session = DB::transaction(function () use ($request, $user, $fileMeta, $scanResults, $signableTarget) {
            $session = DocumentSession::create([
                'title' => trim((string) $request->input('title')),
                'document_type' => $request->input('document_type'),
                'status' => 'draft',
                'created_by' => $user->id,
                'google_doc_file_id' => (string) ($signableTarget['signable_meta']['id'] ?? $request->input('google_doc_file_id')),
                'google_drive_folder_id' => $request->input('google_drive_folder_id'),
                'deadline_at' => $request->input('deadline_at'),
                'allow_delegated_editing' => false,
                'description' => $request->input('description'),
            ]);

            SessionMember::create([
                'session_id' => $session->id,
                'user_id' => $user->id,
                'role' => 'session_admin',
                'display_role_name' => 'Creator',
                'member_status' => 'pending',
                'invitation_status' => 'accepted',
                'invited_at' => now(),
                'responded_at' => now(),
                'can_view_session' => true,
                'can_view_document' => true,
                'can_sign' => true,
                'can_view_drive_panel' => true,
                'can_add_files' => true,
                'can_remove_files' => true,
                'can_edit_session' => true,
                'can_manage_signatories' => true,
                'can_send_notifications' => true,
                'can_close_session' => true,
            ]);

            $primarySessionFile = SessionFile::create([
                'session_id' => $session->id,
                'source_google_drive_file_id' => $fileMeta['id'] ?? null,
                'google_drive_file_id' => $signableTarget['signable_meta']['id'] ?? null,
                'google_drive_parent_id' => $signableTarget['parent_id'],
                'name' => $fileMeta['name'] ?? trim((string) $request->input('title')),
                'source_mime_type' => $fileMeta['mimeType'] ?? null,
                'mime_type' => $signableTarget['signable_meta']['mimeType'] ?? self::GOOGLE_DOC_MIME,
                'web_view_link' => $signableTarget['signable_meta']['webViewLink'] ?? null,
                'uploaded_by' => $user->id,
                'source' => 'docs',
                'is_converted_for_signing' => (bool) $signableTarget['converted'],
                'is_primary_document' => true,
            ]);

            foreach ($scanResults['matched'] as $matched) {
                SessionPlaceholder::create([
                    'session_id' => $session->id,
                    'session_file_id' => $primarySessionFile->id,
                    'registry_placeholder_id' => $matched['registry_placeholder_id'],
                    'placeholder_key' => $matched['placeholder_key'],
                    'raw_token' => $matched['raw_token'],
                    'label' => $matched['label'],
                    'status' => 'unassigned',
                ]);
            }

            SessionActivity::create([
                'session_id' => $session->id,
                'user_id' => $user->id,
                'type' => 'created_session',
                'meta_json' => [
                    'matched_placeholders' => count($scanResults['matched']),
                    'unmatched_placeholders' => count($scanResults['unmatched']),
                    'primary_document_name' => $fileMeta['name'] ?? null,
                    'converted_for_signing' => (bool) $signableTarget['converted'],
                ],
            ]);

            return $session;
        });

        $session->load([
            'creator:id,name,email',
            'members.user:id,name,email,role,status',
            'placeholders.registryPlaceholder:id,placeholder_key,label,category',
            'placeholders.sessionFile:id,name',
            'placeholders.assignedMember.user:id,name,email',
            'files',
            'activities.user:id,name,email',
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Session created and document placeholders scanned successfully.',
            'session' => $this->formatSession($session, $user->id, true, $scanResults),
        ], 201);
    }

    public function update(Request $request, int $id)
    {
        $session = DocumentSession::query()
            ->with([
                'creator:id,name,email',
                'members.user:id,name,email,role,status',
                'placeholders.registryPlaceholder:id,placeholder_key,label,category',
                'placeholders.sessionFile:id,name',
                'placeholders.assignedMember.user:id,name,email',
                'files',
                'activities.user:id,name,email',
            ])
            ->find($id);

        if (!$session) {
            return response()->json([
                'success' => false,
                'message' => 'Session not found.',
            ], 404);
        }

        $membership = $this->getAuthorizedMembership($session, $request->user()->id);
        if (!$membership || !$membership->can_edit_session) {
            return response()->json([
                'success' => false,
                'message' => 'You are not allowed to edit this session.',
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'title' => ['required', 'string', 'max:255'],
            'document_type' => ['nullable', 'string', 'max:120'],
            'google_doc_file_id' => ['required', 'string', 'regex:' . self::GOOGLE_RESOURCE_ID_REGEX],
            'google_drive_folder_id' => ['nullable', 'string', 'regex:' . self::GOOGLE_RESOURCE_ID_REGEX],
            'deadline_at' => ['nullable', 'date'],
            'description' => ['nullable', 'string'],
            'allow_delegated_editing' => ['nullable', 'boolean'],
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation errors.',
                'errors' => $validator->errors(),
            ], 422);
        }

        $user = $request->user();
        $primaryFile = $session->files->firstWhere('is_primary_document', true);
        $currentSourceFileId = $primaryFile?->source_google_drive_file_id ?: $session->google_doc_file_id;
        $requestedFileId = (string) $request->input('google_doc_file_id');
        $documentChanged = $requestedFileId !== '' && $requestedFileId !== (string) $currentSourceFileId;

        if ($documentChanged && $session->status !== 'draft') {
            return response()->json([
                'success' => false,
                'message' => 'The primary document can only be changed while the session is still in draft status.',
            ], 422);
        }

        $scanResults = null;
        $fileMeta = null;
        $signableTarget = null;

        if ($documentChanged) {
            try {
                $fileMeta = $this->googleWorkspaceService->getDriveFileMeta(
                    $user,
                    $requestedFileId
                );

                $signableTarget = $this->resolveSignableTarget(
                    $user,
                    $fileMeta,
                    $request->input('google_drive_folder_id') ?: $session->google_drive_folder_id
                );

                $document = $this->googleWorkspaceService->getDocument(
                    $user,
                    (string) ($signableTarget['signable_meta']['id'] ?? '')
                );
            } catch (RuntimeException $exception) {
                return response()->json([
                    'success' => false,
                    'message' => $exception->getMessage(),
                ], 422);
            }

            $scanResults = $this->placeholderScanner->matchRegisteredPlaceholders($document);
        }

        DB::transaction(function () use (
            $request,
            $user,
            $session,
            $documentChanged,
            $fileMeta,
            $signableTarget,
            $scanResults
        ) {
            $session->update([
                'title' => trim((string) $request->input('title')),
                'document_type' => $request->input('document_type'),
                'google_doc_file_id' => $documentChanged
                    ? (string) ($signableTarget['signable_meta']['id'] ?? $request->input('google_doc_file_id'))
                    : $session->google_doc_file_id,
                'google_drive_folder_id' => $request->input('google_drive_folder_id') ?: $session->google_drive_folder_id,
                'deadline_at' => $request->input('deadline_at'),
                'description' => $request->input('description'),
            ]);

            if ($documentChanged) {
                SessionPlaceholder::query()
                    ->where('session_id', $session->id)
                    ->delete();

                SessionFile::query()
                    ->where('session_id', $session->id)
                    ->where('is_primary_document', true)
                    ->delete();

                $primarySessionFile = SessionFile::create([
                    'session_id' => $session->id,
                    'source_google_drive_file_id' => $fileMeta['id'] ?? null,
                    'google_drive_file_id' => $signableTarget['signable_meta']['id'] ?? null,
                    'google_drive_parent_id' => $signableTarget['parent_id'],
                    'name' => $fileMeta['name'] ?? trim((string) $request->input('title')),
                    'source_mime_type' => $fileMeta['mimeType'] ?? null,
                    'mime_type' => $signableTarget['signable_meta']['mimeType'] ?? self::GOOGLE_DOC_MIME,
                    'web_view_link' => $signableTarget['signable_meta']['webViewLink'] ?? null,
                    'uploaded_by' => $user->id,
                    'source' => 'docs',
                    'is_converted_for_signing' => (bool) $signableTarget['converted'],
                    'is_primary_document' => true,
                ]);

                foreach ($scanResults['matched'] as $matched) {
                    SessionPlaceholder::create([
                        'session_id' => $session->id,
                        'session_file_id' => $primarySessionFile->id,
                        'registry_placeholder_id' => $matched['registry_placeholder_id'],
                        'placeholder_key' => $matched['placeholder_key'],
                        'raw_token' => $matched['raw_token'],
                        'label' => $matched['label'],
                        'status' => 'unassigned',
                    ]);
                }
            }

            SessionActivity::create([
                'session_id' => $session->id,
                'user_id' => $user->id,
                'type' => $documentChanged ? 'updated_session_document' : 'updated_session',
                'meta_json' => array_filter([
                    'title' => trim((string) $request->input('title')),
                    'document_type' => $request->input('document_type'),
                    'deadline_at' => $request->input('deadline_at'),
                    'primary_document_name' => $fileMeta['name'] ?? null,
                    'matched_placeholders' => $scanResults ? count($scanResults['matched']) : null,
                    'unmatched_placeholders' => $scanResults ? count($scanResults['unmatched']) : null,
                ], static fn ($value) => $value !== null),
            ]);
        });

        $session->refresh()->load([
            'creator:id,name,email',
            'members.user:id,name,email,role,status',
            'placeholders.registryPlaceholder:id,placeholder_key,label,category',
            'placeholders.sessionFile:id,name',
            'placeholders.assignedMember.user:id,name,email',
            'files',
            'activities.user:id,name,email',
        ]);

        return response()->json([
            'success' => true,
            'message' => $documentChanged
                ? 'Session updated and placeholders rescanned successfully.'
                : 'Session updated successfully.',
            'session' => $this->formatSession($session, $user->id, true, $scanResults),
        ]);
    }

    public function destroy(Request $request, int $id)
    {
        $session = DocumentSession::query()
            ->with(['members.user:id,name,email'])
            ->find($id);

        if (!$session) {
            return response()->json([
                'success' => false,
                'message' => 'Session not found.',
            ], 404);
        }

        $membership = $this->getAuthorizedMembership($session, $request->user()->id);
        if (!$membership || !$membership->can_close_session) {
            return response()->json([
                'success' => false,
                'message' => 'You are not allowed to delete this session.',
            ], 403);
        }

        $session->delete();

        return response()->json([
            'success' => true,
            'message' => 'Session deleted successfully.',
        ]);
    }

    public function addMember(Request $request, int $id)
    {
        $session = DocumentSession::query()
            ->with(['members.user:id,name,email,role,status'])
            ->find($id);

        if (!$session) {
            return response()->json([
                'success' => false,
                'message' => 'Session not found.',
            ], 404);
        }

        $actorMembership = $this->getAuthorizedMembership($session, $request->user()->id, true);
        if (!$actorMembership) {
            return response()->json([
                'success' => false,
                'message' => 'You are not allowed to manage session signatories.',
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'user_id' => ['required', 'exists:users,id'],
            'role' => ['required', 'in:signatory,viewer,session_editor'],
            'display_role_name' => ['nullable', 'string', 'max:255'],
            'sign_order' => ['nullable', 'integer', 'min:1', 'max:999'],
            'permissions' => ['nullable', 'array'],
            'permissions.can_view_session' => ['nullable', 'boolean'],
            'permissions.can_view_document' => ['nullable', 'boolean'],
            'permissions.can_sign' => ['nullable', 'boolean'],
            'permissions.can_view_drive_panel' => ['nullable', 'boolean'],
            'permissions.can_add_files' => ['nullable', 'boolean'],
            'permissions.can_remove_files' => ['nullable', 'boolean'],
            'permissions.can_edit_session' => ['nullable', 'boolean'],
            'permissions.can_manage_signatories' => ['nullable', 'boolean'],
            'permissions.can_send_notifications' => ['nullable', 'boolean'],
            'permissions.can_close_session' => ['nullable', 'boolean'],
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation errors.',
                'errors' => $validator->errors(),
            ], 422);
        }

        $targetUser = User::find((int) $request->input('user_id'));
        if (!$targetUser || $targetUser->status !== 'Active') {
            return response()->json([
                'success' => false,
                'message' => 'Selected user is unavailable for session membership.',
            ], 422);
        }

        $existingMember = SessionMember::query()
            ->where('session_id', $session->id)
            ->where('user_id', $targetUser->id)
            ->first();

        if ($existingMember) {
            return response()->json([
                'success' => false,
                'message' => 'This user is already part of the session.',
            ], 409);
        }

        $permissions = $this->buildMemberPermissions(
            (string) $request->input('role'),
            $request->input('permissions', [])
        );

        $session->loadMissing([
            'files',
            'creator',
        ]);

        $member = DB::transaction(function () use ($request, $session, $targetUser, $permissions) {
            $member = SessionMember::create(array_merge([
                'session_id' => $session->id,
                'user_id' => $targetUser->id,
                'role' => (string) $request->input('role'),
                'display_role_name' => $request->input('display_role_name'),
                'sign_order' => $request->input('sign_order'),
                'member_status' => (bool) ($permissions['can_sign'] ?? false) ? 'waiting' : 'viewed',
                'invitation_status' => 'pending',
                'invited_at' => now(),
                'responded_at' => null,
            ], $permissions));

            SessionActivity::create([
                'session_id' => $session->id,
                'user_id' => $request->user()->id,
                'type' => 'added_signatory',
                'meta_json' => [
                    'member_id' => $member->id,
                    'target_user_id' => $targetUser->id,
                    'target_user_name' => $targetUser->name,
                    'role' => $member->role,
                    'display_role_name' => $member->display_role_name,
                    'sign_order' => $member->sign_order,
                ],
            ]);

            UserNotification::create([
                'user_id' => $targetUser->id,
                'type' => 'session_invitation',
                'title' => 'New session invitation',
                'body' => sprintf(
                    '%s invited you to join the session "%s" as %s.',
                    $request->user()->name,
                    $session->title,
                    $member->display_role_name ?: ucfirst(str_replace('_', ' ', $member->role))
                ),
                'data_json' => [
                    'session_id' => $session->id,
                    'session_member_id' => $member->id,
                    'session_title' => $session->title,
                    'invited_by_user_id' => $request->user()->id,
                    'invited_by_name' => $request->user()->name,
                    'role' => $member->role,
                    'display_role_name' => $member->display_role_name,
                ],
            ]);

            return $member;
        });

        try {
            $this->shareSessionFilesWithMember($session, $targetUser, (string) $request->input('role'));
        } catch (RuntimeException $exception) {
            return response()->json([
                'success' => false,
                'message' => 'Session member was added, but Google Drive sharing failed: ' . $exception->getMessage(),
            ], 422);
        }

        $member->load('user:id,name,email,role,status');

        return response()->json([
            'success' => true,
            'message' => 'Session member added successfully.',
            'member' => $this->formatMember($member),
        ], 201);
    }

    public function addFile(Request $request, int $id)
    {
        $session = DocumentSession::query()
            ->with(['members', 'files'])
            ->find($id);

        if (!$session) {
            return response()->json([
                'success' => false,
                'message' => 'Session not found.',
            ], 404);
        }

        $membership = $this->getAuthorizedMembership($session, $request->user()->id);
        if (!$membership || !$membership->can_add_files) {
            return response()->json([
                'success' => false,
                'message' => 'You are not allowed to add files to this session.',
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'google_drive_file_id' => ['required', 'string', 'regex:' . self::GOOGLE_RESOURCE_ID_REGEX],
            'source' => ['nullable', 'in:drive,docs,upload'],
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation errors.',
                'errors' => $validator->errors(),
            ], 422);
        }

        $googleDriveFileId = (string) $request->input('google_drive_file_id');
        $existingFile = $session->files->first(function (SessionFile $file) use ($googleDriveFileId) {
            return $file->google_drive_file_id === $googleDriveFileId
                || $file->source_google_drive_file_id === $googleDriveFileId;
        });
        if ($existingFile) {
            return response()->json([
                'success' => false,
                'message' => 'This file is already attached to the session.',
            ], 409);
        }

        try {
            $fileMeta = $this->googleWorkspaceService->getDriveFileMeta($request->user(), $googleDriveFileId);
            $signableTarget = $this->resolveSignableTarget(
                $request->user(),
                $fileMeta,
                $session->google_drive_folder_id
            );
        } catch (RuntimeException $exception) {
            return response()->json([
                'success' => false,
                'message' => $exception->getMessage(),
            ], 422);
        }

        $scanResults = ['matched' => [], 'unmatched' => []];
        if (($signableTarget['signable_meta']['mimeType'] ?? null) === self::GOOGLE_DOC_MIME && !empty($signableTarget['signable_meta']['id'])) {
            try {
                $document = $this->googleWorkspaceService->getDocument(
                    $request->user(),
                    (string) $signableTarget['signable_meta']['id']
                );
                $scanResults = $this->placeholderScanner->matchRegisteredPlaceholders($document);
            } catch (RuntimeException) {
                $scanResults = ['matched' => [], 'unmatched' => []];
            }
        }

        $sessionFile = DB::transaction(function () use ($request, $session, $fileMeta, $scanResults, $signableTarget) {
            $sessionFile = SessionFile::create([
                'session_id' => $session->id,
                'source_google_drive_file_id' => $fileMeta['id'] ?? null,
                'google_drive_file_id' => $signableTarget['signable_meta']['id'] ?? null,
                'google_drive_parent_id' => $signableTarget['parent_id'],
                'name' => $fileMeta['name'] ?? 'Untitled file',
                'source_mime_type' => $fileMeta['mimeType'] ?? null,
                'mime_type' => $signableTarget['signable_meta']['mimeType'] ?? null,
                'web_view_link' => $signableTarget['signable_meta']['webViewLink'] ?? null,
                'uploaded_by' => $request->user()->id,
                'source' => $request->input('source', 'drive'),
                'is_converted_for_signing' => (bool) $signableTarget['converted'],
                'is_primary_document' => false,
            ]);

            foreach ($scanResults['matched'] as $matched) {
                SessionPlaceholder::create([
                    'session_id' => $session->id,
                    'session_file_id' => $sessionFile->id,
                    'registry_placeholder_id' => $matched['registry_placeholder_id'],
                    'placeholder_key' => $matched['placeholder_key'],
                    'raw_token' => $matched['raw_token'],
                    'label' => $matched['label'],
                    'status' => 'unassigned',
                ]);
            }

            SessionActivity::create([
                'session_id' => $session->id,
                'user_id' => $request->user()->id,
                'type' => 'attached_file',
                'meta_json' => [
                    'session_file_id' => $sessionFile->id,
                    'google_drive_file_id' => $sessionFile->google_drive_file_id,
                    'name' => $sessionFile->name,
                    'matched_placeholders' => count($scanResults['matched']),
                    'converted_for_signing' => (bool) $signableTarget['converted'],
                ],
            ]);

            return $sessionFile;
        });

        $session->loadMissing([
            'creator',
            'members.user:id,name,email',
        ]);

        try {
            $this->shareSessionFileWithMembers($session, $sessionFile);
        } catch (RuntimeException $exception) {
            return response()->json([
                'success' => false,
                'message' => 'The file was attached, but sharing it with invited members failed: ' . $exception->getMessage(),
            ], 422);
        }

        return response()->json([
            'success' => true,
            'message' => 'File attached to the session successfully.',
            'file' => [
                'id' => $sessionFile->id,
                'source_google_drive_file_id' => $sessionFile->source_google_drive_file_id,
                'google_drive_file_id' => $sessionFile->google_drive_file_id,
                'google_drive_parent_id' => $sessionFile->google_drive_parent_id,
                'name' => $sessionFile->name,
                'source_mime_type' => $sessionFile->source_mime_type,
                'mime_type' => $sessionFile->mime_type,
                'web_view_link' => $sessionFile->web_view_link,
                'uploaded_by' => $sessionFile->uploaded_by,
                'source' => $sessionFile->source,
                'is_converted_for_signing' => (bool) $sessionFile->is_converted_for_signing,
                'is_primary_document' => (bool) $sessionFile->is_primary_document,
            ],
        ], 201);
    }

    public function rescanPlaceholders(Request $request, int $id)
    {
        $session = DocumentSession::query()
            ->with(['members', 'files', 'placeholders'])
            ->find($id);

        if (!$session) {
            return response()->json([
                'success' => false,
                'message' => 'Session not found.',
            ], 404);
        }

        $membership = $this->getAuthorizedMembership($session, $request->user()->id, true);
        if (!$membership) {
            return response()->json([
                'success' => false,
                'message' => 'You are not allowed to rescan placeholders for this session.',
            ], 403);
        }

        $allMatched = [];
        $allUnmatched = [];
        $createdCount = 0;
        $removedCount = 0;

        DB::transaction(function () use (
            $request,
            $session,
            &$allMatched,
            &$allUnmatched,
            &$createdCount,
            &$removedCount
        ) {
            foreach ($session->files as $file) {
                if (($file->mime_type ?? null) !== self::GOOGLE_DOC_MIME || empty($file->google_drive_file_id)) {
                    continue;
                }

                $document = $this->googleWorkspaceService->getDocument(
                    $request->user(),
                    (string) $file->google_drive_file_id
                );

                $scanResults = $this->placeholderScanner->matchRegisteredPlaceholders($document);
                $allMatched = array_merge($allMatched, $scanResults['matched']);
                $allUnmatched = array_merge($allUnmatched, $scanResults['unmatched']);

                $existingPlaceholders = SessionPlaceholder::query()
                    ->where('session_id', $session->id)
                    ->where('session_file_id', $file->id)
                    ->get()
                    ->keyBy(fn (SessionPlaceholder $placeholder) => strtoupper((string) $placeholder->raw_token));

                $seenTokens = [];

                foreach ($scanResults['matched'] as $matched) {
                    $tokenKey = strtoupper((string) ($matched['raw_token'] ?? ''));
                    if ($tokenKey === '' || in_array($tokenKey, $seenTokens, true)) {
                        continue;
                    }

                    $seenTokens[] = $tokenKey;
                    $existing = $existingPlaceholders->get($tokenKey);

                    if ($existing) {
                        $existing->update([
                            'registry_placeholder_id' => $matched['registry_placeholder_id'],
                            'placeholder_key' => $matched['placeholder_key'],
                            'raw_token' => $matched['raw_token'],
                            'label' => $matched['label'],
                        ]);
                        continue;
                    }

                    SessionPlaceholder::create([
                        'session_id' => $session->id,
                        'session_file_id' => $file->id,
                        'registry_placeholder_id' => $matched['registry_placeholder_id'],
                        'placeholder_key' => $matched['placeholder_key'],
                        'raw_token' => $matched['raw_token'],
                        'label' => $matched['label'],
                        'status' => 'unassigned',
                    ]);

                    $createdCount++;
                }

                foreach ($existingPlaceholders as $tokenKey => $existing) {
                    if (in_array($tokenKey, $seenTokens, true)) {
                        continue;
                    }

                    if ($existing->status === 'signed' || $existing->assigned_member_id) {
                        continue;
                    }

                    $existing->delete();
                    $removedCount++;
                }
            }

            SessionActivity::create([
                'session_id' => $session->id,
                'user_id' => $request->user()->id,
                'type' => 'rescanned_placeholders',
                'meta_json' => [
                    'matched_placeholders' => count($allMatched),
                    'unmatched_placeholders' => count($allUnmatched),
                    'created_placeholders' => $createdCount,
                    'removed_placeholders' => $removedCount,
                ],
            ]);
        });

        $session->load([
            'creator:id,name,email',
            'members.user:id,name,email,role,status',
            'placeholders.registryPlaceholder:id,placeholder_key,label,category',
            'placeholders.sessionFile:id,name',
            'placeholders.assignedMember.user:id,name,email',
            'files',
            'activities.user:id,name,email',
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Session placeholders rescanned successfully.',
            'session' => $this->formatSession($session, $request->user()->id, true, [
                'matched' => array_values($allMatched),
                'unmatched' => array_values($allUnmatched),
            ]),
        ]);
    }

    public function signPlaceholder(Request $request, int $id)
    {
        $session = DocumentSession::query()
            ->with([
                'creator',
                'members',
                'placeholders.sessionFile',
                'files',
            ])
            ->find($id);

        if (!$session) {
            return response()->json([
                'success' => false,
                'message' => 'Session not found.',
            ], 404);
        }

        $membership = $this->getAuthorizedMembership($session, $request->user()->id);
        if (!$membership || !$membership->can_sign) {
            return response()->json([
                'success' => false,
                'message' => 'You are not allowed to sign in this session.',
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'placeholder_id' => ['required', 'integer', 'exists:session_placeholders,id'],
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation errors.',
                'errors' => $validator->errors(),
            ], 422);
        }

        $placeholder = SessionPlaceholder::query()
            ->with('sessionFile')
            ->where('session_id', $session->id)
            ->find((int) $request->input('placeholder_id'));

        if (!$placeholder) {
            return response()->json([
                'success' => false,
                'message' => 'Placeholder not found in this session.',
            ], 404);
        }

        $isCreator = $membership->role === 'session_admin';

        if (!$isCreator && (int) $placeholder->assigned_member_id !== (int) $membership->id) {
            return response()->json([
                'success' => false,
                'message' => 'This placeholder is not assigned to your account.',
            ], 403);
        }

        if ($isCreator) {
            $creatorSignedOtherPlaceholder = SessionPlaceholder::query()
                ->where('session_id', $session->id)
                ->where('signed_by_user_id', $request->user()->id)
                ->where('id', '!=', $placeholder->id)
                ->exists();

            if ($creatorSignedOtherPlaceholder) {
                return response()->json([
                    'success' => false,
                    'message' => 'The creator can only sign one placeholder in this session.',
                ], 422);
            }

            if (
                $placeholder->assigned_member_id
                && (int) $placeholder->assigned_member_id !== (int) $membership->id
            ) {
                return response()->json([
                    'success' => false,
                    'message' => 'This placeholder is already assigned to another signatory.',
                ], 422);
            }
        }

        if ($placeholder->status === 'signed') {
            return response()->json([
                'success' => false,
                'message' => 'This placeholder has already been signed.',
            ], 422);
        }

        $signatureAsset = UserSignatureAsset::query()
            ->where('user_id', $request->user()->id)
            ->where('is_active', true)
            ->latest()
            ->first();

        if (!$signatureAsset) {
            return response()->json([
                'success' => false,
                'message' => 'No active signature is configured in your account yet.',
            ], 422);
        }

        $documentFile = $placeholder->sessionFile
            ?: $session->files->firstWhere('is_primary_document', true)
            ?: $session->files->first();

        if (!$documentFile?->google_drive_file_id) {
            return response()->json([
                'success' => false,
                'message' => 'The session document is not available for signing.',
            ], 422);
        }

        if (($documentFile->mime_type ?? '') !== self::GOOGLE_DOC_MIME) {
            return response()->json([
                'success' => false,
                'message' => 'Only Google Docs files can receive inline signature replacement.',
            ], 422);
        }

        $imageUrl = $signatureAsset->drive_public_url;

        if (!$imageUrl && $signatureAsset->drive_file_id) {
            $imageUrl = $this->googleWorkspaceService->getDrivePublicImageUrl($signatureAsset->drive_file_id);
        }

        if (!$imageUrl) {
            return response()->json([
                'success' => false,
                'message' => 'Your active signature has not been synced to Google Drive yet. Re-save it in Account and try again.',
            ], 422);
        }

        try {
            $documentOwner = User::find($session->created_by);

            if (!$documentOwner) {
                return response()->json([
                    'success' => false,
                    'message' => 'The session creator could not be resolved for Google Docs signing.',
                ], 422);
            }

            $this->googleWorkspaceService->replaceDocumentPlaceholderWithImage(
                $documentOwner,
                (string) $documentFile->google_drive_file_id,
                (string) $placeholder->raw_token,
                $imageUrl
            );
        } catch (RuntimeException $exception) {
            return response()->json([
                'success' => false,
                'message' => $exception->getMessage(),
            ], 422);
        }

        DB::transaction(function () use ($request, $session, $membership, $placeholder, $signatureAsset, $isCreator) {
            $placeholder->update([
                'assigned_member_id' => $placeholder->assigned_member_id ?: $membership->id,
                'status' => 'signed',
                'signed_by_user_id' => $request->user()->id,
                'signature_asset_id' => null,
                'signed_at' => now(),
            ]);

            $remaining = SessionPlaceholder::query()
                ->where('session_id', $session->id)
                ->where('assigned_member_id', $membership->id)
                ->where('status', '!=', 'signed')
                ->count();

            $membership->update([
                'member_status' => ($remaining === 0 || $isCreator) ? 'signed' : 'pending',
                'signed_at' => ($remaining === 0 || $isCreator) ? now() : $membership->signed_at,
            ]);

            SessionActivity::create([
                'session_id' => $session->id,
                'user_id' => $request->user()->id,
                'type' => 'signed',
                'meta_json' => [
                    'placeholder_id' => $placeholder->id,
                    'placeholder_key' => $placeholder->placeholder_key,
                    'session_file_id' => $placeholder->session_file_id,
                ],
            ]);
        });

        return response()->json([
            'success' => true,
            'message' => 'Signature applied successfully.',
        ]);
    }

    public function updateMember(Request $request, int $id, int $memberId)
    {
        $session = DocumentSession::query()
            ->with('members')
            ->find($id);

        if (!$session) {
            return response()->json([
                'success' => false,
                'message' => 'Session not found.',
            ], 404);
        }

        $actorMembership = $this->getAuthorizedMembership($session, $request->user()->id, true);
        if (!$actorMembership) {
            return response()->json([
                'success' => false,
                'message' => 'You are not allowed to manage session signatories.',
            ], 403);
        }

        $member = SessionMember::query()
            ->where('session_id', $session->id)
            ->find($memberId);

        if (!$member) {
            return response()->json([
                'success' => false,
                'message' => 'Session member not found.',
            ], 404);
        }

        if ($member->role === 'session_admin') {
            return response()->json([
                'success' => false,
                'message' => 'Session admin permissions cannot be edited here.',
            ], 422);
        }

        $validator = Validator::make($request->all(), [
            'role' => ['sometimes', 'in:signatory,viewer,session_editor'],
            'display_role_name' => ['nullable', 'string', 'max:255'],
            'sign_order' => ['nullable', 'integer', 'min:1', 'max:999'],
            'member_status' => ['sometimes', 'in:waiting,pending,accepted,signed,viewed'],
            'permissions' => ['nullable', 'array'],
            'permissions.can_view_session' => ['nullable', 'boolean'],
            'permissions.can_view_document' => ['nullable', 'boolean'],
            'permissions.can_sign' => ['nullable', 'boolean'],
            'permissions.can_view_drive_panel' => ['nullable', 'boolean'],
            'permissions.can_add_files' => ['nullable', 'boolean'],
            'permissions.can_remove_files' => ['nullable', 'boolean'],
            'permissions.can_edit_session' => ['nullable', 'boolean'],
            'permissions.can_manage_signatories' => ['nullable', 'boolean'],
            'permissions.can_send_notifications' => ['nullable', 'boolean'],
            'permissions.can_close_session' => ['nullable', 'boolean'],
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation errors.',
                'errors' => $validator->errors(),
            ], 422);
        }

        $nextRole = (string) $request->input('role', $member->role);
        $permissions = $this->buildMemberPermissions($nextRole, $request->input('permissions', []), $member);

        DB::transaction(function () use ($request, $session, $member, $nextRole, $permissions) {
            $member->update(array_merge([
                'role' => $nextRole,
                'display_role_name' => $request->has('display_role_name')
                    ? $request->input('display_role_name')
                    : $member->display_role_name,
                'sign_order' => $request->has('sign_order')
                    ? $request->input('sign_order')
                    : $member->sign_order,
                'member_status' => $request->input('member_status', $member->member_status),
            ], $permissions));

            if (!$member->can_sign) {
                SessionPlaceholder::query()
                    ->where('session_id', $session->id)
                    ->where('assigned_member_id', $member->id)
                    ->where('status', '!=', 'signed')
                    ->update([
                        'assigned_member_id' => null,
                        'status' => 'unassigned',
                    ]);
            }
        });

        SessionActivity::create([
            'session_id' => $session->id,
            'user_id' => $request->user()->id,
            'type' => 'updated_signatory',
            'meta_json' => [
                'member_id' => $member->id,
                'target_user_id' => $member->user_id,
                'role' => $member->role,
                'display_role_name' => $member->display_role_name,
                'sign_order' => $member->sign_order,
                'member_status' => $member->member_status,
            ],
        ]);

        $member->load('user:id,name,email,role,status');

        return response()->json([
            'success' => true,
            'message' => 'Session member updated successfully.',
            'member' => $this->formatMember($member),
        ]);
    }

    public function destroyMember(Request $request, int $id, int $memberId)
    {
        $session = DocumentSession::query()
            ->with('members')
            ->find($id);

        if (!$session) {
            return response()->json([
                'success' => false,
                'message' => 'Session not found.',
            ], 404);
        }

        $actorMembership = $this->getAuthorizedMembership($session, $request->user()->id, true);
        if (!$actorMembership) {
            return response()->json([
                'success' => false,
                'message' => 'You are not allowed to manage session signatories.',
            ], 403);
        }

        $member = SessionMember::query()
            ->where('session_id', $session->id)
            ->find($memberId);

        if (!$member) {
            return response()->json([
                'success' => false,
                'message' => 'Session member not found.',
            ], 404);
        }

        if ($member->role === 'session_admin') {
            return response()->json([
                'success' => false,
                'message' => 'The session creator cannot be removed from the session.',
            ], 422);
        }

        DB::transaction(function () use ($request, $session, $member) {
            SessionPlaceholder::query()
                ->where('session_id', $session->id)
                ->where('assigned_member_id', $member->id)
                ->where('status', '!=', 'signed')
                ->update([
                    'assigned_member_id' => null,
                    'status' => 'unassigned',
                ]);

            SessionActivity::create([
                'session_id' => $session->id,
                'user_id' => $request->user()->id,
                'type' => 'updated_signatory',
                'meta_json' => [
                    'member_id' => $member->id,
                    'target_user_id' => $member->user_id,
                    'action' => 'removed',
                ],
            ]);

            $member->delete();
        });

        return response()->json([
            'success' => true,
            'message' => 'Session member removed successfully.',
        ]);
    }

    public function assignPlaceholder(Request $request, int $id, int $placeholderId)
    {
        $session = DocumentSession::query()
            ->with(['members', 'placeholders'])
            ->find($id);

        if (!$session) {
            return response()->json([
                'success' => false,
                'message' => 'Session not found.',
            ], 404);
        }

        $actorMembership = $this->getAuthorizedMembership($session, $request->user()->id, true);
        if (!$actorMembership) {
            return response()->json([
                'success' => false,
                'message' => 'You are not allowed to assign placeholders.',
            ], 403);
        }

        $placeholder = SessionPlaceholder::query()
            ->where('session_id', $session->id)
            ->find($placeholderId);

        if (!$placeholder) {
            return response()->json([
                'success' => false,
                'message' => 'Session placeholder not found.',
            ], 404);
        }

        if ($placeholder->status === 'signed') {
            return response()->json([
                'success' => false,
                'message' => 'Signed placeholders cannot be reassigned.',
            ], 422);
        }

        $validator = Validator::make($request->all(), [
            'assigned_member_id' => ['required', 'integer', 'exists:session_members,id'],
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation errors.',
                'errors' => $validator->errors(),
            ], 422);
        }

        $member = SessionMember::query()
            ->where('session_id', $session->id)
            ->find((int) $request->input('assigned_member_id'));

        if (!$member) {
            return response()->json([
                'success' => false,
                'message' => 'Assigned member does not belong to this session.',
            ], 422);
        }

        if (!$member->can_sign) {
            return response()->json([
                'success' => false,
                'message' => 'Selected session member does not have signing permission.',
            ], 422);
        }

        $member->loadMissing('user:id,name,email');

        DB::transaction(function () use ($session, $placeholder, $member) {
            SessionPlaceholder::query()
                ->where('session_id', $session->id)
                ->where('assigned_member_id', $member->id)
                ->where('id', '!=', $placeholder->id)
                ->where('status', '!=', 'signed')
                ->update([
                    'assigned_member_id' => null,
                    'status' => 'unassigned',
                ]);

            $placeholder->update([
                'assigned_member_id' => $member->id,
                'status' => 'assigned',
            ]);

            if ($member->member_status === 'waiting') {
                $member->update([
                    'member_status' => 'pending',
                ]);
            }
        });

        SessionActivity::create([
            'session_id' => $session->id,
            'user_id' => $request->user()->id,
            'type' => 'assigned_placeholder',
            'meta_json' => [
                'placeholder_id' => $placeholder->id,
                'placeholder_key' => $placeholder->placeholder_key,
                'assigned_member_id' => $member->id,
                'assigned_user_id' => $member->user_id,
                'assigned_user_name' => $member->user?->name,
            ],
        ]);

        $placeholder->load(['assignedMember.user:id,name,email', 'registryPlaceholder:id,placeholder_key,label,category']);

        return response()->json([
            'success' => true,
            'message' => 'Placeholder assigned successfully.',
            'placeholder' => $this->formatPlaceholder($placeholder),
        ]);
    }

    public function unassignPlaceholder(Request $request, int $id, int $placeholderId)
    {
        $session = DocumentSession::query()
            ->with('members')
            ->find($id);

        if (!$session) {
            return response()->json([
                'success' => false,
                'message' => 'Session not found.',
            ], 404);
        }

        $actorMembership = $this->getAuthorizedMembership($session, $request->user()->id, true);
        if (!$actorMembership) {
            return response()->json([
                'success' => false,
                'message' => 'You are not allowed to assign placeholders.',
            ], 403);
        }

        $placeholder = SessionPlaceholder::query()
            ->where('session_id', $session->id)
            ->find($placeholderId);

        if (!$placeholder) {
            return response()->json([
                'success' => false,
                'message' => 'Session placeholder not found.',
            ], 404);
        }

        if ($placeholder->status === 'signed') {
            return response()->json([
                'success' => false,
                'message' => 'Signed placeholders cannot be unassigned.',
            ], 422);
        }

        $previousMemberId = $placeholder->assigned_member_id;

        $placeholder->update([
            'assigned_member_id' => null,
            'status' => 'unassigned',
        ]);

        SessionActivity::create([
            'session_id' => $session->id,
            'user_id' => $request->user()->id,
            'type' => 'unassigned_placeholder',
            'meta_json' => [
                'placeholder_id' => $placeholder->id,
                'placeholder_key' => $placeholder->placeholder_key,
                'previous_member_id' => $previousMemberId,
            ],
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Placeholder unassigned successfully.',
        ]);
    }

    private function getAuthorizedMembership(DocumentSession $session, int $userId, bool $requireManageSignatories = false): ?SessionMember
    {
        $membership = $session->relationLoaded('members')
            ? $session->members->firstWhere('user_id', $userId)
            : SessionMember::query()
                ->where('session_id', $session->id)
                ->where('user_id', $userId)
                ->first();

        if (!$membership || !$membership->can_view_session) {
            return null;
        }

        if ($membership->invitation_status !== 'accepted') {
            return null;
        }

        if ($requireManageSignatories && !$membership->can_manage_signatories) {
            return null;
        }

        return $membership;
    }

    private function buildMemberPermissions(string $role, array $overrides = [], ?SessionMember $existingMember = null): array
    {
        $base = match ($role) {
            'viewer' => [
                'can_view_session' => true,
                'can_view_document' => true,
                'can_sign' => false,
                'can_view_drive_panel' => false,
                'can_add_files' => false,
                'can_remove_files' => false,
                'can_edit_session' => false,
                'can_manage_signatories' => false,
                'can_send_notifications' => false,
                'can_close_session' => false,
            ],
            'session_editor' => [
                'can_view_session' => true,
                'can_view_document' => true,
                'can_sign' => true,
                'can_view_drive_panel' => true,
                'can_add_files' => true,
                'can_remove_files' => false,
                'can_edit_session' => true,
                'can_manage_signatories' => false,
                'can_send_notifications' => false,
                'can_close_session' => false,
            ],
            default => [
                'can_view_session' => true,
                'can_view_document' => true,
                'can_sign' => true,
                'can_view_drive_panel' => false,
                'can_add_files' => false,
                'can_remove_files' => false,
                'can_edit_session' => false,
                'can_manage_signatories' => false,
                'can_send_notifications' => false,
                'can_close_session' => false,
            ],
        };

        if ($existingMember) {
            $base = array_merge($base, [
                'can_view_session' => (bool) $existingMember->can_view_session,
                'can_view_document' => (bool) $existingMember->can_view_document,
                'can_sign' => (bool) $existingMember->can_sign,
                'can_view_drive_panel' => (bool) $existingMember->can_view_drive_panel,
                'can_add_files' => (bool) $existingMember->can_add_files,
                'can_remove_files' => (bool) $existingMember->can_remove_files,
                'can_edit_session' => (bool) $existingMember->can_edit_session,
                'can_manage_signatories' => (bool) $existingMember->can_manage_signatories,
                'can_send_notifications' => (bool) $existingMember->can_send_notifications,
                'can_close_session' => (bool) $existingMember->can_close_session,
            ]);
        }

        foreach ($overrides as $key => $value) {
            if (array_key_exists($key, $base)) {
                $base[$key] = (bool) $value;
            }
        }

        return $base;
    }

    private function formatMember(SessionMember $member): array
    {
        return [
            'id' => $member->id,
            'user_id' => $member->user_id,
            'name' => $member->user?->name,
            'email' => $member->user?->email,
            'role' => $member->role,
            'display_role_name' => $member->display_role_name,
            'sign_order' => $member->sign_order,
            'member_status' => $member->member_status,
            'invitation_status' => $member->invitation_status,
            'invited_at' => $member->invited_at?->toIso8601String(),
            'responded_at' => $member->responded_at?->toIso8601String(),
            'signed_at' => $member->signed_at?->toIso8601String(),
            'permissions' => [
                'can_view_session' => (bool) $member->can_view_session,
                'can_view_document' => (bool) $member->can_view_document,
                'can_sign' => (bool) $member->can_sign,
                'can_view_drive_panel' => (bool) $member->can_view_drive_panel,
                'can_add_files' => (bool) $member->can_add_files,
                'can_remove_files' => (bool) $member->can_remove_files,
                'can_edit_session' => (bool) $member->can_edit_session,
                'can_manage_signatories' => (bool) $member->can_manage_signatories,
                'can_send_notifications' => (bool) $member->can_send_notifications,
                'can_close_session' => (bool) $member->can_close_session,
            ],
        ];
    }

    private function formatPlaceholder(SessionPlaceholder $placeholder): array
    {
        return [
            'id' => $placeholder->id,
            'registry_placeholder_id' => $placeholder->registry_placeholder_id,
            'session_file_id' => $placeholder->session_file_id,
            'session_file_name' => $placeholder->sessionFile?->name,
            'placeholder_key' => $placeholder->placeholder_key,
            'raw_token' => $placeholder->raw_token,
            'label' => $placeholder->label,
            'status' => $placeholder->status,
            'assigned_member_id' => $placeholder->assigned_member_id,
            'assigned_user_id' => $placeholder->assignedMember?->user_id,
            'assigned_user_name' => $placeholder->assignedMember?->user?->name,
            'signed_by_user_id' => $placeholder->signed_by_user_id,
            'signature_asset_id' => $placeholder->signature_asset_id,
            'signed_at' => $placeholder->signed_at?->toIso8601String(),
            'category' => $placeholder->registryPlaceholder?->category,
        ];
    }

    private function formatSession(
        DocumentSession $session,
        int $currentUserId,
        bool $includeRelations = false,
        ?array $scanResults = null
    ): array {
        $membership = $session->relationLoaded('members')
            ? $session->members->firstWhere('user_id', $currentUserId)
            : null;

        $payload = [
            'id' => $session->id,
            'title' => $session->title,
            'document_type' => $session->document_type,
            'status' => $session->status,
            'description' => $session->description,
            'google_doc_file_id' => $session->google_doc_file_id,
            'google_drive_folder_id' => $session->google_drive_folder_id,
            'deadline_at' => $session->deadline_at?->toIso8601String(),
            'allow_delegated_editing' => (bool) $session->allow_delegated_editing,
            'created_at' => $session->created_at?->toIso8601String(),
            'updated_at' => $session->updated_at?->toIso8601String(),
            'creator' => $session->relationLoaded('creator') && $session->creator
                ? [
                    'id' => $session->creator->id,
                    'name' => $session->creator->name,
                    'email' => $session->creator->email,
                ]
                : null,
            'current_member' => $membership ? [
                'id' => $membership->id,
                'user_id' => $membership->user_id,
                'role' => $membership->role,
                'display_role_name' => $membership->display_role_name,
                'member_status' => $membership->member_status,
                'invitation_status' => $membership->invitation_status,
                'invited_at' => $membership->invited_at?->toIso8601String(),
                'responded_at' => $membership->responded_at?->toIso8601String(),
                'permissions' => [
                    'can_view_session' => (bool) $membership->can_view_session,
                    'can_view_document' => (bool) $membership->can_view_document,
                    'can_sign' => (bool) $membership->can_sign,
                    'can_view_drive_panel' => (bool) $membership->can_view_drive_panel,
                    'can_add_files' => (bool) $membership->can_add_files,
                    'can_remove_files' => (bool) $membership->can_remove_files,
                    'can_edit_session' => (bool) $membership->can_edit_session,
                    'can_manage_signatories' => (bool) $membership->can_manage_signatories,
                    'can_send_notifications' => (bool) $membership->can_send_notifications,
                    'can_close_session' => (bool) $membership->can_close_session,
                ],
            ] : null,
        ];

        $primaryFile = $session->relationLoaded('files')
            ? $session->files->firstWhere('is_primary_document', true)
            : null;

        $payload['primary_document'] = $primaryFile ? [
            'id' => $primaryFile->id,
            'source_google_drive_file_id' => $primaryFile->source_google_drive_file_id,
            'google_drive_file_id' => $primaryFile->google_drive_file_id,
            'name' => $primaryFile->name,
            'mime_type' => $primaryFile->mime_type,
            'source_mime_type' => $primaryFile->source_mime_type,
            'web_view_link' => $primaryFile->web_view_link,
        ] : null;

        if (!$includeRelations) {
            $payload['placeholder_counts'] = [
                'total' => $session->relationLoaded('placeholders') ? $session->placeholders->count() : 0,
                'assigned' => $session->relationLoaded('placeholders')
                    ? $session->placeholders->where('status', 'assigned')->count()
                    : 0,
                'signed' => $session->relationLoaded('placeholders')
                    ? $session->placeholders->where('status', 'signed')->count()
                    : 0,
            ];

            return $payload;
        }

        $payload['members'] = $session->relationLoaded('members')
            ? $session->members->map(fn (SessionMember $member) => $this->formatMember($member))->values()
            : [];

        $payload['placeholders'] = $session->relationLoaded('placeholders')
            ? $session->placeholders->map(fn (SessionPlaceholder $placeholder) => $this->formatPlaceholder($placeholder))->values()
            : [];

        $payload['files'] = $session->relationLoaded('files')
            ? $session->files->map(function (SessionFile $file) {
                return [
                    'id' => $file->id,
                    'source_google_drive_file_id' => $file->source_google_drive_file_id,
                    'google_drive_file_id' => $file->google_drive_file_id,
                    'google_drive_parent_id' => $file->google_drive_parent_id,
                    'name' => $file->name,
                    'source_mime_type' => $file->source_mime_type,
                    'mime_type' => $file->mime_type,
                    'web_view_link' => $file->web_view_link,
                    'uploaded_by' => $file->uploaded_by,
                    'source' => $file->source,
                    'is_converted_for_signing' => (bool) $file->is_converted_for_signing,
                    'is_primary_document' => (bool) $file->is_primary_document,
                ];
            })->values()
            : [];

        $payload['activities'] = $session->relationLoaded('activities')
            ? $session->activities->map(function (SessionActivity $activity) {
                return [
                    'id' => $activity->id,
                    'type' => $activity->type,
                    'user_id' => $activity->user_id,
                    'user_name' => $activity->user?->name,
                    'meta' => $activity->meta_json,
                    'created_at' => $activity->created_at?->toIso8601String(),
                ];
            })->values()
            : [];

        $payload['scan_results'] = $scanResults;

        return $payload;
    }

    private function resolveSignableTarget(User $user, array $sourceMeta, ?string $fallbackParentId = null): array
    {
        $sourceMimeType = (string) ($sourceMeta['mimeType'] ?? '');
        $parentId = (string) (($sourceMeta['parents'][0] ?? $fallbackParentId) ?: '');

        if ($sourceMimeType === self::GOOGLE_DOC_MIME) {
            return [
                'converted' => false,
                'parent_id' => $parentId ?: null,
                'signable_meta' => $sourceMeta,
            ];
        }

        if (!$this->isWordDocumentMime($sourceMimeType)) {
            throw new RuntimeException('Only Google Docs and Microsoft Word documents are currently supported for signable session files.');
        }

        $convertedMeta = $this->googleWorkspaceService->createGoogleDocFromDriveFile(
            $user,
            (string) ($sourceMeta['id'] ?? ''),
            $parentId ?: null
        );

        return [
            'converted' => true,
            'parent_id' => $parentId ?: null,
            'signable_meta' => $convertedMeta,
        ];
    }

    private function isWordDocumentMime(string $mimeType): bool
    {
        return in_array($mimeType, [
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/msword',
        ], true);
    }

    private function shareSessionFilesWithMember(DocumentSession $session, User $targetUser, string $role): void
    {
        $session->loadMissing('files', 'creator');

        foreach ($session->files as $file) {
            $this->shareGoogleDriveFileToUser(
                $session,
                (string) $file->google_drive_file_id,
                $targetUser,
                $role
            );
        }
    }

    private function shareSessionFileWithMembers(DocumentSession $session, SessionFile $sessionFile): void
    {
        $session->loadMissing('members.user', 'creator');

        foreach ($session->members as $member) {
            if (
                (int) $member->user_id === (int) $session->created_by
                || !$member->can_view_document
                || !in_array((string) $member->invitation_status, ['pending', 'accepted'], true)
            ) {
                continue;
            }

            if (!$member->user?->email) {
                continue;
            }

            $this->shareGoogleDriveFileToUser(
                $session,
                (string) $sessionFile->google_drive_file_id,
                $member->user,
                (string) $member->role
            );
        }
    }

    private function shareGoogleDriveFileToUser(DocumentSession $session, string $fileId, User $targetUser, string $role): void
    {
        $fileId = trim($fileId);
        if ($fileId === '' || !$targetUser->email) {
            return;
        }

        $owner = User::find($session->created_by);

        if (!$owner instanceof User) {
            throw new RuntimeException('Session creator could not be resolved for Google Drive sharing.');
        }

        $shareRole = $role === 'session_editor' ? 'writer' : 'reader';

        $this->googleWorkspaceService->ensureDriveFileShared(
            $owner,
            $fileId,
            (string) $targetUser->email,
            $shareRole,
            false
        );
    }
}
