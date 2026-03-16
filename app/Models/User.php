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
    ];

    protected $hidden = [
        'remember_token',
    ];

    public function department()
    {
        return $this->belongsTo(Department::class);
    }
}