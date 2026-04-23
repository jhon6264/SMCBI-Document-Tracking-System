<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\GoogleWorkspaceService;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Validator;
use RuntimeException;

class UserGoogleWorkspaceController extends Controller
{
    private const GOOGLE_RESOURCE_ID_REGEX = '/^[A-Za-z0-9_-]{10,200}$/';

    public function __construct(private readonly GoogleWorkspaceService $googleWorkspaceService)
    {
    }

    public function connect(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'access_token' => ['required', 'string'],
            'refresh_token' => ['nullable', 'string'],
            'expires_in' => ['nullable', 'integer', 'min:60'],
            'scope' => ['nullable'],
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation errors.',
                'errors' => $validator->errors(),
            ], 422);
        }

        $user = $request->user();
        $scope = $request->input('scope');
        $scopes = [];

        if (is_string($scope) && trim($scope) !== '') {
            $scopes = preg_split('/\s+/', trim($scope)) ?: [];
        } elseif (is_array($scope)) {
            $scopes = Arr::where($scope, fn ($item) => is_string($item) && trim($item) !== '');
        }

        $user->google_access_token = $request->access_token;

        if ($request->filled('refresh_token')) {
            $user->google_refresh_token = $request->refresh_token;
        }

        if ($request->filled('expires_in')) {
            $user->google_token_expires_at = now()->addSeconds((int) $request->expires_in);
        }

        if (!empty($scopes)) {
            $user->google_token_scopes = array_values(array_unique($scopes));
        }

        $user->save();
        $this->googleWorkspaceService->invalidateUserCache($user);

        return response()->json([
            'success' => true,
            'message' => 'Google Workspace connected successfully.',
            'status' => $this->googleWorkspaceService->getAuthStatus($user),
        ]);
    }

    public function connectCode(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'code' => ['required', 'string'],
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation errors.',
                'errors' => $validator->errors(),
            ], 422);
        }

        try {
            $tokenPayload = $this->googleWorkspaceService->exchangeAuthorizationCode(
                $request->code
            );
        } catch (RuntimeException $exception) {
            return response()->json([
                'success' => false,
                'message' => $exception->getMessage(),
            ], 422);
        }

        $user = $request->user();
        $scope = $tokenPayload['scope'] ?? null;
        $scopes = [];

        if (is_string($scope) && trim($scope) !== '') {
            $scopes = preg_split('/\s+/', trim($scope)) ?: [];
        }

        $user->google_access_token = (string) ($tokenPayload['access_token'] ?? '');

        if (!empty($tokenPayload['refresh_token'])) {
            $user->google_refresh_token = (string) $tokenPayload['refresh_token'];
        }

        if (!empty($tokenPayload['expires_in'])) {
            $user->google_token_expires_at = now()->addSeconds((int) $tokenPayload['expires_in']);
        }

        if (!empty($scopes)) {
            $user->google_token_scopes = array_values(array_unique($scopes));
        }

        $user->save();
        $this->googleWorkspaceService->invalidateUserCache($user);

        return response()->json([
            'success' => true,
            'message' => 'Google Workspace connected successfully.',
            'status' => $this->googleWorkspaceService->getAuthStatus($user),
        ]);
    }

    public function status(Request $request)
    {
        return response()->json([
            'success' => true,
            'status' => $this->googleWorkspaceService->getAuthStatus($request->user()),
        ]);
    }

    public function disconnect(Request $request)
    {
        $user = $request->user();
        $user->google_access_token = null;
        $user->google_refresh_token = null;
        $user->google_token_expires_at = null;
        $user->google_token_scopes = null;
        $user->save();

        $this->googleWorkspaceService->invalidateUserCache($user);

        return response()->json([
            'success' => true,
            'message' => 'Google Workspace disconnected.',
            'status' => $this->googleWorkspaceService->getAuthStatus($user),
        ]);
    }

    public function driveFiles(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'pageSize' => ['nullable', 'integer', 'min:1', 'max:1000'],
            'search' => ['nullable', 'string', 'max:120'],
            'parentId' => ['nullable', 'string', 'regex:' . self::GOOGLE_RESOURCE_ID_REGEX],
            'section' => ['nullable', 'in:my-drive,shared,recent,starred,trash'],
            'force' => ['nullable', 'boolean'],
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation errors.',
                'errors' => $validator->errors(),
            ], 422);
        }

        try {
            $files = $this->googleWorkspaceService->listDriveFilesByQuery(
                $request->user(),
                (int) $request->integer('pageSize', 20)
                ,
                $request->input('search'),
                $request->input('parentId'),
                $request->input('section', 'my-drive'),
                (bool) $request->boolean('force')
            );

            return response()->json([
                'success' => true,
                'data' => $files['data'] ?? [],
                'meta' => $files['meta'] ?? null,
            ]);
        } catch (RuntimeException $exception) {
            return response()->json([
                'success' => false,
                'message' => $exception->getMessage(),
            ], 422);
        }
    }

    public function drivePreview(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'file_id' => ['required', 'string', 'regex:' . self::GOOGLE_RESOURCE_ID_REGEX],
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation errors.',
                'errors' => $validator->errors(),
            ], 422);
        }

        try {
            $preview = $this->googleWorkspaceService->getDrivePreviewContent(
                $request->user(),
                $request->input('file_id')
            );

            return response($preview['content'] ?? '', 200, [
                'Content-Type' => $preview['content_type'] ?? 'application/pdf',
                'Content-Disposition' => 'inline; filename="' . ($preview['filename'] ?? 'preview.pdf') . '"',
                'Cache-Control' => 'private, max-age=300',
            ]);
        } catch (RuntimeException $exception) {
            $message = (string) $exception->getMessage();
            $safeMessage = @iconv('UTF-8', 'UTF-8//IGNORE', $message);
            if (!is_string($safeMessage) || trim($safeMessage) === '') {
                $safeMessage = 'Unable to preview this file.';
            }
            return response()->json([
                'success' => false,
                'message' => $safeMessage,
            ], 422);
        } catch (\Throwable $exception) {
            return response()->json([
                'success' => false,
                'message' => 'Unable to preview this file.',
            ], 500);
        }
    }

    public function driveFileMeta(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'file_id' => ['required', 'string', 'regex:' . self::GOOGLE_RESOURCE_ID_REGEX],
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation errors.',
                'errors' => $validator->errors(),
            ], 422);
        }

        try {
            $meta = $this->googleWorkspaceService->getDriveFileMeta(
                $request->user(),
                (string) $request->input('file_id')
            );

            return response()->json([
                'success' => true,
                'data' => $meta,
            ]);
        } catch (RuntimeException $exception) {
            return response()->json([
                'success' => false,
                'message' => $exception->getMessage(),
            ], 422);
        }
    }

    public function driveCreateFolder(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => ['required', 'string', 'max:120'],
            'parent_id' => ['nullable', 'string', 'regex:' . self::GOOGLE_RESOURCE_ID_REGEX],
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation errors.',
                'errors' => $validator->errors(),
            ], 422);
        }

        try {
            $folder = $this->googleWorkspaceService->createDriveFolder(
                $request->user(),
                trim($request->name),
                $request->input('parent_id')
            );

            return response()->json([
                'success' => true,
                'message' => 'Folder created successfully.',
                'data' => $folder,
            ]);
        } catch (RuntimeException $exception) {
            return response()->json([
                'success' => false,
                'message' => $exception->getMessage(),
            ], 422);
        }
    }

    public function driveSystemLibrary(Request $request)
    {
        try {
            $library = $this->googleWorkspaceService->ensureSystemDriveFolder($request->user(), 'SMCBI_DTS');

            return response()->json([
                'success' => true,
                'data' => $library,
            ]);
        } catch (RuntimeException $exception) {
            return response()->json([
                'success' => false,
                'message' => $exception->getMessage(),
            ], 422);
        }
    }

    public function driveUpload(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'file' => ['required', 'file', 'max:10240'],
            'parent_id' => ['nullable', 'string', 'regex:' . self::GOOGLE_RESOURCE_ID_REGEX],
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation errors.',
                'errors' => $validator->errors(),
            ], 422);
        }

        try {
            $file = $request->file('file');
            $uploaded = $this->googleWorkspaceService->uploadDriveFile(
                $request->user(),
                $file->getClientOriginalName(),
                (string) file_get_contents($file->getRealPath()),
                $file->getMimeType() ?: 'application/octet-stream',
                $request->input('parent_id')
            );

            return response()->json([
                'success' => true,
                'message' => 'File uploaded successfully.',
                'data' => $uploaded,
            ]);
        } catch (RuntimeException $exception) {
            return response()->json([
                'success' => false,
                'message' => $exception->getMessage(),
            ], 422);
        }
    }

    public function driveDelete(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'file_id' => ['required', 'string', 'regex:' . self::GOOGLE_RESOURCE_ID_REGEX],
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation errors.',
                'errors' => $validator->errors(),
            ], 422);
        }

        try {
            $deleted = $this->googleWorkspaceService->deleteDriveFile(
                $request->user(),
                $request->file_id
            );

            return response()->json([
                'success' => true,
                'message' => $deleted
                    ? 'File deleted successfully.'
                    : 'Delete request accepted.',
            ]);
        } catch (RuntimeException $exception) {
            return response()->json([
                'success' => false,
                'message' => $exception->getMessage(),
            ], 422);
        }
    }

    public function driveShare(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'file_id' => ['required', 'string', 'regex:' . self::GOOGLE_RESOURCE_ID_REGEX],
            'email' => ['required', 'email'],
            'role' => ['nullable', 'in:reader,writer,commenter'],
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation errors.',
                'errors' => $validator->errors(),
            ], 422);
        }

        try {
            $permission = $this->googleWorkspaceService->shareDriveFile(
                $request->user(),
                $request->file_id,
                $request->email,
                $request->input('role', 'reader')
            );

            return response()->json([
                'success' => true,
                'message' => 'Drive file shared successfully.',
                'data' => $permission,
            ]);
        } catch (RuntimeException $exception) {
            return response()->json([
                'success' => false,
                'message' => $exception->getMessage(),
            ], 422);
        }
    }

    public function driveArchive(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'file_id' => ['required', 'string', 'regex:' . self::GOOGLE_RESOURCE_ID_REGEX],
            'destination_folder_id' => ['nullable', 'string', 'regex:' . self::GOOGLE_RESOURCE_ID_REGEX],
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation errors.',
                'errors' => $validator->errors(),
            ], 422);
        }

        try {
            $archive = $this->googleWorkspaceService->archiveDriveFile(
                $request->user(),
                $request->file_id,
                $request->destination_folder_id
            );

            return response()->json([
                'success' => true,
                'message' => 'Drive archive copy created.',
                'data' => $archive,
            ]);
        } catch (RuntimeException $exception) {
            return response()->json([
                'success' => false,
                'message' => $exception->getMessage(),
            ], 422);
        }
    }

    public function gmailMessages(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'maxResults' => ['nullable', 'integer', 'min:1', 'max:100'],
            'q' => ['nullable', 'string', 'max:200'],
            'pageToken' => ['nullable', 'string', 'max:400'],
            'force' => ['nullable', 'boolean'],
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation errors.',
                'errors' => $validator->errors(),
            ], 422);
        }

        try {
            $messages = $this->googleWorkspaceService->listGmailMessages(
                $request->user(),
                (int) $request->integer('maxResults', 50),
                $request->input('q'),
                $request->input('pageToken'),
                (bool) $request->boolean('force')
            );

            $nextPageToken = (string) ($messages['data']['nextPageToken'] ?? '');
            if ($nextPageToken !== '') {
                $user = $request->user();
                $query = (string) $request->input('q', '');
                $maxResults = (int) $request->integer('maxResults', 50);

                app()->terminating(function () use ($user, $query, $nextPageToken, $maxResults): void {
                    $this->googleWorkspaceService->warmGmailMessagesPage(
                        $user,
                        $query !== '' ? $query : null,
                        $nextPageToken,
                        $maxResults
                    );
                });
            }

            return response()->json([
                'success' => true,
                'data' => $messages['data'] ?? [],
                'meta' => $messages['meta'] ?? null,
            ]);
        } catch (RuntimeException $exception) {
            return response()->json([
                'success' => false,
                'message' => $exception->getMessage(),
            ], 422);
        }
    }

    public function gmailSummary(Request $request)
    {
        try {
            $summary = $this->googleWorkspaceService->getGmailSummary($request->user());

            return response()->json([
                'success' => true,
                'data' => $summary,
            ]);
        } catch (RuntimeException $exception) {
            return response()->json([
                'success' => false,
                'message' => $exception->getMessage(),
            ], 422);
        }
    }

    public function gmailRecipients(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'search' => ['nullable', 'string', 'max:120'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:20'],
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation errors.',
                'errors' => $validator->errors(),
            ], 422);
        }

        try {
            $recipients = $this->googleWorkspaceService->listGmailRecipientSuggestions(
                $request->user(),
                (string) $request->input('search', ''),
                (int) $request->integer('limit', 8)
            );

            return response()->json([
                'success' => true,
                'data' => $recipients,
            ]);
        } catch (RuntimeException $exception) {
            return response()->json([
                'success' => false,
                'message' => $exception->getMessage(),
            ], 422);
        }
    }

    public function gmailSend(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'to' => ['required', 'email'],
            'subject' => ['required', 'string', 'max:255'],
            'body' => ['required', 'string'],
            'attachments' => ['nullable', 'array'],
            'attachments.*' => ['file', 'max:10240'],
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation errors.',
                'errors' => $validator->errors(),
            ], 422);
        }

        try {
            $message = $this->googleWorkspaceService->sendGmailMessage(
                $request->user(),
                $request->to,
                $request->subject,
                $request->body,
                $request->file('attachments', [])
            );

            return response()->json([
                'success' => true,
                'message' => 'Email sent successfully.',
                'data' => $message,
            ]);
        } catch (RuntimeException $exception) {
            return response()->json([
                'success' => false,
                'message' => $exception->getMessage(),
            ], 422);
        }
    }

    public function gmailMessage(Request $request, string $messageId)
    {
        try {
            $message = $this->googleWorkspaceService->getGmailMessage($request->user(), $messageId);

            return response()->json([
                'success' => true,
                'data' => $message,
            ]);
        } catch (RuntimeException $exception) {
            return response()->json([
                'success' => false,
                'message' => $exception->getMessage(),
            ], 422);
        }
    }

    public function gmailReply(Request $request, string $messageId)
    {
        $validator = Validator::make($request->all(), [
            'body' => ['required', 'string'],
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation errors.',
                'errors' => $validator->errors(),
            ], 422);
        }

        try {
            $reply = $this->googleWorkspaceService->replyGmailMessage(
                $request->user(),
                $messageId,
                $request->body
            );

            return response()->json([
                'success' => true,
                'message' => 'Reply sent successfully.',
                'data' => $reply,
            ]);
        } catch (RuntimeException $exception) {
            return response()->json([
                'success' => false,
                'message' => $exception->getMessage(),
            ], 422);
        }
    }

    public function gmailMark(Request $request, string $messageId)
    {
        $validator = Validator::make($request->all(), [
            'mark_as_read' => ['required', 'boolean'],
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation errors.',
                'errors' => $validator->errors(),
            ], 422);
        }

        try {
            $updated = $this->googleWorkspaceService->modifyGmailMessage(
                $request->user(),
                $messageId,
                (bool) $request->boolean('mark_as_read')
            );

            return response()->json([
                'success' => true,
                'message' => 'Message status updated.',
                'data' => $updated,
            ]);
        } catch (RuntimeException $exception) {
            return response()->json([
                'success' => false,
                'message' => $exception->getMessage(),
            ], 422);
        }
    }

    public function documentView(Request $request, string $documentId)
    {
        if (!$this->isValidGoogleResourceId($documentId)) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid Google document identifier.',
            ], 422);
        }

        try {
            $document = $this->googleWorkspaceService->getDocument($request->user(), $documentId);

            return response()->json([
                'success' => true,
                'data' => $document,
            ]);
        } catch (RuntimeException $exception) {
            return response()->json([
                'success' => false,
                'message' => $exception->getMessage(),
            ], 422);
        }
    }

    public function documentUpdate(Request $request, string $documentId)
    {
        if (!$this->isValidGoogleResourceId($documentId)) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid Google document identifier.',
            ], 422);
        }

        $validator = Validator::make($request->all(), [
            'text' => ['required', 'string'],
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation errors.',
                'errors' => $validator->errors(),
            ], 422);
        }

        try {
            $document = $this->googleWorkspaceService->replaceDocumentText(
                $request->user(),
                $documentId,
                (string) $request->input('text', '')
            );

            return response()->json([
                'success' => true,
                'message' => 'Document updated successfully.',
                'data' => $document,
            ]);
        } catch (RuntimeException $exception) {
            return response()->json([
                'success' => false,
                'message' => $exception->getMessage(),
            ], 422);
        }
    }

    private function isValidGoogleResourceId(string $value): bool
    {
        return preg_match(self::GOOGLE_RESOURCE_ID_REGEX, $value) === 1;
    }

}
