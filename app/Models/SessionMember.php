<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SessionMember extends Model
{
    protected $fillable = [
        'session_id',
        'user_id',
        'role',
        'display_role_name',
        'sign_order',
        'member_status',
        'invitation_status',
        'invited_at',
        'responded_at',
        'can_view_session',
        'can_view_document',
        'can_sign',
        'can_view_drive_panel',
        'can_add_files',
        'can_remove_files',
        'can_edit_session',
        'can_manage_signatories',
        'can_send_notifications',
        'can_close_session',
        'signed_at',
    ];

    protected $casts = [
        'can_view_session' => 'boolean',
        'can_view_document' => 'boolean',
        'can_sign' => 'boolean',
        'can_view_drive_panel' => 'boolean',
        'can_add_files' => 'boolean',
        'can_remove_files' => 'boolean',
        'can_edit_session' => 'boolean',
        'can_manage_signatories' => 'boolean',
        'can_send_notifications' => 'boolean',
        'can_close_session' => 'boolean',
        'invited_at' => 'datetime',
        'responded_at' => 'datetime',
        'signed_at' => 'datetime',
    ];

    public function session()
    {
        return $this->belongsTo(DocumentSession::class, 'session_id');
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function assignedPlaceholders()
    {
        return $this->hasMany(SessionPlaceholder::class, 'assigned_member_id');
    }
}
