<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AdminAuthController;
use App\Http\Controllers\Api\AdminUserController;

Route::post('/admin/login', [AdminAuthController::class, 'login']);
Route::middleware('auth:sanctum')->post('/admin/logout', [AdminAuthController::class, 'logout']);

Route::get('/admin/departments', [AdminUserController::class, 'getDepartments']);
Route::get('/admin/users', [AdminUserController::class, 'getUsers']);
Route::post('/admin/users', [AdminUserController::class, 'storeUser']);
Route::put('/admin/users/{id}', [AdminUserController::class, 'updateUser']);
Route::patch('/admin/users/{id}/status', [AdminUserController::class, 'toggleUserStatus']);
Route::delete('/admin/users/{id}', [AdminUserController::class, 'deleteUser']);