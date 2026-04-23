<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;

class UserAuthController extends Controller
{
    private function formatUser(User $user, array $googleUser = []): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'google_name' => (string) ($googleUser['name'] ?? ''),
            'email' => $user->email,
            'role' => $user->role,
            'department' => $user->department?->name,
            'department_id' => $user->department_id,
            'status' => $user->status,
            'google_id' => $user->google_id,
            'profile_picture' => (string) ($googleUser['picture'] ?? ''),
        ];
    }

    public function login(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'credential' => ['required', 'string'],
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation errors.',
                'errors' => $validator->errors(),
            ], 422);
        }

        $clientId = config('services.google.client_id');
        $schoolDomain = 'smcbi.edu.ph';

        if (!$clientId) {
            return response()->json([
                'success' => false,
                'message' => 'Google login is not configured yet.',
            ], 500);
        }

        try {
            $googleResponse = Http::acceptJson()
                ->timeout(10)
                ->get('https://oauth2.googleapis.com/tokeninfo', [
                    'id_token' => $request->credential,
                ]);
        } catch (ConnectionException $exception) {
            Log::error('Google token verification connection failed.', [
                'message' => $exception->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Unable to verify your Google account right now.',
            ], 503);
        }

        if (!$googleResponse->ok()) {
            return response()->json([
                'success' => false,
                'message' => 'Google validation failed. Please sign in again.',
            ], 401);
        }

        $googleUser = $googleResponse->json();
        $email = strtolower(trim((string) ($googleUser['email'] ?? '')));
        $googleId = (string) ($googleUser['sub'] ?? '');
        $audience = (string) ($googleUser['aud'] ?? '');
        $hostedDomain = strtolower(trim((string) ($googleUser['hd'] ?? '')));
        $emailVerified = $googleUser['email_verified'] ?? false;

        if ($audience !== $clientId) {
            return response()->json([
                'success' => false,
                'message' => 'This Google account is not linked to your app client.',
            ], 401);
        }

        if (!in_array($emailVerified, [true, 'true', 1, '1'], true)) {
            return response()->json([
                'success' => false,
                'message' => 'Your Google email must be verified first.',
            ], 403);
        }

        if (!str_ends_with($email, '@'.$schoolDomain)) {
            return response()->json([
                'success' => false,
                'message' => 'Only official @smcbi.edu.ph Google accounts are allowed.',
            ], 403);
        }

        if ($hostedDomain !== '' && $hostedDomain !== $schoolDomain) {
            return response()->json([
                'success' => false,
                'message' => 'Please use your official school Google account.',
            ], 403);
        }

        $user = User::with('department')->where('email', $email)->first();

        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'This Google account is not registered by the admin.',
            ], 404);
        }

        if ($user->status !== 'Active') {
            return response()->json([
                'success' => false,
                'message' => 'Your account is inactive. Please contact the admin.',
            ], 403);
        }

        if (!$user->google_id || $user->google_id !== $googleId) {
            $user->google_id = $googleId;
            $user->save();
        }

        $token = $user->createToken('user_token')->plainTextToken;

        return response()->json([
            'success' => true,
            'message' => 'Login successful.',
            'token' => $token,
            'user' => $this->formatUser($user, $googleUser),
        ], 200);
    }
}
