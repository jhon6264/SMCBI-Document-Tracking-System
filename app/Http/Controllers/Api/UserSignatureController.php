<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\UserSignatureAsset;
use App\Services\GoogleWorkspaceService;
use Illuminate\Http\File;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use RuntimeException;

class UserSignatureController extends Controller
{
    public function __construct(
        private readonly GoogleWorkspaceService $googleWorkspaceService
    ) {
    }

    public function index(Request $request)
    {
        $assets = UserSignatureAsset::query()
            ->where('user_id', $request->user()->id)
            ->latest()
            ->get()
            ->map(fn (UserSignatureAsset $asset) => $this->formatAsset($asset))
            ->values();

        return response()->json([
            'success' => true,
            'assets' => $assets,
            'active_asset' => $assets->firstWhere('is_active', true),
        ]);
    }

    public function upload(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'signature' => ['required', 'file', 'mimes:png,jpg,jpeg,webp', 'max:5120'],
            'processed_signature' => ['nullable', 'file', 'mimes:png,webp', 'max:5120'],
            'signature_type' => ['nullable', 'in:uploaded,drawn'],
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation errors.',
                'errors' => $validator->errors(),
            ], 422);
        }

        $user = $request->user();
        $originalFile = $request->file('signature');
        $processedFile = $request->file('processed_signature');
        $signatureType = $request->input('signature_type') === 'drawn' ? 'drawn' : 'uploaded';

        $originalExtension = strtolower($originalFile->getClientOriginalExtension() ?: 'png');
        $originalPath = $originalFile->storeAs(
            "user-signatures/{$user->id}",
            "{$signatureType}-original-" . Str::uuid() . '.' . $originalExtension,
            'public'
        );

        $processedPath = null;
        if ($processedFile) {
            $processedExtension = strtolower($processedFile->getClientOriginalExtension() ?: 'png');
            $processedPath = $processedFile->storeAs(
                "user-signatures/{$user->id}",
                "{$signatureType}-processed-" . Str::uuid() . '.' . $processedExtension,
                'public'
            );
        }

        try {
            $driveAsset = $this->storeSignatureOnDrive(
                $user,
                $processedFile ?: $originalFile,
                $processedPath ?: $originalPath,
                $processedFile?->getMimeType() ?: $originalFile->getMimeType() ?: 'image/png'
            );
        } catch (RuntimeException $exception) {
            Storage::disk('public')->delete(array_filter([$originalPath, $processedPath]));

            return response()->json([
                'success' => false,
                'message' => $exception->getMessage(),
            ], 422);
        }

        $asset = DB::transaction(function () use (
            $user,
            $signatureType,
            $originalFile,
            $processedFile,
            $originalPath,
            $processedPath,
            $driveAsset
        ) {
            UserSignatureAsset::query()
                ->where('user_id', $user->id)
                ->where('is_active', true)
                ->update(['is_active' => false]);

            return UserSignatureAsset::create([
                'user_id' => $user->id,
                'type' => $signatureType,
                'original_path' => $originalPath,
                'processed_path' => $processedPath,
                'drive_file_id' => $driveAsset['file_id'] ?? null,
                'drive_web_view_link' => $driveAsset['web_view_link'] ?? null,
                'drive_public_url' => $driveAsset['public_url'] ?? null,
                'mime_type' => $processedFile?->getMimeType() ?: $originalFile->getMimeType() ?: 'image/png',
                'is_active' => true,
                'meta_json' => [
                    'original_name' => $originalFile->getClientOriginalName(),
                    'original_size' => $originalFile->getSize(),
                    'processed_size' => $processedFile?->getSize(),
                    'background_removed' => (bool) $processedFile,
                    'drawn_from_canvas' => $signatureType === 'drawn',
                    'stored_in_drive' => !empty($driveAsset['file_id']),
                ],
            ]);
        });

        return response()->json([
            'success' => true,
            'message' => $signatureType === 'drawn'
                ? 'Drawn signature saved successfully.'
                : ($processedPath
                    ? 'Signature image uploaded and processed successfully.'
                    : 'Signature image uploaded successfully.'),
            'asset' => $this->formatAsset($asset),
        ], 201);
    }

    public function storeDrawn(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'signature_data_url' => ['required', 'string'],
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation errors.',
                'errors' => $validator->errors(),
            ], 422);
        }

        $raw = (string) $request->input('signature_data_url');
        if (!preg_match('/^data:(image\/png|image\/jpeg|image\/webp);base64,(.+)$/', $raw, $matches)) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid signature image payload.',
            ], 422);
        }

        $mimeType = $matches[1];
        $binary = base64_decode($matches[2], true);
        if ($binary === false) {
            return response()->json([
                'success' => false,
                'message' => 'Unable to decode signature image.',
            ], 422);
        }

        $user = $request->user();
        $extension = match ($mimeType) {
            'image/jpeg' => 'jpg',
            'image/webp' => 'webp',
            default => 'png',
        };
        $path = "user-signatures/{$user->id}/drawn-" . Str::uuid() . ".{$extension}";
        Storage::disk('public')->put($path, $binary);

        try {
            $driveAsset = $this->storeSignatureOnDrive(
                $user,
                null,
                $path,
                $mimeType,
                'drawn-signature-' . Str::uuid() . ".{$extension}",
                $binary
            );
        } catch (RuntimeException $exception) {
            Storage::disk('public')->delete($path);

            return response()->json([
                'success' => false,
                'message' => $exception->getMessage(),
            ], 422);
        }

        $asset = DB::transaction(function () use ($user, $path, $mimeType, $binary, $driveAsset) {
            UserSignatureAsset::query()
                ->where('user_id', $user->id)
                ->where('is_active', true)
                ->update(['is_active' => false]);

            return UserSignatureAsset::create([
                'user_id' => $user->id,
                'type' => 'drawn',
                'original_path' => $path,
                'processed_path' => null,
                'drive_file_id' => $driveAsset['file_id'] ?? null,
                'drive_web_view_link' => $driveAsset['web_view_link'] ?? null,
                'drive_public_url' => $driveAsset['public_url'] ?? null,
                'mime_type' => $mimeType,
                'is_active' => true,
                'meta_json' => [
                    'size' => strlen($binary),
                    'stored_in_drive' => !empty($driveAsset['file_id']),
                ],
            ]);
        });

        return response()->json([
            'success' => true,
            'message' => 'Drawn signature saved successfully.',
            'asset' => $this->formatAsset($asset),
        ], 201);
    }

    public function activate(Request $request, int $id)
    {
        $asset = UserSignatureAsset::query()
            ->where('user_id', $request->user()->id)
            ->find($id);

        if (!$asset) {
            return response()->json([
                'success' => false,
                'message' => 'Signature asset not found.',
            ], 404);
        }

        DB::transaction(function () use ($request, $asset) {
            UserSignatureAsset::query()
                ->where('user_id', $request->user()->id)
                ->where('is_active', true)
                ->update(['is_active' => false]);

            $asset->update(['is_active' => true]);
        });

        return response()->json([
            'success' => true,
            'message' => 'Signature activated successfully.',
            'asset' => $this->formatAsset($asset->fresh()),
        ]);
    }

    public function destroy(Request $request, int $id)
    {
        $asset = UserSignatureAsset::query()
            ->where('user_id', $request->user()->id)
            ->find($id);

        if (!$asset) {
            return response()->json([
                'success' => false,
                'message' => 'Signature asset not found.',
            ], 404);
        }

        Storage::disk('public')->delete(array_filter([
            $asset->original_path,
            $asset->processed_path,
        ]));

        if ($asset->drive_file_id) {
            try {
                $this->googleWorkspaceService->deleteDriveFile($request->user(), $asset->drive_file_id);
            } catch (RuntimeException) {
                // Keep local cleanup successful even if Drive cleanup fails.
            }
        }

        $asset->delete();

        return response()->json([
            'success' => true,
            'message' => 'Signature asset deleted successfully.',
        ]);
    }

    private function formatAsset(UserSignatureAsset $asset): array
    {
        $originalImageUrl = $this->buildInlinePreviewUrl($asset->original_path, $asset->mime_type);
        $processedImageUrl = $this->buildInlinePreviewUrl($asset->processed_path, $asset->mime_type);
        $previewUrl = $originalImageUrl ?: $processedImageUrl ?: ($asset->drive_public_url ?: $asset->drive_web_view_link);
        $signingImageUrl = $asset->drive_public_url ?: $processedImageUrl ?: $originalImageUrl;

        return [
            'id' => $asset->id,
            'type' => $asset->type,
            'mime_type' => $asset->mime_type,
            'is_active' => (bool) $asset->is_active,
            'original_path' => $asset->original_path,
            'processed_path' => $asset->processed_path,
            'drive_file_id' => $asset->drive_file_id,
            'drive_web_view_link' => $asset->drive_web_view_link,
            'drive_public_url' => $asset->drive_public_url,
            'image_url' => $previewUrl,
            'preview_url' => $previewUrl,
            'original_image_url' => $originalImageUrl,
            'processed_image_url' => $processedImageUrl,
            'signing_image_url' => $signingImageUrl,
            'meta' => $asset->meta_json,
            'created_at' => $asset->created_at?->toIso8601String(),
            'updated_at' => $asset->updated_at?->toIso8601String(),
        ];
    }

    private function buildInlinePreviewUrl(?string $path, ?string $mimeType): ?string
    {
        if (!$path) {
            return null;
        }

        $disk = Storage::disk('public');
        if (!$disk->exists($path)) {
            return null;
        }

        $contents = $disk->get($path);
        if ($contents === '') {
            return null;
        }

        $resolvedMimeType = $mimeType ?: $disk->mimeType($path) ?: 'image/png';

        return 'data:' . $resolvedMimeType . ';base64,' . base64_encode($contents);
    }

    private function storeSignatureOnDrive(
        $user,
        $uploadedFile,
        string $localPath,
        string $mimeType,
        ?string $filename = null,
        ?string $binaryContents = null
    ): array {
        $folder = $this->googleWorkspaceService->ensureSignatureDriveFolder($user);
        $targetParentId = (string) ($folder['id'] ?? '');

        if ($targetParentId === '') {
            throw new RuntimeException('Unable to prepare the Google Drive signature folder.');
        }

        $contents = $binaryContents;
        if ($contents === null) {
            if ($uploadedFile instanceof \Illuminate\Http\UploadedFile) {
                $contents = $uploadedFile->get();
            } else {
                $contents = Storage::disk('public')->get($localPath);
            }
        }

        $resolvedFilename = $filename
            ?: 'signature-' . Str::uuid() . '.' . ($uploadedFile?->getClientOriginalExtension() ?: 'png');

        $driveFile = $this->googleWorkspaceService->uploadDriveFile(
            $user,
            $resolvedFilename,
            $contents,
            $mimeType,
            $targetParentId
        );

        $driveFileId = (string) ($driveFile['id'] ?? '');
        if ($driveFileId === '') {
            throw new RuntimeException('Google Drive did not return a file id for the saved signature.');
        }

        $this->googleWorkspaceService->makeDriveFilePublic($user, $driveFileId);

        return [
            'file_id' => $driveFileId,
            'web_view_link' => $driveFile['webViewLink'] ?? null,
            'public_url' => $this->googleWorkspaceService->getDrivePublicImageUrl($driveFileId),
        ];
    }
}
