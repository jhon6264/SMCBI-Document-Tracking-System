<?php

namespace App\Services;

use App\Models\SignatoryPlaceholder;

class SessionPlaceholderScanner
{
    public function extractRawTokens(array $document): array
    {
        $text = $this->flattenDocumentText($document);

        if ($text === '') {
            return [];
        }

        preg_match_all('/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/', $text, $matches);

        $tokens = [];
        foreach ($matches[1] ?? [] as $match) {
            $key = $this->normalizeKey((string) $match);
            if ($key === '') {
                continue;
            }

            $tokens[] = '{{' . $key . '}}';
        }

        return array_values(array_unique($tokens));
    }

    public function matchRegisteredPlaceholders(array $document): array
    {
        $rawTokens = $this->extractRawTokens($document);

        if (empty($rawTokens)) {
            return [
                'matched' => [],
                'unmatched' => [],
            ];
        }

        $registered = SignatoryPlaceholder::query()
            ->where('is_active', true)
            ->whereIn('raw_token', $rawTokens)
            ->get()
            ->keyBy('raw_token');

        $matched = [];
        $unmatched = [];

        foreach ($rawTokens as $rawToken) {
            $placeholder = $registered->get($rawToken);

            if ($placeholder) {
                $matched[] = [
                    'registry_placeholder_id' => $placeholder->id,
                    'placeholder_key' => $placeholder->placeholder_key,
                    'raw_token' => $placeholder->raw_token,
                    'label' => $placeholder->label,
                    'category' => $placeholder->category,
                ];
                continue;
            }

            $unmatched[] = [
                'raw_token' => $rawToken,
                'placeholder_key' => $this->normalizeKey(
                    trim(str_replace(['{{', '}}'], '', $rawToken))
                ),
            ];
        }

        return [
            'matched' => $matched,
            'unmatched' => $unmatched,
        ];
    }

    private function normalizeKey(string $value): string
    {
        $value = strtoupper(trim($value));
        $value = preg_replace('/\s+/', '_', $value);
        $value = preg_replace('/[^A-Z0-9_]/', '', $value);
        $value = preg_replace('/_+/', '_', $value);

        return trim((string) $value, '_');
    }

    private function flattenDocumentText(array $document): string
    {
        $content = $document['body']['content'] ?? [];
        $buffer = '';

        foreach ($content as $structuralElement) {
            $buffer .= $this->flattenStructuralElement($structuralElement);
        }

        return $buffer;
    }

    private function flattenStructuralElement(array $element): string
    {
        if (!empty($element['paragraph']['elements']) && is_array($element['paragraph']['elements'])) {
            $text = '';
            foreach ($element['paragraph']['elements'] as $paragraphElement) {
                $text .= (string) ($paragraphElement['textRun']['content'] ?? '');
            }

            return $text;
        }

        if (!empty($element['table']['tableRows']) && is_array($element['table']['tableRows'])) {
            $text = '';
            foreach ($element['table']['tableRows'] as $row) {
                foreach (($row['tableCells'] ?? []) as $cell) {
                    foreach (($cell['content'] ?? []) as $cellElement) {
                        $text .= $this->flattenStructuralElement($cellElement);
                    }
                }
            }

            return $text;
        }

        if (!empty($element['tableOfContents']['content']) && is_array($element['tableOfContents']['content'])) {
            $text = '';
            foreach ($element['tableOfContents']['content'] as $tocElement) {
                $text .= $this->flattenStructuralElement($tocElement);
            }

            return $text;
        }

        return '';
    }
}
