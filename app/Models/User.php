<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    protected $fillable = [
        'name',
        'email',
        'role',
        'department_id',
        'status',
        'google_id',
        'google_access_token',
        'google_refresh_token',
        'google_token_expires_at',
        'google_token_scopes',
    ];

    protected $hidden = [
        'remember_token',
        'google_access_token',
        'google_refresh_token',
    ];

    protected $casts = [
        'google_token_expires_at' => 'datetime',
        'google_token_scopes' => 'array',
    ];

    public function department()
    {
        return $this->belongsTo(Department::class);
    }

    public function createdSessions()
    {
        return $this->hasMany(DocumentSession::class, 'created_by');
    }

    public function sessionMemberships()
    {
        return $this->hasMany(SessionMember::class);
    }

    public function uploadedSessionFiles()
    {
        return $this->hasMany(SessionFile::class, 'uploaded_by');
    }

    public function signatureAssets()
    {
        return $this->hasMany(SignatureAsset::class);
    }

    public function signedSessionPlaceholders()
    {
        return $this->hasMany(SessionPlaceholder::class, 'signed_by_user_id');
    }

    public function sessionActivities()
    {
        return $this->hasMany(SessionActivity::class);
    }

    public function userSignatureAssets()
    {
        return $this->hasMany(UserSignatureAsset::class);
    }

    public function userNotifications()
    {
        return $this->hasMany(UserNotification::class);
    }
}
