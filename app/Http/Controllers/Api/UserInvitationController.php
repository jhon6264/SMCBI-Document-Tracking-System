<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SessionActivity;
use App\Models\SessionMember;
use App\Models\UserNotification;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class UserInvitationController extends Controller
{
    public function index(Request $request)
    {
        $memberships = SessionMember::query()
            ->with([
                'session.creator:id,name,email',
                'session.files',
                'session.placeholders',
            ])
            ->where('user_id', $request->user()->id)
            ->where('invitation_status', 'pending')
            ->latest('invited_at')
            ->get();

        return response()->json([
            'success' => true,
            'tasks' => $memberships->map(fn (SessionMember $member) => $this->formatInvitationTask($member))->values(),
        ]);
    }

    public function accept(Request $request, int $memberId)
    {
        $member = SessionMember::query()
            ->with(['session.creator:id,name,email'])
            ->where('user_id', $request->user()->id)
            ->where('invitation_status', 'pending')
            ->find($memberId);

        if (!$member) {
            return response()->json([
                'success' => false,
                'message' => 'Pending invitation not found.',
            ], 404);
        }

        DB::transaction(function () use ($member, $request) {
            $member->update([
                'invitation_status' => 'accepted',
                'responded_at' => now(),
                'member_status' => 'accepted',
            ]);

            SessionActivity::create([
                'session_id' => $member->session_id,
                'user_id' => $request->user()->id,
                'type' => 'accepted_session_invitation',
                'meta_json' => [
                    'member_id' => $member->id,
                    'target_user_id' => $member->user_id,
                    'target_user_name' => $request->user()->name,
                ],
            ]);

            UserNotification::query()
                ->where('user_id', $member->user_id)
                ->where('type', 'session_invitation')
                ->where('read_at', null)
                ->where('data_json->session_member_id', $member->id)
                ->update(['read_at' => now()]);
        });

        $member->refresh();

        return response()->json([
            'success' => true,
            'message' => 'Session invitation accepted.',
            'task' => $this->formatInvitationTask($member),
        ]);
    }

    public function decline(Request $request, int $memberId)
    {
        $member = SessionMember::query()
            ->with(['session.creator:id,name,email', 'user:id,name,email'])
            ->where('user_id', $request->user()->id)
            ->where('invitation_status', 'pending')
            ->find($memberId);

        if (!$member) {
            return response()->json([
                'success' => false,
                'message' => 'Pending invitation not found.',
            ], 404);
        }

        DB::transaction(function () use ($member, $request) {
            SessionActivity::create([
                'session_id' => $member->session_id,
                'user_id' => $request->user()->id,
                'type' => 'declined_session_invitation',
                'meta_json' => [
                    'member_id' => $member->id,
                    'target_user_id' => $member->user_id,
                    'target_user_name' => $request->user()->name,
                ],
            ]);

            UserNotification::query()
                ->where('user_id', $member->user_id)
                ->where('type', 'session_invitation')
                ->where('read_at', null)
                ->where('data_json->session_member_id', $member->id)
                ->update(['read_at' => now()]);

            $member->delete();
        });

        return response()->json([
            'success' => true,
            'message' => 'Session invitation declined.',
        ]);
    }

    private function formatInvitationTask(SessionMember $member): array
    {
        $session = $member->session;
        $placeholders = $session?->placeholders ?? collect();
        $files = $session?->files ?? collect();
        $primaryFile = $files->firstWhere('is_primary_document', true) ?: $files->first();

        return [
            'member_id' => $member->id,
            'session_id' => $member->session_id,
            'title' => $session?->title ?? 'Untitled Session',
            'document_type' => $session?->document_type ?? 'Document',
            'status' => $session?->status ?? 'draft',
            'creator_name' => $session?->creator?->name ?? 'Unknown',
            'creator_email' => $session?->creator?->email,
            'display_role_name' => $member->display_role_name ?: ucfirst(str_replace('_', ' ', $member->role)),
            'invited_at' => $member->invited_at?->toIso8601String(),
            'deadline_at' => $session?->deadline_at?->toIso8601String(),
            'placeholder_count' => $placeholders->count(),
            'file_name' => $primaryFile?->name,
            'is_converted_for_signing' => (bool) ($primaryFile?->is_converted_for_signing),
        ];
    }
}
