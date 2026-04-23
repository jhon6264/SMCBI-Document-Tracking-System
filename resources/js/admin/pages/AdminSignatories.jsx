import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import "../../../css/admin/admin-signatories.css";
import { theme } from "../../../utils/theme";
import { useAdminTheme } from "../context/AdminThemeContext";
import { animateStaggerReveal, cleanupMotion } from "../../user/utils/animeMotion";
import {
    FiCheckCircle,
    FiEdit2,
    FiFileText,
    FiKey,
    FiPlus,
    FiSearch,
    FiSlash,
    FiTrash2,
    FiUsers,
    FiX,
} from "react-icons/fi";

const CATEGORY_OPTIONS = ["All", "Academic", "Finance", "Records", "Administration"];
const STATUS_OPTIONS = ["All", "Active", "Inactive"];

const toPlaceholderKey = (value = "") =>
    value
        .trim()
        .replace(/\s+/g, "_")
        .replace(/[^A-Za-z0-9_]/g, "")
        .replace(/_+/g, "_")
        .toUpperCase();

function SignatoryStats({ total, active, inactive, totalUsage }) {
    const items = [
        {
            label: "Registry Entries",
            value: total,
            subtext: "Active and inactive placeholders in the system registry.",
            icon: <FiKey />,
            tone: "primary",
        },
        {
            label: "Active Tokens",
            value: active,
            subtext: "Available for document scanning and session assignment.",
            icon: <FiCheckCircle />,
            tone: "success",
        },
        {
            label: "Inactive Tokens",
            value: inactive,
            subtext: "Stored for reference but ignored during matching.",
            icon: <FiSlash />,
            tone: "muted",
        },
        {
            label: "Registry Usage",
            value: totalUsage,
            subtext: "Total session matches recorded across placeholder definitions.",
            icon: <FiUsers />,
            tone: "accent",
        },
    ];

    return (
        <section className="asig-stat-grid">
            {items.map((item) => (
                <article key={item.label} className={`asig-stat-card asig-stat-card--${item.tone}`}>
                    <div className="asig-stat-icon">{item.icon}</div>
                    <div className="asig-stat-copy">
                        <div className="asig-stat-value">{item.value}</div>
                        <div className="asig-stat-label">{item.label}</div>
                        <p className="asig-stat-subtext">{item.subtext}</p>
                    </div>
                </article>
            ))}
        </section>
    );
}

