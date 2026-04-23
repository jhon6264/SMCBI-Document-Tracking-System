<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SessionFile extends Model
{
    protected $fillable = [
        'session_id',
        'source_google_drive_file_id',
        'google_drive_file_id',
        'google_drive_parent_id',
        'name',
        'source_mime_type',
        'mime_type',
        'web_view_link',
        'uploaded_by',
        'source',
        'is_converted_for_signing',
        'is_primary_document',
    ];

    protected $casts = [
        'is_converted_for_signing' => 'boolean',
        'is_primary_document' => 'boolean',
    ];

    public function session()
    {
        return $this->belongsTo(DocumentSession::class, 'session_id');
    }

    public function uploader()
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }

    public function placeholders()
    {
        return $this->hasMany(SessionPlaceholder::class, 'session_file_id');
    }
}
