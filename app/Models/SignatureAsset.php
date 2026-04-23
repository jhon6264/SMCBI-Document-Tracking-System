<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SignatureAsset extends Model
{
    protected $fillable = [
        'session_id',
        'user_id',
        'original_name',
        'mime_type',
        'storage_path',
        'drive_file_id',
        'width',
        'height',
    ];

    public function session()
    {
        return $this->belongsTo(DocumentSession::class, 'session_id');
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
