import React, { useEffect, useRef, useState } from "react";
import "../../../../css/admin/confirm-action-modal.css";
import { theme } from "../../../../utils/theme";
import { useAdminTheme } from "../../context/AdminThemeContext";
import { animateStaggerReveal, cleanupMotion } from "../../../user/utils/animeMotion";

function ConfirmActionModal({
    isOpen,
    onClose,
    onConfirm,
    title = "Confirm Action",
    message = "Are you sure you want to continue?",
    highlightText = "",
    confirmText = "Confirm",
    cancelText = "Cancel",
    confirmVariant = "delete",
    submitting = false,
}) {
    const { activeTheme, themeMode } = useAdminTheme();
    const activeColors = activeTheme.colors;

    const semanticTones = {
        dark: {
            danger: "#dc2626",
            dangerDeep: "#991b1b",
            neutral: "#6b7280",
            neutralDeep: "#4b5563",
        },
        ivory: {
            danger: "#c43a2d",
            dangerDeep: "#942d23",
            neutral: "#727987",
            neutralDeep: "#566072",
        },
        clean: {
            danger: "#c83732",
            dangerDeep: "#9a2d29",
            neutral: "#667085",
            neutralDeep: "#4f5a6f",
        },
    };

    const toneSet = semanticTones[themeMode] || semanticTones.dark;

    const confirmButtonClass =
        confirmVariant === "success" ? "cam-btn-success" : "cam-btn-delete";

    const [isMounted, setIsMounted] = useState(false);
    const [isVisible, setIsVisible] = useState(false);
    const modalRef = useRef(null);

    useEffect(() => {
        if (isOpen) {
            setIsMounted(true);

            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    setIsVisible(true);
                });
            });
        } else if (isMounted) {
            setIsVisible(false);

            const timer = setTimeout(() => {
                setIsMounted(false);
            }, 220);

            return () => clearTimeout(timer);
        }
    }, [isOpen, isMounted]);

    useEffect(() => {
        if (!isVisible) {
            return undefined;
        }

        const motion = animateStaggerReveal(modalRef.current, {
            selector: "[data-cam-motion-item]",
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
    }, [isVisible, confirmVariant, title, message, submitting]);

    const closeWithAnimation = () => {
        if (submitting) return;

        setIsVisible(false);

        setTimeout(() => {
            onClose?.();
        }, 200);
    };

    const handleOverlayClick = (e) => {
        if (e.target === e.currentTarget) {
            closeWithAnimation();
        }
    };

    const renderHighlightedMessage = (content, valueToHighlight) => {
        if (!valueToHighlight || typeof content !== "string") {
            return content;
        }

        const highlightClass =
            confirmVariant === "success"
                ? "cam-highlight-name cam-highlight-name-success"
                : "cam-highlight-name";

        const parts = content.split(valueToHighlight);
        if (parts.length === 1) {
            return content;
        }

        return parts.map((part, index) => (
            <React.Fragment key={`msg-part-${index}`}>
                {part}
                {index < parts.length - 1 ? (
                    <span className={highlightClass}>{valueToHighlight}</span>
                ) : null}
            </React.Fragment>
        ));
    };

    const modalStyle = {
        "--cam-primary-dark": activeColors.primaryDark,
        "--cam-primary": activeColors.primary,
        "--cam-accent": activeColors.accent,
        "--cam-border": activeColors.border,
        "--cam-border-hover": activeColors.borderHover,
        "--cam-white": activeColors.white,
        "--cam-text": activeColors.text,
        "--cam-text-muted": activeColors.textMuted,
        "--cam-background": activeColors.background,
        "--cam-surface": activeColors.surface,
        "--cam-panel": activeColors.panel,
        "--cam-card": activeColors.card,
        "--cam-green": activeColors.status.signed,
        "--cam-danger": toneSet.danger,
        "--cam-danger-deep": toneSet.dangerDeep,
        "--cam-neutral": toneSet.neutral,
        "--cam-neutral-deep": toneSet.neutralDeep,
        "--cam-font": theme.fonts.primary,
        "--cam-radius-md": theme.radius.md,
        "--cam-radius-lg": theme.radius.lg,
        "--cam-shadow": activeTheme.shadows.card,
    };

    if (!isMounted) {
        return null;
    }

    return (
        <div
            className={`confirm-action-overlay ${isVisible ? "open" : "closing"}`}
            style={modalStyle}
            onClick={handleOverlayClick}
        >
            <div
                ref={modalRef}
                className={`confirm-action-modal ${isVisible ? "open" : "closing"} variant-${confirmVariant}`}
            >
                <div className="cam-header" data-cam-motion-item>
                    <h3>{title}</h3>
                    <button
                        type="button"
                        className="cam-close-btn"
                        onClick={closeWithAnimation}
                        disabled={submitting}
                        aria-label="Close modal"
                    >
                        ×
                    </button>
                </div>

                <div className="cam-body" data-cam-motion-item>
                    <p>{renderHighlightedMessage(message, highlightText)}</p>
                </div>

                <div className="cam-actions" data-cam-motion-item>
                    <button
                        type="button"
                        className="cam-btn cam-btn-cancel"
                        onClick={closeWithAnimation}
                        disabled={submitting}
                    >
                        {cancelText}
                    </button>

                    <button
                        type="button"
                        className={`cam-btn ${confirmButtonClass}`}
                        onClick={onConfirm}
                        disabled={submitting}
                    >
                        {submitting ? "Processing..." : confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default ConfirmActionModal;
