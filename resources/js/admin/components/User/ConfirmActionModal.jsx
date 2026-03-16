import React, { useEffect, useState } from "react";
import "../../../../css/admin/confirm-action-modal.css";
import { theme } from "../../../../utils/theme";

function ConfirmActionModal({
    isOpen,
    onClose,
    onConfirm,
    title = "Confirm Action",
    message = "Are you sure you want to continue?",
    confirmText = "Confirm",
    cancelText = "Cancel",
    confirmVariant = "danger",
    submitting = false,
}) {
    const [isMounted, setIsMounted] = useState(false);
    const [isVisible, setIsVisible] = useState(false);

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

    const modalStyle = {
        "--cam-primary-dark": theme.colors.primaryDark || "#0d4ea8",
        "--cam-primary": theme.colors.primary,
        "--cam-accent": theme.colors.accent,
        "--cam-border": theme.colors.border,
        "--cam-white": theme.colors.white,
        "--cam-text": theme.colors.text,
        "--cam-background": theme.colors.background,
        "--cam-green": theme.colors.status.signed,
        "--cam-font": theme.fonts.primary,
        "--cam-radius-md": theme.radius.md,
        "--cam-radius-lg": theme.radius.lg,
        "--cam-shadow": theme.shadows.card,
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
            <div className={`confirm-action-modal ${isVisible ? "open" : "closing"}`}>
                <div className="cam-header">
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

                <div className="cam-body">
                    <p>{message}</p>
                </div>

                <div className="cam-actions">
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
                        className={`cam-btn ${
                            confirmVariant === "success"
                                ? "cam-btn-success"
                                : "cam-btn-danger"
                        }`}
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