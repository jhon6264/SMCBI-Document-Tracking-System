<?php

namespace App\Services;

use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Response;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class GoogleWorkspaceService
{
    private const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
    private const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
    private const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1';
    private const PEOPLE_API_BASE = 'https://people.googleapis.com/v1';
    private const DOCS_API_BASE = 'https://docs.googleapis.com/v1';
    private const POPUP_REDIRECT_URI = 'postmessage';
    private const HTTP_CONNECT_TIMEOUT_SECONDS = 4;
    private const HTTP_TIMEOUT_SECONDS = 8;
    private const PREVIEW_HTTP_TIMEOUT_SECONDS = 30;
    private const GMAIL_MAX_RESULTS_LIMIT = 100;
    private const GMAIL_LIST_TIME_BUDGET_SECONDS = 18;
    private const DRIVE_CACHE_FRESH_SECONDS = 600;
    private const DRIVE_CACHE_MAX_STALE_SECONDS = 1800;
    private const GMAIL_CACHE_FRESH_SECONDS = 3600;
    private const GMAIL_CACHE_MAX_STALE_SECONDS = 3600;
    private const GMAIL_RECIPIENT_CACHE_SECONDS = 600;

    /**
     * @throws RuntimeException
     */
    public function getAuthStatus(User $user): array
    {
        return [
            'connected' => !empty($user->google_access_token),
            'has_refresh_token' => !empty($user->google_refresh_token),
            'expires_at' => $user->google_token_expires_at?->toIso8601String(),
            'scopes' => $user->google_token_scopes ?? [],
        ];
    }

    public function exchangeAuthorizationCode(string $code): array
    {
        $clientId = config('services.google.client_id');
        $clientSecret = config('services.google.client_secret');
        $redirectUri = config('services.google.redirect') ?: self::POPUP_REDIRECT_URI;

        if (!$clientId || !$clientSecret) {
            throw new RuntimeException('Google OAuth client credentials are missing.');
        }

        $response = Http::asForm()
            ->acceptJson()
            ->connectTimeout(self::HTTP_CONNECT_TIMEOUT_SECONDS)
            ->timeout(self::HTTP_TIMEOUT_SECONDS)
            ->post(self::TOKEN_ENDPOINT, [
                'client_id' => $clientId,
                'client_secret' => $clientSecret,
                'code' => $code,
                'grant_type' => 'authorization_code',
                'redirect_uri' => $redirectUri,
            ]);

        if (!$response->successful()) {
            $message = $response->json('error_description')
                ?: $response->json('error')
                ?: 'Unable to exchange authorization code.';

            throw new RuntimeException((string) $message);
        }

        return $response->json();
    }

    public function listDriveFiles(User $user, int $pageSize = 20): array
    {
        return $this->listDriveFilesByQuery($user, max(1, min($pageSize, 1000)), null, null);
    }

    public function listDriveFilesByQuery(
        User $user,
        int $pageSize = 30,
        ?string $search = null,
        ?string $parentId = null,
        string $section = 'my-drive',
        bool $forceRefresh = false
    ): array {
        $allowedSections = ['my-drive', 'shared', 'recent', 'starred', 'trash'];
        $safeSection = in_array($section, $allowedSections, true) ? $section : 'my-drive';
        $showTrashed = $safeSection === 'trash';
        $allowParentNavigation = in_array($safeSection, ['my-drive', 'shared'], true);
        $effectiveParentId = $allowParentNavigation ? $parentId : null;

        $queryParts = [];
        $queryParts[] = $showTrashed ? 'trashed = true' : 'trashed = false';

        // Shared root view: only items directly shared with the user.
        // Once a shared folder is opened, query children by parentId instead.
        if ($safeSection === 'shared' && !$effectiveParentId) {
            $queryParts[] = 'sharedWithMe';
        }

        if ($safeSection === 'starred') {
            $queryParts[] = 'starred = true';
        }

        if ($effectiveParentId) {
            $queryParts[] = "'{$effectiveParentId}' in parents";
        } elseif (!$search && $safeSection === 'my-drive') {
            // Mirror Google Drive root behavior when no folder/search is provided.
            $queryParts[] = "'root' in parents";
        }

        if ($search) {
            $safeSearch = str_replace("'", "\\'", $search);
            $queryParts[] = "name contains '{$safeSearch}'";
        }

        $cacheKey = $this->cacheKey($user->id, 'drive_files', [
            'query_version' => 4,
            'size' => max(1, min($pageSize, 1000)),
            'search' => $search ?: '',
            'parent' => $effectiveParentId ?: '',
            'section' => $safeSection,
        ]);

        return $this->resolveCachedResource(
            $cacheKey,
            self::DRIVE_CACHE_FRESH_SECONDS,
            self::DRIVE_CACHE_MAX_STALE_SECONDS,
            function () use ($user, $pageSize, $queryParts, $safeSection) {
                $orderBy = match ($safeSection) {
                    'recent' => 'viewedByMeTime desc,modifiedTime desc,name_natural asc',
                    'shared' => 'sharedWithMeTime desc,name_natural asc',
                    default => 'folder,name_natural asc,modifiedTime desc',
                };
                $targetSize = max(1, min($pageSize, 1000));
                $requestPageSize = min($targetSize, 200);
                $query = implode(' and ', $queryParts);
                $files = [];
                $pageToken = null;

                do {
                    $queryParams = [
                        'pageSize' => $requestPageSize,
                        'orderBy' => $orderBy,
                        'q' => $query,
                        'supportsAllDrives' => 'true',
                        'includeItemsFromAllDrives' => 'true',
                        'spaces' => 'drive',
                        'fields' => 'nextPageToken,files(id,name,mimeType,modifiedTime,owners(displayName,emailAddress),webViewLink,webContentLink,size,thumbnailLink,iconLink)',
                    ];

                    if ($pageToken) {
                        $queryParams['pageToken'] = $pageToken;
                    }

                    $response = $this->request($user, 'GET', self::DRIVE_API_BASE.'/files', [
                        'query' => $queryParams,
                    ])->json();

                    $files = array_merge($files, $response['files'] ?? []);
                    $pageToken = $response['nextPageToken'] ?? null;
                } while ($pageToken && count($files) < $targetSize);

                return [
                    'files' => array_slice($files, 0, $targetSize),
                ];
            },
            $forceRefresh
        );
    }

    public function invalidateUserCache(User $user): void
    {
        $this->bumpCacheVersion($user->id);
    }

    public function shareDriveFile(
        User $user,
        string $fileId,
        string $email,
        string $role = 'reader',
        bool $sendNotificationEmail = true
    ): array {
        $response = $this->request(
            $user,
            'POST',
            self::DRIVE_API_BASE."/files/{$fileId}/permissions",
            [
                'query' => [
                    'sendNotificationEmail' => $sendNotificationEmail ? 'true' : 'false',
                ],
                'json' => [
                    'type' => 'user',
                    'role' => $role,
                    'emailAddress' => $email,
                ],
            ]
        );

        $this->bumpCacheVersion($user->id);
        return $response->json();
    }

    public function ensureDriveFileShared(
        User $user,
        string $fileId,
        string $email,
        string $role = 'reader',
        bool $sendNotificationEmail = false
    ): ?array {
        try {
            return $this->shareDriveFile($user, $fileId, $email, $role, $sendNotificationEmail);
        } catch (RuntimeException $exception) {
            $message = strtolower($exception->getMessage());

            if (
                str_contains($message, 'already') &&
                (str_contains($message, 'permission') || str_contains($message, 'access'))
            ) {
                return null;
            }

            throw $exception;
        }
    }

    public function archiveDriveFile(
        User $user,
        string $fileId,
        ?string $destinationFolderId = null
    ): array {
        $payload = [
            'name' => 'Archived_'.now()->format('Ymd_His'),
        ];

        if ($destinationFolderId) {
            $payload['parents'] = [$destinationFolderId];
        }

        $response = $this->request(
            $user,
            'POST',
            self::DRIVE_API_BASE."/files/{$fileId}/copy",
            [
                'json' => $payload,
            ]
        );

        $this->bumpCacheVersion($user->id);
        return $response->json();
    }

    public function getDriveFileMeta(User $user, string $fileId): array
    {
        $response = $this->request(
            $user,
            'GET',
            self::DRIVE_API_BASE . "/files/{$fileId}",
            [
                'query' => [
                    'supportsAllDrives' => 'true',
                    'fields' => 'id,name,mimeType,webViewLink,iconLink,parents',
                ],
            ]
        );

        return $response->json();
    }

    public function getDrivePreviewContent(User $user, string $fileId): array
    {
        $meta = $this->request(
            $user,
            'GET',
            self::DRIVE_API_BASE . "/files/{$fileId}",
            [
                'query' => [
                    'supportsAllDrives' => 'true',
                    'fields' => 'id,name,mimeType,modifiedTime',
                ],
            ]
        )->json();

        $mimeType = (string) ($meta['mimeType'] ?? '');
        $filename = (string) ($meta['name'] ?? 'preview');
        $modifiedTime = (string) ($meta['modifiedTime'] ?? '');

        $cacheKey = $this->cacheKey($user->id, 'drive_preview_content', [
            'file_id' => $fileId,
            'mime' => $mimeType,
            'modified' => $modifiedTime,
        ]);

        $cached = Cache::get($cacheKey);
        if (is_array($cached) && isset($cached['content'], $cached['content_type'])) {
            return $cached;
        }

        $isGoogleNative = in_array($mimeType, [
            'application/vnd.google-apps.document',
            'application/vnd.google-apps.spreadsheet',
            'application/vnd.google-apps.presentation',
        ], true);

        if ($isGoogleNative) {
            $response = $this->requestRaw(
                $user,
                'GET',
                self::DRIVE_API_BASE . "/files/{$fileId}/export",
                [
                    'timeout_seconds' => self::PREVIEW_HTTP_TIMEOUT_SECONDS,
                    'query' => [
                        'mimeType' => 'application/pdf',
                        'supportsAllDrives' => 'true',
                    ],
                ]
            );

            $payload = [
                'content' => $response->body(),
                'content_type' => 'application/pdf',
                'filename' => preg_replace('/\.[^.]+$/', '', $filename) . '.pdf',
            ];

            Cache::put($cacheKey, $payload, now()->addMinutes(10));
            return $payload;
        }

        if ($this->isOfficeConvertibleMime($mimeType)) {
            throw new RuntimeException('Office preview is handled in the Google Drive embedded viewer.');
        }

        if ($mimeType !== 'application/pdf') {
            throw new RuntimeException('PDF-only preview mode is active. Convert this file to PDF first.');
        }

        $response = $this->requestRaw(
            $user,
            'GET',
            self::DRIVE_API_BASE . "/files/{$fileId}",
            [
                'timeout_seconds' => self::PREVIEW_HTTP_TIMEOUT_SECONDS,
                'query' => [
                    'alt' => 'media',
                    'supportsAllDrives' => 'true',
                ],
            ]
        );

        $contentType = (string) ($response->header('Content-Type') ?: $mimeType ?: 'application/octet-stream');
        $payload = [
            'content' => $response->body(),
            'content_type' => $contentType,
            'filename' => $filename,
        ];

        Cache::put($cacheKey, $payload, now()->addMinutes(10));
        return $payload;
    }

    private function isOfficeConvertibleMime(string $mimeType): bool
    {
        return in_array($mimeType, [
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'application/vnd.ms-powerpoint',
        ], true);
    }

    public function createDriveFolder(
        User $user,
        string $name,
        ?string $parentId = null
    ): array {
        $payload = [
            'name' => $name,
            'mimeType' => 'application/vnd.google-apps.folder',
        ];

        if ($parentId) {
            $payload['parents'] = [$parentId];
        }

        $response = $this->request($user, 'POST', self::DRIVE_API_BASE.'/files', [
            'json' => $payload,
        ]);

        $this->bumpCacheVersion($user->id);
        return $response->json();
    }

    public function findDriveFolderByName(
        User $user,
        string $name,
        ?string $parentId = null
    ): ?array {
        $safeName = trim($name);
        if ($safeName === '') {
            return null;
        }

        $escapedName = str_replace("'", "\\'", $safeName);
        $parentConstraint = $parentId ? "'{$parentId}' in parents" : "'root' in parents";

        $response = $this->request($user, 'GET', self::DRIVE_API_BASE.'/files', [
            'query' => [
                'pageSize' => 1,
                'orderBy' => 'createdTime asc',
                'q' => sprintf(
                    "trashed = false and mimeType = 'application/vnd.google-apps.folder' and name = '%s' and %s",
                    $escapedName,
                    $parentConstraint
                ),
                'supportsAllDrives' => 'true',
                'includeItemsFromAllDrives' => 'true',
                'spaces' => 'drive',
                'fields' => 'files(id,name,mimeType,webViewLink,iconLink)',
            ],
        ])->json();

        return $response['files'][0] ?? null;
    }

    public function ensureDriveFolder(User $user, string $name, ?string $parentId = null): array
    {
        $folder = $this->findDriveFolderByName($user, $name, $parentId);
        if ($folder) {
            return $folder;
        }

        $createdFolder = $this->createDriveFolder($user, $name, $parentId);
        $folderId = (string) ($createdFolder['id'] ?? '');
        if ($folderId === '') {
            throw new RuntimeException('Google Drive folder was created but no folder id was returned.');
        }

        return $this->getDriveFileMeta($user, $folderId);
    }

    public function ensureSystemDriveFolder(User $user, string $name = 'SMCBI_DTS'): array
    {
        $safeName = trim($name);
        if ($safeName === '') {
            throw new RuntimeException('Folder name is required.');
        }

        $folder = $this->ensureDriveFolder($user, $safeName);

        $contents = $this->listDriveFilesByQuery(
            $user,
            200,
            null,
            (string) ($folder['id'] ?? ''),
            'my-drive',
            true
        );

        return [
            'folder' => $folder,
            'files' => $contents['data']['files'] ?? [],
            'meta' => $contents['meta'] ?? null,
        ];
    }

    public function ensureSignatureDriveFolder(User $user): array
    {
        $systemFolder = $this->ensureSystemDriveFolder($user, 'SMCBI_DTS');
        $signaturesFolder = $this->ensureDriveFolder(
            $user,
            'Signatures',
            (string) ($systemFolder['folder']['id'] ?? '')
        );

        return $this->ensureDriveFolder($user, 'user_' . $user->id, (string) ($signaturesFolder['id'] ?? ''));
    }

    public function makeDriveFilePublic(User $user, string $fileId): array
    {
        $response = $this->request(
            $user,
            'POST',
            self::DRIVE_API_BASE."/files/{$fileId}/permissions",
            [
                'query' => [
                    'sendNotificationEmail' => 'false',
                ],
                'json' => [
                    'type' => 'anyone',
                    'role' => 'reader',
                ],
            ]
        );

        $this->bumpCacheVersion($user->id);
        return $response->json();
    }

    public function getDrivePublicImageUrl(string $fileId): string
    {
        return 'https://drive.google.com/uc?export=view&id=' . urlencode($fileId);
    }

    public function deleteDriveFile(User $user, string $fileId): bool
    {
        $response = $this->request($user, 'DELETE', self::DRIVE_API_BASE."/files/{$fileId}");

        $deleted = $response->successful();
        if ($deleted) {
            $this->bumpCacheVersion($user->id);
        }

        return $deleted;
    }

    public function uploadDriveFile(
        User $user,
        string $filename,
        string $contents,
        string $mimeType,
        ?string $parentId = null,
        ?string $targetMimeType = null
    ): array {
        $metadata = [
            'name' => $filename,
        ];

        if ($targetMimeType) {
            $metadata['mimeType'] = $targetMimeType;
        }

        if ($parentId) {
            $metadata['parents'] = [$parentId];
        }

        $response = $this->request(
            $user,
            'POST',
            'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
            [
                'multipart' => [
                    [
                        'name' => 'metadata',
                        'contents' => json_encode($metadata, JSON_UNESCAPED_SLASHES),
                        'headers' => [
                            'Content-Type' => 'application/json; charset=UTF-8',
                        ],
                    ],
                    [
                        'name' => 'file',
                        'contents' => $contents,
                        'filename' => $filename,
                        'headers' => [
                            'Content-Type' => $mimeType ?: 'application/octet-stream',
                        ],
                    ],
                ],
            ]
        );

        $this->bumpCacheVersion($user->id);
        return $response->json();
    }

    public function downloadDriveBinary(User $user, string $fileId): array
    {
        $meta = $this->getDriveFileMeta($user, $fileId);
        $mimeType = (string) ($meta['mimeType'] ?? '');

        if (str_starts_with($mimeType, 'application/vnd.google-apps.')) {
            throw new RuntimeException('Google-native files should not be downloaded through the binary conversion path.');
        }

        $response = $this->requestRaw(
            $user,
            'GET',
            self::DRIVE_API_BASE . "/files/{$fileId}",
            [
                'timeout_seconds' => self::PREVIEW_HTTP_TIMEOUT_SECONDS,
                'query' => [
                    'alt' => 'media',
                    'supportsAllDrives' => 'true',
                ],
            ]
        );

        return [
            'meta' => $meta,
            'content' => $response->body(),
            'content_type' => (string) ($response->header('Content-Type') ?: $mimeType ?: 'application/octet-stream'),
        ];
    }

    public function createGoogleDocFromDriveFile(
        User $user,
        string $sourceFileId,
        ?string $parentId = null,
        ?string $targetName = null
    ): array {
        $downloaded = $this->downloadDriveBinary($user, $sourceFileId);
        $meta = $downloaded['meta'] ?? [];
        $sourceName = (string) ($meta['name'] ?? 'Converted document');
        $resolvedName = trim((string) ($targetName ?: preg_replace('/\.[^.]+$/', '', $sourceName)));

        if ($resolvedName === '') {
            $resolvedName = 'Converted document';
        }

        $converted = $this->uploadDriveFile(
            $user,
            $resolvedName,
            (string) ($downloaded['content'] ?? ''),
            (string) ($downloaded['content_type'] ?? 'application/octet-stream'),
            $parentId,
            'application/vnd.google-apps.document'
        );

        return $this->getDriveFileMeta($user, (string) ($converted['id'] ?? ''));
    }

    public function listGmailMessages(
        User $user,
        int $maxResults = 8,
        ?string $query = null,
        ?string $pageToken = null,
        bool $forceRefresh = false
    ): array
    {
        $safeMaxResults = max(1, min($maxResults, self::GMAIL_MAX_RESULTS_LIMIT));
        $safePageToken = is_string($pageToken) && trim($pageToken) !== '' ? trim($pageToken) : null;

        $cacheKey = $this->cacheKey($user->id, 'gmail_messages', [
            'max' => $safeMaxResults,
            'q' => $query ?: '',
            'page' => $safePageToken ?: '',
        ]);

        return $this->resolveCachedResource(
            $cacheKey,
            self::GMAIL_CACHE_FRESH_SECONDS,
            self::GMAIL_CACHE_MAX_STALE_SECONDS,
            function () use ($user, $safeMaxResults, $query, $safePageToken) {
                $startedAt = microtime(true);

                $response = $this->request($user, 'GET', self::GMAIL_API_BASE.'/users/me/messages', [
                    'query' => array_filter([
                        'maxResults' => $safeMaxResults,
                        'q' => $query,
                        'pageToken' => $safePageToken,
                    ]),
                ]);

                $messageIds = $response->json('messages', []);
                $nextPageToken = (string) ($response->json('nextPageToken') ?? '');
                $messages = [];
                $truncated = false;

                foreach ($messageIds as $message) {
                    if ((microtime(true) - $startedAt) >= self::GMAIL_LIST_TIME_BUDGET_SECONDS) {
                        $truncated = true;
                        break;
                    }

                    $messageId = (string) ($message['id'] ?? '');

                    if ($messageId === '') {
                        continue;
                    }

                    try {
                        $messageResponse = $this->request(
                            $user,
                            'GET',
                            self::GMAIL_API_BASE."/users/me/messages/{$messageId}",
                            [
                                'query' => [
                                    'format' => 'metadata',
                                'metadataHeaders' => ['Subject', 'From', 'To', 'Date'],
                                'fields' => 'id,threadId,labelIds,internalDate,snippet,payload/headers',
                            ],
                        ]
                        );
                    } catch (RuntimeException) {
                        continue;
                    }

                    $payloadHeaders = $messageResponse->json('payload.headers', []);
                    $labelIds = $messageResponse->json('labelIds', []);
                    $internalDate = $messageResponse->json('internalDate');

                    $messages[] = [
                        'id' => $messageId,
                        'threadId' => (string) ($messageResponse->json('threadId') ?? ''),
                        'subject' => $this->extractHeader($payloadHeaders, 'Subject') ?: '(No subject)',
                        'from' => $this->extractHeader($payloadHeaders, 'From') ?: '-',
                        'to' => $this->extractHeader($payloadHeaders, 'To') ?: '-',
                        'receivedAt' => $internalDate
                            ? Carbon::createFromTimestampMs((int) $internalDate)->toDateTimeString()
                            : ($this->extractHeader($payloadHeaders, 'Date') ?: '-'),
                        'status' => in_array('UNREAD', $labelIds, true) ? 'Unread' : 'Read',
                        'snippet' => (string) ($messageResponse->json('snippet') ?? ''),
                    ];
                }

                return [
                    'messages' => $messages,
                    'nextPageToken' => $nextPageToken,
                    'summary' => [
                        'truncated' => $truncated,
                        'requested' => $safeMaxResults,
                        'returned' => count($messages),
                    ],
                ];
            },
            $forceRefresh
        );
    }

    public function sendGmailMessage(
        User $user,
        string $to,
        string $subject,
        string $body,
        array $attachments = []
    ): array
    {
        $raw = $this->buildRawMimeMessage($to, $subject, $body, $attachments);

        $encodedMessage = rtrim(strtr(base64_encode($raw), '+/', '-_'), '=');

        $response = $this->request($user, 'POST', self::GMAIL_API_BASE.'/users/me/messages/send', [
            'json' => [
                'raw' => $encodedMessage,
            ],
        ]);

        $this->bumpCacheVersion($user->id);
        return $response->json();
    }

    public function getGmailSummary(User $user): array
    {
        $cacheKey = $this->cacheKey($user->id, 'gmail_summary');

        return Cache::remember($cacheKey, now()->addMinutes(5), function () use ($user) {
            $response = $this->request($user, 'GET', self::GMAIL_API_BASE.'/users/me/labels');
            $labels = $response->json('labels', []);

            $result = [
                'inboxTotal' => 0,
                'inboxUnread' => null,
                'sentTotal' => 0,
                'draftsTotal' => 0,
            ];

            foreach ($labels as $label) {
                $id = (string) ($label['id'] ?? '');
                $total = (int) ($label['messagesTotal'] ?? 0);
                $unread = (int) ($label['messagesUnread'] ?? 0);
                $threadsUnread = (int) ($label['threadsUnread'] ?? 0);

                if ($id === 'INBOX') {
                    $result['inboxTotal'] = $total;
                    $result['inboxUnread'] = max($unread, $threadsUnread);
                } elseif ($id === 'SENT') {
                    $result['sentTotal'] = $total;
                } elseif ($id === 'DRAFT') {
                    $result['draftsTotal'] = $total;
                }
            }

            $unreadEstimate = $this->request($user, 'GET', self::GMAIL_API_BASE.'/users/me/messages', [
                'query' => [
                    'maxResults' => 1,
                    'q' => 'in:inbox is:unread',
                ],
            ])->json('resultSizeEstimate');

            if (is_numeric($unreadEstimate)) {
                $result['inboxUnread'] = (int) $unreadEstimate;
            }

            if (!is_int($result['inboxUnread'])) {
                $result['inboxUnread'] = 0;
            }

            return $result;
        });
    }

    public function warmGmailMessagesPage(
        User $user,
        ?string $query,
        string $pageToken,
        int $maxResults = 30
    ): void {
        if (trim($pageToken) === '') {
            return;
        }

        try {
            $this->listGmailMessages(
                $user,
                max(1, min($maxResults, 60)),
                $query,
                $pageToken,
                true
            );
        } catch (RuntimeException) {
            // Best-effort hydration only.
        }
    }

    public function listGmailRecipientSuggestions(User $user, string $search = '', int $limit = 8): array
    {
        $safeLimit = max(1, min($limit, 20));
        $needle = strtolower(trim($search));
        $cacheKey = $this->cacheKey($user->id, 'gmail_recipients', [
            'needle' => $needle,
            'limit' => $safeLimit,
        ]);

        $cached = Cache::get($cacheKey);
        if (is_array($cached)) {
            return $cached;
        }

        $suggestions = [];

        $addSuggestion = function (string $email, ?string $name = null) use (&$suggestions, $needle): void {
            $email = trim($email);
            $name = trim((string) $name);

            if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
                return;
            }

            if ($needle !== '' && !str_contains(strtolower($email . ' ' . $name), $needle)) {
                return;
            }

            $key = strtolower($email);
            if (isset($suggestions[$key])) {
                return;
            }

            $suggestions[$key] = [
                'email' => $email,
                'name' => $name,
                'label' => $name !== '' ? "{$name} <{$email}>" : $email,
            ];
        };

        try {
            $connections = $this->request($user, 'GET', self::PEOPLE_API_BASE.'/people/me/connections', [
                'query' => [
                    'personFields' => 'names,emailAddresses',
                    'pageSize' => 200,
                ],
            ])->json('connections', []);

            foreach ($connections as $connection) {
                $name = (string) ($connection['names'][0]['displayName'] ?? '');
                $addresses = $connection['emailAddresses'] ?? [];

                foreach ($addresses as $address) {
                    $addSuggestion((string) ($address['value'] ?? ''), $name);
                }
            }

            if ($needle !== '') {
                $matches = $this->request($user, 'POST', self::PEOPLE_API_BASE.'/people:searchContacts', [
                    'json' => [
                        'query' => $search,
                        'pageSize' => 8,
                        'readMask' => 'names,emailAddresses',
                    ],
                ])->json('results', []);

                foreach ($matches as $match) {
                    $person = $match['person'] ?? [];
                    $name = (string) ($person['names'][0]['displayName'] ?? '');
                    $addresses = $person['emailAddresses'] ?? [];

                    foreach ($addresses as $address) {
                        $addSuggestion((string) ($address['value'] ?? ''), $name);
                    }
                }
            }
        } catch (RuntimeException) {
            // Contacts scope/API can be unavailable. Fallback to Gmail senders.
        }

        if (count($suggestions) >= $safeLimit) {
            $result = array_values(array_slice($suggestions, 0, $safeLimit, true));
            Cache::put($cacheKey, $result, now()->addSeconds(self::GMAIL_RECIPIENT_CACHE_SECONDS));
            return $result;
        }

        $messages = $this->listGmailMessages($user, 12, null, null, false);
        $sentMessages = $this->listGmailMessages($user, 20, 'in:sent', null, false);
        $messageItems = array_merge(
            $messages['data']['messages'] ?? [],
            $sentMessages['data']['messages'] ?? []
        );

        foreach ($messageItems as $message) {
            foreach ([(string) ($message['from'] ?? ''), (string) ($message['to'] ?? '')] as $header) {
                $parsedItems = $this->parseMailboxAddresses($header);
                foreach ($parsedItems as $parsed) {
                    $addSuggestion($parsed['email'], $parsed['name']);
                }
            }
        }

        $result = array_values(array_slice($suggestions, 0, $safeLimit, true));
        Cache::put($cacheKey, $result, now()->addSeconds(self::GMAIL_RECIPIENT_CACHE_SECONDS));
        return $result;
    }

    public function getGmailMessage(User $user, string $messageId): array
    {
        $cacheKey = $this->cacheKey($user->id, 'gmail_message', ['id' => $messageId]);

        return Cache::remember($cacheKey, now()->addMinutes(1), function () use ($user, $messageId) {
            $response = $this->request(
            $user,
            'GET',
            self::GMAIL_API_BASE."/users/me/messages/{$messageId}",
            [
                'query' => [
                    'format' => 'full',
                ],
            ]
            );

            $headers = $response->json('payload.headers', []);
            $labelIds = $response->json('labelIds', []);
            $internalDate = $response->json('internalDate');
            $body = $this->extractGmailBody($response->json('payload'));

            return [
                'id' => (string) $response->json('id'),
                'threadId' => (string) $response->json('threadId'),
                'subject' => $this->extractHeader($headers, 'Subject') ?: '(No subject)',
                'from' => $this->extractHeader($headers, 'From') ?: '-',
                'to' => $this->extractHeader($headers, 'To') ?: '-',
                'date' => $this->extractHeader($headers, 'Date') ?: '-',
                'receivedAt' => $internalDate
                    ? Carbon::createFromTimestampMs((int) $internalDate)->toDateTimeString()
                    : '-',
                'status' => in_array('UNREAD', $labelIds, true) ? 'Unread' : 'Read',
                'snippet' => (string) $response->json('snippet', ''),
                'body' => $body,
                'labelIds' => $labelIds,
            ];
        });
    }

    public function modifyGmailMessage(User $user, string $messageId, bool $markAsRead): array
    {
        $payload = $markAsRead
            ? [
                'removeLabelIds' => ['UNREAD'],
            ]
            : [
                'addLabelIds' => ['UNREAD'],
            ];

        $response = $this->request(
            $user,
            'POST',
            self::GMAIL_API_BASE."/users/me/messages/{$messageId}/modify",
            [
                'json' => $payload,
            ]
        );

        $this->bumpCacheVersion($user->id);
        return $response->json();
    }

    public function replyGmailMessage(User $user, string $messageId, string $body): array
    {
        $original = $this->getGmailMessage($user, $messageId);
        $to = $this->extractEmailAddress($original['from']);
        $subject = $original['subject'] ?? '(No subject)';
        $replySubject = str_starts_with(strtolower($subject), 're:') ? $subject : "Re: {$subject}";

        $raw = "To: {$to}\r\n";
        $raw .= "Subject: {$replySubject}\r\n";
        $raw .= "Content-Type: text/plain; charset=utf-8\r\n\r\n";
        $raw .= $body;

        $encodedMessage = rtrim(strtr(base64_encode($raw), '+/', '-_'), '=');

        $response = $this->request($user, 'POST', self::GMAIL_API_BASE.'/users/me/messages/send', [
            'json' => [
                'threadId' => $original['threadId'],
                'raw' => $encodedMessage,
            ],
        ]);

        $this->bumpCacheVersion($user->id);
        return $response->json();
    }

    public function getDocument(User $user, string $documentId): array
    {
        $response = $this->request(
            $user,
            'GET',
            self::DOCS_API_BASE."/documents/{$documentId}",
            [
                'query' => [
                    'includeTabsContent' => 'false',
                ],
            ]
        );

        return $response->json();
    }

    public function replaceDocumentText(User $user, string $documentId, string $text): array
    {
        $document = $this->getDocument($user, $documentId);
        $existingRange = $this->resolveDocumentTextRange($document);
        $requests = [];

        if ($existingRange['endIndex'] > $existingRange['startIndex']) {
            $requests[] = [
                'deleteContentRange' => [
                    'range' => [
                        'startIndex' => $existingRange['startIndex'],
                        'endIndex' => $existingRange['endIndex'],
                    ],
                ],
            ];
        }

        if ($text !== '') {
            $requests[] = [
                'insertText' => [
                    'location' => [
                        'index' => 1,
                    ],
                    'text' => $text,
                ],
            ];
        }

        if (!empty($requests)) {
            $this->request(
                $user,
                'POST',
                self::DOCS_API_BASE."/documents/{$documentId}:batchUpdate",
                [
                    'json' => [
                        'requests' => $requests,
                    ],
                ]
            );
        }

        return $this->getDocument($user, $documentId);
    }

    public function replaceDocumentPlaceholderWithImage(
        User $user,
        string $documentId,
        string $placeholderToken,
        string $imageUrl
    ): array {
        $document = $this->getDocument($user, $documentId);
        $range = $this->findDocumentTextRange($document, $placeholderToken);

        if (!$range) {
            throw new RuntimeException("Placeholder {$placeholderToken} was not found in the document.");
        }

        $this->request(
            $user,
            'POST',
            self::DOCS_API_BASE."/documents/{$documentId}:batchUpdate",
            [
                'json' => [
                    'requests' => [
                        [
                            'deleteContentRange' => [
                                'range' => [
                                    'startIndex' => $range['startIndex'],
                                    'endIndex' => $range['endIndex'],
                                ],
                            ],
                        ],
                        [
                            'insertInlineImage' => [
                                'location' => [
                                    'index' => $range['startIndex'],
                                ],
                                'uri' => $imageUrl,
                                'objectSize' => [
                                    'height' => [
                                        'magnitude' => 60,
                                        'unit' => 'PT',
                                    ],
                                    'width' => [
                                        'magnitude' => 220,
                                        'unit' => 'PT',
                                    ],
                                ],
                            ],
                        ],
                    ],
                ],
            ]
        );

        return $this->getDocument($user, $documentId);
    }


    private function resolveDocumentTextRange(array $document): array
    {
        $body = $document['body']['content'] ?? [];
        $maxEndIndex = 1;

        foreach ($body as $item) {
            $end = (int) ($item['endIndex'] ?? 1);
            if ($end > $maxEndIndex) {
                $maxEndIndex = $end;
            }
        }

        return [
            'startIndex' => 1,
            'endIndex' => max(1, $maxEndIndex - 1),
        ];
    }

    private function findDocumentTextRange(array $document, string $needle): ?array
    {
        $needle = (string) $needle;
        if ($needle === '') {
            return null;
        }

        foreach (($document['body']['content'] ?? []) as $element) {
            $range = $this->findTextRangeInStructuralElement($element, $needle);
            if ($range) {
                return $range;
            }
        }

        return null;
    }

    private function findTextRangeInStructuralElement(array $element, string $needle): ?array
    {
        if (!empty($element['paragraph']['elements']) && is_array($element['paragraph']['elements'])) {
            $segments = [];
            $buffer = '';

            foreach ($element['paragraph']['elements'] as $paragraphElement) {
                $text = (string) ($paragraphElement['textRun']['content'] ?? '');
                if ($text === '') {
                    continue;
                }

                $segments[] = [
                    'text' => $text,
                    'startIndex' => (int) ($paragraphElement['startIndex'] ?? 0),
                    'endIndex' => (int) ($paragraphElement['endIndex'] ?? 0),
                    'bufferStart' => strlen($buffer),
                    'bufferEnd' => strlen($buffer) + strlen($text),
                ];
                $buffer .= $text;
            }

            $position = strpos($buffer, $needle);
            if ($position === false) {
                return null;
            }

            $startIndex = null;
            $endIndex = null;
            $targetStart = $position;
            $targetEnd = $position + strlen($needle);

            foreach ($segments as $segment) {
                if ($startIndex === null && $targetStart >= $segment['bufferStart'] && $targetStart < $segment['bufferEnd']) {
                    $startIndex = $segment['startIndex'] + ($targetStart - $segment['bufferStart']);
                }

                if ($targetEnd > $segment['bufferStart'] && $targetEnd <= $segment['bufferEnd']) {
                    $endIndex = $segment['startIndex'] + ($targetEnd - $segment['bufferStart']);
                    break;
                }
            }

            if ($startIndex !== null && $endIndex !== null && $endIndex > $startIndex) {
                return [
                    'startIndex' => $startIndex,
                    'endIndex' => $endIndex,
                ];
            }
        }

        if (!empty($element['table']['tableRows']) && is_array($element['table']['tableRows'])) {
            foreach ($element['table']['tableRows'] as $row) {
                foreach (($row['tableCells'] ?? []) as $cell) {
                    foreach (($cell['content'] ?? []) as $cellElement) {
                        $range = $this->findTextRangeInStructuralElement($cellElement, $needle);
                        if ($range) {
                            return $range;
                        }
                    }
                }
            }
        }

        if (!empty($element['tableOfContents']['content']) && is_array($element['tableOfContents']['content'])) {
            foreach ($element['tableOfContents']['content'] as $tocElement) {
                $range = $this->findTextRangeInStructuralElement($tocElement, $needle);
                if ($range) {
                    return $range;
                }
            }
        }

        return null;
    }

    /**
     * @throws RuntimeException
     */
    private function request(User $user, string $method, string $url, array $options = []): Response
    {
        $accessToken = $this->ensureValidAccessToken($user);

        try {
            $response = Http::withToken($accessToken)
                ->acceptJson()
                ->connectTimeout(self::HTTP_CONNECT_TIMEOUT_SECONDS)
                ->timeout(self::HTTP_TIMEOUT_SECONDS)
                ->send($method, $url, $options);
        } catch (ConnectionException $exception) {
            throw new RuntimeException('Failed to connect to Google services.');
        }

        if ($response->status() === 401 && $user->google_refresh_token) {
            $this->refreshAccessToken($user);

            $response = Http::withToken($user->google_access_token)
                ->acceptJson()
                ->connectTimeout(self::HTTP_CONNECT_TIMEOUT_SECONDS)
                ->timeout(self::HTTP_TIMEOUT_SECONDS)
                ->send($method, $url, $options);
        }

        if (!$response->successful()) {
            throw new RuntimeException($this->extractApiErrorMessage($response, 'Google API request failed.'));
        }

        return $response;
    }

    /**
     * @throws RuntimeException
     */
    private function requestRaw(User $user, string $method, string $url, array $options = []): Response
    {
        $accessToken = $this->ensureValidAccessToken($user);
        $timeoutSeconds = (int) ($options['timeout_seconds'] ?? self::HTTP_TIMEOUT_SECONDS);
        unset($options['timeout_seconds']);

        try {
            $response = Http::withToken($accessToken)
                ->connectTimeout(self::HTTP_CONNECT_TIMEOUT_SECONDS)
                ->timeout(max(1, $timeoutSeconds))
                ->send($method, $url, $options);
        } catch (ConnectionException $exception) {
            throw new RuntimeException('Failed to connect to Google services.');
        }

        if ($response->status() === 401 && $user->google_refresh_token) {
            $this->refreshAccessToken($user);

            $response = Http::withToken($user->google_access_token)
                ->connectTimeout(self::HTTP_CONNECT_TIMEOUT_SECONDS)
                ->timeout(max(1, $timeoutSeconds))
                ->send($method, $url, $options);
        }

        if (!$response->successful()) {
            throw new RuntimeException($this->extractApiErrorMessage($response, 'Google API request failed.'));
        }

        return $response;
    }

    private function extractApiErrorMessage(Response $response, string $fallback): string
    {
        $message = $fallback;
        $decoded = $response->json();

        if (is_array($decoded)) {
            $candidate = $decoded['error']['message']
                ?? $decoded['error']
                ?? $decoded['message']
                ?? null;

            if (is_string($candidate) && trim($candidate) !== '') {
                $message = $candidate;
            } elseif (is_scalar($candidate)) {
                $message = (string) $candidate;
            }
        }

        // Prevent malformed UTF-8 from breaking JSON error responses.
        $normalized = @iconv('UTF-8', 'UTF-8//IGNORE', (string) $message);
        if (!is_string($normalized) || trim($normalized) === '') {
            return $fallback;
        }

        return $normalized;
    }

    /**
     * @throws RuntimeException
     */
    private function ensureValidAccessToken(User $user): string
    {
        if (!$user->google_access_token) {
            throw new RuntimeException('Google account is not connected yet.');
        }

        $expiresAt = $user->google_token_expires_at;
        if ($expiresAt && Carbon::parse($expiresAt)->greaterThan(now()->addMinute())) {
            return $user->google_access_token;
        }

        if (!$user->google_refresh_token) {
            return $user->google_access_token;
        }

        $this->refreshAccessToken($user);

        if (!$user->google_access_token) {
            throw new RuntimeException('Google access token is not available.');
        }

        return $user->google_access_token;
    }

    /**
     * @throws RuntimeException
     */
    private function refreshAccessToken(User $user): void
    {
        $clientId = config('services.google.client_id');
        $clientSecret = config('services.google.client_secret');

        if (!$clientId || !$clientSecret || !$user->google_refresh_token) {
            throw new RuntimeException('Google token refresh is not configured.');
        }

        $response = Http::asForm()
            ->acceptJson()
            ->connectTimeout(self::HTTP_CONNECT_TIMEOUT_SECONDS)
            ->timeout(self::HTTP_TIMEOUT_SECONDS)
            ->post(self::TOKEN_ENDPOINT, [
                'client_id' => $clientId,
                'client_secret' => $clientSecret,
                'refresh_token' => $user->google_refresh_token,
                'grant_type' => 'refresh_token',
            ]);

        if (!$response->successful()) {
            $message = $response->json('error_description')
                ?: $response->json('error')
                ?: 'Unable to refresh Google access token.';
            throw new RuntimeException((string) $message);
        }

        $this->bumpCacheVersion($user->id);
        $user->google_access_token = (string) $response->json('access_token');
        $user->google_token_expires_at = now()->addSeconds((int) $response->json('expires_in', 3600));
        $user->save();
    }

    /**
     * @param callable():array $resolver
     */
    private function resolveCachedResource(
        string $cacheKey,
        int $freshSeconds,
        int $maxStaleSeconds,
        callable $resolver,
        bool $forceRefresh = false
    ): array {
        $now = now();
        $cached = Cache::get($cacheKey);
        $cachedPayload = is_array($cached) ? ($cached['payload'] ?? null) : null;
        $cachedAtRaw = is_array($cached) ? ($cached['cached_at'] ?? null) : null;
        $cachedAt = is_string($cachedAtRaw) ? Carbon::parse($cachedAtRaw) : null;

        if (!$forceRefresh && is_array($cachedPayload) && $cachedAt) {
            $ageSeconds = $cachedAt->diffInSeconds($now);
            if ($ageSeconds <= $maxStaleSeconds) {
                return [
                    'data' => $cachedPayload,
                    'meta' => [
                        'source' => 'cache',
                        'cachedAt' => $cachedAt->toIso8601String(),
                        'stale' => $ageSeconds > $freshSeconds,
                    ],
                ];
            }
        }

        $payload = $resolver();
        $cachedAt = now();

        Cache::put(
            $cacheKey,
            [
                'payload' => $payload,
                'cached_at' => $cachedAt->toIso8601String(),
            ],
            now()->addSeconds($maxStaleSeconds)
        );

        return [
            'data' => $payload,
            'meta' => [
                'source' => 'google',
                'cachedAt' => $cachedAt->toIso8601String(),
                'stale' => false,
            ],
        ];
    }

    private function extractHeader(array $headers, string $name): ?string
    {
        foreach ($headers as $header) {
            if (strcasecmp((string) ($header['name'] ?? ''), $name) === 0) {
                return (string) ($header['value'] ?? '');
            }
        }

        return null;
    }

    private function extractGmailBody(?array $payload): string
    {
        if (!$payload) {
            return '';
        }

        $mimeType = (string) ($payload['mimeType'] ?? '');
        $bodyData = (string) ($payload['body']['data'] ?? '');

        if ($bodyData && ($mimeType === 'text/plain' || $mimeType === 'text/html')) {
            return $this->decodeBase64Url($bodyData);
        }

        $parts = $payload['parts'] ?? [];
        foreach ($parts as $part) {
            $nested = $this->extractGmailBody($part);
            if ($nested !== '') {
                return $nested;
            }
        }

        return '';
    }

    private function decodeBase64Url(string $value): string
    {
        $decoded = base64_decode(strtr($value, '-_', '+/'), true);
        return $decoded !== false ? $decoded : '';
    }

    private function extractEmailAddress(string $headerValue): string
    {
        if (preg_match('/<([^>]+)>/', $headerValue, $matches)) {
            return strtolower(trim($matches[1]));
        }

        return strtolower(trim($headerValue));
    }

    private function parseMailboxAddresses(string $headerValue): array
    {
        $value = trim($headerValue);
        if ($value === '') {
            return [];
        }

        $result = [];
        $parts = str_getcsv($value, ',', '"', '\\');
        foreach ($parts as $part) {
            $chunk = trim((string) $part);
            if ($chunk === '') {
                continue;
            }

            if (preg_match('/^(.*?)<([^>]+)>$/', $chunk, $matches)) {
                $name = trim(trim((string) $matches[1]), "\"' ");
                $email = strtolower(trim((string) $matches[2]));

                if (filter_var($email, FILTER_VALIDATE_EMAIL)) {
                    $result[] = [
                        'name' => $name,
                        'email' => $email,
                    ];
                }
                continue;
            }

            if (filter_var($chunk, FILTER_VALIDATE_EMAIL)) {
                $result[] = [
                    'name' => '',
                    'email' => strtolower($chunk),
                ];
            }
        }

        return $result;
    }

    private function buildRawMimeMessage(
        string $to,
        string $subject,
        string $body,
        array $attachments = []
    ): string {
        $validAttachments = array_values(array_filter(
            $attachments,
            static fn ($item) => $item instanceof UploadedFile && $item->isValid()
        ));

        $raw = "To: {$to}\r\n";
        $raw .= "Subject: {$subject}\r\n";
        $raw .= "MIME-Version: 1.0\r\n";

        if (count($validAttachments) === 0) {
            $raw .= "Content-Type: text/plain; charset=utf-8\r\n";
            $raw .= "Content-Transfer-Encoding: 7bit\r\n\r\n";
            $raw .= $body;
            return $raw;
        }

        $boundary = 'gmail-boundary-' . bin2hex(random_bytes(8));
        $raw .= "Content-Type: multipart/mixed; boundary=\"{$boundary}\"\r\n\r\n";

        $raw .= "--{$boundary}\r\n";
        $raw .= "Content-Type: text/plain; charset=utf-8\r\n";
        $raw .= "Content-Transfer-Encoding: 7bit\r\n\r\n";
        $raw .= $body . "\r\n";

        foreach ($validAttachments as $attachment) {
            $path = $attachment->getRealPath();
            if ($path === false) {
                continue;
            }

            $contents = file_get_contents($path);
            if ($contents === false) {
                continue;
            }

            $filename = trim(str_replace(["\r", "\n", "\""], ['', '', ''], $attachment->getClientOriginalName()));
            if ($filename === '') {
                $filename = 'attachment.bin';
            }

            $mimeType = $attachment->getClientMimeType() ?: 'application/octet-stream';
            $encodedContent = rtrim(chunk_split(base64_encode($contents), 76, "\r\n"));

            $raw .= "--{$boundary}\r\n";
            $raw .= "Content-Type: {$mimeType}; name=\"{$filename}\"\r\n";
            $raw .= "Content-Disposition: attachment; filename=\"{$filename}\"\r\n";
            $raw .= "Content-Transfer-Encoding: base64\r\n\r\n";
            $raw .= $encodedContent . "\r\n";
        }

        $raw .= "--{$boundary}--";

        return $raw;
    }

    private function cacheKey(int $userId, string $resource, array $context = []): string
    {
        $version = (int) Cache::get("google_ws_cache_version_{$userId}", 1);
        $hash = md5(json_encode($context, JSON_UNESCAPED_SLASHES));
        return "google_ws:{$userId}:v{$version}:{$resource}:{$hash}";
    }

    private function bumpCacheVersion(int $userId): void
    {
        $key = "google_ws_cache_version_{$userId}";
        if (!Cache::has($key)) {
            Cache::put($key, 1, now()->addDays(30));
        }

        Cache::increment($key);
    }
}
