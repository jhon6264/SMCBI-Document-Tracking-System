import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import "../../../css/user/pages/user-google-drive.css";
import { requestGoogleWorkspaceAuthCode } from "../utils/googleWorkspaceAuth";
import FolderIcon from "../../assets/images/folder.png";
import GoogleDriveIcon from "../../assets/images/google-drive.png";
import useAnimatedPresence from "../../hooks/useAnimatedPresence";
import { animateStaggerReveal, cleanupMotion } from "../utils/animeMotion";
import {
    LuArrowLeft,
    LuChevronRight,
    LuClock3,
    LuFolderPlus,
    LuHouse,
    LuLayoutGrid,
    LuList,
    LuRefreshCw,
    LuRows3,
    LuSearch,
    LuStar,
    LuTrash2,
    LuUpload,
    LuUsers,
    LuUsersRound,
    LuX,
} from "react-icons/lu";
import { HiArrowTopRightOnSquare } from "react-icons/hi2";

const DRIVE_URL = "https://drive.google.com/drive/my-drive";
const DRIVE_SEARCH_DEBOUNCE_MS = 300;
const DRIVE_VIEW_STORAGE_KEY = "user_drive_view_mode";

const VIEW_OPTIONS = [
    { id: "list",    label: "List",    icon: LuList },
    { id: "grid",    label: "Grid",    icon: LuLayoutGrid },
    { id: "compact", label: "Compact", icon: LuRows3 },
];

const NAV_ITEMS = [
    { id: "shared",  label: "Shared with me", icon: LuUsersRound },
    { id: "recent",  label: "Recent",          icon: LuClock3 },
    { id: "starred", label: "Starred",         icon: LuStar },
    { id: "trash",   label: "Trash",           icon: LuTrash2 },
];

const NAV_LABELS = {
    "my-drive": "My Drive",
    shared: "Shared with me",
    recent: "Recent",
    starred: "Starred",
    trash: "Trash",
};

/* ─── File type icon fallback (Google-color dots) ─────────────────────────── */
function MimeIcon({ file }) {
    if (file.isFolder) {
        return <img src={FolderIcon} alt="folder" className="gdrive-folder-asset" />;
    }
    if (file.iconLink) {
        return <img src={file.iconLink} alt="" className="gdrive-file-icon-img" />;
    }
    return <span className="gdrive-file-dot" />;
}

