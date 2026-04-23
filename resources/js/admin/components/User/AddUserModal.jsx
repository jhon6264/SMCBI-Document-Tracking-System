import React, { useEffect, useMemo, useRef, useState } from "react";
import "../../../../css/admin/add-user-modal.css";
import { theme } from "../../../../utils/theme";
import { useAdminTheme } from "../../context/AdminThemeContext";
import { animateStaggerReveal, cleanupMotion } from "../../../user/utils/animeMotion";

const INSTITUTIONAL_DOMAIN = "@smcbi.edu.ph";

function AddUserModal({
    isOpen,
    mode = "add",
    onClose,
    onSave,
    departments = [],
    loadingDepartments = false,
    submitting = false,
    initialData = null,
}) {
    const { activeTheme, themeMode } = useAdminTheme();
    const activeColors = activeTheme.colors;

    const dangerPalette = {
        dark: "#dc2626",
        ivory: "#bf2e24",
        clean: "#c7342f",
    };

    const modalDanger = dangerPalette[themeMode] || dangerPalette.dark;
    const selectedPillPalette = {
        dark: {
            bg: activeColors.primary,
            text: activeColors.black,
            border: activeColors.primaryDark,
        },
        ivory: {
            bg: activeColors.primary,
            text: activeColors.white,
            border: activeColors.primaryDark,
        },
        clean: {
            bg: activeColors.primary,
            text: activeColors.white,
            border: activeColors.primaryDark,
        },
    };

    const selectedPillColors =
        selectedPillPalette[themeMode] || selectedPillPalette.dark;

    const [isMounted, setIsMounted] = useState(false);
    const [isVisible, setIsVisible] = useState(false);
    const modalRef = useRef(null);

    const [formData, setFormData] = useState({
        name: "",
        emailUsername: "",
        role: "Faculty",
        department_id: "",
        status: "Active",
    });

    const [errors, setErrors] = useState({});
    const [submitError, setSubmitError] = useState("");

    const roleOptions = [
        "Faculty",
        "Staff",
        "Instructor",
        "Cashier",
        "Registrar",
        "President",
    ];

    const statusOptions = ["Active", "Inactive"];

    const modalTitle = mode === "edit" ? "Edit User" : "Add User";
    const modalSubtitle =
        mode === "edit"
            ? "Update the institutional user account details."
            : "Create a new institutional user account.";
    const submitLabel = submitting
        ? "Saving..."
        : mode === "edit"
        ? "Save Changes"
        : "Save User";

    const fullEmail = useMemo(() => {
        const username = formData.emailUsername.trim().toLowerCase();
        return username ? `${username}${INSTITUTIONAL_DOMAIN}` : "";
    }, [formData.emailUsername]);

    useEffect(() => {
        if (isOpen) {
            const resolvedDepartmentId =
                initialData?.department_id ??
                (departments.length > 0 ? String(departments[0].id) : "");

            const rawEmail = initialData?.email || "";
            const usernameOnly = rawEmail.endsWith(INSTITUTIONAL_DOMAIN)
                ? rawEmail.replace(INSTITUTIONAL_DOMAIN, "")
                : rawEmail;

            setFormData({
                name: initialData?.name || "",
                emailUsername: usernameOnly || "",
                role: initialData?.role || "Faculty",
                department_id: resolvedDepartmentId ? String(resolvedDepartmentId) : "",
                status: initialData?.status || "Active",
            });

            setErrors({});
            setSubmitError("");
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
            }, 260);

            return () => clearTimeout(timer);
        }
    }, [isOpen, initialData, departments, isMounted]);

    useEffect(() => {
        if (!isVisible) {
            return undefined;
        }

        const motion = animateStaggerReveal(modalRef.current, {
            selector: "[data-aum-motion-item]",
            duration: 500,
            staggerMs: 34,
            startDelayMs: 0,
        });

        if (!motion) {
            return undefined;
        }

        return () => {
            cleanupMotion(motion);
        };
    }, [isVisible, mode, departments.length, loadingDepartments, submitError]);

    const closeWithAnimation = () => {
        setIsVisible(false);

        setTimeout(() => {
            onClose?.();
        }, 240);
    };

    const validateForm = () => {
        const newErrors = {};

        if (!formData.name.trim()) {
            newErrors.name = "Full name is required.";
        }

        if (!formData.emailUsername.trim()) {
            newErrors.email = "Institutional email is required.";
        } else if (!/^[A-Za-z0-9._%+-]+$/.test(formData.emailUsername.trim())) {
            newErrors.email =
                "Only letters, numbers, dots, underscores, percent, plus, and hyphen are allowed.";
        } else if (!fullEmail.endsWith(INSTITUTIONAL_DOMAIN)) {
            newErrors.email = "Email must be a valid @smcbi.edu.ph address.";
        }

        if (!formData.role) {
            newErrors.role = "Role is required.";
        }

        if (!formData.department_id) {
            newErrors.department_id = "Department is required.";
        }

        if (!formData.status) {
            newErrors.status = "Status is required.";
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleChangeName = (e) => {
        const value = e.target.value;

        setFormData((prev) => ({
            ...prev,
            name: value,
        }));

        setErrors((prev) => ({
            ...prev,
            name: "",
        }));

        setSubmitError("");
    };

    const handleEmailChange = (e) => {
        const rawValue = e.target.value
            .replace(INSTITUTIONAL_DOMAIN, "")
            .replace(/\s+/g, "");

        setFormData((prev) => ({
            ...prev,
            emailUsername: rawValue,
        }));

        setErrors((prev) => ({
            ...prev,
            email: "",
        }));

        setSubmitError("");
    };

    const handleSelectValue = (field, value) => {
        setFormData((prev) => ({
            ...prev,
            [field]: value,
        }));

        setErrors((prev) => ({
            ...prev,
            [field]: "",
        }));

        setSubmitError("");
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validateForm()) {
            return;
        }

        try {
            setSubmitError("");

            await onSave({
                name: formData.name.trim(),
                email: fullEmail,
                role: formData.role,
                department_id: Number(formData.department_id),
                status: formData.status,
            });

            setIsVisible(false);
        } catch (error) {
            if (error?.fieldErrors) {
                setErrors((prev) => ({
                    ...prev,
                    ...error.fieldErrors,
                }));
            }

            setSubmitError(error.message || "Failed to save user.");
        }
    };

    const handleOverlayClick = (e) => {
        if (e.target === e.currentTarget && !submitting) {
            closeWithAnimation();
        }
    };

    const modalStyle = {
        "--aum-primary-dark": activeColors.primaryDark,
        "--aum-primary": activeColors.primary,
        "--aum-border": activeColors.border,
        "--aum-border-hover": activeColors.borderHover,
        "--aum-white": activeColors.white,
        "--aum-text": activeColors.text,
        "--aum-text-muted": activeColors.textMuted,
        "--aum-accent": activeColors.accent,
        "--aum-background": activeColors.background,
        "--aum-surface": activeColors.surface,
        "--aum-panel": activeColors.panel,
        "--aum-card": activeColors.card,
        "--aum-hint": activeColors.hint,
        "--aum-black": activeColors.black,
        "--aum-green": activeColors.status.signed,
        "--aum-danger": modalDanger,
        "--aum-pill-selected-bg": selectedPillColors.bg,
        "--aum-pill-selected-text": selectedPillColors.text,
        "--aum-pill-selected-border": selectedPillColors.border,
        "--aum-font": theme.fonts.primary,
        "--aum-radius-md": theme.radius.md,
        "--aum-radius-lg": theme.radius.lg,
        "--aum-shadow": activeTheme.shadows.card,
    };

    if (!isMounted) {
        return null;
    }

    return (
        <div
            className={`add-user-modal-overlay ${isVisible ? "open" : "closing"}`}
            style={modalStyle}
            onClick={handleOverlayClick}
        >
            <div
                ref={modalRef}
                className={`add-user-modal mode-${themeMode} ${isVisible ? "open" : "closing"}`}
            >
                <div className="aum-header" data-aum-motion-item>
                    <div>
                        <h2>{modalTitle}</h2>
                        <p>{modalSubtitle}</p>
                    </div>

                    <button
                        type="button"
                        className="aum-close-btn"
                        onClick={closeWithAnimation}
                        disabled={submitting}
                        aria-label="Close modal"
                    >
                        ×
                    </button>
                </div>

                <form className="aum-form" onSubmit={handleSubmit}>
                    <div className="aum-field" data-aum-motion-item>
                        <label htmlFor="aum-name">Full Name</label>
                        {errors.name && <span className="aum-error">{errors.name}</span>}
                        <input
                            id="aum-name"
                            type="text"
                            name="name"
                            value={formData.name}
                            onChange={handleChangeName}
                            placeholder="Enter full name"
                            disabled={submitting}
                            className={errors.name ? "aum-input-error" : ""}
                        />
                    </div>

                    <div className="aum-field" data-aum-motion-item>
                        <label htmlFor="aum-email">Email</label>
                        {errors.email && <span className="aum-error">{errors.email}</span>}

                        <div
                            className={`aum-email-group ${
                                errors.email ? "aum-email-group-error" : ""
                            }`}
                        >
                            <input
                                id="aum-email"
                                type="text"
                                value={formData.emailUsername}
                                onChange={handleEmailChange}
                                placeholder="username"
                                disabled={submitting}
                                className={errors.email ? "aum-input-error" : ""}
                                autoComplete="off"
                            />
                            <span className="aum-email-domain-inline">
                                {INSTITUTIONAL_DOMAIN}
                            </span>
                        </div>
                    </div>

                    <div className="aum-field" data-aum-motion-item>
                        <label>Role</label>
                        {errors.role && <span className="aum-error">{errors.role}</span>}
                        <div className="aum-pill-group">
                            {roleOptions.map((role) => {
                                const isSelected = formData.role === role;

                                return (
                                    <button
                                        key={role}
                                        type="button"
                                        className={`aum-pill-btn ${
                                            isSelected ? "selected" : ""
                                        }`}
                                        onClick={() => handleSelectValue("role", role)}
                                        disabled={submitting}
                                    >
                                        {role}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="aum-field" data-aum-motion-item>
                        <label>Department</label>
                        {errors.department_id && (
                            <span className="aum-error">{errors.department_id}</span>
                        )}

                        <div className="aum-pill-group">
                            {loadingDepartments ? (
                                <div className="aum-helper-text">Loading departments...</div>
                            ) : departments.length > 0 ? (
                                departments.map((department) => {
                                    const isSelected =
                                        String(formData.department_id) ===
                                        String(department.id);

                                    return (
                                        <button
                                            key={department.id}
                                            type="button"
                                            className={`aum-pill-btn ${
                                                isSelected ? "selected" : ""
                                            }`}
                                            onClick={() =>
                                                handleSelectValue(
                                                    "department_id",
                                                    String(department.id)
                                                )
                                            }
                                            disabled={submitting}
                                        >
                                            {department.name}
                                        </button>
                                    );
                                })
                            ) : (
                                <div className="aum-helper-text">
                                    No departments available.
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="aum-field" data-aum-motion-item>
                        <label>Status</label>
                        {errors.status && <span className="aum-error">{errors.status}</span>}

                        <div className="aum-pill-group aum-status-pill-group">
                            {statusOptions.map((status) => {
                                const isSelected = formData.status === status;
                                const statusClass =
                                    status === "Active"
                                        ? "aum-status-active"
                                        : "aum-status-inactive";

                                return (
                                    <button
                                        key={status}
                                        type="button"
                                        className={`aum-pill-btn aum-status-pill ${statusClass} ${
                                            isSelected ? "selected" : ""
                                        }`}
                                        onClick={() => handleSelectValue("status", status)}
                                        disabled={submitting}
                                    >
                                        {status}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {submitError && <span className="aum-submit-error" data-aum-motion-item>{submitError}</span>}

                    <div className="aum-actions" data-aum-motion-item>
                        <button
                            type="button"
                            className="aum-btn aum-btn-cancel"
                            onClick={closeWithAnimation}
                            disabled={submitting}
                        >
                            Cancel
                        </button>

                        <button
                            type="submit"
                            className="aum-btn aum-btn-save"
                            disabled={submitting || loadingDepartments}
                        >
                            {submitLabel}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default AddUserModal;
