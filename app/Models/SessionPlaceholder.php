<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SessionPlaceholder extends Model
{
    protected $fillable = [
        'session_id',
        'session_file_id',
        'registry_placeholder_id',
        'placeholder_key',
        'raw_token',
        'label',
        'assigned_member_id',
        'status',
        'signed_by_user_id',
        'signature_asset_id',
        'signed_at',
    ];

    protected $casts = [
        'signed_at' => 'datetime',
    ];

    public function session()
    {
        return $this->belongsTo(DocumentSession::class, 'session_id');
    }

    public function registryPlaceholder()
    {
        return $this->belongsTo(SignatoryPlaceholder::class, 'registry_placeholder_id');
    }

    public function sessionFile()
    {
        return $this->belongsTo(SessionFile::class, 'session_file_id');
    }

    public function assignedMember()
    {
        return $this->belongsTo(SessionMember::class, 'assigned_member_id');
    }

    public function signedBy()
    {
        return $this->belongsTo(User::class, 'signed_by_user_id');
    }

    public function signatureAsset()
    {
        return $this->belongsTo(SignatureAsset::class, 'signature_asset_id');
    }
}