function SignatoryFormModal({
    isOpen,
    mode,
    form,
    errorMessage,
    submitting,
    onChange,
    onClose,
    onSubmit,
}) {
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
            }, 240);

            return () => clearTimeout(timer);
        }

        return undefined;
    }, [isMounted, isOpen]);

    useEffect(() => {
        if (!isVisible) {
            return undefined;
        }

        const motion = animateStaggerReveal(modalRef.current, {
            selector: "[data-asig-modal-item]",
            duration: 460,
            staggerMs: 32,
            startDelayMs: 0,
        });

        if (!motion) {
            return undefined;
        }

        return () => {
            cleanupMotion(motion);
        };
    }, [isVisible, mode, errorMessage, form.isActive]);

    const closeWithAnimation = () => {
        if (submitting) return;

        setIsVisible(false);

        setTimeout(() => {
            onClose?.();
        }, 220);
    };

    if (!isMounted) return null;

    const placeholderKey = toPlaceholderKey(form.placeholderKey);
    const rawToken = placeholderKey ? `{{${placeholderKey}}}` : "{{PLACEHOLDER_KEY}}";

    return (
        <div
            className={`asig-modal-backdrop ${isVisible ? "open" : "closing"}`}
            onClick={closeWithAnimation}
        >
            <div
                ref={modalRef}
                className={`asig-modal ${isVisible ? "open" : "closing"}`}
                onClick={(event) => event.stopPropagation()}
            >
                <div className="asig-modal-header" data-asig-modal-item>
                    <div>
                        <h2>{mode === "edit" ? "Edit Placeholder" : "Create Placeholder"}</h2>
                        <p>Define the tokens the backend is allowed to match in Google Docs.</p>
                    </div>
                    <button type="button" className="asig-modal-close" onClick={closeWithAnimation}>
                        <FiX />
                    </button>
                </div>

                <div className="asig-modal-body">
                    <label className="asig-field" data-asig-modal-item>
                        <span>Placeholder Key</span>
                        <input
                            type="text"
                            value={form.placeholderKey}
                            onChange={(event) =>
                                onChange("placeholderKey", toPlaceholderKey(event.target.value))
                            }
                            placeholder="BSIT_PROGRAM_HEAD"
                        />
                    </label>

                    <label className="asig-field" data-asig-modal-item>
                        <span>Label</span>
                        <input
                            type="text"
                            value={form.label}
                            onChange={(event) => onChange("label", event.target.value)}
                            placeholder="BSIT Program Head"
                        />
                    </label>

                    <label className="asig-field" data-asig-modal-item>
                        <span>Category</span>
                        <select
                            value={form.category}
                            onChange={(event) => onChange("category", event.target.value)}
                        >
                            {CATEGORY_OPTIONS.filter((option) => option !== "All").map((option) => (
                                <option key={option} value={option}>
                                    {option}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label className="asig-field asig-field--wide" data-asig-modal-item>
                        <span>Description</span>
                        <textarea
                            rows="4"
                            value={form.description}
                            onChange={(event) => onChange("description", event.target.value)}
                            placeholder="Explain how this placeholder should be used."
                        />
                    </label>

                    <label className="asig-toggle" data-asig-modal-item>
                        <input
                            type="checkbox"
                            checked={form.isActive}
                            onChange={(event) => onChange("isActive", event.target.checked)}
                        />
                        <span>Active placeholder</span>
                    </label>

                    <div className="asig-token-preview" data-asig-modal-item>
                        <div className="asig-token-preview-label">Generated Token</div>
                        <code>{rawToken}</code>
                        <p>
                            Use this exact token inside Google Docs so Laravel can match it during
                            session setup.
                        </p>
                        {errorMessage && <div className="asig-inline-error">{errorMessage}</div>}
                    </div>
                </div>

                <div className="asig-modal-footer" data-asig-modal-item>
                    <button type="button" className="asig-btn asig-btn--ghost" onClick={closeWithAnimation}>
                        Cancel
                    </button>
                    <button
                        type="button"
                        className="asig-btn asig-btn--primary"
                        onClick={onSubmit}
                        disabled={submitting}
                    >
                        {submitting
                            ? "Saving..."
                            : mode === "edit"
                                ? "Save Changes"
                                : "Create Placeholder"}
                    </button>
                </div>
            </div>
        </div>
    );
}

function AdminSignatories() {
    const { activeTheme } = useAdminTheme();
    const activeColors = activeTheme.colors;

    const [entries, setEntries] = useState([]);
    const [search, setSearch] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("All");
    const [statusFilter, setStatusFilter] = useState("All");
    const [modalOpen, setModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState("create");
    const [editingId, setEditingId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const [modalError, setModalError] = useState("");
    const [form, setForm] = useState({
        placeholderKey: "",
        label: "",
        description: "",
        category: "Academic",
        isActive: true,
    });

    const pageStyle = {
        "--asig-page-bg": activeColors.background,
        "--asig-surface": activeColors.surface,
        "--asig-panel": activeColors.panel,
        "--asig-card": activeColors.card,
        "--asig-primary": activeColors.primary,
        "--asig-primary-dark": activeColors.primaryDark,
        "--asig-accent": activeColors.accent,
        "--asig-border": activeColors.border,
        "--asig-border-hover": activeColors.borderHover,
        "--asig-text": activeColors.text,
        "--asig-text-muted": activeColors.textMuted,
        "--asig-white": activeColors.white,
        "--asig-black": activeColors.black,
        "--asig-blue-tint": activeColors.blueTint,
        "--asig-teal-tint": activeColors.tealTint,
        "--asig-hint": activeColors.hint,
        "--asig-shadow": activeTheme.shadows.card,
        "--asig-font": theme.fonts.primary,
        "--asig-radius-sm": theme.radius.sm,
        "--asig-radius-md": theme.radius.md,
        "--asig-radius-lg": theme.radius.lg,
    };

    useEffect(() => {
        const fetchPlaceholders = async () => {
            try {
                setLoading(true);
                setErrorMessage("");
                const response = await axios.get("/api/admin/signatory-placeholders", {
                    headers: { Accept: "application/json" },
                });
                if (response.data.success) {
                    setEntries(response.data.placeholders || []);
                }
            } catch (error) {
                setErrorMessage(
                    error.response?.data?.message || "Failed to load signatory placeholders."
                );
            } finally {
                setLoading(false);
            }
        };

        fetchPlaceholders();
    }, []);

    const filteredEntries = useMemo(() => {
        return entries.filter((entry) => {
            const query = search.trim().toLowerCase();
            const matchesSearch =
                !query ||
                entry.placeholder_key.toLowerCase().includes(query) ||
                entry.label.toLowerCase().includes(query) ||
                String(entry.description || "").toLowerCase().includes(query);

            const matchesCategory =
                categoryFilter === "All" || (entry.category || "Uncategorized") === categoryFilter;

            const entryStatus = entry.is_active ? "Active" : "Inactive";
            const matchesStatus = statusFilter === "All" || entryStatus === statusFilter;

            return matchesSearch && matchesCategory && matchesStatus;
        });
    }, [entries, search, categoryFilter, statusFilter]);

    const totalEntries = entries.length;
    const activeEntries = entries.filter((entry) => entry.is_active).length;
    const inactiveEntries = totalEntries - activeEntries;
    const totalUsage = entries.reduce((sum, entry) => sum + (entry.usage_count || 0), 0);

    const resetForm = () => {
        setForm({
            placeholderKey: "",
            label: "",
            description: "",
            category: "Academic",
            isActive: true,
        });
        setEditingId(null);
        setModalError("");
    };

    const openCreateModal = () => {
        setModalMode("create");
        resetForm();
        setModalOpen(true);
    };

    const openEditModal = (entry) => {
        setModalMode("edit");
        setEditingId(entry.id);
        setForm({
            placeholderKey: entry.placeholder_key,
            label: entry.label,
            description: entry.description || "",
            category: entry.category || "Academic",
            isActive: Boolean(entry.is_active),
        });
        setModalError("");
        setModalOpen(true);
    };

    const handleFormChange = (field, value) => {
        setForm((prev) => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async () => {
        const payload = {
            placeholder_key: toPlaceholderKey(form.placeholderKey),
            label: form.label.trim(),
            description: form.description.trim(),
            category: form.category,
            is_active: form.isActive,
        };

        if (!payload.placeholder_key || !payload.label) {
            setModalError("Placeholder key and label are required.");
            return;
        }

        try {
            setSubmitting(true);
            setModalError("");

            const response =
                modalMode === "edit"
                    ? await axios.put(`/api/admin/signatory-placeholders/${editingId}`, payload, {
                          headers: { Accept: "application/json" },
                      })
                    : await axios.post("/api/admin/signatory-placeholders", payload, {
                          headers: { Accept: "application/json" },
                      });

            const nextEntry = response.data.placeholder;
            setEntries((prev) => {
                if (modalMode === "edit") {
                    return prev.map((entry) => (entry.id === nextEntry.id ? nextEntry : entry));
                }
                return [nextEntry, ...prev];
            });

            setModalOpen(false);
            resetForm();
        } catch (error) {
            setModalError(
                error.response?.data?.message ||
                Object.values(error.response?.data?.errors || {})[0]?.[0] ||
                "Failed to save placeholder."
            );
        } finally {
            setSubmitting(false);
        }
    };

    const toggleStatus = async (id) => {
        try {
            const response = await axios.patch(
                `/api/admin/signatory-placeholders/${id}/status`,
                {},
                { headers: { Accept: "application/json" } }
            );
            const nextEntry = response.data.placeholder;
            setEntries((prev) => prev.map((entry) => (entry.id === nextEntry.id ? nextEntry : entry)));
        } catch (error) {
            setErrorMessage(error.response?.data?.message || "Failed to update placeholder status.");
        }
    };

    const handleDelete = async (id) => {
        try {
            await axios.delete(`/api/admin/signatory-placeholders/${id}`, {
                headers: { Accept: "application/json" },
            });
            setEntries((prev) => prev.filter((entry) => entry.id !== id));
        } catch (error) {
            setErrorMessage(error.response?.data?.message || "Failed to delete placeholder.");
        }
    };

    return (
        <div className="admin-signatories-page" style={pageStyle}>
            <section className="asig-hero-card">
                <div className="asig-hero-copy">
                    <nav className="asig-breadcrumb">
                        <a href="/admin/dashboard">Admin</a>
                        <span>/</span>
                        <span>Signatories</span>
                    </nav>
                    <h1 className="admin-page-title">Signatories Registry</h1>
                    <p className="asig-hero-description">
                        Maintain the approved placeholder tokens that Laravel is allowed to match
                        when scanning Google Docs for session signatures.
                    </p>
                </div>

                <div className="asig-hero-actions">
                    <div className="asig-search">
                        <FiSearch />
                        <input
                            type="text"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search placeholder key, label, or description"
                        />
                    </div>
                    <button type="button" className="asig-btn asig-btn--primary" onClick={openCreateModal}>
                        <FiPlus />
                        New Placeholder
                    </button>
                </div>
            </section>

            <SignatoryStats
                total={totalEntries}
                active={activeEntries}
                inactive={inactiveEntries}
                totalUsage={totalUsage}
            />

            {errorMessage && <div className="asig-error-banner">{errorMessage}</div>}

            <section className="asig-workspace">
                <div className="asig-registry-card">
                    <div className="asig-card-header">
                        <div>
                            <h2>Placeholder Registry</h2>
                            <p>Only active entries here should be considered valid during document scans.</p>
                        </div>

                        <div className="asig-card-filters">
                            <select
                                value={categoryFilter}
                                onChange={(event) => setCategoryFilter(event.target.value)}
                            >
                                {CATEGORY_OPTIONS.map((option) => (
                                    <option key={option} value={option}>
                                        {option}
                                    </option>
                                ))}
                            </select>

                            <select
                                value={statusFilter}
                                onChange={(event) => setStatusFilter(event.target.value)}
                            >
                                {STATUS_OPTIONS.map((option) => (
                                    <option key={option} value={option}>
                                        {option}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="asig-table-wrap">
                        <table className="asig-table">
                            <thead>
                                <tr>
                                    <th>Placeholder</th>
                                    <th>Token</th>
                                    <th>Category</th>
                                    <th>Status</th>
                                    <th>Usage</th>
                                    <th>Updated</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan="7" className="asig-empty-cell">
                                            <div className="asig-empty-state">
                                                <FiFileText />
                                                <strong>Loading placeholder registry...</strong>
                                            </div>
                                        </td>
                                    </tr>
                                ) : filteredEntries.length > 0 ? (
                                    filteredEntries.map((entry) => (
                                        <tr key={entry.id}>
                                            <td>
                                                <div className="asig-placeholder-cell">
                                                    <strong>{entry.label}</strong>
                                                    <span>{entry.description || "No description provided."}</span>
                                                </div>
                                            </td>
                                            <td>
                                                <code className="asig-token-chip">{entry.raw_token}</code>
                                            </td>
                                            <td>
                                                <span className="asig-pill">
                                                    {entry.category || "Uncategorized"}
                                                </span>
                                            </td>
                                            <td>
                                                <span
                                                    className={`asig-status asig-status--${
                                                        entry.is_active ? "active" : "inactive"
                                                    }`}
                                                >
                                                    {entry.is_active ? "Active" : "Inactive"}
                                                </span>
                                            </td>
                                            <td>{entry.usage_count}</td>
                                            <td>{entry.last_updated || "-"}</td>
                                            <td>
                                                <div className="asig-action-row">
                                                    <button
                                                        type="button"
                                                        className="asig-icon-btn"
                                                        onClick={() => openEditModal(entry)}
                                                        title="Edit placeholder"
                                                    >
                                                        <FiEdit2 />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="asig-icon-btn"
                                                        onClick={() => toggleStatus(entry.id)}
                                                        title={entry.is_active ? "Deactivate" : "Activate"}
                                                    >
                                                        {entry.is_active ? <FiSlash /> : <FiCheckCircle />}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="asig-icon-btn asig-icon-btn--danger"
                                                        onClick={() => handleDelete(entry.id)}
                                                        title="Delete placeholder"
                                                    >
                                                        <FiTrash2 />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="7" className="asig-empty-cell">
                                            <div className="asig-empty-state">
                                                <FiFileText />
                                                <strong>No placeholders match the current filters.</strong>
                                                <span>
                                                    Create a new registry item or adjust the search,
                                                    category, and status filters.
                                                </span>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <aside className="asig-guidance-card">
                    <h2>Implementation Rules</h2>
                    <ul className="asig-guidance-list">
                        <li>Use uppercase underscore keys like `BSIT_PROGRAM_HEAD`.</li>
                        <li>Laravel should only accept tokens registered here and marked active.</li>
                        <li>Raw tokens are generated as `{"{{PLACEHOLDER_KEY}}"}` in documents.</li>
                        <li>Session admins later map matched placeholders to intended signatories.</li>
                    </ul>

                    <div className="asig-guidance-panel">
                        <h3>Document Example</h3>
                        <code>{`{{BSIT_PROGRAM_HEAD}}`}</code>
                        <p>
                            Keep the placeholder token on the document template where the signature
                            image should be injected.
                        </p>
                    </div>
                </aside>
            </section>

            <SignatoryFormModal
                isOpen={modalOpen}
                mode={modalMode}
                form={form}
                errorMessage={modalError}
                submitting={submitting}
                onChange={handleFormChange}
                onClose={() => setModalOpen(false)}
                onSubmit={handleSubmit}
            />
        </div>
    );
}

export default AdminSignatories;
