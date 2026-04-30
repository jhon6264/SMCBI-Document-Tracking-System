import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
    LuArrowLeft,
    LuArrowRight,
    LuChevronRight,
    LuExternalLink,
    LuPlus,
    LuRefreshCw,
    LuSearch,
    LuTrash2,
    LuUpload,
    LuX,
} from "react-icons/lu";
import "../../../css/user/pages/user-documents.css";
import FolderIcon from "../../assets/images/folder.png";
import GoogleDriveIcon from "../../assets/images/google-drive.png";
import { animateStaggerReveal, animateValue, cleanupMotion, stopMotion } from "../utils/animeMotion";

const FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";
const DOCUMENTS_CACHE_DURATION_MS = 60 * 60 * 1000;

const formatDate = (value) => {
    if (!value) return "Unknown update";

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "Unknown update";

    const now = new Date();
    const sameYear = parsed.getFullYear() === now.getFullYear();

    return parsed.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        ...(sameYear ? {} : { year: "numeric" }),
    });
};

const formatFileSize = (value) => {
    const size = Number(value);
    if (!Number.isFinite(size) || size <= 0) return "Google Drive file";

    const units = ["B", "KB", "MB", "GB"];
    let current = size;
    let index = 0;

    while (current >= 1024 && index < units.length - 1) {
        current /= 1024;
        index += 1;
    }

    const digits = current >= 10 || index === 0 ? 0 : 1;
    return `${current.toFixed(digits)} ${units[index]}`;
};

const formatLastUpdated = (timestamp) => {
    if (!timestamp) return "Not synced yet";

    return new Date(timestamp).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });
};

const DRIVE_URL = "https://drive.google.com/drive/my-drive";

const getFileKindLabel = (file) => {
    if (file.isFolder) return "Folder";

    const extension = file.name?.split(".").pop()?.trim();
    if (extension && extension !== file.name) return extension.toUpperCase();

    const subtype = file.mimeType?.split("/").pop();
    return subtype ? subtype.toUpperCase() : "FILE";
};

const mapDriveFiles = (files = []) =>
    files.map((file) => ({
        id: file.id,
        name: file.name || "Untitled",
        mimeType: file.mimeType || "",
        isFolder: file.mimeType === FOLDER_MIME_TYPE,
        modifiedTime: file.modifiedTime || "",
        size: file.size || "",
        webViewLink: file.webViewLink || "",
        webContentLink: file.webContentLink || "",
        thumbnailLink: file.thumbnailLink || "",
        iconLink: file.iconLink || "",
    }));

const areTrailsEqual = (left = [], right = []) => {
    if (left.length !== right.length) return false;

    return left.every((item, index) => item.id === right[index]?.id);
};

