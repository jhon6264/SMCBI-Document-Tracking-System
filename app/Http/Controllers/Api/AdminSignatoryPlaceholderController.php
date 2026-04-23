<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SignatoryPlaceholder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class AdminSignatoryPlaceholderController extends Controller
{
    private function normalizeKey(string $value): string
    {
        $value = strtoupper(trim($value));
        $value = preg_replace('/\s+/', '_', $value);
        $value = preg_replace('/[^A-Z0-9_]/', '', $value);
        $value = preg_replace('/_+/', '_', $value);

        return trim($value, '_');
    }

    private function formatPlaceholder(SignatoryPlaceholder $placeholder): array
    {
        return [
            'id' => $placeholder->id,
            'placeholder_key' => $placeholder->placeholder_key,
            'raw_token' => $placeholder->raw_token,
            'label' => $placeholder->label,
            'description' => $placeholder->description,
            'category' => $placeholder->category,
            'is_active' => $placeholder->is_active,
            'usage_count' => $placeholder->usage_count,
            'last_updated' => optional($placeholder->updated_at)->format('M j, Y'),
            'created_at' => $placeholder->created_at,
            'updated_at' => $placeholder->updated_at,
        ];
    }

    private function validatePayload(Request $request, ?SignatoryPlaceholder $placeholder = null)
    {
        $normalizedKey = $this->normalizeKey((string) $request->input('placeholder_key', ''));
        $request->merge([
            'placeholder_key' => $normalizedKey,
            'raw_token' => $normalizedKey ? '{{' . $normalizedKey . '}}' : '',
        ]);

        return Validator::make(
            $request->all(),
            [
                'placeholder_key' => [
                    'required',
                    'string',
                    'max:255',
                    'regex:/^[A-Z0-9_]+$/',
                    Rule::unique('signatory_placeholders', 'placeholder_key')->ignore($placeholder?->id),
                ],
                'raw_token' => [
                    'required',
                    'string',
                    'max:255',
                    Rule::unique('signatory_placeholders', 'raw_token')->ignore($placeholder?->id),
                ],
                'label' => ['required', 'string', 'max:255'],
                'description' => ['nullable', 'string'],
                'category' => ['nullable', 'string', 'max:255'],
                'is_active' => ['required', 'boolean'],
            ],
            [
                'placeholder_key.regex' => 'Placeholder key must use uppercase letters, numbers, and underscores only.',
            ]
        );
    }

    public function index()
    {
        $placeholders = SignatoryPlaceholder::orderByDesc('is_active')
            ->orderBy('placeholder_key')
            ->get()
            ->map(fn (SignatoryPlaceholder $placeholder) => $this->formatPlaceholder($placeholder));

        return response()->json([
            'success' => true,
            'placeholders' => $placeholders,
        ], 200);
    }

    public function store(Request $request)
    {
        $validator = $this->validatePayload($request);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation errors.',
                'errors' => $validator->errors(),
            ], 422);
        }

        $placeholder = SignatoryPlaceholder::create([
            'placeholder_key' => $request->placeholder_key,
            'raw_token' => $request->raw_token,
            'label' => trim((string) $request->label),
            'description' => $request->filled('description') ? trim((string) $request->description) : null,
            'category' => $request->filled('category') ? trim((string) $request->category) : null,
            'is_active' => (bool) $request->is_active,
            'usage_count' => 0,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Placeholder created successfully.',
            'placeholder' => $this->formatPlaceholder($placeholder),
        ], 201);
    }

    public function update(Request $request, $id)
    {
        $placeholder = SignatoryPlaceholder::find($id);

        if (!$placeholder) {
            return response()->json([
                'success' => false,
                'message' => 'Placeholder not found.',
            ], 404);
        }

        $validator = $this->validatePayload($request, $placeholder);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Validation errors.',
                'errors' => $validator->errors(),
            ], 422);
        }

        $placeholder->update([
            'placeholder_key' => $request->placeholder_key,
            'raw_token' => $request->raw_token,
            'label' => trim((string) $request->label),
            'description' => $request->filled('description') ? trim((string) $request->description) : null,
            'category' => $request->filled('category') ? trim((string) $request->category) : null,
            'is_active' => (bool) $request->is_active,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Placeholder updated successfully.',
            'placeholder' => $this->formatPlaceholder($placeholder->fresh()),
        ], 200);
    }

    public function toggleStatus($id)
    {
        $placeholder = SignatoryPlaceholder::find($id);

        if (!$placeholder) {
            return response()->json([
                'success' => false,
                'message' => 'Placeholder not found.',
            ], 404);
        }

        $placeholder->is_active = !$placeholder->is_active;
        $placeholder->save();

        return response()->json([
            'success' => true,
            'message' => $placeholder->is_active
                ? 'Placeholder activated successfully.'
                : 'Placeholder deactivated successfully.',
            'placeholder' => $this->formatPlaceholder($placeholder->fresh()),
        ], 200);
    }

    public function destroy($id)
    {
        $placeholder = SignatoryPlaceholder::find($id);

        if (!$placeholder) {
            return response()->json([
                'success' => false,
                'message' => 'Placeholder not found.',
            ], 404);
        }

        $placeholder->delete();

        return response()->json([
            'success' => true,
            'message' => 'Placeholder deleted successfully.',
        ], 200);
    }
}
