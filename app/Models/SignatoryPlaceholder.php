<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SignatoryPlaceholder extends Model
{
    protected $fillable = [
        'placeholder_key',
        'raw_token',
        'label',
        'description',
        'category',
        'is_active',
        'usage_count',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    public function sessionPlaceholders()
    {
        return $this->hasMany(SessionPlaceholder::class, 'registry_placeholder_id');
    }
}