/* ─── Grid thumbnail ───────────────────────────────────────────────────────── */
function CardThumb({ file, getImageUrl }) {
    const imageCandidate = useMemo(() => {
        if (file.isFolder) return "";
        if (file.thumbnailLink) return file.thumbnailLink;
        if (file.mimeType?.startsWith("image/")) return getImageUrl(file);
        return "";
    }, [file, getImageUrl]);

    const [thumbSrc, setThumbSrc] = useState(imageCandidate);

    useEffect(() => {
        setThumbSrc(imageCandidate);
    }, [imageCandidate, file.id]);

    if (file.isFolder) {
        return <img src={FolderIcon} alt="folder" className="gdrive-grid-folder" />;
    }
    if (thumbSrc) {
        return (
            <img
                src={thumbSrc}
                alt={file.name}
                className="gdrive-grid-thumb-image"
                loading="lazy"
                onError={() => {
                    const fallback = file.mimeType?.startsWith("image/") ? getImageUrl(file) : "";
                    if (thumbSrc !== fallback) {
                        setThumbSrc(fallback);
                        return;
                    }
                    setThumbSrc("");
                }}
            />
        );
    }
    if (file.iconLink) {
        return (
            <div className="gdrive-grid-icon-wrap">
                <img src={file.iconLink} alt={file.mimeType} className="gdrive-grid-icon-large" />
                <span className="gdrive-grid-mime-label">{file.mimeType?.split("/").pop()}</span>
            </div>
        );
    }
    return (
        <div className="gdrive-grid-generic">
            {file.mimeType?.split("/").pop() ?? "file"}
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
function UserGoogleDrive() {
    const [searchInput,   setSearchInput]   = useState("");
    const [searchQuery,   setSearchQuery]   = useState("");
    const [navSection,    setNavSection]    = useState("my-drive");
    const [folderTrail,   setFolderTrail]   = useState([]);
    const [viewMode,      setViewMode]      = useState(() => {
        const stored = localStorage.getItem(DRIVE_VIEW_STORAGE_KEY);
        return VIEW_OPTIONS.some((v) => v.id === stored) ? stored : "grid";
    });
    const [previewFile,   setPreviewFile]   = useState(null);
    const [previewImageFailed, setPreviewImageFailed] = useState(false);
    const [previewClosing, setPreviewClosing] = useState(false);
    const [previewNonce, setPreviewNonce] = useState(0);
    const [previewBlobUrl, setPreviewBlobUrl] = useState("");
    const [previewBlobLoading, setPreviewBlobLoading] = useState(false);
    const [previewBlobFailed, setPreviewBlobFailed] = useState(false);
    const [notice,        setNotice]        = useState("");
    const [errorMessage,  setErrorMessage]  = useState("");
    const [createFolderModalOpen, setCreateFolderModalOpen] = useState(false);
    const [newFolderName, setNewFolderName] = useState("");
    const [shareModalFile, setShareModalFile] = useState(null);
    const [shareEmail, setShareEmail] = useState("");
    const [shareRole, setShareRole] = useState("reader");
    const [deleteModalFile, setDeleteModalFile] = useState(null);
    const [shareModalRenderFile, setShareModalRenderFile] = useState(null);
    const [deleteModalRenderFile, setDeleteModalRenderFile] = useState(null);
    const [pendingNavSection, setPendingNavSection] = useState("");
    const [accountMenuOpen, setAccountMenuOpen] = useState(false);
    const [searchFocused, setSearchFocused] = useState(false);

    const fileInputRef             = useRef(null);
    const previewCloseTimerRef     = useRef(null);
    const forceRefreshRef          = useRef(false);
    const staleRefreshTriggeredRef = useRef(false);
    const accountMenuRef           = useRef(null);
    const searchWrapRef            = useRef(null);
    const workspaceRef             = useRef(null);
    const resultsPaneRef           = useRef(null);
    const previewModalRef          = useRef(null);
    const createFolderDialogRef    = useRef(null);
    const shareDialogRef           = useRef(null);
    const deleteDialogRef          = useRef(null);
    const queryClient              = useQueryClient();
    const createFolderDialogPresence = useAnimatedPresence(createFolderModalOpen, { exitDurationMs: 220 });
    const shareDialogPresence = useAnimatedPresence(Boolean(shareModalFile), { exitDurationMs: 220 });
    const deleteDialogPresence = useAnimatedPresence(Boolean(deleteModalFile), { exitDurationMs: 220 });

    const googleClientId     = window.appConfig?.googleClientId     || "";
    const googleRedirectUri  = window.appConfig?.googleRedirectUri  || "postmessage";
    const institutionDomain  = window.appConfig?.institutionDomain  || "smcbi.edu.ph";

    const userData = useMemo(() => {
        try {
            return JSON.parse(localStorage.getItem("user_data") || "null");
        } catch {
            return null;
        }
    }, []);

    const userId = useMemo(() => {
        try {
            const parsed = userData;
            return parsed?.id ? String(parsed.id) : "unknown";
        } catch {
            return "unknown";
        }
    }, [userData]);

    const connectedName = userData?.name || "User";
    const connectedEmail = userData?.email || "";
    const connectedPhoto =
        userData?.profile_picture ||
        userData?.picture ||
        userData?.avatar ||
        userData?.photo ||
        userData?.image ||
        "";
    const connectedInitial = (connectedName || "U").trim().charAt(0).toUpperCase();

    const buildAuthConfig = useCallback(() => {
        const token = localStorage.getItem("user_token");
        return { headers: { Accept: "application/json", Authorization: `Bearer ${token || ""}` } };
    }, []);

    const mapDriveFiles = useCallback(
        (files = []) =>
            files.map((file) => ({
                id:            file.id,
                name:          file.name          || "(Unnamed file)",
                mimeType:      file.mimeType       || "-",
                isFolder:      file.mimeType === "application/vnd.google-apps.folder",
                owner:
                    file.owners?.[0]?.displayName  ||
                    file.owners?.[0]?.emailAddress ||
                    "Unknown",
                updatedAt:     file.modifiedTime
                    ? new Date(file.modifiedTime).toLocaleString()
                    : "-",
                size:          file.size
                    ? `${Math.ceil(Number(file.size) / 1024)} KB`
                    : "-",
                webViewLink:   file.webViewLink   || "",
                webContentLink: file.webContentLink || "",
                thumbnailLink: file.thumbnailLink || "",
                iconLink:      file.iconLink      || "",
            })),
        []
    );

    /* ── Queries ─────────────────────────────────────────────────────────── */
    const statusQuery = useQuery({
        queryKey: ["user-google-status", userId],
        queryFn:  async () => {
            const { data } = await axios.get("/api/user/google/status", buildAuthConfig());
            return data;
        },
    });

    const isGoogleConnected = Boolean(statusQuery.data?.status?.connected);
    const currentFolder   = folderTrail[folderTrail.length - 1] || null;
    const currentFolderId = currentFolder?.id || "";
    const sectionLabel    = NAV_LABELS[navSection] || NAV_LABELS["my-drive"];

    const driveFilesQuery = useQuery({
        queryKey:        ["user-google-drive-files", userId, navSection, currentFolderId || "", searchQuery || ""],
        enabled:         isGoogleConnected,
        placeholderData: keepPreviousData,
        queryFn:         async () => {
            const { data } = await axios.get("/api/user/google/drive/files", {
                ...buildAuthConfig(),
                params: {
                    pageSize: 300,
                    search:   searchQuery   || undefined,
                    parentId: currentFolderId || undefined,
                    section: navSection,
                    force:    forceRefreshRef.current ? 1 : undefined,
                },
            });
            return data;
        },
    });

    const driveFiles = useMemo(
        () => mapDriveFiles(driveFilesQuery.data?.data?.files || []),
        [driveFilesQuery.data, mapDriveFiles]
    );

    const searchSuggestions = useMemo(() => {
        const list = queryClient.getQueriesData({ queryKey: ["user-google-drive-files", userId] });
        const byLower = new Map();
        const needle = searchInput.trim().toLowerCase();

        const addSuggestion = (rawValue) => {
            const text = String(rawValue || "").replace(/\s+/g, " ").trim();
            if (!text || text.length < 2) return;
            if (needle && !text.toLowerCase().includes(needle)) return;
            const key = text.toLowerCase();
            if (!byLower.has(key)) byLower.set(key, text);
        };

        list.forEach(([, cached]) => {
            const files = cached?.data?.files;
            if (!Array.isArray(files)) return;
            files.forEach((file) => {
                addSuggestion(file?.name);
                addSuggestion(file?.owners?.[0]?.displayName);
            });
        });

        return Array.from(byLower.values()).slice(0, 8);
    }, [queryClient, userId, searchInput, driveFilesQuery.dataUpdatedAt]);

    const invalidateDriveQueries = useCallback(async () => {
        forceRefreshRef.current = true;
        await queryClient.invalidateQueries({ queryKey: ["user-google-drive-files", userId] });
        forceRefreshRef.current = false;
    }, [queryClient, userId]);

    /* ── Mutations ───────────────────────────────────────────────────────── */
    const connectMutation = useMutation({
        mutationFn: async () => {
            const codeResponse = await requestGoogleWorkspaceAuthCode({
                clientId:     googleClientId,
                hostedDomain: institutionDomain,
                redirectUri:  googleRedirectUri,
            });
            await axios.post(
                "/api/user/google/connect-code",
                { code: codeResponse.code },
                buildAuthConfig()
            );
        },
        onSuccess: async () => {
            setErrorMessage("");
            setNotice("Google Workspace connected.");
            setFolderTrail([]);
            setSearchInput("");
            setSearchQuery("");
            setPreviewFile(null);
            await statusQuery.refetch();
            await invalidateDriveQueries();
        },
        onError: (error) =>
            setErrorMessage(
                error.response?.data?.message || error.message || "Google Workspace connection failed."
            ),
    });

    const disconnectMutation = useMutation({
        mutationFn: async () => axios.post("/api/user/google/disconnect", {}, buildAuthConfig()),
        onSuccess: async () => {
            setErrorMessage("");
            setNotice("Google Workspace disconnected.");
            setAccountMenuOpen(false);
            setFolderTrail([]);
            setPreviewFile(null);
            setSearchInput("");
            setSearchQuery("");
            await statusQuery.refetch();
            await queryClient.invalidateQueries({ queryKey: ["user-google-drive-files", userId] });
        },
        onError: (error) => setErrorMessage(error.response?.data?.message || "Disconnect failed."),
    });

    const createFolderMutation = useMutation({
        mutationFn: (name) =>
            axios.post(
                "/api/user/google/drive/folders",
                { name: name.trim(), parent_id: currentFolderId || undefined },
                buildAuthConfig()
            ),
        onSuccess: async (_, name) => {
            setNotice(`Folder "${name}" created.`);
            await invalidateDriveQueries();
        },
        onError: (error) => setErrorMessage(error.response?.data?.message || "Create failed."),
    });

    const uploadMutation = useMutation({
        mutationFn: async (file) => {
            const formData = new FormData();
            formData.append("file", file);
            if (currentFolderId) formData.append("parent_id", currentFolderId);
            await axios.post("/api/user/google/drive/upload", formData, {
                ...buildAuthConfig(),
                headers: { ...buildAuthConfig().headers, "Content-Type": "multipart/form-data" },
            });
        },
        onSuccess: async (_, file) => {
            setNotice(`Uploaded "${file.name}" successfully.`);
            await invalidateDriveQueries();
        },
        onError: (error) => setErrorMessage(error.response?.data?.message || "Upload failed."),
    });

    const shareMutation = useMutation({
        mutationFn: ({ file, email, role }) =>
            axios.post(
                "/api/user/google/drive/share",
                { file_id: file.id, email: email.trim(), role },
                buildAuthConfig()
            ),
        onSuccess: (_, variables) =>
            setNotice(`Shared "${variables.file.name}" with ${variables.email}.`),
        onError: (error) => setErrorMessage(error.response?.data?.message || "Share failed."),
    });

    const deleteMutation = useMutation({
        mutationFn: (file) =>
            axios.delete("/api/user/google/drive/file", {
                ...buildAuthConfig(),
                data: { file_id: file.id },
            }),
        onMutate: async (file) => {
            await queryClient.cancelQueries({ queryKey: ["user-google-drive-files", userId] });
            const snapshots = queryClient.getQueriesData({
                queryKey: ["user-google-drive-files", userId],
            });
            snapshots.forEach(([key, cached]) => {
                const files = cached?.data?.files;
                if (Array.isArray(files)) {
                    queryClient.setQueryData(key, {
                        ...cached,
                        data: { ...cached.data, files: files.filter((i) => i.id !== file.id) },
                    });
                }
            });
            return { snapshots };
        },
        onError: (error, _, context) => {
            context?.snapshots?.forEach(([key, value]) => queryClient.setQueryData(key, value));
            setErrorMessage(error.response?.data?.message || "Delete failed.");
        },
        onSuccess: (_, file) => {
            setNotice(`Deleted "${file.name}".`);
            if (previewFile?.id === file.id) setPreviewFile(null);
        },
        onSettled: invalidateDriveQueries,
    });

    /* ── Helpers ─────────────────────────────────────────────────────────── */
    const getPreviewUrl = useCallback((file, nonce = 0) => {
        if (!file?.id) return "";
        const qs = `rm=minimal&embedded=true&t=${nonce || Date.now()}`;
        if (file.mimeType === "application/vnd.google-apps.document")     return `https://docs.google.com/document/d/${file.id}/preview?${qs}`;
        if (file.mimeType === "application/vnd.google-apps.spreadsheet")  return `https://docs.google.com/spreadsheets/d/${file.id}/preview?${qs}`;
        if (file.mimeType === "application/vnd.google-apps.presentation") return `https://docs.google.com/presentation/d/${file.id}/preview?${qs}`;
        return `https://drive.google.com/file/d/${file.id}/preview?t=${nonce || Date.now()}`;
    }, []);

    const isImageFile  = useCallback((file) => Boolean(file?.mimeType?.startsWith("image/")), []);
    const getImageUrl  = useCallback((file) => `https://drive.google.com/thumbnail?id=${file.id}&sz=w1800`, []);
    const getHiResThumbnail = useCallback((file) => {
        const raw = file?.thumbnailLink || "";
        if (!raw) return "";
        return raw.replace(/=s\d+$/, "=s1600");
    }, []);
    const getModalImageSrc = useCallback((file) => {
        if (!file) return "";
        return getHiResThumbnail(file) || getImageUrl(file) || file.webContentLink || "";
    }, [getHiResThumbnail, getImageUrl]);

    const closePreviewModal = useCallback(() => {
        if (!previewFile || previewClosing) return;
        setPreviewClosing(true);
        if (previewCloseTimerRef.current) window.clearTimeout(previewCloseTimerRef.current);
        previewCloseTimerRef.current = window.setTimeout(() => {
            setPreviewFile(null);
            setPreviewClosing(false);
            setPreviewImageFailed(false);
            setPreviewBlobFailed(false);
            setPreviewBlobLoading(false);
            if (previewBlobUrl) {
                URL.revokeObjectURL(previewBlobUrl);
                setPreviewBlobUrl("");
            }
        }, 180);
    }, [previewBlobUrl, previewClosing, previewFile]);

    const openByName = (file) => {
        if (!file) return;
        if (file.isFolder) {
            setFolderTrail((prev) => {
                if (prev[prev.length - 1]?.id === file.id) return prev;
                return [...prev, { id: file.id, name: file.name }];
            });
            return;
        }
        setPreviewClosing(false);
        setPreviewNonce(Date.now());
        setPreviewFile(file);
    };

    const selectSection = (section) => {
        if (section === navSection) return;
        forceRefreshRef.current = true;
        setPendingNavSection(section);
        setNavSection(section);
        setFolderTrail([]);
        setPreviewFile(null);
        setPreviewImageFailed(false);
        setPreviewClosing(false);
    };

    /* ── Reusable sub-components ─────────────────────────────────────────── */
    const actionButtons = (file) => (
        <div className="gdrive-actions">
            <a
                href={file.webViewLink || DRIVE_URL}
                target="_blank"
                rel="noreferrer"
                title="Open in Google Drive"
                className="gdrive-action-btn gdrive-action-btn--open"
            >
                <HiArrowTopRightOnSquare size={15} />
            </a>
            <button
                type="button"
                title="Share"
                className="gdrive-action-btn gdrive-action-btn--share"
                onClick={() => {
                    setShareModalFile(file);
                    setShareEmail("");
                    setShareRole("reader");
                }}
            >
                <LuUsers size={15} />
            </button>
            <button
                type="button"
                title="Delete"
                className="gdrive-action-btn gdrive-action-btn--delete"
                onClick={() => setDeleteModalFile(file)}
            >
                <LuTrash2 size={15} />
            </button>
        </div>
    );

    const nameButton = (file) => (
        <button type="button" className="gdrive-name-btn" onClick={() => openByName(file)}>
            <MimeIcon file={file} />
            <span>{file.name}</span>
        </button>
    );

    /* ── Side-effects ────────────────────────────────────────────────────── */
    useEffect(() => localStorage.setItem(DRIVE_VIEW_STORAGE_KEY, viewMode), [viewMode]);

    useEffect(() => {
        const timer = window.setTimeout(
            () => setSearchQuery(searchInput.trim()),
            DRIVE_SEARCH_DEBOUNCE_MS
        );
        return () => window.clearTimeout(timer);
    }, [searchInput]);

    useEffect(() => {
        const handleOutside = (event) => {
            if (!accountMenuRef.current?.contains(event.target)) setAccountMenuOpen(false);
            if (!searchWrapRef.current?.contains(event.target)) setSearchFocused(false);
        };
        if (accountMenuOpen || searchFocused) document.addEventListener("mousedown", handleOutside);
        return () => document.removeEventListener("mousedown", handleOutside);
    }, [accountMenuOpen, searchFocused]);

    useEffect(() => { staleRefreshTriggeredRef.current = false; }, [navSection, currentFolderId, searchQuery]);

    useEffect(() => {
        if (!pendingNavSection) return;
        if (driveFilesQuery.isFetching) return;
        if (navSection !== pendingNavSection) return;
        forceRefreshRef.current = false;
        setPendingNavSection("");
    }, [pendingNavSection, navSection, driveFilesQuery.isFetching]);

    useEffect(() => {
        if (!statusQuery.error) return;
        setErrorMessage(statusQuery.error.message || "Failed to load Google status.");
    }, [statusQuery.error]);

    useEffect(() => {
        if (!driveFilesQuery.error) return;
        const message = driveFilesQuery.error.message || "Failed to load Drive files.";
        if (message.toLowerCase().includes("invalid authentication credentials")) {
            setNotice("Google token expired. Please reconnect.");
        }
        setErrorMessage(message);
    }, [driveFilesQuery.error]);

    useEffect(() => {
        if (!isGoogleConnected) {
            setNotice("");
            return;
        }
        if (driveFilesQuery.data?.meta?.stale && !staleRefreshTriggeredRef.current) {
            staleRefreshTriggeredRef.current = true;
            forceRefreshRef.current = true;
            driveFilesQuery.refetch().finally(() => {
                forceRefreshRef.current = false;
            });
        }
    }, [driveFilesQuery, isGoogleConnected]);

    useEffect(() => {
        const onEscape = (e) => { if (e.key === "Escape") closePreviewModal(); };
        window.addEventListener("keydown", onEscape);
        return () => window.removeEventListener("keydown", onEscape);
    }, [closePreviewModal]);

    useEffect(() => {
        if (shareModalFile) {
            setShareModalRenderFile(shareModalFile);
        } else if (!shareDialogPresence.isRendered) {
            setShareModalRenderFile(null);
        }
    }, [shareDialogPresence.isRendered, shareModalFile]);

    useEffect(() => {
        if (deleteModalFile) {
            setDeleteModalRenderFile(deleteModalFile);
        } else if (!deleteDialogPresence.isRendered) {
            setDeleteModalRenderFile(null);
        }
    }, [deleteDialogPresence.isRendered, deleteModalFile]);

    useEffect(() => {
        setPreviewImageFailed(false);
        setPreviewBlobFailed(false);
    }, [previewFile?.id]);

    useEffect(() => {
        if (!previewFile || isImageFile(previewFile)) {
            setPreviewBlobLoading(false);
            setPreviewBlobFailed(false);
            if (previewBlobUrl) {
                URL.revokeObjectURL(previewBlobUrl);
                setPreviewBlobUrl("");
            }
            return;
        }

        let isAlive = true;
        setPreviewBlobLoading(true);
        setPreviewBlobFailed(false);

        axios
            .get("/api/user/google/drive/preview", {
                ...buildAuthConfig(),
                params: { file_id: previewFile.id },
                responseType: "blob",
            })
            .then(({ data }) => {
                if (!isAlive) return;
                const url = URL.createObjectURL(data);
                setPreviewBlobUrl((prev) => {
                    if (prev) URL.revokeObjectURL(prev);
                    return url;
                });
            })
            .catch(() => {
                if (!isAlive) return;
                setPreviewBlobFailed(true);
            })
            .finally(() => {
                if (!isAlive) return;
                setPreviewBlobLoading(false);
            });

        return () => {
            isAlive = false;
        };
    }, [previewFile, isImageFile, buildAuthConfig]);

    useEffect(() => {
        return () => {
            if (previewCloseTimerRef.current) {
                window.clearTimeout(previewCloseTimerRef.current);
            }
            if (previewBlobUrl) {
                URL.revokeObjectURL(previewBlobUrl);
            }
        };
    }, [previewBlobUrl]);

    useEffect(() => {
        const motion = animateStaggerReveal(workspaceRef.current, {
            selector: "[data-gd-layout-item]",
            duration: 680,
            staggerMs: 48,
            startDelayMs: 12,
        });

        if (!motion) {
            return undefined;
        }

        return () => {
            cleanupMotion(motion);
        };
    }, [navSection, currentFolderId, viewMode, isGoogleConnected]);

    useEffect(() => {
        const selector = driveFilesQuery.isPending || (driveFilesQuery.isFetching && driveFiles.length === 0)
            ? "[data-gd-empty-state], [data-gd-skeleton-item]"
            : driveFiles.length === 0
                ? "[data-gd-empty-state]"
                : "[data-gd-result-item]";

        const motion = animateStaggerReveal(resultsPaneRef.current, {
            selector,
            duration: 620,
            staggerMs: viewMode === "grid" ? 44 : 26,
            startDelayMs: 8,
        });

        if (!motion) {
            return undefined;
        }

        return () => {
            cleanupMotion(motion);
        };
    }, [viewMode, driveFiles.length, driveFilesQuery.isPending, driveFilesQuery.isFetching, pendingNavSection, navSection]);

    useEffect(() => {
        if (!previewFile || previewClosing) {
            return undefined;
        }

        const motion = animateStaggerReveal(previewModalRef.current, {
            selector: "[data-gd-preview-item]",
            duration: 520,
            staggerMs: 36,
            startDelayMs: 0,
        });

        if (!motion) {
            return undefined;
        }

        return () => {
            cleanupMotion(motion);
        };
    }, [previewFile?.id, previewClosing, previewBlobLoading, previewBlobFailed, previewImageFailed]);

    useEffect(() => {
        if (!createFolderDialogPresence.isVisible) {
            return undefined;
        }

        const motion = animateStaggerReveal(createFolderDialogRef.current, {
            selector: "[data-gd-dialog-item]",
            duration: 460,
            staggerMs: 34,
            startDelayMs: 0,
        });

        if (!motion) {
            return undefined;
        }

        return () => {
            cleanupMotion(motion);
        };
    }, [createFolderDialogPresence.isVisible]);

    useEffect(() => {
        if (!shareDialogPresence.isVisible) {
            return undefined;
        }

        const motion = animateStaggerReveal(shareDialogRef.current, {
            selector: "[data-gd-dialog-item]",
            duration: 480,
            staggerMs: 34,
            startDelayMs: 0,
        });

        if (!motion) {
            return undefined;
        }

        return () => {
            cleanupMotion(motion);
        };
    }, [shareDialogPresence.isVisible, shareModalRenderFile?.id]);

    useEffect(() => {
        if (!deleteDialogPresence.isVisible) {
            return undefined;
        }

        const motion = animateStaggerReveal(deleteDialogRef.current, {
            selector: "[data-gd-dialog-item]",
            duration: 420,
            staggerMs: 30,
            startDelayMs: 0,
        });

        if (!motion) {
            return undefined;
        }

        return () => {
            cleanupMotion(motion);
        };
    }, [deleteDialogPresence.isVisible, deleteModalRenderFile?.id]);

    const showSignInAssist =
        Boolean(previewFile) &&
        previewBlobFailed &&
        !isImageFile(previewFile);
    const showImageAssist =
        Boolean(previewFile) &&
        previewImageFailed &&
        isImageFile(previewFile);

    /* ── Render ──────────────────────────────────────────────────────────── */
    return (
        <div ref={workspaceRef} className={`gdrive-workspace gdrive-view-${viewMode}`}>

            {/* ── TOP TOOLBAR ── */}
            <header className="gdrive-toolbar" data-gd-layout-item>
                <div className="gdrive-brand">
                    <img src={GoogleDriveIcon} alt="" className="gdrive-brand-logo" aria-hidden="true" />
                    <strong>Drive</strong>
                </div>

                <div className="gdrive-search-wrap" ref={searchWrapRef}>
                    <LuSearch size={16} className="gdrive-search-icon" />
                    <input
                        type="text"
                        className="gdrive-search"
                        placeholder="Search in Drive..."
                        value={searchInput}
                        onFocus={() => setSearchFocused(true)}
                        onChange={(e) => setSearchInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Escape") setSearchFocused(false);
                            if (e.key === "Enter") {
                                setSearchFocused(false);
                                setSearchQuery(searchInput.trim());
                            }
                        }}
                        disabled={!isGoogleConnected}
                    />
                    {searchInput ? (
                        <button
                            type="button"
                            className="gdrive-search-clear-btn"
                            onClick={() => {
                                setSearchInput("");
                                setSearchQuery("");
                                setSearchFocused(false);
                            }}
                            aria-label="Clear search"
                        >
                            <LuX size={14} />
                        </button>
                    ) : null}
                    {searchFocused && searchSuggestions.length > 0 && isGoogleConnected ? (
                        <div className="gdrive-search-suggestions" role="listbox" aria-label="Drive suggestions">
                            {searchSuggestions.map((suggestion) => (
                                <button
                                    key={suggestion}
                                    type="button"
                                    className="gdrive-search-suggestion-item"
                                    onClick={() => {
                                        setSearchInput(suggestion);
                                        setSearchQuery(suggestion);
                                        setSearchFocused(false);
                                    }}
                                >
                                    <LuSearch size={14} />
                                    <span>{suggestion}</span>
                                </button>
                            ))}
                        </div>
                    ) : null}
                </div>

                <div className="gdrive-toolbar-actions">
                    {isGoogleConnected ? (
                        <div className="gdrive-connected-wrap" ref={accountMenuRef}>
                            <button
                                type="button"
                                className="gdrive-btn gdrive-connected-pill"
                                onClick={() => setAccountMenuOpen((open) => !open)}
                                aria-expanded={accountMenuOpen}
                                aria-haspopup="menu"
                            >
                                <span className="gdrive-connected-chip">
                                    {connectedPhoto ? (
                                        <img
                                            src={connectedPhoto}
                                            alt={connectedName}
                                            className="gdrive-connected-avatar"
                                        />
                                    ) : (
                                        <span className="gdrive-connected-avatar gdrive-connected-avatar--fallback">
                                            {connectedInitial}
                                        </span>
                                    )}
                                    <span className="gdrive-connected-text">
                                        <strong>Connected</strong>
                                        {connectedEmail && <small>{connectedEmail}</small>}
                                    </span>
                                </span>
                            </button>
                            {accountMenuOpen ? (
                                <div className="gdrive-account-menu" role="menu">
                                    <button
                                        type="button"
                                        className="gdrive-account-menu-item gdrive-account-menu-item--danger"
                                        onClick={() => disconnectMutation.mutate()}
                                        disabled={disconnectMutation.isPending}
                                        role="menuitem"
                                    >
                                        {disconnectMutation.isPending ? "Disconnecting…" : "Logout Google"}
                                    </button>
                                </div>
                            ) : null}
                        </div>
                    ) : (
                        <button
                            type="button"
                            className="gdrive-btn gdrive-btn--connect"
                            onClick={() => connectMutation.mutate()}
                            disabled={connectMutation.isPending || statusQuery.isPending}
                        >
                            {connectMutation.isPending ? "Connecting…" : "Connect"}
                        </button>
                    )}
                    <button
                        type="button"
                        className="gdrive-btn"
                        onClick={() => {
                            forceRefreshRef.current = true;
                            driveFilesQuery.refetch().finally(() => (forceRefreshRef.current = false));
                        }}
                        disabled={!isGoogleConnected || driveFilesQuery.isFetching}
                    >
                        <LuRefreshCw size={14} />
                        <span>Refresh</span>
                    </button>
                    <a href={DRIVE_URL} target="_blank" rel="noreferrer" className="gdrive-btn">
                        <HiArrowTopRightOnSquare size={14} />
                        <span>Open Google Drive</span>
                    </a>
                </div>
            </header>

            {/* ── EXPLORER (sidebar + content) ── */}
            <div className="gdrive-explorer">

                {/* Sidebar */}
                <aside className="gdrive-sidebar" data-gd-layout-item>
                    <button
                        className="gdrive-new-btn"
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <LuUpload size={16} />
                        <span>New Upload</span>
                    </button>
                    <button
                        className="gdrive-new-btn gdrive-new-btn--secondary"
                        type="button"
                        onClick={() => setCreateFolderModalOpen(true)}
                    >
                        <LuFolderPlus size={16} />
                        <span>New Folder</span>
                    </button>

                    <nav className="gdrive-nav">
                        <button
                            type="button"
                            className={`gdrive-nav-item ${navSection === "my-drive" ? "active" : ""}`}
                            onClick={() => selectSection("my-drive")}
                        >
                            <LuHouse size={16} />
                            <span>My Drive</span>
                        </button>
                        {NAV_ITEMS.map((item) => {
                            const Icon = item.icon;
                            return (
                                <button
                                    key={item.id}
                                    type="button"
                                    className={`gdrive-nav-item ${navSection === item.id ? "active" : ""}`}
                                    onClick={() => selectSection(item.id)}
                                >
                                    <Icon size={16} />
                                    <span>{item.label}</span>
                                </button>
                            );
                        })}
                    </nav>
                </aside>

                {/* Main content */}
                <section className="gdrive-content" data-gd-layout-item>
                    {/* Content header */}
                    <div className="gdrive-content-head" data-gd-layout-item>
                        <div className="gdrive-title-stack">
                            <h2>{currentFolder?.name || sectionLabel}</h2>
                            <div className="gdrive-breadcrumbs">
                                <button type="button" onClick={() => setFolderTrail([])}>
                                    {sectionLabel}
                                </button>
                                {folderTrail.map((folder, index) => (
                                    <React.Fragment key={folder.id}>
                                        <span className="gdrive-breadcrumb-sep">
                                            <LuChevronRight size={13} />
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setFolderTrail((prev) => prev.slice(0, index + 1))
                                            }
                                        >
                                            {folder.name}
                                        </button>
                                    </React.Fragment>
                                ))}
                            </div>
                        </div>

                        <div className="gdrive-head-actions">
                            {folderTrail.length > 0 && (
                                <button
                                    type="button"
                                    className="gdrive-btn"
                                    onClick={() => setFolderTrail((prev) => prev.slice(0, -1))}
                                >
                                    <LuArrowLeft size={14} />
                                    <span>Up</span>
                                </button>
                            )}
                            <div className="gdrive-view-switcher">
                                {VIEW_OPTIONS.map((option) => {
                                    const Icon = option.icon;
                                    return (
                                        <button
                                            key={option.id}
                                            type="button"
                                            className={`gdrive-view-btn ${viewMode === option.id ? "active" : ""}`}
                                            onClick={() => setViewMode(option.id)}
                                            title={option.label}
                                        >
                                            <Icon size={15} />
                                            <span>{option.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* ── Scrollable file pane ── */}
                    <div className="gdrive-scroll-pane" ref={resultsPaneRef} data-gd-layout-item>
                        {!isGoogleConnected ? (
                            <div className="gdrive-empty-state" data-gd-empty-state>
                                Google Workspace is not connected yet.
                            </div>
                        ) : pendingNavSection === navSection && driveFilesQuery.isFetching ? (
                            <div className="gdrive-skeleton-grid">
                                {Array.from({ length: 8 }).map((_, index) => (
                                    <article key={`grid-skeleton-${index}`} className="gdrive-skeleton-card" data-gd-skeleton-item>
                                        <div className="gdrive-skeleton-thumb" />
                                        <div className="gdrive-skeleton-title" />
                                        <div className="gdrive-skeleton-meta" />
                                        <div className="gdrive-skeleton-actions">
                                            <span className="gdrive-skeleton-action-btn" />
                                            <span className="gdrive-skeleton-action-btn" />
                                            <span className="gdrive-skeleton-action-btn" />
                                        </div>
                                    </article>
                                ))}
                            </div>
                        ) : driveFilesQuery.isPending ||
                          (driveFilesQuery.isFetching && driveFiles.length === 0) ? (
                            <div className="gdrive-empty-state gdrive-loading" data-gd-empty-state>
                                <LuRefreshCw size={18} className="gdrive-spin" />
                                Loading files…
                            </div>
                        ) : driveFiles.length === 0 ? (
                            <div className="gdrive-empty-state" data-gd-empty-state>No files found in this folder.</div>

                        ) : viewMode === "list" ? (
                            /* ── LIST VIEW ── */
                            <div className="gdrive-table-wrap">
                                <table className="gdrive-table">
                                    <thead>
                                        <tr>
                                            <th>Name</th>
                                            <th>Type</th>
                                            <th>Owner</th>
                                            <th>Modified</th>
                                            <th>Size</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {driveFiles.map((file) => (
                                            <tr key={file.id} data-gd-result-item>
                                                <td>{nameButton(file)}</td>
                                                <td>
                                                    <span className="gdrive-mime-cell">
                                                        {file.iconLink && (
                                                            <img
                                                                src={file.iconLink}
                                                                alt=""
                                                                className="gdrive-mime-icon"
                                                            />
                                                        )}
                                                        {file.isFolder ? "Folder" : file.mimeType}
                                                    </span>
                                                </td>
                                                <td>{file.owner}</td>
                                                <td>{file.updatedAt}</td>
                                                <td>{file.size}</td>
                                                <td>{actionButtons(file)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                        ) : viewMode === "compact" ? (
                            /* ── COMPACT VIEW ── */
                            <div className="gdrive-compact-list">
                                {driveFiles.map((file) => (
                                    <article key={file.id} className="gdrive-compact-item" data-gd-result-item>
                                        <div className="gdrive-compact-main">
                                            {nameButton(file)}
                                            <div className="gdrive-compact-meta">
                                                {file.iconLink && (
                                                    <img
                                                        src={file.iconLink}
                                                        alt=""
                                                        className="gdrive-mime-icon"
                                                    />
                                                )}
                                                <span>{file.isFolder ? "Folder" : file.mimeType}</span>
                                                <span>{file.updatedAt}</span>
                                                <span>{file.size}</span>
                                            </div>
                                        </div>
                                        {actionButtons(file)}
                                    </article>
                                ))}
                            </div>

                        ) : (
                            /* ── GRID VIEW ── */
                            <div className="gdrive-grid">
                                {driveFiles.map((file) => (
                                    <article key={file.id} className="gdrive-card" data-gd-result-item>
                                        <div className="gdrive-card-thumb">
                                            <CardThumb file={file} getImageUrl={getImageUrl} />
                                        </div>
                                        <div className="gdrive-card-body">
                                            {nameButton(file)}
                                            <p>{file.updatedAt}</p>
                                        </div>
                                        <div className="gdrive-card-actions">
                                            {actionButtons(file)}
                                        </div>
                                    </article>
                                ))}
                            </div>
                        )}
                    </div>
                </section>
            </div>

            {/* Hidden file input */}
            <input
                ref={fileInputRef}
                type="file"
                className="gdrive-hidden-input"
                onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadMutation.mutate(file);
                    e.target.value = "";
                }}
            />

            {/* Alert banner */}
            {(notice || errorMessage) && (
                <div className={`gdrive-alert ${errorMessage ? "gdrive-alert--error" : ""}`}>
                    {errorMessage || notice}
                </div>
            )}

            {/* ── FILE PREVIEW MODAL ── */}
            {previewFile && (
                <div
                    className={`gdrive-preview-backdrop ${previewClosing ? "is-closing" : ""}`}
                    role="presentation"
                    onClick={(e) => e.target === e.currentTarget && closePreviewModal()}
                >
                    <div
                        ref={previewModalRef}
                        className={`gdrive-preview-modal ${previewClosing ? "is-closing" : ""}`}
                        role="dialog"
                        aria-modal="true"
                    >
                        <div className="gdrive-preview-header" data-gd-preview-item>
                            <div className="gdrive-preview-title">
                                {previewFile.iconLink && (
                                    <img
                                        src={previewFile.iconLink}
                                        alt=""
                                        className="gdrive-preview-type-icon"
                                    />
                                )}
                                <div>
                                    <strong>{previewFile.name}</strong>
                                    <span>{previewFile.mimeType}</span>
                                </div>
                            </div>
                            <div className="gdrive-preview-actions">
                                <a
                                    href={previewFile.webViewLink || DRIVE_URL}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="gdrive-btn"
                                >
                                    <HiArrowTopRightOnSquare size={14} />
                                    <span>Open in Google</span>
                                </a>
                                <button
                                    type="button"
                                    className="gdrive-btn"
                                    onClick={closePreviewModal}
                                >
                                    <LuX size={14} />
                                    <span>Close</span>
                                </button>
                            </div>
                        </div>
                        <div className="gdrive-preview-body" data-gd-preview-item>
                            {isImageFile(previewFile) && !previewImageFailed ? (
                                <img
                                    src={getModalImageSrc(previewFile)}
                                    alt={previewFile.name}
                                    className="gdrive-preview-image"
                                    onError={() => setPreviewImageFailed(true)}
                                />
                            ) : previewBlobLoading ? (
                                <div className="gdrive-preview-loading">
                                    <LuRefreshCw size={18} className="gdrive-spin" />
                                    <span>Loading preview...</span>
                                </div>
                            ) : previewBlobUrl ? (
                                <iframe
                                    src={previewBlobUrl}
                                    title={`Preview ${previewFile.name}`}
                                    className="gdrive-preview-frame"
                                    allow="autoplay"
                                />
                            ) : (
                                <iframe
                                    src={getPreviewUrl(previewFile, previewNonce)}
                                    title={`Preview ${previewFile.name}`}
                                    className="gdrive-preview-frame"
                                    allow="autoplay"
                                />
                            )}
                            <div
                                id="gdrive-preview-fallback"
                                className={`gdrive-preview-fallback ${showSignInAssist ? "is-visible gdrive-preview-fallback--signin" : ""}`}
                                data-gd-preview-item
                            >
                                <div className="gdrive-preview-fallback-divider">
                                    <span>or</span>
                                </div>
                                <button
                                    type="button"
                                    className="gdrive-btn gdrive-btn--connect"
                                    onClick={() => {
                                        window.open(previewFile.webViewLink || DRIVE_URL, "_blank", "noopener,noreferrer");
                                        setPreviewFile(null);
                                    }}
                                >
                                    Open in Google
                                </button>
                            </div>
                            <div
                                className={`gdrive-preview-fallback ${showImageAssist ? "is-visible gdrive-preview-fallback--image" : ""}`}
                                data-gd-preview-item
                            >
                                <button
                                    type="button"
                                    className="gdrive-btn gdrive-btn--connect"
                                    onClick={() => {
                                        window.open(previewFile.webViewLink || DRIVE_URL, "_blank", "noopener,noreferrer");
                                        setPreviewFile(null);
                                    }}
                                >
                                    Open in Google
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {createFolderDialogPresence.isRendered && (
                <div
                    className={`gdrive-dialog-backdrop ${createFolderDialogPresence.isVisible ? "open" : "closing"}`}
                    role="presentation"
                    onClick={(e) => e.target === e.currentTarget && setCreateFolderModalOpen(false)}
                >
                    <div
                        ref={createFolderDialogRef}
                        className={`gdrive-dialog ${createFolderDialogPresence.isVisible ? "open" : "closing"}`}
                        role="dialog"
                        aria-modal="true"
                    >
                        <h3 data-gd-dialog-item>Create New Folder</h3>
                        <p data-gd-dialog-item>Enter a folder name for the current location.</p>
                        <input
                            type="text"
                            value={newFolderName}
                            onChange={(e) => setNewFolderName(e.target.value)}
                            className="gdrive-dialog-input"
                            placeholder="Folder name"
                            autoFocus
                            data-gd-dialog-item
                        />
                        <div className="gdrive-dialog-actions" data-gd-dialog-item>
                            <button
                                type="button"
                                className="gdrive-btn"
                                onClick={() => {
                                    setCreateFolderModalOpen(false);
                                    setNewFolderName("");
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="gdrive-btn gdrive-btn--connect"
                                onClick={() => {
                                    const trimmed = newFolderName.trim();
                                    if (!trimmed) return;
                                    createFolderMutation.mutate(trimmed);
                                    setCreateFolderModalOpen(false);
                                    setNewFolderName("");
                                }}
                            >
                                Create
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {shareDialogPresence.isRendered && shareModalRenderFile && (
                <div
                    className={`gdrive-dialog-backdrop ${shareDialogPresence.isVisible ? "open" : "closing"}`}
                    role="presentation"
                    onClick={(e) => e.target === e.currentTarget && setShareModalFile(null)}
                >
                    <div
                        ref={shareDialogRef}
                        className={`gdrive-dialog ${shareDialogPresence.isVisible ? "open" : "closing"}`}
                        role="dialog"
                        aria-modal="true"
                    >
                        <h3 data-gd-dialog-item>Share File</h3>
                        <p data-gd-dialog-item>Share "{shareModalRenderFile.name}" with recipients and access level.</p>
                        <label className="gdrive-dialog-label" htmlFor="gdrive-share-email" data-gd-dialog-item>
                            Recipients
                        </label>
                        <input
                            id="gdrive-share-email"
                            type="email"
                            value={shareEmail}
                            onChange={(e) => setShareEmail(e.target.value)}
                            className="gdrive-dialog-input"
                            placeholder="name@smcbi.edu.ph"
                            autoFocus
                            data-gd-dialog-item
                        />
                        <label className="gdrive-dialog-label" htmlFor="gdrive-share-role" data-gd-dialog-item>
                            Who can access
                        </label>
                        <select
                            id="gdrive-share-role"
                            value={shareRole}
                            onChange={(e) => setShareRole(e.target.value)}
                            className="gdrive-dialog-input"
                            data-gd-dialog-item
                        >
                            <option value="reader">Viewer</option>
                            <option value="commenter">Commenter</option>
                            <option value="writer">Editor</option>
                        </select>
                        <div className="gdrive-dialog-actions" data-gd-dialog-item>
                            <button
                                type="button"
                                className="gdrive-btn"
                                onClick={() => {
                                    setShareModalFile(null);
                                    setShareEmail("");
                                    setShareRole("reader");
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="gdrive-btn gdrive-btn--connect"
                                onClick={() => {
                                    const email = shareEmail.trim();
                                    if (!email || !shareModalRenderFile) return;
                                    shareMutation.mutate({ file: shareModalRenderFile, email, role: shareRole });
                                    setShareModalFile(null);
                                    setShareEmail("");
                                    setShareRole("reader");
                                }}
                            >
                                Share
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {deleteDialogPresence.isRendered && deleteModalRenderFile && (
                <div
                    className={`gdrive-dialog-backdrop ${deleteDialogPresence.isVisible ? "open" : "closing"}`}
                    role="presentation"
                    onClick={(e) => e.target === e.currentTarget && setDeleteModalFile(null)}
                >
                    <div
                        ref={deleteDialogRef}
                        className={`gdrive-dialog ${deleteDialogPresence.isVisible ? "open" : "closing"}`}
                        role="dialog"
                        aria-modal="true"
                    >
                        <h3 data-gd-dialog-item>Delete File</h3>
                        <p data-gd-dialog-item>Are you sure you want to delete "{deleteModalRenderFile.name}"?</p>
                        <div className="gdrive-dialog-actions" data-gd-dialog-item>
                            <button
                                type="button"
                                className="gdrive-btn"
                                onClick={() => setDeleteModalFile(null)}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="gdrive-btn gdrive-btn--danger"
                                onClick={() => {
                                    deleteMutation.mutate(deleteModalRenderFile);
                                    setDeleteModalFile(null);
                                }}
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default UserGoogleDrive;
