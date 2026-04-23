import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import SignatureCanvas from "react-signature-canvas";
import { removeBackground } from "@imgly/background-removal";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LuBadgeCheck, LuGripVertical, LuImage, LuPenTool, LuUser } from "react-icons/lu";
import "../../../css/user/pages/user-account.css";
import useAnimatedPresence from "../../hooks/useAnimatedPresence";
import {
    animateValue,
    animateFlipMoves,
    animateStaggerReveal,
    captureElementRects,
    cleanupMotion,
    prefersReducedMotion,
    queryMotionElements,
    stopMotion,
} from "../utils/animeMotion";
import { defaultThemeMode, themeModes } from "../../../utils/theme";

const SETTINGS_TABS = [
    { id: "profile", label: "Profile", icon: LuUser },
    { id: "esignature", label: "E-Signature", icon: LuPenTool },
];

const SIGNATURE_CARD_DEFAULT_ORDER = ["current", "saved", "method"];

const getInitialTab = () => {
    if (typeof window === "undefined") {
        return "profile";
    }

    const hash = window.location.hash.replace("#", "").toLowerCase();
    return SETTINGS_TABS.some((tab) => tab.id === hash) ? hash : "profile";
};

function UserAccount() {
    let user = null;
    try {
        user = JSON.parse(localStorage.getItem("user_data")) || null;
    } catch {
        user = null;
    }

    const queryClient = useQueryClient();
    const pageRef = useRef(null);
    const settingsPanelRef = useRef(null);
    const signatureGridRef = useRef(null);
    const assetGridRef = useRef(null);
    const deleteModalRef = useRef(null);
    const signatureCanvasRef = useRef(null);
    const fileInputRef = useRef(null);
    const uploadProgressMotionRef = useRef(null);
    const uploadProgressResetTimeoutRef = useRef(null);
    const uploadProgressStateRef = useRef({ visible: false, label: "", progress: 0 });
    const deleteProgressMotionRef = useRef(null);
    const deleteProgressResetTimeoutRef = useRef(null);
    const deleteProgressStateRef = useRef({ visible: false, label: "", progress: 0 });
    const signatureCardRectsRef = useRef(new Map());
    const [activeTab, setActiveTab] = useState(getInitialTab);
    const [themeMode, setThemeMode] = useState(defaultThemeMode);
    const [signatureError, setSignatureError] = useState("");
    const [signatureTab, setSignatureTab] = useState("upload");
    const [signatureCardOrder, setSignatureCardOrder] = useState(SIGNATURE_CARD_DEFAULT_ORDER);
    const [hasDrawnSignature, setHasDrawnSignature] = useState(false);
    const [brokenPreviewIds, setBrokenPreviewIds] = useState([]);
    const [activePreviewMode, setActivePreviewMode] = useState("original");
    const [draggedSignatureCard, setDraggedSignatureCard] = useState(null);
    const [signatureDropTarget, setSignatureDropTarget] = useState(null);
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
    const [deleteModalState, setDeleteModalState] = useState({
        open: false,
        assetId: null,
        confirmationText: "",
    });
    const deleteModalPresence = useAnimatedPresence(deleteModalState.open, { exitDurationMs: 220 });

    useEffect(() => {
        if (typeof window === "undefined") {
            return undefined;
        }

        const syncTabFromHash = () => {
            setActiveTab(getInitialTab());
        };

        window.addEventListener("hashchange", syncTabFromHash);
        return () => window.removeEventListener("hashchange", syncTabFromHash);
    }, []);

    useEffect(() => {
        if (typeof window === "undefined") {
            return undefined;
        }

        const resolveThemeMode = () => {
            const shell = pageRef.current?.closest(".user-layout-shell");
            const matchedMode = Object.keys(themeModes).find((mode) =>
                shell?.classList.contains(`mode-${mode}`)
            );
            const storedMode = localStorage.getItem("user_theme_mode");

            setThemeMode(
                matchedMode ||
                    (storedMode && themeModes[storedMode] ? storedMode : defaultThemeMode)
            );
        };

        resolveThemeMode();

        const shell = pageRef.current?.closest(".user-layout-shell");
        const observer =
            shell && typeof MutationObserver !== "undefined"
                ? new MutationObserver(resolveThemeMode)
                : null;

        observer?.observe(shell, {
            attributes: true,
            attributeFilter: ["class"],
        });

        window.addEventListener("storage", resolveThemeMode);

        return () => {
            observer?.disconnect();
            window.removeEventListener("storage", resolveThemeMode);
        };
    }, []);

    useEffect(() => {
        uploadProgressStateRef.current = uploadProgress;
    }, [uploadProgress]);

    useEffect(() => {
        deleteProgressStateRef.current = deleteProgress;
    }, [deleteProgress]);

    useEffect(() => {
        return () => {
            stopMotion(uploadProgressMotionRef.current);
            if (uploadProgressResetTimeoutRef.current) {
                window.clearTimeout(uploadProgressResetTimeoutRef.current);
            }
            stopMotion(deleteProgressMotionRef.current);
            if (deleteProgressResetTimeoutRef.current) {
                window.clearTimeout(deleteProgressResetTimeoutRef.current);
            }
        };
    }, []);

    useEffect(() => {
        if (!deleteModalPresence.isRendered && !deleteModalState.open && deleteModalState.assetId) {
            setDeleteModalState({
                open: false,
                assetId: null,
                confirmationText: "",
            });
        }
    }, [deleteModalPresence.isRendered, deleteModalState]);

    useEffect(() => {
        if (signatureTab !== "draw") {
            setHasDrawnSignature(false);
        }
    }, [signatureTab]);

    useEffect(() => {
        const currentScope = settingsPanelRef.current?.querySelector(
            `[data-ua-motion-scope="${activeTab}"]`
        );

        const motion = animateStaggerReveal(currentScope);

        if (!motion) {
            return undefined;
        }

        return () => {
            cleanupMotion(motion);
        };
    }, [activeTab]);

    useEffect(() => {
        if (!deleteModalPresence.isVisible) {
            return undefined;
        }

        const motion = animateStaggerReveal(deleteModalRef.current, {
            selector: "[data-ua-modal-item]",
            duration: 520,
            staggerMs: 44,
            startDelayMs: 0,
        });

        if (!motion) {
            return undefined;
        }

        return () => {
            cleanupMotion(motion);
        };
    }, [deleteModalPresence.isVisible, deleteProgress.visible]);

    useEffect(() => {
        if (prefersReducedMotion()) {
            signatureCardRectsRef.current = new Map();
            return undefined;
        }

        if (activeTab !== "esignature") {
            signatureCardRectsRef.current = new Map();
            return undefined;
        }

        const cards = queryMotionElements(signatureGridRef.current, "[data-signature-card-id]");

        if (cards.length === 0) {
            signatureCardRectsRef.current = new Map();
            return undefined;
        }

        const previousRects = signatureCardRectsRef.current;
        signatureCardRectsRef.current = new Map();

        if (previousRects.size === 0) {
            return undefined;
        }

        const motions = animateFlipMoves(cards, previousRects, {
            getKey: (card) => card.dataset.signatureCardId,
        });

        return () => {
            motions.forEach(cleanupMotion);
        };
    }, [activeTab, signatureCardOrder]);

    const updateActiveTab = (tabId) => {
        setActiveTab(tabId);

        if (typeof window !== "undefined") {
            window.history.replaceState(null, "", `${window.location.pathname}#${tabId}`);
        }
    };

    const swapSignatureCards = (sourceId, targetId) => {
        if (!sourceId || !targetId || sourceId === targetId) {
            return;
        }

        const currentCards = queryMotionElements(
            signatureGridRef.current,
            "[data-signature-card-id]"
        );

        signatureCardRectsRef.current = captureElementRects(
            currentCards,
            (card) => card.dataset.signatureCardId
        );

        setSignatureCardOrder((current) => {
            const sourceIndex = current.indexOf(sourceId);
            const targetIndex = current.indexOf(targetId);

            if (sourceIndex < 0 || targetIndex < 0) {
                return current;
            }

            const next = [...current];
            [next[sourceIndex], next[targetIndex]] = [next[targetIndex], next[sourceIndex]];
            return next;
        });
    };

    const handleSignatureCardDragStart = (cardId, event) => {
        setDraggedSignatureCard(cardId);
        setSignatureDropTarget(cardId);
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", cardId);
    };

    const handleSignatureCardDragOver = (cardId, event) => {
        event.preventDefault();
        if (cardId !== signatureDropTarget) {
            setSignatureDropTarget(cardId);
        }
    };

    const handleSignatureCardDrop = (targetId, event) => {
        event.preventDefault();
        const sourceId = event.dataTransfer.getData("text/plain") || draggedSignatureCard;
        swapSignatureCards(sourceId, targetId);
        setDraggedSignatureCard(null);
        setSignatureDropTarget(null);
    };

    const handleSignatureCardDragEnd = () => {
        setDraggedSignatureCard(null);
        setSignatureDropTarget(null);
    };

    const buildAuthConfig = () => {
        const token = localStorage.getItem("user_token");
        return {
            headers: {
                Accept: "application/json",
                Authorization: `Bearer ${token || ""}`,
            },
        };
    };

    const signaturesQuery = useQuery({
        queryKey: ["user-account-signatures"],
        queryFn: async () => {
            const { data } = await axios.get("/api/user/account/signatures", buildAuthConfig());
            return data;
        },
    });

    const refreshSignatures = async () => {
        await queryClient.invalidateQueries({ queryKey: ["user-account-signatures"] });
    };

    const clearUploadProgressReset = () => {
        if (uploadProgressResetTimeoutRef.current) {
            window.clearTimeout(uploadProgressResetTimeoutRef.current);
            uploadProgressResetTimeoutRef.current = null;
        }
    };

    const animateUploadProgressTo = (label, targetProgress, options = {}) => {
        clearUploadProgressReset();
        stopMotion(uploadProgressMotionRef.current);

        const startProgress = options.from ?? uploadProgressStateRef.current.progress;
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
    };

    const resetUploadProgress = () => {
        clearUploadProgressReset();
        stopMotion(uploadProgressMotionRef.current);
        uploadProgressMotionRef.current = null;
        setUploadProgress({
            visible: false,
            label: "",
            progress: 0,
        });
    };

    const beginUploadProgress = (label, targetProgress = 12) => {
        animateUploadProgressTo(label, targetProgress, {
            from: 0,
            duration: 680,
            ease: "outCirc",
        });
    };

    const showUploadProgress = (label, progress) => {
        animateUploadProgressTo(label, progress, {
            duration: progress >= 90 ? 520 : 760,
            ease: progress >= 90 ? "outQuad" : "outExpo",
        });
    };

    const finishUploadProgress = (label = "Completed") => {
        animateUploadProgressTo(label, 100, {
            duration: 520,
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
    };

    const clearDeleteProgressReset = () => {
        if (deleteProgressResetTimeoutRef.current) {
            window.clearTimeout(deleteProgressResetTimeoutRef.current);
            deleteProgressResetTimeoutRef.current = null;
        }
    };

    const animateDeleteProgressTo = (label, targetProgress, options = {}) => {
        clearDeleteProgressReset();
        stopMotion(deleteProgressMotionRef.current);

        const startProgress = options.from ?? deleteProgressStateRef.current.progress;
        const nextProgress = Math.max(startProgress, targetProgress);
        setDeleteProgress({
            visible: true,
            label,
            progress: Math.round(startProgress),
        });

        deleteProgressMotionRef.current = animateValue({
            from: startProgress,
            to: nextProgress,
            duration: options.duration ?? 700,
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
    };

    const resetDeleteProgress = () => {
        clearDeleteProgressReset();
        stopMotion(deleteProgressMotionRef.current);
        deleteProgressMotionRef.current = null;
        setDeleteProgress({
            visible: false,
            label: "",
            progress: 0,
        });
    };

    const beginDeleteProgress = (label, targetProgress = 24) => {
        animateDeleteProgressTo(label, targetProgress, {
            from: 0,
            duration: 620,
            ease: "outCirc",
        });
    };

    const showDeleteProgress = (label, progress) => {
        animateDeleteProgressTo(label, progress, {
            duration: progress >= 88 ? 460 : 700,
            ease: progress >= 88 ? "outQuad" : "outExpo",
        });
    };

    const finishDeleteProgress = (label = "Deleted") => {
        animateDeleteProgressTo(label, 100, {
            duration: 440,
            ease: "outQuad",
        });

        deleteProgressResetTimeoutRef.current = window.setTimeout(() => {
            setDeleteModalState({
                open: false,
                assetId: null,
                confirmationText: "",
            });
            setDeleteProgress({
                visible: false,
                label: "",
                progress: 0,
            });
            deleteProgressResetTimeoutRef.current = null;
        }, 900);
    };

    const uploadSignatureMutation = useMutation({
        mutationFn: async (file) => {
            beginUploadProgress("Removing background", 14);
            const processedBlob = await removeBackground(file);
            showUploadProgress("Removing background", 50);
            const formData = new FormData();
            formData.append("signature", file);
            formData.append(
                "processed_signature",
                new File([processedBlob], "signature-transparent.png", { type: "image/png" })
            );
            const { data } = await axios.post("/api/user/account/signatures/upload", formData, {
                ...buildAuthConfig(),
                headers: { ...buildAuthConfig().headers, "Content-Type": "multipart/form-data" },
                onUploadProgress: (progressEvent) => {
                    if (!progressEvent.total) {
                        showUploadProgress("Uploading image", 70);
                        return;
                    }

                    const uploadRatio = progressEvent.loaded / progressEvent.total;
                    const stagedProgress = 50 + Math.round(uploadRatio * 40);
                    showUploadProgress("Uploading image", Math.min(90, Math.max(50, stagedProgress)));
                },
            });
            showUploadProgress("Finalizing", 95);
            return data;
        },
        onSuccess: async () => {
            setSignatureError("");
            await refreshSignatures();
            finishUploadProgress("Completed");
        },
        onError: (error) => {
            setSignatureError(error?.response?.data?.message || "Upload failed.");
            resetUploadProgress();
        },
    });

    const saveDrawnSignatureMutation = useMutation({
        mutationFn: async (file) => {
            beginUploadProgress("Saving drawing", 18);
            const formData = new FormData();
            formData.append("signature", file);
            formData.append("signature_type", "drawn");

            const { data } = await axios.post("/api/user/account/signatures/upload", formData, {
                ...buildAuthConfig(),
                headers: { ...buildAuthConfig().headers, "Content-Type": "multipart/form-data" },
                onUploadProgress: (progressEvent) => {
                    if (!progressEvent.total) {
                        showUploadProgress("Saving drawing", 72);
                        return;
                    }

                    const uploadRatio = progressEvent.loaded / progressEvent.total;
                    const stagedProgress = 18 + Math.round(uploadRatio * 64);
                    showUploadProgress("Saving drawing", Math.min(82, Math.max(18, stagedProgress)));
                },
            });

            showUploadProgress("Finalizing", 95);
            return data;
        },
        onSuccess: async () => {
            setSignatureError("");
            setHasDrawnSignature(false);
            signatureCanvasRef.current?.clear();
            await refreshSignatures();
            finishUploadProgress("Saved");
        },
        onError: (error) => {
            setSignatureError(error?.response?.data?.message || "Save failed.");
            resetUploadProgress();
        },
    });

    const activateSignatureMutation = useMutation({
        mutationFn: async (signatureId) => {
            const { data } = await axios.patch(
                `/api/user/account/signatures/${signatureId}/activate`,
                {},
                buildAuthConfig()
            );
            return data;
        },
        onSuccess: async () => {
            setSignatureError("");
            await refreshSignatures();
        },
        onError: (error) => {
            setSignatureError(error?.response?.data?.message || "Activation failed.");
        },
    });

    const deleteSignatureMutation = useMutation({
        mutationFn: async (signatureId) => {
            const { data } = await axios.delete(
                `/api/user/account/signatures/${signatureId}`,
                buildAuthConfig()
            );
            showDeleteProgress("Finalizing", 88);
            return data;
        },
        onSuccess: async () => {
            setSignatureError("");
            await refreshSignatures();
            finishDeleteProgress("Deleted");
        },
        onError: (error) => {
            setSignatureError(error?.response?.data?.message || "Delete failed.");
            resetDeleteProgress();
        },
    });

    const signatureAssets = Array.isArray(signaturesQuery.data?.assets)
        ? signaturesQuery.data.assets
        : [];
    const activeSignature =
        signaturesQuery.data?.active_asset || signatureAssets.find((asset) => asset.is_active) || null;

    useEffect(() => {
        if (activeTab !== "esignature") {
            return undefined;
        }

        const motion = animateStaggerReveal(assetGridRef.current, {
            selector: "[data-ua-asset-item]",
            duration: 680,
            staggerMs: 52,
            startDelayMs: 24,
        });

        if (!motion) {
            return undefined;
        }

        return () => {
            cleanupMotion(motion);
        };
    }, [activeTab, signatureAssets.length, activeSignature?.id]);

    const signatureBusy =
        uploadSignatureMutation.isPending ||
        saveDrawnSignatureMutation.isPending ||
        activateSignatureMutation.isPending ||
        deleteSignatureMutation.isPending;

    const resolveAssetUrl = (url) => {
        if (!url) return "";
        if (/^https?:\/\//i.test(url) || url.startsWith("data:") || url.startsWith("blob:")) {
            return url;
        }
        if (typeof window === "undefined") return url;
        try {
            return new URL(url, window.location.origin).toString();
        } catch {
            return url;
        }
    };

    const getSignaturePreviewUrl = (asset, mode = activePreviewMode) => {
        if (!asset) return "";

        const primary =
            mode === "processed"
                ? asset.processed_image_url ||
                  asset.original_image_url ||
                  asset.preview_url ||
                  asset.image_url ||
                  ""
                : asset.original_image_url || asset.preview_url || asset.image_url || "";

        const fallback = asset.processed_image_url || asset.drive_public_url || asset.image_url || "";
        return resolveAssetUrl(brokenPreviewIds.includes(asset.id) ? fallback : primary);
    };

    const handlePreviewError = (assetId) => {
        setBrokenPreviewIds((current) => (current.includes(assetId) ? current : [...current, assetId]));
    };

    const openDeleteModal = (assetId) => {
        setSignatureError("");
        resetDeleteProgress();
        setDeleteModalState({
            open: true,
            assetId,
            confirmationText: "",
        });
    };

    const closeDeleteModal = () => {
        if (deleteSignatureMutation.isPending) {
            return;
        }

        resetDeleteProgress();
        setDeleteModalState({
            open: false,
            assetId: null,
            confirmationText: "",
        });
    };

    const handleDeleteConfirmationChange = (event) => {
        const { value } = event.target;
        setDeleteModalState((current) => ({
            ...current,
            confirmationText: value,
        }));
    };

    const handleDeleteConfirm = () => {
        if (!deleteModalState.assetId || deleteModalState.confirmationText.trim().toLowerCase() !== "yes") {
            return;
        }

        setSignatureError("");
        beginDeleteProgress("Deleting signature", 22);
        deleteSignatureMutation.mutate(deleteModalState.assetId);
    };

    const handleUploadInput = (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setSignatureError("");
        resetUploadProgress();
        uploadSignatureMutation.mutate(file);
        event.target.value = "";
    };

    const exportDrawnSignatureFile = () => {
        const sourceCanvas = signatureCanvasRef.current?.getCanvas();
        const sourceContext = sourceCanvas?.getContext("2d", { willReadFrequently: true });

        if (!sourceCanvas || !sourceContext) {
            return Promise.reject(new Error("Unable to capture the signature."));
        }

        const { width, height } = sourceCanvas;
        const pixels = sourceContext.getImageData(0, 0, width, height).data;
        let minX = width;
        let minY = height;
        let maxX = -1;
        let maxY = -1;

        for (let y = 0; y < height; y += 1) {
            for (let x = 0; x < width; x += 1) {
                const alpha = pixels[(y * width + x) * 4 + 3];
                if (alpha === 0) {
                    continue;
                }

                if (x < minX) minX = x;
                if (y < minY) minY = y;
                if (x > maxX) maxX = x;
                if (y > maxY) maxY = y;
            }
        }

        if (maxX < minX || maxY < minY) {
            return Promise.reject(new Error("Draw your signature before saving."));
        }

        const padding = 8;
        const cropX = Math.max(0, minX - padding);
        const cropY = Math.max(0, minY - padding);
        const cropWidth = Math.min(width - cropX, maxX - minX + 1 + padding * 2);
        const cropHeight = Math.min(height - cropY, maxY - minY + 1 + padding * 2);
        const outputCanvas = document.createElement("canvas");
        const outputContext = outputCanvas.getContext("2d");

        if (!outputContext) {
            return Promise.reject(new Error("Unable to prepare the drawn signature."));
        }

        outputCanvas.width = cropWidth;
        outputCanvas.height = cropHeight;
        outputContext.drawImage(
            sourceCanvas,
            cropX,
            cropY,
            cropWidth,
            cropHeight,
            0,
            0,
            cropWidth,
            cropHeight
        );

        return new Promise((resolve, reject) => {
            outputCanvas.toBlob((blob) => {
                if (!blob) {
                    reject(new Error("Unable to prepare the drawn signature."));
                    return;
                }

                resolve(new File([blob], "drawn-signature.png", { type: "image/png" }));
            }, "image/png");
        });
    };

    const handleSaveDrawnSignature = async () => {
        if (!signatureCanvasRef.current || signatureCanvasRef.current.isEmpty()) {
            setSignatureError("Draw your signature before saving.");
            return;
        }

        setSignatureError("");
        resetUploadProgress();

        try {
            const file = await exportDrawnSignatureFile();
            saveDrawnSignatureMutation.mutate(file);
        } catch (error) {
            setSignatureError(error?.message || "Save failed.");
        }
    };

    const refreshDrawState = () => {
        const syncState = () => {
            setHasDrawnSignature(
                Boolean(signatureCanvasRef.current && !signatureCanvasRef.current.isEmpty())
            );
        };

        if (typeof window === "undefined") {
            syncState();
            return;
        }

        window.requestAnimationFrame(syncState);
    };

    const handleDrawBegin = () => {
        setSignatureError("");
        setHasDrawnSignature(true);
    };

    const handleClearCanvas = () => {
        signatureCanvasRef.current?.clear();
        setHasDrawnSignature(false);
        setSignatureError("");
    };

    const userName = user?.google_name || user?.name || "Personnel";
    const userRole = user?.role || "User";
    const userEmail = user?.email || "-";
    const userGoogleId = user?.google_id || "-";
    const userPhoto = user?.profile_picture || user?.picture || user?.avatar || user?.photo || "";
    const userInitials =
        String(userName)
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((part) => part[0] || "")
            .join("")
            .toUpperCase() || "U";
    const activeUpdated = activeSignature?.updated_at
        ? new Date(activeSignature.updated_at).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
          })
        : null;
    const showProcessedToggle = Boolean(
        activeSignature?.processed_image_url || activeSignature?.meta?.background_removed
    );
    const profileFields = [
        { label: "Name", value: userName },
        { label: "Email", value: userEmail },
        { label: "Role", value: userRole },
        { label: "Google ID", value: userGoogleId },
    ];
    const deleteConfirmationValid = deleteModalState.confirmationText.trim().toLowerCase() === "yes";
    const signaturePenColor = themeMode === "dark" ? "#ffffff" : "#0f172a";
    const renderUploadProgress = uploadProgress.visible ? (
        <div
            className="ua-upload-progress"
            data-ua-progress-card
            role="status"
            aria-live="polite"
            aria-label={`${uploadProgress.label}: ${uploadProgress.progress}%`}
        >
            <div className="ua-upload-progress-head">
                <strong>{uploadProgress.label}</strong>
                <span>{uploadProgress.progress}%</span>
            </div>
            <div className="ua-upload-progress-bar" aria-hidden="true">
                <div
                    className="ua-upload-progress-fill"
                    style={{ width: `${uploadProgress.progress}%` }}
                />
            </div>
        </div>
    ) : null;
    const renderSignatureCard = (cardId) => {
        switch (cardId) {
            case "current":
                return {
                    title: "Current Signature",
                    subtitle: "Active signing copy for your upcoming document actions.",
                    icon: LuBadgeCheck,
                    content: signaturesQuery.isLoading ? (
                        <span className="ua-muted">Loading...</span>
                    ) : activeSignature ? (
                        <div className="ua-signature-status">
                            <div className="ua-active-preview">
                                <img
                                    src={getSignaturePreviewUrl(activeSignature)}
                                    alt="Active signature"
                                    onError={() => handlePreviewError(activeSignature.id)}
                                />
                            </div>
                            <div className="ua-active-info">
                                <span className="ua-status-pill">
                                    <LuBadgeCheck />
                                    Active
                                </span>
                                <span className="ua-active-meta">
                                    {activeSignature.type === "drawn" ? "Drawn" : "Uploaded"}
                                    {activeUpdated ? ` - Updated ${activeUpdated}` : ""}
                                </span>
                                {showProcessedToggle && (
                                    <div className="ua-inline-tabs ua-inline-tabs--compact">
                                        <button
                                            type="button"
                                            className={activePreviewMode === "original" ? "active" : ""}
                                            onClick={() => setActivePreviewMode("original")}
                                        >
                                            Original
                                        </button>
                                        <button
                                            type="button"
                                            className={activePreviewMode === "processed" ? "active" : ""}
                                            onClick={() => setActivePreviewMode("processed")}
                                        >
                                            Signing Copy
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="ua-card-empty">
                            <span className="ua-muted">No active signature selected.</span>
                        </div>
                    ),
                };
            case "saved":
                return {
                    title: "Saved Signatures",
                    subtitle: "Switch or remove the signatures currently stored in your account.",
                    icon: LuImage,
                    content:
                        signatureAssets.length > 0 ? (
                            <div className="ua-asset-grid" ref={assetGridRef}>
                                {signatureAssets.map((asset) => (
                                    <div
                                        key={asset.id}
                                        data-ua-asset-item
                                        className={`ua-asset${asset.is_active ? " ua-asset--active" : ""}`}
                                    >
                                        {asset.is_active && <span className="ua-asset-badge">Active</span>}
                                        <div className="ua-asset-thumb">
                                            <img
                                                src={getSignaturePreviewUrl(asset, "original")}
                                                alt={`Signature ${asset.id}`}
                                                onError={() => handlePreviewError(asset.id)}
                                            />
                                        </div>
                                        <div className="ua-asset-footer">
                                            <span className="ua-asset-type">
                                                {asset.type === "drawn" ? "Drawn" : "Uploaded"}
                                            </span>
                                            <div className="ua-asset-actions">
                                                {!asset.is_active && (
                                                    <button
                                                        type="button"
                                                        onClick={() => activateSignatureMutation.mutate(asset.id)}
                                                        disabled={signatureBusy}
                                                    >
                                                        Use
                                                    </button>
                                                )}
                                                <button
                                                    type="button"
                                                    className="is-danger"
                                                    onClick={() => openDeleteModal(asset.id)}
                                                    disabled={signatureBusy}
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="ua-card-empty">
                                <span className="ua-muted">No saved signatures yet.</span>
                            </div>
                        ),
                };
            case "method":
            default:
                return {
                    title: "Signature Method",
                    subtitle: "Upload a clean signature image or draw one directly on the canvas.",
                    icon: LuPenTool,
                    content: (
                        <div className="ua-col">
                            <div className="ua-inline-tabs">
                                <button
                                    type="button"
                                    className={signatureTab === "upload" ? "active" : ""}
                                    onClick={() => setSignatureTab("upload")}
                                >
                                    <LuImage />
                                    Upload Image
                                </button>
                                <button
                                    type="button"
                                    className={signatureTab === "draw" ? "active" : ""}
                                    onClick={() => setSignatureTab("draw")}
                                >
                                    <LuPenTool />
                                    Draw
                                </button>
                            </div>

                            {signatureTab === "upload" && (
                                <div className="ua-upload-zone">
                                    <span>PNG, JPG or WebP supported</span>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/png,image/jpeg,image/webp"
                                        className="ua-file-input"
                                        onChange={handleUploadInput}
                                    />
                                    <button
                                        type="button"
                                        className="ua-btn ua-btn--primary"
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={signatureBusy}
                                    >
                                        {uploadSignatureMutation.isPending ? "Processing..." : "Choose File"}
                                    </button>
                                    {renderUploadProgress}
                                </div>
                            )}

                            {signatureTab === "draw" && (
                                <div className="ua-draw-panel">
                                    <div className="ua-canvas-wrap">
                                        <SignatureCanvas
                                            ref={signatureCanvasRef}
                                            penColor={signaturePenColor}
                                            onBegin={handleDrawBegin}
                                            onEnd={refreshDrawState}
                                            canvasProps={{ className: "ua-canvas", width: 960, height: 220 }}
                                        />
                                    </div>
                                    <div className="ua-draw-actions">
                                        <button
                                            type="button"
                                            className="ua-btn ua-btn--ghost"
                                            onClick={handleClearCanvas}
                                            disabled={signatureBusy}
                                        >
                                            Clear
                                        </button>
                                        <button
                                            type="button"
                                            className="ua-btn ua-btn--primary"
                                            onClick={handleSaveDrawnSignature}
                                            disabled={signatureBusy || !hasDrawnSignature}
                                        >
                                            {saveDrawnSignatureMutation.isPending ? "Saving..." : "Save Signature"}
                                        </button>
                                    </div>
                                    {renderUploadProgress}
                                </div>
                            )}

                            {signatureError && <div className="ua-notice ua-notice--error">{signatureError}</div>}
                        </div>
                    ),
                };
        }
    };

    return (
        <div className="ua-page" ref={pageRef}>
            <header className="ua-shell-head">
                <h1 className="ua-shell-title">Settings</h1>
            </header>

            <nav className="ua-settings-tabs" aria-label="Settings sections">
                {SETTINGS_TABS.map((tab) => (
                    <button
                        key={tab.id}
                        type="button"
                        className={activeTab === tab.id ? "active" : ""}
                        onClick={() => updateActiveTab(tab.id)}
                    >
                        <tab.icon />
                        <span>{tab.label}</span>
                    </button>
                ))}
            </nav>

            <div className="ua-settings-panel" ref={settingsPanelRef}>
                {activeTab === "profile" && (
                    <section className="ua-content-card" data-ua-motion-scope="profile">
                        <div className="ua-section-head" data-ua-motion-item>
                            <div>
                                <h2 className="ua-section-title ua-section-title--icon">
                                    <LuUser />
                                    <span>Profile Information</span>
                                </h2>
                                <p className="ua-section-sub">
                                    Manage the identity details currently linked to your account.
                                </p>
                            </div>
                        </div>

                        <div className="ua-divider" data-ua-motion-item />

                        <div className="ua-form-row" data-ua-motion-item>
                            <div className="ua-form-label">
                                <span>Profile Picture</span>
                            </div>
                            <div className="ua-form-content">
                                <div className="ua-profile-identity">
                                    <div className="ua-avatar">
                                        {userPhoto ? <img src={userPhoto} alt={userName} /> : <span>{userInitials}</span>}
                                    </div>
                                    <div className="ua-profile-copy">
                                        <strong>{userName}</strong>
                                        <span>{userRole}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {profileFields.map((field) => (
                            <React.Fragment key={field.label}>
                                <div className="ua-divider" data-ua-motion-item />
                                <div className="ua-form-row" data-ua-motion-item>
                                    <div className="ua-form-label">
                                        <span>{field.label}</span>
                                    </div>
                                    <div className="ua-form-content">
                                        <input className="ua-input" type="text" value={field.value} readOnly />
                                    </div>
                                </div>
                            </React.Fragment>
                        ))}
                    </section>
                )}

                {activeTab === "esignature" && (
                    <section className="ua-esignature-shell" data-ua-motion-scope="esignature">
                        <div className="ua-section-head" data-ua-motion-item>
                            <div>
                                <h2 className="ua-section-title ua-section-title--icon">
                                    <LuPenTool />
                                    <span>E-Signature</span>
                                </h2>
                                <p className="ua-section-sub">
                                    Manage the signature used when confirming document session placeholders.
                                </p>
                            </div>
                            <span className="ua-section-chip">Drag cards to rearrange</span>
                        </div>

                        <div className="ua-signature-grid" ref={signatureGridRef}>
                            {signatureCardOrder.map((cardId, index) => {
                                const card = renderSignatureCard(cardId);
                                const CardIcon = card.icon;

                                return (
                                    <article
                                        key={cardId}
                                        data-signature-card-id={cardId}
                                        data-ua-motion-item
                                        className={`ua-signature-card ${index === 0 ? "ua-signature-card--hero" : ""} ${
                                            draggedSignatureCard === cardId ? "is-dragging" : ""
                                        } ${signatureDropTarget === cardId ? "is-drop-target" : ""}`}
                                        onDragOver={(event) => handleSignatureCardDragOver(cardId, event)}
                                        onDrop={(event) => handleSignatureCardDrop(cardId, event)}
                                    >
                                        <div className="ua-signature-card-head">
                                            <div className="ua-signature-card-title">
                                                <span className="ua-signature-card-icon">
                                                    <CardIcon />
                                                </span>
                                                <div>
                                                    <h3>{card.title}</h3>
                                                    <p>{card.subtitle}</p>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                className="ua-signature-card-drag"
                                                draggable
                                                aria-label={`Drag ${card.title}`}
                                                onDragStart={(event) => handleSignatureCardDragStart(cardId, event)}
                                                onDragEnd={handleSignatureCardDragEnd}
                                            >
                                                <LuGripVertical />
                                            </button>
                                        </div>
                                        <div className="ua-signature-card-body">{card.content}</div>
                                    </article>
                                );
                            })}
                        </div>
                    </section>
                )}
            </div>

            {deleteModalPresence.isRendered && (
                <div
                    className={`ua-modal-backdrop ${deleteModalPresence.isVisible ? "open" : "closing"}`}
                    role="presentation"
                    onClick={closeDeleteModal}
                >
                    <div
                        className={`ua-modal ${deleteModalPresence.isVisible ? "open" : "closing"}`}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="delete-signature-title"
                        onClick={(event) => event.stopPropagation()}
                        ref={deleteModalRef}
                    >
                        <div className="ua-modal-head" data-ua-modal-item>
                            <h2 id="delete-signature-title">Delete Signature</h2>
                            <p>Type <strong>yes</strong> to permanently remove this signature.</p>
                        </div>

                        <div className="ua-modal-body" data-ua-modal-item>
                            <label className="ua-modal-field">
                                <span>Confirmation</span>
                                <input
                                    type="text"
                                    value={deleteModalState.confirmationText}
                                    onChange={handleDeleteConfirmationChange}
                                    placeholder="Type 'yes' to delete"
                                    autoFocus
                                    disabled={deleteSignatureMutation.isPending}
                                />
                            </label>

                            {deleteProgress.visible && (
                                <div
                                    className="ua-upload-progress ua-upload-progress--danger"
                                    data-ua-progress-card
                                    role="status"
                                    aria-live="polite"
                                    aria-label={`${deleteProgress.label}: ${deleteProgress.progress}%`}
                                >
                                    <div className="ua-upload-progress-head">
                                        <strong>{deleteProgress.label}</strong>
                                        <span>{deleteProgress.progress}%</span>
                                    </div>
                                    <div className="ua-upload-progress-bar ua-upload-progress-bar--danger" aria-hidden="true">
                                        <div
                                            className="ua-upload-progress-fill ua-upload-progress-fill--danger"
                                            style={{ width: `${deleteProgress.progress}%` }}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="ua-modal-actions" data-ua-modal-item>
                            <button
                                type="button"
                                className="ua-btn ua-btn--ghost"
                                onClick={closeDeleteModal}
                                disabled={deleteSignatureMutation.isPending}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="ua-btn ua-btn--danger"
                                onClick={handleDeleteConfirm}
                                disabled={!deleteConfirmationValid || deleteSignatureMutation.isPending}
                            >
                                {deleteSignatureMutation.isPending ? "Deleting..." : "Delete Signature"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default UserAccount;
