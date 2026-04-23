<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AdminAuthController;
use App\Http\Controllers\Api\AdminSignatoryPlaceholderController;
use App\Http\Controllers\Api\AdminUserController;
use App\Http\Controllers\Api\UserAuthController;
use App\Http\Controllers\Api\UserGoogleWorkspaceController;
use App\Http\Controllers\Api\UserInvitationController;
use App\Http\Controllers\Api\UserNotificationController;
use App\Http\Controllers\Api\UserSessionController;
use App\Http\Controllers\Api\UserSignatureController;

Route::post('/admin/login', [AdminAuthController::class, 'login']);
Route::middleware('auth:sanctum')->post('/admin/logout', [AdminAuthController::class, 'logout']);

Route::get('/admin/departments', [AdminUserController::class, 'getDepartments']);
Route::get('/admin/users', [AdminUserController::class, 'getUsers']);
Route::post('/admin/users', [AdminUserController::class, 'storeUser']);
Route::put('/admin/users/{id}', [AdminUserController::class, 'updateUser']);
Route::patch('/admin/users/{id}/status', [AdminUserController::class, 'toggleUserStatus']);
Route::delete('/admin/users/{id}', [AdminUserController::class, 'deleteUser']);
Route::get('/admin/signatory-placeholders', [AdminSignatoryPlaceholderController::class, 'index']);
Route::post('/admin/signatory-placeholders', [AdminSignatoryPlaceholderController::class, 'store']);
Route::put('/admin/signatory-placeholders/{id}', [AdminSignatoryPlaceholderController::class, 'update']);
Route::patch('/admin/signatory-placeholders/{id}/status', [AdminSignatoryPlaceholderController::class, 'toggleStatus']);
Route::delete('/admin/signatory-placeholders/{id}', [AdminSignatoryPlaceholderController::class, 'destroy']);

Route::post('/user/login', [UserAuthController::class, 'login']);

Route::middleware('auth:sanctum')->prefix('/user/sessions')->group(function () {
    Route::get('/', [UserSessionController::class, 'index']);
    Route::post('/', [UserSessionController::class, 'store']);
    Route::patch('/{id}', [UserSessionController::class, 'update']);
    Route::delete('/{id}', [UserSessionController::class, 'destroy']);
    Route::get('/{id}', [UserSessionController::class, 'show']);
    Route::post('/{id}/files', [UserSessionController::class, 'addFile']);
    Route::post('/{id}/rescan-placeholders', [UserSessionController::class, 'rescanPlaceholders']);
    Route::post('/{id}/sign', [UserSessionController::class, 'signPlaceholder']);
    Route::post('/{id}/members', [UserSessionController::class, 'addMember']);
    Route::patch('/{id}/members/{memberId}', [UserSessionController::class, 'updateMember']);
    Route::delete('/{id}/members/{memberId}', [UserSessionController::class, 'destroyMember']);
    Route::patch('/{id}/placeholders/{placeholderId}/assign', [UserSessionController::class, 'assignPlaceholder']);
    Route::patch('/{id}/placeholders/{placeholderId}/unassign', [UserSessionController::class, 'unassignPlaceholder']);
});

Route::middleware('auth:sanctum')->prefix('/user/tasks')->group(function () {
    Route::get('/session-invitations', [UserInvitationController::class, 'index']);
    Route::patch('/session-invitations/{memberId}/accept', [UserInvitationController::class, 'accept']);
    Route::patch('/session-invitations/{memberId}/decline', [UserInvitationController::class, 'decline']);
});

Route::middleware('auth:sanctum')->prefix('/user/notifications')->group(function () {
    Route::get('/', [UserNotificationController::class, 'index']);
    Route::patch('/{id}/read', [UserNotificationController::class, 'markRead']);
});

Route::middleware('auth:sanctum')->prefix('/user/google')->group(function () {
    Route::post('/connect', [UserGoogleWorkspaceController::class, 'connect']);
    Route::post('/connect-code', [UserGoogleWorkspaceController::class, 'connectCode']);
    Route::post('/disconnect', [UserGoogleWorkspaceController::class, 'disconnect']);
    Route::get('/status', [UserGoogleWorkspaceController::class, 'status']);

    Route::get('/drive/files', [UserGoogleWorkspaceController::class, 'driveFiles']);
    Route::get('/drive/file-meta', [UserGoogleWorkspaceController::class, 'driveFileMeta']);
    Route::get('/drive/preview', [UserGoogleWorkspaceController::class, 'drivePreview']);
    Route::get('/drive/system-library', [UserGoogleWorkspaceController::class, 'driveSystemLibrary']);
    Route::post('/drive/folders', [UserGoogleWorkspaceController::class, 'driveCreateFolder']);
    Route::post('/drive/upload', [UserGoogleWorkspaceController::class, 'driveUpload']);
    Route::post('/drive/share', [UserGoogleWorkspaceController::class, 'driveShare']);
    Route::delete('/drive/file', [UserGoogleWorkspaceController::class, 'driveDelete']);
    Route::post('/drive/archive', [UserGoogleWorkspaceController::class, 'driveArchive']);

    Route::get('/gmail/messages', [UserGoogleWorkspaceController::class, 'gmailMessages']);
    Route::get('/gmail/summary', [UserGoogleWorkspaceController::class, 'gmailSummary']);
    Route::get('/gmail/recipients', [UserGoogleWorkspaceController::class, 'gmailRecipients']);
    Route::get('/gmail/messages/{messageId}', [UserGoogleWorkspaceController::class, 'gmailMessage']);
    Route::post('/gmail/messages/{messageId}/reply', [UserGoogleWorkspaceController::class, 'gmailReply']);
    Route::patch('/gmail/messages/{messageId}/mark', [UserGoogleWorkspaceController::class, 'gmailMark']);
    Route::post('/gmail/send', [UserGoogleWorkspaceController::class, 'gmailSend']);

    Route::get('/docs/{documentId}', [UserGoogleWorkspaceController::class, 'documentView']);
    Route::patch('/docs/{documentId}', [UserGoogleWorkspaceController::class, 'documentUpdate']);
});

Route::middleware('auth:sanctum')->prefix('/user/account')->group(function () {
    Route::get('/signatures', [UserSignatureController::class, 'index']);
    Route::post('/signatures/upload', [UserSignatureController::class, 'upload']);
    Route::post('/signatures/drawn', [UserSignatureController::class, 'storeDrawn']);
    Route::patch('/signatures/{id}/activate', [UserSignatureController::class, 'activate']);
    Route::delete('/signatures/{id}', [UserSignatureController::class, 'destroy']);
});
