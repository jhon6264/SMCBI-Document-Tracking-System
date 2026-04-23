<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DocumentSession extends Model
{
    protected $table = 'sessions';

    protected $fillable = [
        'title',
        'document_type',
        'status',
        'created_by',
        'google_doc_file_id',
        'google_drive_folder_id',
        'deadline_at',
        'allow_delegated_editing',
        'description',
    ];

    protected $casts = [
        'deadline_at' => 'datetime',
        'allow_delegated_editing' => 'boolean',
    ];

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function members()
    {
        return $this->hasMany(SessionMember::class, 'session_id');
    }

    public function placeholders()
    {
        return $this->hasMany(SessionPlaceholder::class, 'session_id');
    }

    public function files()
    {
        return $this->hasMany(SessionFile::class, 'session_id');
    }

    public function signatureAssets()
    {
        return $this->hasMany(SignatureAsset::class, 'session_id');
    }

    public function activities()
    {
        return $this->hasMany(SessionActivity::class, 'session_id');
    }
}