function UserDocuments() {
    const [folderTrail, setFolderTrail] = useState([]);
    const [backHistory, setBackHistory] = useState([]);
    const [forwardHistory, setForwardHistory] = useState([]);
    const [selectedFile, setSelectedFile] = useState(null);
    const [searchInput, setSearchInput] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [actionMenuOpen, setActionMenuOpen] = useState(false);
    const [previewFile, setPreviewFile] = useState(null);
    const [previewClosing, setPreviewClosing] = useState(false);
    const [previewNonce, setPreviewNonce] = useState(0);
    const [previewImageFailed, setPreviewImageFailed] = useState(false);
    const [previewBlobUrl, setPreviewBlobUrl] = useState("");
    const [previewBlobLoading, setPreviewBlobLoading] = useState(false);
    const [previewBlobFailed, setPreviewBlobFailed] = useState(false);
    const [createFolderModalOpen, setCreateFolderModalOpen] = useState(false);
    const [newFolderName, setNewFolderName] = useState("");
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [deleteConfirmationName, setDeleteConfirmationName] = useState("");
    const [notice, setNotice] = useState("");
    const [actionError, setActionError] = useState("");
    const [uploadProgress, setUploadProgress] = useState({
        visible: false,
        label: "",
        progress: 0,
    });
    const [deleteProgress, setDeleteProgress] = useState({
        visible: false,
        label: "",
        progress: 0,
    });

    const folderTrailRef = useRef([]);
    const actionMenuRef = useRef(null);
    const uploadFileInputRef = useRef(null);
    const uploadFolderInputRef = useRef(null);
    const pageRef = useRef(null);
    const resultsRef = useRef(null);
    const previewModalRef = useRef(null);
    const createFolderDialogRef = useRef(null);
    const deleteDialogRef = useRef(null);
    const previewCloseTimerRef = useRef(null);
    const uploadProgressMotionRef = useRef(null);
    const deleteProgressMotionRef = useRef(null);
    const uploadProgressResetTimeoutRef = useRef(null);
    const deleteProgressResetTimeoutRef = useRef(null);

    const buildAuthConfig = useCallback(() => {
        const token = localStorage.getItem("user_token");

        return {
            headers: {
                Accept: "application/json",
                Authorization: `Bearer ${token || ""}`,
            },
        };
    }, []);

    const rootQuery = useQuery({
        queryKey: ["user-documents-root"],
        staleTime: DOCUMENTS_CACHE_DURATION_MS,
        gcTime: DOCUMENTS_CACHE_DURATION_MS,
        queryFn: async () => {
            const { data } = await axios.get(
                "/api/user/google/drive/system-library",
                buildAuthConfig()
            );

            return data;
        },
    });

    const rootFolder = rootQuery.data?.data?.folder || null;
    const currentFolder = folderTrail[folderTrail.length - 1] || rootFolder;
    const currentFolderId = currentFolder?.id || "";

    const contentsQuery = useQuery({
        queryKey: ["user-documents-contents", currentFolderId],
        enabled: Boolean(currentFolderId),
        staleTime: DOCUMENTS_CACHE_DURATION_MS,
        gcTime: DOCUMENTS_CACHE_DURATION_MS,
        queryFn: async () => {
            const { data } = await axios.get("/api/user/google/drive/files", {
                ...buildAuthConfig(),
                params: {
                    pageSize: 300,
                    parentId: currentFolderId,
                    section: "my-drive",
                },
            });

            return data;
        },
    });

    const entries = useMemo(
        () => mapDriveFiles(contentsQuery.data?.data?.files || []),
        [contentsQuery.data]
    );

    const filteredEntries = useMemo(() => {
        const needle = searchQuery.trim().toLowerCase();
        if (!needle) return entries;

        return entries.filter((item) => {
            const haystack = `${item.name} ${item.mimeType}`.toLowerCase();
            return haystack.includes(needle);
        });
    }, [entries, searchQuery]);

    const folders = useMemo(
        () => filteredEntries.filter((item) => item.isFolder),
        [filteredEntries]
    );

    const files = useMemo(
        () => filteredEntries.filter((item) => !item.isFolder),
        [filteredEntries]
    );
    const hasResults = folders.length > 0 || files.length > 0;

    const activeDriveLink =
        selectedFile?.webViewLink || currentFolder?.webViewLink || rootFolder?.webViewLink || "";

    const clearFeedback = useCallback(() => {
        setNotice("");
        setActionError("");
    }, []);

    const getPreviewUrl = useCallback((file, nonce = 0) => {
        if (!file?.id) return "";
        const qs = `rm=minimal&embedded=true&t=${nonce || Date.now()}`;

        if (file.mimeType === "application/vnd.google-apps.document") {
            return `https://docs.google.com/document/d/${file.id}/preview?${qs}`;
        }
        if (file.mimeType === "application/vnd.google-apps.spreadsheet") {
            return `https://docs.google.com/spreadsheets/d/${file.id}/preview?${qs}`;
        }
        if (file.mimeType === "application/vnd.google-apps.presentation") {
            return `https://docs.google.com/presentation/d/${file.id}/preview?${qs}`;
        }

        return `https://drive.google.com/file/d/${file.id}/preview?t=${nonce || Date.now()}`;
    }, []);

    const isImageFile = useCallback((file) => Boolean(file?.mimeType?.startsWith("image/")), []);
    const getImageUrl = useCallback((file) => `https://drive.google.com/thumbnail?id=${file.id}&sz=w1800`, []);
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
        if (previewCloseTimerRef.current) {
            window.clearTimeout(previewCloseTimerRef.current);
        }

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

    const refreshContents = useCallback(async () => {
        await contentsQuery.refetch();
    }, [contentsQuery]);

    const createDriveFolderRequest = useCallback(async (name, parentId) => {
        const { data } = await axios.post(
            "/api/user/google/drive/folders",
            {
                name: name.trim(),
                parent_id: parentId || undefined,
            },
            buildAuthConfig()
        );

        return data?.data || null;
    }, [buildAuthConfig]);

    const uploadDriveFileRequest = useCallback(async (file, parentId, onUploadProgress) => {
        const formData = new FormData();
        formData.append("file", file);
        if (parentId) {
            formData.append("parent_id", parentId);
        }

        await axios.post("/api/user/google/drive/upload", formData, {
            ...buildAuthConfig(),
            headers: {
                ...buildAuthConfig().headers,
                "Content-Type": "multipart/form-data",
            },
            onUploadProgress,
        });
    }, [buildAuthConfig]);

    const clearUploadProgressReset = useCallback(() => {
        if (uploadProgressResetTimeoutRef.current) {
            window.clearTimeout(uploadProgressResetTimeoutRef.current);
            uploadProgressResetTimeoutRef.current = null;
        }
    }, []);

    const clearDeleteProgressReset = useCallback(() => {
        if (deleteProgressResetTimeoutRef.current) {
            window.clearTimeout(deleteProgressResetTimeoutRef.current);
            deleteProgressResetTimeoutRef.current = null;
        }
    }, []);

    const animateUploadProgressTo = useCallback((label, targetProgress, options = {}) => {
        clearUploadProgressReset();
        stopMotion(uploadProgressMotionRef.current);

        const startProgress = options.from ?? uploadProgress.progress;
        const nextProgress = Math.max(startProgress, targetProgress);
        setUploadProgress({
            visible: true,
            label,
            progress: Math.round(startProgress),
        });

        uploadProgressMotionRef.current = animateValue({
            from: startProgress,
            to: nextProgress,
            duration: options.duration ?? 760,
            ease: options.ease ?? "outExpo",
            onUpdate: (value) => {
                setUploadProgress({
                    visible: true,
                    label,
                    progress: Math.round(value),
                });
            },
            onComplete: () => {
                uploadProgressMotionRef.current = null;
                setUploadProgress({
                    visible: true,
                    label,
                    progress: Math.round(nextProgress),
                });
            },
        });
    }, [clearUploadProgressReset, uploadProgress.progress]);

    const animateDeleteProgressTo = useCallback((label, targetProgress, options = {}) => {
        clearDeleteProgressReset();
        stopMotion(deleteProgressMotionRef.current);

        const startProgress = options.from ?? deleteProgress.progress;
        const nextProgress = Math.max(startProgress, targetProgress);
        setDeleteProgress({
            visible: true,
            label,
            progress: Math.round(startProgress),
        });

        deleteProgressMotionRef.current = animateValue({
            from: startProgress,
            to: nextProgress,
            duration: options.duration ?? 680,
            ease: options.ease ?? "outExpo",
            onUpdate: (value) => {
                setDeleteProgress({
                    visible: true,
                    label,
                    progress: Math.round(value),
                });
            },
            onComplete: () => {
                deleteProgressMotionRef.current = null;
                setDeleteProgress({
                    visible: true,
                    label,
                    progress: Math.round(nextProgress),
                });
            },
        });
    }, [clearDeleteProgressReset, deleteProgress.progress]);

    const resetUploadProgress = useCallback(() => {
        clearUploadProgressReset();
        stopMotion(uploadProgressMotionRef.current);
        uploadProgressMotionRef.current = null;
        setUploadProgress({
            visible: false,
            label: "",
            progress: 0,
        });
    }, [clearUploadProgressReset]);

    const resetDeleteProgress = useCallback(() => {
        clearDeleteProgressReset();
        stopMotion(deleteProgressMotionRef.current);
        deleteProgressMotionRef.current = null;
        setDeleteProgress({
            visible: false,
            label: "",
            progress: 0,
        });
    }, [clearDeleteProgressReset]);

    const beginUploadProgress = useCallback((label, targetProgress = 10) => {
        animateUploadProgressTo(label, targetProgress, {
            from: 0,
            duration: 620,
            ease: "outCirc",
        });
    }, [animateUploadProgressTo]);

    const showUploadProgress = useCallback((label, progress) => {
        animateUploadProgressTo(label, progress, {
            duration: progress >= 90 ? 420 : 720,
            ease: progress >= 90 ? "outQuad" : "outExpo",
        });
    }, [animateUploadProgressTo]);

    const finishUploadProgress = useCallback((label = "Completed") => {
        animateUploadProgressTo(label, 100, {
            duration: 420,
            ease: "outQuad",
        });

        uploadProgressResetTimeoutRef.current = window.setTimeout(() => {
            setUploadProgress({
                visible: false,
                label: "",
                progress: 0,
            });
            uploadProgressResetTimeoutRef.current = null;
        }, 900);
    }, [animateUploadProgressTo]);

    const beginDeleteProgress = useCallback((label, targetProgress = 24) => {
        animateDeleteProgressTo(label, targetProgress, {
            from: 0,
            duration: 560,
            ease: "outCirc",
        });
    }, [animateDeleteProgressTo]);

    const showDeleteProgress = useCallback((label, progress) => {
        animateDeleteProgressTo(label, progress, {
            duration: progress >= 88 ? 360 : 620,
            ease: progress >= 88 ? "outQuad" : "outExpo",
        });
    }, [animateDeleteProgressTo]);

    const finishDeleteProgress = useCallback((label = "Deleted") => {
        animateDeleteProgressTo(label, 100, {
            duration: 360,
            ease: "outQuad",
        });

        deleteProgressResetTimeoutRef.current = window.setTimeout(() => {
            setDeleteProgress({
                visible: false,
                label: "",
                progress: 0,
            });
            deleteProgressResetTimeoutRef.current = null;
        }, 900);
    }, [animateDeleteProgressTo]);

    useEffect(() => {
        folderTrailRef.current = folderTrail;
    }, [folderTrail]);

    useEffect(() => {
        const input = uploadFolderInputRef.current;
        if (!input) return;

        input.setAttribute("webkitdirectory", "");
        input.setAttribute("directory", "");
        input.setAttribute("mozdirectory", "");
    }, []);

    useEffect(() => {
        if (!selectedFile) return;

        const fileStillVisible = entries.some((item) => item.id === selectedFile.id && !item.isFolder);
        if (!fileStillVisible) {
            setSelectedFile(null);
        }
    }, [entries, selectedFile]);

    useEffect(() => {
        if (!previewFile) return;

        const fileStillVisible = entries.some((item) => item.id === previewFile.id && !item.isFolder);
        if (!fileStillVisible) {
            closePreviewModal();
        }
    }, [closePreviewModal, entries, previewFile]);

    useEffect(() => {
        if (!actionMenuOpen) return undefined;

        const handlePointerDown = (event) => {
            if (actionMenuRef.current?.contains(event.target)) return;
            setActionMenuOpen(false);
        };

        document.addEventListener("mousedown", handlePointerDown);

        return () => document.removeEventListener("mousedown", handlePointerDown);
    }, [actionMenuOpen]);

    useEffect(() => () => {
        clearUploadProgressReset();
        clearDeleteProgressReset();
        stopMotion(uploadProgressMotionRef.current);
        stopMotion(deleteProgressMotionRef.current);
        if (previewCloseTimerRef.current) {
            window.clearTimeout(previewCloseTimerRef.current);
        }
    }, [clearDeleteProgressReset, clearUploadProgressReset]);

    useEffect(() => {
        return () => {
            if (previewBlobUrl) {
                URL.revokeObjectURL(previewBlobUrl);
            }
        };
    }, [previewBlobUrl]);

    useEffect(() => {
        const motion = animateStaggerReveal(pageRef.current, {
            selector: "[data-ud-layout-item]",
            duration: 700,
            staggerMs: 42,
            startDelayMs: 16,
        });

        if (!motion) {
            return undefined;
        }

        return () => {
            cleanupMotion(motion);
        };
    }, []);

    useEffect(() => {
        const selector = isLoading || isError
            ? "[data-ud-state-item]"
            : hasResults
                ? "[data-ud-result-item]"
                : "[data-ud-empty-item]";

        const motion = animateStaggerReveal(resultsRef.current, {
            selector,
            duration: 640,
            staggerMs: 36,
            startDelayMs: 10,
        });

        if (!motion) {
            return undefined;
        }

        return () => {
            cleanupMotion(motion);
        };
    }, [files.length, folders.length, hasResults, isError, isLoading, searchQuery]);

    useEffect(() => {
        if (!previewFile || previewClosing) {
            return undefined;
        }

        const motion = animateStaggerReveal(previewModalRef.current, {
            selector: "[data-ud-preview-item]",
            duration: 520,
            staggerMs: 30,
            startDelayMs: 0,
        });

        if (!motion) {
            return undefined;
        }

        return () => {
            cleanupMotion(motion);
        };
    }, [previewBlobFailed, previewBlobLoading, previewClosing, previewFile?.id, previewImageFailed]);

    useEffect(() => {
        if (!createFolderModalOpen) {
            return undefined;
        }

        const motion = animateStaggerReveal(createFolderDialogRef.current, {
            selector: "[data-ud-dialog-item]",
            duration: 460,
            staggerMs: 30,
            startDelayMs: 0,
        });

        if (!motion) {
            return undefined;
        }

        return () => {
            cleanupMotion(motion);
        };
    }, [createFolderModalOpen]);

    useEffect(() => {
        if (!deleteTarget) {
            return undefined;
        }

        const motion = animateStaggerReveal(deleteDialogRef.current, {
            selector: "[data-ud-dialog-item]",
            duration: 460,
            staggerMs: 30,
            startDelayMs: 0,
        });

        if (!motion) {
            return undefined;
        }

        return () => {
            cleanupMotion(motion);
        };
    }, [deleteConfirmationName, deleteTarget]);

    useEffect(() => {
        const onEscape = (event) => {
            if (event.key === "Escape") {
                closePreviewModal();
            }
        };

        window.addEventListener("keydown", onEscape);
        return () => window.removeEventListener("keydown", onEscape);
    }, [closePreviewModal]);

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
                setPreviewBlobUrl((previous) => {
                    if (previous) {
                        URL.revokeObjectURL(previous);
                    }
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
    }, [buildAuthConfig, isImageFile, previewFile]);

    const navigateToTrail = useCallback((nextTrail, historyMode = "push") => {
        const currentTrailState = folderTrailRef.current;
        const normalizedNextTrail = Array.isArray(nextTrail) ? nextTrail : [];

        setSelectedFile(null);

        if (areTrailsEqual(currentTrailState, normalizedNextTrail)) {
            return;
        }

        if (historyMode === "back") {
            setBackHistory((previous) => previous.slice(0, -1));
            setForwardHistory((previous) => [...previous, currentTrailState]);
        } else if (historyMode === "forward") {
            setForwardHistory((previous) => previous.slice(0, -1));
            setBackHistory((previous) => [...previous, currentTrailState]);
        } else {
            setBackHistory((previous) => [...previous, currentTrailState]);
            setForwardHistory([]);
        }

        setFolderTrail(normalizedNextTrail);
    }, []);

    const createFolderMutation = useMutation({
        mutationFn: (name) => createDriveFolderRequest(name, currentFolderId),
        onSuccess: async (_, folderName) => {
            setNotice(`Folder "${folderName.trim()}" created.`);
            setActionError("");
            setCreateFolderModalOpen(false);
            setNewFolderName("");
            await refreshContents();
        },
        onError: (error) => {
            setActionError(error.response?.data?.message || "Create failed.");
            setNotice("");
        },
    });

    const uploadFileMutation = useMutation({
        mutationFn: async (file) => {
            beginUploadProgress(`Uploading ${file.name}`, 12);

            await uploadDriveFileRequest(file, currentFolderId, (progressEvent) => {
                if (!progressEvent.total) {
                    showUploadProgress(`Uploading ${file.name}`, 72);
                    return;
                }

                const uploadRatio = progressEvent.loaded / progressEvent.total;
                const stagedProgress = 12 + Math.round(uploadRatio * 78);
                showUploadProgress(
                    `Uploading ${file.name}`,
                    Math.min(90, Math.max(12, stagedProgress))
                );
            });
        },
        onSuccess: async (_, file) => {
            setNotice(`Uploaded "${file.name}" successfully.`);
            setActionError("");
            finishUploadProgress(`Uploaded ${file.name}`);
            await refreshContents();
        },
        onError: (error) => {
            setActionError(error.response?.data?.message || "Upload failed.");
            setNotice("");
            resetUploadProgress();
        },
    });

    const uploadFolderMutation = useMutation({
        mutationFn: async (fileList) => {
            const filesToUpload = Array.from(fileList || []).filter(Boolean);
            if (!filesToUpload.length) {
                throw new Error("No files were selected.");
            }

            const totalBytes = filesToUpload.reduce((sum, file) => sum + (Number(file.size) || 0), 0);
            let uploadedBytes = 0;

            const folderCache = new Map();
            const fallbackRootName =
                filesToUpload[0].webkitRelativePath?.split("/").filter(Boolean)[0] || "Folder";

            beginUploadProgress(`Uploading folder ${fallbackRootName}`, 8);

            const ensureFolderPath = async (folderParts) => {
                let parentId = currentFolderId || "";
                let pathKey = "";

                for (const part of folderParts) {
                    pathKey = pathKey ? `${pathKey}/${part}` : part;

                    if (!folderCache.has(pathKey)) {
                        const createdFolder = await createDriveFolderRequest(part, parentId);
                        folderCache.set(pathKey, createdFolder?.id || "");
                    }

                    parentId = folderCache.get(pathKey) || parentId;
                }

                return parentId || currentFolderId || "";
            };

            for (const file of filesToUpload) {
                const relativePath = file.webkitRelativePath || file.name;
                const parts = relativePath.split("/").filter(Boolean);
                const folderParts = parts.slice(0, -1);
                const targetParentId = folderParts.length
                    ? await ensureFolderPath(folderParts)
                    : currentFolderId;
                let previousLoaded = 0;

                await uploadDriveFileRequest(file, targetParentId || "", (progressEvent) => {
                    if (!progressEvent.total || totalBytes <= 0) {
                        const fallbackStep = Math.min(
                            90,
                            12 + Math.round(((uploadedBytes + previousLoaded) / Math.max(filesToUpload.length, 1)) * 4)
                        );
                        showUploadProgress(`Uploading folder ${fallbackRootName}`, fallbackStep);
                        return;
                    }

                    const currentLoaded = progressEvent.loaded || 0;
                    uploadedBytes += currentLoaded - previousLoaded;
                    previousLoaded = currentLoaded;

                    const uploadRatio = uploadedBytes / totalBytes;
                    const stagedProgress = 8 + Math.round(uploadRatio * 82);
                    showUploadProgress(
                        `Uploading folder ${fallbackRootName}`,
                        Math.min(90, Math.max(8, stagedProgress))
                    );
                });
            }

            return {
                count: filesToUpload.length,
                rootName: fallbackRootName,
            };
        },
        onSuccess: async ({ count, rootName }) => {
            setNotice(`Uploaded folder "${rootName}" with ${count} file${count === 1 ? "" : "s"}.`);
            setActionError("");
            finishUploadProgress(`Uploaded folder ${rootName}`);
            await refreshContents();
        },
        onError: (error) => {
            setActionError(error.response?.data?.message || error.message || "Folder upload failed.");
            setNotice("");
            resetUploadProgress();
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (target) => {
            beginDeleteProgress(`Deleting ${target.name}`, 20);
            showDeleteProgress(`Deleting ${target.name}`, 72);

            return axios.delete("/api/user/google/drive/file", {
                ...buildAuthConfig(),
                data: { file_id: target.id },
            });
        },
        onSuccess: async (_, target) => {
            setNotice(`Deleted "${target.name}".`);
            setActionError("");
            finishDeleteProgress(`Deleted ${target.name}`);
            if (selectedFile?.id === target.id) {
                setSelectedFile(null);
            }
            if (previewFile?.id === target.id) {
                closePreviewModal();
            }
            setDeleteTarget(null);
            setDeleteConfirmationName("");
            await refreshContents();
        },
        onError: (error) => {
            setActionError(error.response?.data?.message || "Delete failed.");
            setNotice("");
            resetDeleteProgress();
        },
    });

    const handleOpenFolder = useCallback((folder) => {
        navigateToTrail(
            [
                ...folderTrailRef.current,
                { id: folder.id, name: folder.name, webViewLink: folder.webViewLink || "" },
            ],
            "push"
        );
    }, [navigateToTrail]);

    const handleOpenFile = (file) => {
        setSelectedFile(file);
        setPreviewClosing(false);
        setPreviewNonce(Date.now());
        setPreviewFile(file);
    };

    const handleSelectCrumb = useCallback((index) => {
        navigateToTrail(folderTrailRef.current.slice(0, index + 1), "push");
    }, [navigateToTrail]);

    const handleGoRoot = useCallback(() => {
        navigateToTrail([], "push");
    }, [navigateToTrail]);

    const handleGoBack = useCallback(() => {
        if (!backHistory.length) {
            setSelectedFile(null);
            return;
        }

        navigateToTrail(backHistory[backHistory.length - 1], "back");
    }, [backHistory, navigateToTrail]);

    const handleGoForward = useCallback(() => {
        if (!forwardHistory.length) return;

        navigateToTrail(forwardHistory[forwardHistory.length - 1], "forward");
    }, [forwardHistory, navigateToTrail]);

    const handleRefresh = async () => {
        clearFeedback();
        await rootQuery.refetch();
        await contentsQuery.refetch();
    };

    const handleOpenCreateFolderDialog = () => {
        clearFeedback();
        setActionMenuOpen(false);
        setCreateFolderModalOpen(true);
    };

    const handleSearchSubmit = useCallback(() => {
        setSearchQuery(searchInput.trim());
    }, [searchInput]);

    const handleClearSearch = useCallback(() => {
        setSearchInput("");
        setSearchQuery("");
    }, []);

    const handleUploadFileClick = () => {
        clearFeedback();
        setActionMenuOpen(false);
        uploadFileInputRef.current?.click();
    };

    const handleUploadFolderClick = () => {
        clearFeedback();
        setActionMenuOpen(false);
        const input = uploadFolderInputRef.current;
        if (!input) return;

        input.setAttribute("webkitdirectory", "");
        input.setAttribute("directory", "");
        input.setAttribute("mozdirectory", "");
        input.multiple = true;
        input.click();
    };

    const handleDeleteClick = (target) => {
        clearFeedback();
        setDeleteTarget(target);
        setDeleteConfirmationName("");
    };

    const handleCreateFolderSubmit = (event) => {
        event.preventDefault();
        const trimmed = newFolderName.trim();
        if (!trimmed || createFolderMutation.isPending) return;

        createFolderMutation.mutate(trimmed);
    };

    const handleDeleteSubmit = (event) => {
        event.preventDefault();
        if (!deleteTarget || deleteMutation.isPending) return;
        if (!deleteNameMatches) return;

        deleteMutation.mutate(deleteTarget);
    };

    const handleFileInputChange = (event) => {
        const file = event.target.files?.[0];
        event.target.value = "";

        if (!file) return;

        clearFeedback();
        uploadFileMutation.mutate(file);
    };

    const handleFolderInputChange = (event) => {
        const folderFiles = Array.from(event.target.files || []);
        event.target.value = "";

        if (!folderFiles.length) return;

        clearFeedback();
        uploadFolderMutation.mutate(folderFiles);
    };

    const isLoading = rootQuery.isLoading || (Boolean(currentFolderId) && contentsQuery.isLoading);
    const isRefreshing = rootQuery.isFetching || contentsQuery.isFetching;
    const isBusy =
        createFolderMutation.isPending ||
        uploadFileMutation.isPending ||
        uploadFolderMutation.isPending ||
        deleteMutation.isPending;
    const isError = rootQuery.isError || contentsQuery.isError;
    const queryErrorMessage =
        rootQuery.error?.response?.data?.message ||
        contentsQuery.error?.response?.data?.message ||
        "Failed to load your document library.";
    const hasRenderableData =
        Boolean(rootFolder?.id) &&
        (!currentFolderId || Array.isArray(contentsQuery.data?.data?.files));
    const showBlockingError = isError && !hasRenderableData;
    const showRefreshWarning = isError && hasRenderableData;
    const latestDataUpdatedAt = Math.max(rootQuery.dataUpdatedAt || 0, contentsQuery.dataUpdatedAt || 0);
    const lastUpdatedLabel = latestDataUpdatedAt
        ? `Last updated ${formatLastUpdated(latestDataUpdatedAt)}`
        : "Last updated just now";
    const deleteNameMatches = deleteConfirmationName.trim().toLowerCase() === "yes";
    const emptyStateConfig = searchQuery.trim()
        ? {
              title: "No matching documents",
              body: `No files or folders match "${searchQuery}".`,
              primaryAction: {
                  label: "Clear search",
                  onClick: handleClearSearch,
              },
              secondaryAction: null,
          }
        : folderTrail.length > 0
            ? {
                  title: `${currentFolder?.name || "This folder"} is empty`,
                  body: "Upload files, upload a folder, or create a folder to start organizing this space.",
                  primaryAction: {
                      label: "Upload file",
                      onClick: handleUploadFileClick,
                  },
                  secondaryAction: {
                      label: "Create folder",
                      onClick: handleOpenCreateFolderDialog,
                  },
              }
            : {
                  title: "No documents yet",
                  body: "Upload a file, upload a folder, or create a folder to start your document library.",
                  primaryAction: {
                      label: "Upload file",
                      onClick: handleUploadFileClick,
                  },
                  secondaryAction: {
                      label: "Create folder",
                      onClick: handleOpenCreateFolderDialog,
                  },
              };
    const showSignInAssist =
        Boolean(previewFile) &&
        previewBlobFailed &&
        !isImageFile(previewFile);
    const showImageAssist =
        Boolean(previewFile) &&
        previewImageFailed &&
        isImageFile(previewFile);
    const renderUploadProgress = uploadProgress.visible ? (
        <div
            className="user-documents-progress"
            role="status"
            aria-live="polite"
            aria-label={`${uploadProgress.label}: ${uploadProgress.progress}%`}
        >
            <div className="user-documents-progress-head">
                <strong>{uploadProgress.label}</strong>
                <span>{uploadProgress.progress}%</span>
            </div>
            <div className="user-documents-progress-bar" aria-hidden="true">
                <div
                    className="user-documents-progress-fill"
                    style={{ width: `${uploadProgress.progress}%` }}
                />
            </div>
        </div>
    ) : null;
    const renderDeleteProgress = deleteProgress.visible ? (
        <div
            className="user-documents-progress user-documents-progress--danger"
            role="status"
            aria-live="polite"
            aria-label={`${deleteProgress.label}: ${deleteProgress.progress}%`}
        >
            <div className="user-documents-progress-head">
                <strong>{deleteProgress.label}</strong>
                <span>{deleteProgress.progress}%</span>
            </div>
            <div
                className="user-documents-progress-bar user-documents-progress-bar--danger"
                aria-hidden="true"
            >
                <div
                    className="user-documents-progress-fill user-documents-progress-fill--danger"
                    style={{ width: `${deleteProgress.progress}%` }}
                />
            </div>
        </div>
    ) : null;

    useEffect(() => {
        if (!latestDataUpdatedAt || isBusy || rootQuery.isFetching || contentsQuery.isFetching) {
            return undefined;
        }

        const ageMs = Date.now() - latestDataUpdatedAt;
        const nextRefreshInMs = Math.max(0, DOCUMENTS_CACHE_DURATION_MS - ageMs);

        const timerId = window.setTimeout(() => {
            rootQuery.refetch();
            contentsQuery.refetch();
        }, nextRefreshInMs);

        return () => window.clearTimeout(timerId);
    }, [
        contentsQuery.isFetching,
        isBusy,
        latestDataUpdatedAt,
        contentsQuery.refetch,
        rootQuery.isFetching,
        rootQuery.refetch,
    ]);

    return (
        <div className="user-documents-page" ref={pageRef}>
            <section className="user-documents-browser">
                <div className="user-documents-toolbar" data-ud-layout-item>
                    <div className="user-documents-title-stack">
                        <h1>My Documents</h1>

                        <div className="user-documents-nav-row">
                            <div className="user-documents-history-controls" aria-label="Navigation history">
                                <button
                                    type="button"
                                    className="user-documents-history-btn"
                                    onClick={handleGoBack}
                                    disabled={!backHistory.length}
                                    aria-label="Go back"
                                >
                                    <LuArrowLeft size={15} />
                                </button>
                                <button
                                    type="button"
                                    className="user-documents-history-btn"
                                    onClick={handleGoForward}
                                    disabled={!forwardHistory.length}
                                    aria-label="Go forward"
                                >
                                    <LuArrowRight size={15} />
                                </button>
                            </div>

                            <div className="user-documents-breadcrumbs" aria-label="Breadcrumb">
                                <button type="button" onClick={handleGoRoot}>
                                    {rootFolder?.name || "SMCBI_DTS"}
                                </button>

                                {folderTrail.map((folder, index) => (
                                    <React.Fragment key={folder.id}>
                                        <span className="user-documents-breadcrumb-sep" aria-hidden="true">
                                            <LuChevronRight size={13} />
                                        </span>
                                        <button type="button" onClick={() => handleSelectCrumb(index)}>
                                            {folder.name}
                                        </button>
                                    </React.Fragment>
                                ))}

                                {selectedFile && (
                                    <>
                                        <span className="user-documents-breadcrumb-sep" aria-hidden="true">
                                            <LuChevronRight size={13} />
                                        </span>
                                        <span
                                            className="user-documents-breadcrumb-current"
                                            title={selectedFile.name}
                                        >
                                            {selectedFile.name}
                                        </span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="user-documents-toolbar-actions">
                        <div className="user-documents-toolbar-menu-wrap" ref={actionMenuRef}>
                            <button
                                type="button"
                                className="user-documents-toolbar-icon-btn"
                                aria-label="Add new item"
                                onClick={() => setActionMenuOpen((previous) => !previous)}
                                disabled={isBusy}
                            >
                                <LuPlus size={16} />
                            </button>

                            {actionMenuOpen && (
                                <div className="user-documents-action-menu" role="menu">
                                    <button
                                        type="button"
                                        className="user-documents-action-menu-item"
                                        onClick={handleUploadFileClick}
                                        disabled={isBusy}
                                    >
                                        <LuUpload size={15} />
                                        <span>Upload File</span>
                                    </button>
                                    <button
                                        type="button"
                                        className="user-documents-action-menu-item"
                                        onClick={handleUploadFolderClick}
                                        disabled={isBusy}
                                    >
                                        <LuUpload size={15} />
                                        <span>Upload Folder</span>
                                    </button>
                                    <button
                                        type="button"
                                        className="user-documents-action-menu-item"
                                        onClick={handleOpenCreateFolderDialog}
                                        disabled={isBusy}
                                    >
                                        <LuPlus size={15} />
                                        <span>Create Folder</span>
                                    </button>
                                </div>
                            )}
                        </div>

                        <label className="user-documents-search">
                            <LuSearch size={15} />
                            <input
                                type="search"
                                value={searchInput}
                                onChange={(event) => setSearchInput(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key !== "Enter") return;
                                    event.preventDefault();
                                    handleSearchSubmit();
                                }}
                                placeholder="Search files and folders, then press Enter..."
                            />
                        </label>

                        <button
                            type="button"
                            className="user-documents-toolbar-btn"
                            onClick={handleRefresh}
                            disabled={isRefreshing || isBusy}
                        >
                            <LuRefreshCw size={15} className={isRefreshing ? "is-spinning" : ""} />
                            <span>{isRefreshing ? "Refreshing..." : "Refresh"}</span>
                        </button>
                        <span className="user-documents-last-updated">{lastUpdatedLabel}</span>

                        {activeDriveLink && (
                            <a
                                href={activeDriveLink}
                                target="_blank"
                                rel="noreferrer"
                                className="user-documents-toolbar-btn user-documents-toolbar-btn--primary"
                            >
                                <img src={GoogleDriveIcon} alt="" aria-hidden="true" />
                                <span>Open in Drive</span>
                                <LuExternalLink size={14} />
                            </a>
                        )}
                    </div>
                </div>

                {(notice || actionError) && (
                    <div
                        className={`user-documents-alert ${actionError ? "is-error" : "is-success"}`}
                        data-ud-layout-item
                    >
                        {actionError || notice}
                    </div>
                )}
                {showRefreshWarning && (
                    <div className="user-documents-alert user-documents-alert--warning" data-ud-layout-item>
                        <strong>Refresh failed.</strong> Showing the most recently cached documents.
                    </div>
                )}
                {(renderUploadProgress || renderDeleteProgress) && (
                    <div className="user-documents-progress-stack" data-ud-layout-item>
                        {renderUploadProgress}
                        {renderDeleteProgress}
                    </div>
                )}

                {selectedFile && (
                    <div className="user-documents-selection-bar" data-ud-layout-item>
                        <div className="user-documents-selection-info">
                            <strong>{selectedFile.name}</strong>
                            <span>
                                {getFileKindLabel(selectedFile)} - Updated {formatDate(selectedFile.modifiedTime)}
                            </span>
                        </div>
                        {selectedFile.webViewLink && (
                            <a
                                href={selectedFile.webViewLink}
                                target="_blank"
                                rel="noreferrer"
                                className="user-documents-selection-link"
                            >
                                <span>Open file</span>
                                <LuExternalLink size={14} />
                            </a>
                        )}
                    </div>
                )}

                {isLoading && !hasRenderableData && (
                    <div className="user-documents-state" ref={resultsRef} data-ud-state-item>
                        <div className="user-documents-state-shell">
                            <LuRefreshCw size={18} className="is-spinning" />
                            <strong>Loading your documents</strong>
                            <span>Checking your cached library and syncing the latest items.</span>
                        </div>
                    </div>
                )}

                {showBlockingError && (
                    <div className="user-documents-state user-documents-state--error" ref={resultsRef} data-ud-state-item>
                        <div className="user-documents-state-shell">
                            <strong>Document library unavailable</strong>
                            <span>{queryErrorMessage}</span>
                            <div className="user-documents-state-actions">
                                <button
                                    type="button"
                                    className="user-documents-state-btn"
                                    onClick={handleRefresh}
                                    disabled={isRefreshing || isBusy}
                                >
                                    Retry
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {(!isLoading || hasRenderableData) && !showBlockingError && (
                    <div className="user-documents-sections" ref={resultsRef} data-ud-layout-item>
                        {!hasResults ? (
                            <div className="user-documents-empty-block" data-ud-empty-item>
                                <div className="user-documents-state-shell">
                                    <strong>{emptyStateConfig.title}</strong>
                                    <span>{emptyStateConfig.body}</span>
                                    <div className="user-documents-state-actions">
                                        {emptyStateConfig.primaryAction && (
                                            <button
                                                type="button"
                                                className="user-documents-state-btn user-documents-state-btn--primary"
                                                onClick={emptyStateConfig.primaryAction.onClick}
                                                disabled={isBusy}
                                            >
                                                {emptyStateConfig.primaryAction.label}
                                            </button>
                                        )}
                                        {emptyStateConfig.secondaryAction && (
                                            <button
                                                type="button"
                                                className="user-documents-state-btn"
                                                onClick={emptyStateConfig.secondaryAction.onClick}
                                                disabled={isBusy}
                                            >
                                                {emptyStateConfig.secondaryAction.label}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <>
                                <section className="user-documents-section">
                                    <div className="user-documents-section-head">
                                        <span className="user-documents-section-label">Folders</span>
                                    </div>

                                    {folders.length > 0 ? (
                                        <div className="user-documents-folder-grid">
                                            {folders.map((folder) => (
                                                <article
                                                    key={folder.id}
                                                    className="user-documents-folder-card"
                                                    data-ud-result-item
                                                >
                                                    <button
                                                        type="button"
                                                        className="user-documents-folder-main"
                                                        onClick={() => handleOpenFolder(folder)}
                                                    >
                                                        <div className="user-documents-folder-icon">
                                                            <img src={FolderIcon} alt="" aria-hidden="true" />
                                                        </div>
                                                        <div className="user-documents-folder-info">
                                                            <div className="user-documents-folder-name">{folder.name}</div>
                                                            <div className="user-documents-folder-meta">
                                                                Updated {formatDate(folder.modifiedTime)}
                                                            </div>
                                                        </div>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="user-documents-item-action"
                                                        aria-label={`Delete folder ${folder.name}`}
                                                        title="Delete folder"
                                                        onClick={() => handleDeleteClick(folder)}
                                                        disabled={isBusy}
                                                    >
                                                        <LuTrash2 size={15} />
                                                    </button>
                                                </article>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="user-documents-section-note">
                                            No folders here.
                                        </div>
                                    )}
                                </section>

                                <section className="user-documents-section">
                                    <div className="user-documents-section-head">
                                        <span className="user-documents-section-label">Files</span>
                                    </div>

                                    {files.length > 0 ? (
                                        <div className="user-documents-file-grid">
                                            {files.map((file) => (
                                                <article
                                                    key={file.id}
                                                    className={`user-documents-file-card ${
                                                        selectedFile?.id === file.id ? "is-selected" : ""
                                                    }`}
                                                    data-ud-result-item
                                                >
                                                    <button
                                                        type="button"
                                                        className="user-documents-file-main"
                                                        onClick={() => handleOpenFile(file)}
                                                    >
                                                        <div className="user-documents-file-preview">
                                                            <div className="user-documents-file-badge">
                                                                {file.iconLink ? (
                                                                    <img src={file.iconLink} alt="" aria-hidden="true" />
                                                                ) : (
                                                                    <img src={GoogleDriveIcon} alt="" aria-hidden="true" />
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="user-documents-file-body">
                                                            <div className="user-documents-file-name">{file.name}</div>
                                                        </div>
                                                    </button>
                                                    <div className="user-documents-file-footer">
                                                        <div className="user-documents-file-meta">
                                                            {formatFileSize(file.size)} - {formatDate(file.modifiedTime)}
                                                        </div>
                                                        <button
                                                            type="button"
                                                            className="user-documents-item-action"
                                                            aria-label={`Delete file ${file.name}`}
                                                            title="Delete file"
                                                            onClick={() => handleDeleteClick(file)}
                                                            disabled={isBusy}
                                                        >
                                                            <LuTrash2 size={15} />
                                                        </button>
                                                    </div>
                                                </article>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="user-documents-section-note">
                                            No files here.
                                        </div>
                                    )}
                                </section>
                            </>
                        )}
                    </div>
                )}

                <input
                    ref={uploadFileInputRef}
                    type="file"
                    className="user-documents-hidden-input"
                    onChange={handleFileInputChange}
                />

                <input
                    ref={uploadFolderInputRef}
                    type="file"
                    className="user-documents-hidden-input"
                    multiple
                    onChange={handleFolderInputChange}
                />

                {previewFile && (
                    <div
                        className={`user-documents-preview-backdrop ${previewClosing ? "is-closing" : ""}`}
                        role="presentation"
                        onClick={(event) => event.target === event.currentTarget && closePreviewModal()}
                    >
                        <div
                            ref={previewModalRef}
                            className={`user-documents-preview-modal ${previewClosing ? "is-closing" : ""}`}
                            role="dialog"
                            aria-modal="true"
                        >
                            <div className="user-documents-preview-header" data-ud-preview-item>
                                <div className="user-documents-preview-title">
                                    {previewFile.iconLink && (
                                        <img
                                            src={previewFile.iconLink}
                                            alt=""
                                            className="user-documents-preview-type-icon"
                                        />
                                    )}
                                    <div>
                                        <strong>{previewFile.name}</strong>
                                        <span>{previewFile.mimeType}</span>
                                    </div>
                                </div>
                                <div className="user-documents-preview-actions">
                                    <a
                                        href={previewFile.webViewLink || DRIVE_URL}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="user-documents-preview-btn"
                                    >
                                        <LuExternalLink size={14} />
                                        <span>Open in Google</span>
                                    </a>
                                    <button
                                        type="button"
                                        className="user-documents-preview-btn"
                                        onClick={closePreviewModal}
                                    >
                                        <LuX size={14} />
                                        <span>Close</span>
                                    </button>
                                </div>
                            </div>

                            <div className="user-documents-preview-body" data-ud-preview-item>
                                {isImageFile(previewFile) && !previewImageFailed ? (
                                    <img
                                        src={getModalImageSrc(previewFile)}
                                        alt={previewFile.name}
                                        className="user-documents-preview-image"
                                        onError={() => setPreviewImageFailed(true)}
                                    />
                                ) : previewBlobLoading ? (
                                    <div className="user-documents-preview-loading">
                                        <LuRefreshCw size={18} className="is-spinning" />
                                        <span>Loading preview...</span>
                                    </div>
                                ) : previewBlobUrl ? (
                                    <iframe
                                        src={previewBlobUrl}
                                        title={`Preview ${previewFile.name}`}
                                        className="user-documents-preview-frame"
                                        allow="autoplay"
                                    />
                                ) : (
                                    <iframe
                                        src={getPreviewUrl(previewFile, previewNonce)}
                                        title={`Preview ${previewFile.name}`}
                                        className="user-documents-preview-frame"
                                        allow="autoplay"
                                    />
                                )}

                                <div
                                    className={`user-documents-preview-fallback ${
                                        showSignInAssist ? "is-visible" : ""
                                    }`}
                                    data-ud-preview-item
                                >
                                    <div className="user-documents-preview-fallback-copy">
                                        Inline preview is unavailable for this file right now.
                                    </div>
                                    <a
                                        href={previewFile.webViewLink || DRIVE_URL}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="user-documents-preview-btn user-documents-preview-btn--primary"
                                    >
                                        Open in Google
                                    </a>
                                </div>

                                <div
                                    className={`user-documents-preview-fallback ${
                                        showImageAssist ? "is-visible" : ""
                                    }`}
                                    data-ud-preview-item
                                >
                                    <div className="user-documents-preview-fallback-copy">
                                        Image preview could not be rendered in the modal.
                                    </div>
                                    <a
                                        href={previewFile.webViewLink || DRIVE_URL}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="user-documents-preview-btn user-documents-preview-btn--primary"
                                    >
                                        Open in Google
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {createFolderModalOpen && (
                    <div
                        className="user-documents-dialog-backdrop"
                        role="presentation"
                        onClick={(event) => {
                            if (event.target === event.currentTarget && !createFolderMutation.isPending) {
                                setCreateFolderModalOpen(false);
                                setNewFolderName("");
                            }
                        }}
                    >
                        <form
                            ref={createFolderDialogRef}
                            className="user-documents-dialog"
                            onSubmit={handleCreateFolderSubmit}
                        >
                            <h3 data-ud-dialog-item>Create Folder</h3>
                            <p data-ud-dialog-item>Enter a name for the new folder in this location.</p>
                            <input
                                type="text"
                                className="user-documents-dialog-input"
                                value={newFolderName}
                                onChange={(event) => setNewFolderName(event.target.value)}
                                placeholder="Folder name"
                                autoFocus
                                data-ud-dialog-item
                            />
                            <div className="user-documents-dialog-actions" data-ud-dialog-item>
                                <button
                                    type="button"
                                    className="user-documents-dialog-btn"
                                    onClick={() => {
                                        setCreateFolderModalOpen(false);
                                        setNewFolderName("");
                                    }}
                                    disabled={createFolderMutation.isPending}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="user-documents-dialog-btn user-documents-dialog-btn--primary"
                                    disabled={!newFolderName.trim() || createFolderMutation.isPending}
                                >
                                    {createFolderMutation.isPending ? "Creating..." : "Create"}
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {deleteTarget && (
                    <div
                        className="user-documents-dialog-backdrop"
                        role="presentation"
                        onClick={(event) => {
                            if (event.target === event.currentTarget && !deleteMutation.isPending) {
                                setDeleteTarget(null);
                                setDeleteConfirmationName("");
                            }
                        }}
                    >
                        <form
                            ref={deleteDialogRef}
                            className="user-documents-dialog"
                            onSubmit={handleDeleteSubmit}
                        >
                            <h3 data-ud-dialog-item>Delete {deleteTarget.isFolder ? "Folder" : "File"}</h3>
                            <p data-ud-dialog-item>
                                Type <strong>yes</strong> to confirm deletion of <strong>{deleteTarget.name}</strong>.
                            </p>
                            {deleteTarget.isFolder && (
                                <div className="user-documents-dialog-danger" data-ud-dialog-item>
                                    If this folder contains files or subfolders, they will also be removed.
                                </div>
                            )}
                            <input
                                type="text"
                                className="user-documents-dialog-input"
                                value={deleteConfirmationName}
                                onChange={(event) => setDeleteConfirmationName(event.target.value)}
                                placeholder='Type "yes" to confirm'
                                autoFocus
                                data-ud-dialog-item
                            />
                            <div className="user-documents-dialog-match" data-ud-dialog-item>
                                {deleteNameMatches
                                    ? 'Confirmation accepted. Delete is enabled.'
                                    : 'Type "yes" to enable deletion.'}
                            </div>
                            <div className="user-documents-dialog-actions" data-ud-dialog-item>
                                <button
                                    type="button"
                                    className="user-documents-dialog-btn"
                                    onClick={() => {
                                        setDeleteTarget(null);
                                        setDeleteConfirmationName("");
                                    }}
                                    disabled={deleteMutation.isPending}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="user-documents-dialog-btn user-documents-dialog-btn--danger"
                                    disabled={!deleteNameMatches || deleteMutation.isPending}
                                >
                                    {deleteMutation.isPending ? "Deleting..." : "Delete"}
                                </button>
                            </div>
                        </form>
                    </div>
                )}
            </section>
        </div>
    );
}

export default UserDocuments;
