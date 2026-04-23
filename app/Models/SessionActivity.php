<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SessionActivity extends Model
{
    protected $fillable = [
        'session_id',
        'user_id',
        'type',
        'meta_json',
    ];

    protected $casts = [
        'meta_json' => 'array',
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
