<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class UserSignatureAsset extends Model
{
    protected $fillable = [
        'user_id',
        'type',
        'original_path',
        'processed_path',
        'drive_file_id',
        'drive_web_view_link',
        'drive_public_url',
        'mime_type',
        'is_active',
        'meta_json',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'meta_json' => 'array',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
