import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import "../../../css/user/pages/user-sessions.css";
import { LuFilter, LuPencil, LuRefreshCcw, LuTrash2 } from "react-icons/lu";
import FolderIcon from "../../assets/images/folder.png";
import GoogleDriveIcon from "../../assets/images/google-drive.png";
import useAnimatedPresence from "../../hooks/useAnimatedPresence";
import { animateStaggerReveal, cleanupMotion } from "../utils/animeMotion";

/* ── Dummy Data ─────────────────────────────────────────────────────────── */
const DUMMY_SESSIONS = [
    {
        id: 1,
        title: "March Payroll Notice",
        type: "Payroll",
        status: "active",
        createdBy: "Jhon Potestas",
        createdAt: "Apr 3, 2026",
        deadline: "Apr 7, 2026",
        deadlineUrgent: true,
        signatories: [
            { initials: "JP", name: "Jhon Potestas",   role: "Faculty",         status: "signed"  },
            { initials: "MA", name: "Maria Alcantara",  role: "Dept. Head",      status: "viewed"  },
            { initials: "RS", name: "Roberto Santos",   role: "Principal",       status: "pending" },
            { initials: "LC", name: "Lourdes Cruz",     role: "Finance Officer", status: "waiting" },
            { initials: "BT", name: "Ben Tolentino",    role: "HR Office",       status: "waiting" },
        ],
        signed: 1,
        total: 5,
    },
    {
        id: 2,
        title: "Faculty Meeting Memo",
        type: "Notice",
        status: "active",
        createdBy: "Jhon Potestas",
        createdAt: "Apr 2, 2026",
        deadline: "Apr 8, 2026",
        deadlineUrgent: false,
        signatories: [
            { initials: "JP", name: "Jhon Potestas",  role: "Faculty",    status: "signed" },
            { initials: "MA", name: "Maria Alcantara", role: "Dept. Head", status: "signed" },
            { initials: "RS", name: "Roberto Santos",  role: "Principal",  status: "signed" },
            { initials: "LC", name: "Lourdes Cruz",    role: "Finance",    status: "pending"},
        ],
        signed: 3,
        total: 4,
    },
    {
        id: 3,
        title: "Leave Application — Feb 2026",
        type: "Request",
        status: "completed",
        createdBy: "Jhon Potestas",
        createdAt: "Mar 20, 2026",
        deadline: "Mar 28, 2026",
        deadlineUrgent: false,
        signatories: [
            { initials: "JP", name: "Jhon Potestas", role: "Faculty",   status: "signed" },
            { initials: "RS", name: "Roberto Santos", role: "Principal", status: "signed" },
            { initials: "HR", name: "HR Office",      role: "HR",        status: "signed" },
        ],
        signed: 3,
        total: 3,
    },
    {
        id: 4,
        title: "Budget Proposal Q2 2026",
        type: "Memo",
        status: "draft",
        createdBy: "Jhon Potestas",
        createdAt: "Apr 1, 2026",
        deadline: "Apr 10, 2026",
        deadlineUrgent: false,
        signatories: [
            { initials: "JP", name: "Jhon Potestas",  role: "Faculty",    status: "waiting" },
            { initials: "MA", name: "Maria Alcantara", role: "Dept. Head", status: "waiting" },
            { initials: "RS", name: "Roberto Santos",  role: "Principal",  status: "waiting" },
        ],
        signed: 0,
        total: 3,
    },
    {
        id: 5,
        title: "IT Equipment Request",
        type: "Request",
        status: "overdue",
        createdBy: "Jhon Potestas",
        createdAt: "Mar 25, 2026",
        deadline: "Apr 1, 2026",
        deadlineUrgent: true,
        signatories: [
            { initials: "JP", name: "Jhon Potestas",  role: "Faculty",    status: "signed"  },
            { initials: "MA", name: "Maria Alcantara", role: "Dept. Head", status: "pending" },
            { initials: "RS", name: "Roberto Santos",  role: "Principal",  status: "waiting" },
        ],
        signed: 1,
        total: 3,
    },
    {
        id: 6,
        title: "Annual Report Summary",
        type: "Report",
        status: "completed",
        createdBy: "Jhon Potestas",
        createdAt: "Mar 10, 2026",
        deadline: "Mar 20, 2026",
        deadlineUrgent: false,
        signatories: [
            { initials: "JP", name: "Jhon Potestas",  role: "Faculty",         status: "signed" },
            { initials: "MA", name: "Maria Alcantara", role: "Dept. Head",      status: "signed" },
            { initials: "RS", name: "Roberto Santos",  role: "Principal",       status: "signed" },
            { initials: "LC", name: "Lourdes Cruz",    role: "Finance Officer", status: "signed" },
        ],
        signed: 4,
        total: 4,
    },
];

const FILTERS = ["All", "Active", "Completed", "Draft", "Overdue"];

const STATUS_MAP = {
    active:    { label: "Active",    color: "blue"  },
    completed: { label: "Completed", color: "green" },
    draft:     { label: "Draft",     color: "gray"  },
    overdue:   { label: "Overdue",   color: "red"   },
};

const TYPE_MAP = {
    Payroll: "type-payroll",
    Notice:  "type-notice",
    Request: "type-request",
    Memo:    "type-memo",
    Report:  "type-report",
};

const SIG_STATUS_COLOR = {
    signed:  "#22c55e",
    viewed:  "#3b82f6",
    pending: "#f59e0b",
    waiting: "#d1d5db",
};

const SIGNABLE_MIME_TYPES = new Set([
    "application/vnd.google-apps.document",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
]);

const INITIAL_SESSION_FORM = {
    title: "",
    documentType: "Notice",
    googleDocFileId: "",
    deadlineAt: "",
    description: "",
};

const toInitials = (name = "") => {
    const parts = String(name).trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "??";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0] || ""}${parts[parts.length - 1][0] || ""}`.toUpperCase();
};

const formatSessionDate = (value) => {
    if (!value) return "-";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "-";
    return parsed.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
};

const mapApiSessionToCard = (session) => {
    const placeholders = Array.isArray(session?.placeholders) ? session.placeholders : [];
    const members = Array.isArray(session?.members) ? session.members : [];
    const signers = members.filter((member) => member?.permissions?.can_sign);
    const signed = placeholders.filter((placeholder) => placeholder?.status === "signed").length;
    const total = placeholders.length || signers.length || 0;
    const deadline = formatSessionDate(session?.deadline_at);
    const deadlineUrgent =
        Boolean(session?.deadline_at) &&
        session?.status !== "completed" &&
        new Date(session.deadline_at).getTime() < Date.now();

    return {
        id: session?.id,
        title: session?.title || "Untitled Session",
        type: session?.document_type || "Document",
        status: session?.status || "draft",
        createdBy: session?.creator?.name || "Unknown",
        createdAt: formatSessionDate(session?.created_at),
        deadline,
        deadlineUrgent,
        signatories: signers.map((member) => ({
            initials: toInitials(member?.name),
            name: member?.name || "Unknown",
            role: member?.display_role_name || member?.role || "Personnel",
            status: member?.member_status || "waiting",
        })),
        signed,
        total,
        description: session?.description || "",
        googleDocFileId:
            session?.primary_document?.source_google_drive_file_id ||
            session?.primary_document?.google_drive_file_id ||
            session?.google_doc_file_id ||
            "",
        deadlineAt: session?.deadline_at
            ? new Date(session.deadline_at).toISOString().slice(0, 16)
            : "",
        permissions: {
            canEdit: Boolean(session?.current_member?.permissions?.can_edit_session),
            canDelete: Boolean(session?.current_member?.permissions?.can_close_session),
        },
    };
};

/* ── Component ──────────────────────────────────────────────────────────── */
function UserSessions() {
    const navigate = (path) => {
        if (window.location.pathname !== path) {
            window.location.href = path;
        }
    };
    const queryClient = useQueryClient();
    const [filter, setFilter]   = useState("All");
    const [search, setSearch]   = useState("");
    const [view,   setView]     = useState("grid"); // "grid" | "list"
    const [filterMenuOpen, setFilterMenuOpen] = useState(false);
    const [showSessionModal, setShowSessionModal] = useState(false);
    const [sessionModalMode, setSessionModalMode] = useState("create");
    const [editingSessionId, setEditingSessionId] = useState(null);
    const [sessionFormError, setSessionFormError] = useState("");
    const [sessionForm, setSessionForm] = useState(INITIAL_SESSION_FORM);
    const [deleteSessionState, setDeleteSessionState] = useState({
        open: false,
        sessionId: null,
        title: "",
        confirmationText: "",
    });
    const sessionModalPresence = useAnimatedPresence(showSessionModal, { exitDurationMs: 260 });
    const deleteModalPresence = useAnimatedPresence(deleteSessionState.open, { exitDurationMs: 220 });
    const filterMenuRef = useRef(null);
    const pageRef = useRef(null);
    const sessionModalRef = useRef(null);
    const deleteModalRef = useRef(null);
    const docGridRef = useRef(null);

    const buildAuthConfig = () => {
        const token = localStorage.getItem("user_token");
        return {
            headers: {
                Accept: "application/json",
                Authorization: `Bearer ${token || ""}`,
            },
        };
    };

    const sessionsQuery = useQuery({
        queryKey: ["user-sessions"],
        queryFn: async () => {
            const { data } = await axios.get("/api/user/sessions", buildAuthConfig());
            return data;
        },
    });
    const docsQuery = useQuery({
        queryKey: ["user-session-create-docs"],
        enabled: showSessionModal,
        queryFn: async () => {
            const { data } = await axios.get("/api/user/google/drive/system-library", buildAuthConfig());
            return data;
        },
    });
    const saveSessionMutation = useMutation({
        mutationFn: async (payload) => {
            if (sessionModalMode === "edit" && editingSessionId) {
                const { data } = await axios.patch(
                    `/api/user/sessions/${editingSessionId}`,
                    payload,
                    buildAuthConfig()
                );
                return data;
            }

            const { data } = await axios.post("/api/user/sessions", payload, buildAuthConfig());
            return data;
        },
        onSuccess: async (data) => {
            const shouldNavigate = sessionModalMode !== "edit";
            setShowSessionModal(false);
            setSessionFormError("");
            setSessionForm(INITIAL_SESSION_FORM);
            setEditingSessionId(null);
            setSessionModalMode("create");
            await queryClient.invalidateQueries({ queryKey: ["user-sessions"] });
            if (shouldNavigate && data?.session?.id) {
                navigate(`/user/sessions/${data.session.id}`);
            }
        },
        onError: (error) => {
            setSessionFormError(
                error?.response?.data?.message ||
                Object.values(error?.response?.data?.errors || {})[0]?.[0] ||
                `Failed to ${sessionModalMode === "edit" ? "update" : "create"} session.`
            );
        },
    });
    const deleteSessionMutation = useMutation({
        mutationFn: async (sessionId) => {
            const { data } = await axios.delete(`/api/user/sessions/${sessionId}`, buildAuthConfig());
            return data;
        },
        onSuccess: async () => {
            setDeleteSessionState({
                open: false,
                sessionId: null,
                title: "",
                confirmationText: "",
            });
            await queryClient.invalidateQueries({ queryKey: ["user-sessions"] });
        },
    });

    useEffect(() => {
        const onClickOutside = (event) => {
            if (!filterMenuRef.current?.contains(event.target)) {
                setFilterMenuOpen(false);
            }
        };

        if (filterMenuOpen) {
            document.addEventListener("mousedown", onClickOutside);
        }

        return () => document.removeEventListener("mousedown", onClickOutside);
    }, [filterMenuOpen]);

    useEffect(() => {
        if (!showSessionModal) {
            setSessionFormError("");
        }
    }, [showSessionModal]);

    useEffect(() => {
        if (!deleteModalPresence.isRendered && !deleteSessionState.open && deleteSessionState.sessionId) {
            setDeleteSessionState({
                open: false,
                sessionId: null,
                title: "",
                confirmationText: "",
            });
        }
    }, [deleteModalPresence.isRendered, deleteSessionState]);

    const sessionItems = useMemo(() => {
        if (sessionsQuery.isLoading) {
            return [];
        }
        const apiSessions = sessionsQuery.data?.sessions;
        if (Array.isArray(apiSessions) && apiSessions.length > 0) {
            return apiSessions.map(mapApiSessionToCard);
        }
        if (Array.isArray(apiSessions) && apiSessions.length === 0) {
            return [];
        }
        return sessionsQuery.isError ? DUMMY_SESSIONS : [];
    }, [sessionsQuery.data, sessionsQuery.isError, sessionsQuery.isLoading]);

    const filtered = sessionItems.filter((s) => {
        const matchFilter =
            filter === "All" ||
            s.status === filter.toLowerCase();
        const matchSearch =
            s.title.toLowerCase().includes(search.toLowerCase()) ||
            s.type.toLowerCase().includes(search.toLowerCase());
        return matchFilter && matchSearch;
    });

    const counts = {
        all:       sessionItems.length,
        active:    sessionItems.filter((s) => s.status === "active").length,
        completed: sessionItems.filter((s) => s.status === "completed").length,
        draft:     sessionItems.filter((s) => s.status === "draft").length,
        overdue:   sessionItems.filter((s) => s.status === "overdue").length,
    };
    const availableDocs = useMemo(() => {
        const files = docsQuery.data?.data?.files;
        if (!Array.isArray(files)) return [];
        return files.filter((file) => SIGNABLE_MIME_TYPES.has(file?.mimeType));
    }, [docsQuery.data]);
    const selectedDoc = useMemo(() => {
        return availableDocs.find((doc) => doc.id === sessionForm.googleDocFileId) || null;
    }, [availableDocs, sessionForm.googleDocFileId]);
    const systemFolder = docsQuery.data?.data?.folder || null;

    useEffect(() => {
        const selector = sessionsQuery.isLoading
            ? "[data-us-empty-state]"
            : filtered.length === 0
                ? "[data-us-empty-state]"
                : view === "grid"
                    ? "[data-us-grid-item]"
                    : "[data-us-list-item]";

        const motion = animateStaggerReveal(pageRef.current, {
            selector,
            duration: 720,
            staggerMs: view === "grid" ? 60 : 42,
            startDelayMs: 20,
        });

        if (!motion) {
            return undefined;
        }

        return () => {
            cleanupMotion(motion);
        };
    }, [view, filter, search, filtered.length, sessionsQuery.isLoading, sessionsQuery.isError]);

    useEffect(() => {
        if (!sessionModalPresence.isVisible) {
            return undefined;
        }

        const motion = animateStaggerReveal(sessionModalRef.current, {
            selector: "[data-us-modal-item]",
            duration: 560,
            staggerMs: 48,
            startDelayMs: 0,
        });

        if (!motion) {
            return undefined;
        }

        return () => {
            cleanupMotion(motion);
        };
    }, [sessionModalPresence.isVisible, sessionModalMode, sessionForm.googleDocFileId, sessionFormError]);

    useEffect(() => {
        if (!sessionModalPresence.isVisible) {
            return undefined;
        }

        const motion = animateStaggerReveal(docGridRef.current, {
            selector: "[data-us-doc-item]",
            duration: 640,
            staggerMs: 40,
            startDelayMs: 16,
        });

        if (!motion) {
            return undefined;
        }

        return () => {
            cleanupMotion(motion);
        };
    }, [sessionModalPresence.isVisible, availableDocs.length, docsQuery.isLoading, docsQuery.isError]);

    useEffect(() => {
        if (!deleteModalPresence.isVisible) {
            return undefined;
        }

        const motion = animateStaggerReveal(deleteModalRef.current, {
            selector: "[data-us-delete-item]",
            duration: 500,
            staggerMs: 42,
            startDelayMs: 0,
        });

        if (!motion) {
            return undefined;
        }

        return () => {
            cleanupMotion(motion);
        };
    }, [deleteModalPresence.isVisible, deleteSessionState.confirmationText]);

    const openCreateSessionModal = () => {
        setSessionModalMode("create");
        setEditingSessionId(null);
        setSessionForm(INITIAL_SESSION_FORM);
        setSessionFormError("");
        setShowSessionModal(true);
    };

    const openEditSessionModal = (session, event) => {
        event?.stopPropagation?.();
        setSessionModalMode("edit");
        setEditingSessionId(session.id);
        setSessionForm({
            title: session.title || "",
            documentType: session.type || "Notice",
            googleDocFileId: session.googleDocFileId || "",
            deadlineAt: session.deadlineAt || "",
            description: session.description || "",
        });
        setSessionFormError("");
        setShowSessionModal(true);
    };

    const closeSessionModal = () => {
        if (saveSessionMutation.isPending) {
            return;
        }

        setShowSessionModal(false);
        setSessionFormError("");
        setSessionModalMode("create");
        setEditingSessionId(null);
        setSessionForm(INITIAL_SESSION_FORM);
    };

    const openDeleteSessionModal = (session, event) => {
        event?.stopPropagation?.();
        setDeleteSessionState({
            open: true,
            sessionId: session.id,
            title: session.title,
            confirmationText: "",
        });
    };

    const closeDeleteSessionModal = () => {
        if (deleteSessionMutation.isPending) {
            return;
        }

        setDeleteSessionState({
            open: false,
            sessionId: null,
            title: "",
            confirmationText: "",
        });
    };

    const handleDeleteSessionConfirmationChange = (event) => {
        const { value } = event.target;
        setDeleteSessionState((current) => ({
            ...current,
            confirmationText: value,
        }));
    };

    const handleSessionFormSave = () => {
        if (!sessionForm.title.trim()) {
            setSessionFormError("Session title is required.");
            return;
        }
        if (!sessionForm.googleDocFileId) {
            setSessionFormError("Select a file to use as the primary document.");
            return;
        }

        saveSessionMutation.mutate({
            title: sessionForm.title.trim(),
            document_type: sessionForm.documentType,
            google_doc_file_id: sessionForm.googleDocFileId,
            deadline_at: sessionForm.deadlineAt || null,
            description: sessionForm.description.trim() || null,
            allow_delegated_editing: false,
        });
    };

    const renderSessionActions = (session, compact = false) => (
        <div
            className={`us-session-actions ${compact ? "us-session-actions--compact" : ""}`}
            onClick={(event) => event.stopPropagation()}
        >
            {session.permissions?.canEdit && (
                <button
                    type="button"
                    className="us-session-action-btn"
                    onClick={(event) => openEditSessionModal(session, event)}
                    aria-label={`Edit ${session.title}`}
                    title="Edit session"
                >
                    <LuPencil size={14} />
                </button>
            )}
            {session.permissions?.canDelete && (
                <button
                    type="button"
                    className="us-session-action-btn us-session-action-btn--danger"
                    onClick={(event) => openDeleteSessionModal(session, event)}
                    aria-label={`Delete ${session.title}`}
                    title="Delete session"
                >
                    <LuTrash2 size={14} />
                </button>
            )}
        </div>
    );
    const deleteSessionConfirmationValid =
        deleteSessionState.confirmationText.trim() === deleteSessionState.title.trim();

    return (
        <div className="us-page" ref={pageRef}>

            {/* ── TOOLBAR ── */}
            <div className="us-toolbar">
                <div className="us-toolbar-left">
                    <div className="us-search">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
                        <input
                            type="text"
                            placeholder="Search sessions..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <button className="us-new-btn us-new-btn--inline" onClick={openCreateSessionModal}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
                        Add Session
                    </button>
                </div>
                <div className="us-toolbar-right">
                    <div className="us-filter-wrap" ref={filterMenuRef}>
                        <button
                            type="button"
                            className={`us-filter-menu-btn ${filterMenuOpen ? "active" : ""}`}
                            onClick={() => setFilterMenuOpen((open) => !open)}
                            title="Filter"
                        >
                            <LuFilter size={14} />
                            <span>{filter}</span>
                        </button>
                        <div className={`us-filter-menu ${filterMenuOpen ? "open" : ""}`}>
                            {FILTERS.map((f) => {
                                const key = f.toLowerCase();
                                const count = key === "all" ? counts.all : counts[key] ?? 0;
                                return (
                                    <button
                                        key={f}
                                        type="button"
                                        className={`us-filter-menu-item ${filter === f ? "active" : ""}`}
                                        onClick={() => {
                                            setFilter(f);
                                            setFilterMenuOpen(false);
                                        }}
                                    >
                                        <span>{f}</span>
                                        <span className="us-filter-count">{count}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                    <div className="us-view-toggle">
                        <button
                            className={view === "grid" ? "active" : ""}
                            onClick={() => setView("grid")}
                            title="Grid view"
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
                        </button>
                        <button
                            className={view === "list" ? "active" : ""}
                            onClick={() => setView("list")}
                            title="List view"
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
                        </button>
                    </div>
                </div>
            </div>

            {/* ── EMPTY STATE ── */}
            {sessionsQuery.isError && (
                <div className="us-empty" style={{ minHeight: 120 }} data-us-empty-state>
                    <p>{sessionsQuery.error?.response?.data?.message || "Failed to load sessions."}</p>
                </div>
            )}

            {sessionsQuery.isLoading && (
                <div className="us-empty" data-us-empty-state>
                    <p>Loading sessions...</p>
                </div>
            )}

            {!sessionsQuery.isLoading && filtered.length === 0 && (
                <div className="us-empty" data-us-empty-state>
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/></svg>
                    <p>No sessions found.</p>
                </div>
            )}

            {/* ── GRID VIEW ── */}
            {view === "grid" && filtered.length > 0 && (
                <div className="us-grid">
                    {filtered.map((session) => {
                        const st    = STATUS_MAP[session.status];
                        const pct   = Math.round((session.signed / session.total) * 100);
                        return (
                            <article
                                key={session.id}
                                data-us-grid-item
                                className={`us-card us-card--${st.color}`}
                                onClick={() => navigate(`/user/sessions/${session.id}`)}
                            >
                                <div className="us-card-accent" />
                                <div className="us-card-top">
                                    <div className="us-card-top-row">
                                        <div className="us-card-top-meta">
                                            <span className={`us-type-badge ${TYPE_MAP[session.type] || ""}`}>
                                                {session.type}
                                            </span>
                                            <span className={`us-status-dot us-status-dot--${st.color}`} title={st.label} />
                                        </div>
                                        {renderSessionActions(session)}
                                    </div>
                                    <h2 className="us-card-title">{session.title}</h2>
                                    <p className="us-card-sub">Created {session.createdAt}</p>
                                </div>

                                <div className="us-card-mid">
                                    <div className="us-prog-row">
                                        <span className="us-prog-label">Signing progress</span>
                                        <span className="us-prog-count">{session.signed} / {session.total}</span>
                                    </div>
                                    <div className="us-prog-bar">
                                        <div
                                            className={`us-prog-fill us-prog-fill--${st.color}`}
                                            style={{ width: `${pct}%` }}
                                        />
                                    </div>
                                    <div className="us-avatars">
                                        {session.signatories.map((sig, i) => (
                                            <div
                                                key={i}
                                                className="us-avatar"
                                                title={`${sig.name} — ${sig.status}`}
                                                style={{ borderColor: SIG_STATUS_COLOR[sig.status] }}
                                            >
                                                {sig.initials}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="us-card-bot">
                                    <div>
                                        <div className="us-deadline">
                                            Deadline: {session.deadline}
                                        </div>
                                        {session.deadlineUrgent && session.status !== "completed" && (
                                            <span className="us-urgent-tag">Urgent</span>
                                        )}
                                        {session.status === "completed" && (
                                            <span className="us-done-tag">All signed</span>
                                        )}
                                    </div>
                                    <span className="us-open-link">
                                        {session.status === "draft" ? "Continue →" : "Open →"}
                                    </span>
                                </div>
                            </article>
                        );
                    })}
                </div>
            )}

            {/* ── LIST VIEW ── */}
            {view === "list" && filtered.length > 0 && (
                <div className="us-list-wrap">
                    <table className="us-list-table">
                        <thead>
                            <tr>
                                <th>Title</th>
                                <th>Type</th>
                                <th>Progress</th>
                                <th>Deadline</th>
                                <th>Status</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((session) => {
                                const st  = STATUS_MAP[session.status];
                                const pct = Math.round((session.signed / session.total) * 100);
                                return (
                                    <tr
                                        key={session.id}
                                        data-us-list-item
                                        className="us-list-row"
                                        onClick={() => navigate(`/user/sessions/${session.id}`)}
                                    >
                                        <td className="us-list-title">{session.title}</td>
                                        <td>
                                            <span className={`us-type-badge ${TYPE_MAP[session.type] || ""}`}>
                                                {session.type}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="us-list-prog">
                                                <div className="us-prog-bar" style={{ width: 80 }}>
                                                    <div
                                                        className={`us-prog-fill us-prog-fill--${st.color}`}
                                                        style={{ width: `${pct}%` }}
                                                    />
                                                </div>
                                                <span className="us-prog-count">{session.signed}/{session.total}</span>
                                            </div>
                                        </td>
                                        <td className={session.deadlineUrgent && session.status !== "completed" ? "us-list-urgent" : "us-list-date"}>
                                            {session.deadline}
                                        </td>
                                        <td>
                                            <span className={`us-status-pill us-status-pill--${st.color}`}>
                                                {st.label}
                                            </span>
                                        </td>
                                        <td className="us-list-action-cell">
                                            <span className="us-list-action">Open →</span>
                                            {renderSessionActions(session, true)}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {sessionModalPresence.isRendered && (
                <div
                    className={`us-modal-backdrop ${sessionModalPresence.isVisible ? "open" : "closing"}`}
                    onClick={closeSessionModal}
                >
                    <div
                        className={`us-modal us-modal--session ${sessionModalPresence.isVisible ? "open" : "closing"}`}
                        onClick={(event) => event.stopPropagation()}
                        ref={sessionModalRef}
                    >
                        <div className="us-modal-header" data-us-modal-item>
                            <div>
                                <h2>{sessionModalMode === "edit" ? "Edit Session" : "Add Session"}</h2>
                                <p>Prepare the session details and choose the primary document.</p>
                            </div>
                            <button
                                type="button"
                                className="us-modal-close"
                                onClick={closeSessionModal}
                            >
                                ×
                            </button>
                        </div>

                        <div className="us-modal-body us-modal-body--session">
                            <label className="us-field us-field--title" data-us-modal-item>
                                <span>Session Title</span>
                                <input
                                    type="text"
                                    value={sessionForm.title}
                                    onChange={(event) =>
                                        setSessionForm((prev) => ({ ...prev, title: event.target.value }))
                                    }
                                    placeholder="March Payroll Notice"
                                />
                            </label>

                            <label className="us-field us-field--type" data-us-modal-item>
                                <span>Document Type</span>
                                <select
                                    value={sessionForm.documentType}
                                    onChange={(event) =>
                                        setSessionForm((prev) => ({ ...prev, documentType: event.target.value }))
                                    }
                                >
                                    <option value="Notice">Notice</option>
                                    <option value="Memo">Memo</option>
                                    <option value="Request">Request</option>
                                    <option value="Payroll">Payroll</option>
                                    <option value="Report">Report</option>
                                </select>
                            </label>

                            <label className="us-field us-field--wide us-field--doc-panel" data-us-modal-item>
                                <span>Primary Document</span>
                                <div className="us-doc-picker">
                                    <div className="us-doc-picker-head">
                                        <strong>{systemFolder?.name || "SMCBI_DTS"}</strong>
                                        <div className="us-doc-picker-actions">
                                            <button
                                                type="button"
                                                className="us-doc-picker-refresh"
                                                onClick={() => docsQuery.refetch()}
                                                disabled={docsQuery.isFetching}
                                                aria-label="Refresh files"
                                                title="Refresh files"
                                            >
                                                <LuRefreshCcw size={14} className={docsQuery.isFetching ? "is-spinning" : ""} />
                                            </button>
                                            {systemFolder?.webViewLink && (
                                                <a
                                                    className="us-doc-picker-link"
                                                    href={systemFolder.webViewLink}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                >
                                                    <img src={FolderIcon} alt="" aria-hidden="true" />
                                                    <span>Open SMCBI_DTS</span>
                                                </a>
                                            )}
                                        </div>
                                    </div>

                                    {selectedDoc && (
                                        <div className="us-doc-picker-selected">
                                            <img src={GoogleDriveIcon} alt="" aria-hidden="true" />
                                            <div>
                                                <div className="us-doc-picker-selected-name">{selectedDoc.name}</div>
                                                <div className="us-doc-picker-selected-label">
                                                    {selectedDoc.mimeType === "application/vnd.google-apps.document"
                                                        ? "Google Doc"
                                                        : "Word document"}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="us-drive-files-grid us-drive-files-grid--modal" ref={docGridRef}>
                                        {docsQuery.isLoading && (
                                            <div className="us-doc-picker-state">Loading files...</div>
                                        )}
                                        {!docsQuery.isLoading && docsQuery.isError && (
                                            <div className="us-doc-picker-state us-doc-picker-state--error">
                                                {docsQuery.error?.response?.data?.message || "Failed to load files."}
                                            </div>
                                        )}
                                        {!docsQuery.isLoading && !docsQuery.isError && availableDocs.length === 0 && (
                                            <div className="us-doc-picker-state">No signable files found.</div>
                                        )}
                                        {!docsQuery.isLoading && !docsQuery.isError && availableDocs.map((doc) => {
                                            const isSelected = doc.id === sessionForm.googleDocFileId;
                                            const isWordSource =
                                                doc.mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
                                                doc.mimeType === "application/msword";
                                            return (
                                                <button
                                                    key={doc.id}
                                                    type="button"
                                                    data-us-doc-item
                                                    className={`us-drive-grid-card ${isSelected ? "is-selected" : ""}`}
                                                    onClick={() =>
                                                        setSessionForm((prev) => ({
                                                            ...prev,
                                                            googleDocFileId: doc.id,
                                                        }))
                                                    }
                                                    title={doc.name}
                                                >
                                                    {doc.iconLink ? (
                                                        <img
                                                            src={doc.iconLink}
                                                            alt=""
                                                            aria-hidden="true"
                                                            className="us-drive-grid-icon"
                                                        />
                                                    ) : (
                                                        <span className="us-drive-file-dot" />
                                                    )}
                                                    <span className="us-drive-grid-name">{doc.name}</span>
                                                    <span className="us-drive-grid-meta">
                                                        {isSelected ? "Selected" : (isWordSource ? "Word document" : "Google Doc")}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </label>

                            <label className="us-field us-field--deadline" data-us-modal-item>
                                <span>Deadline</span>
                                <input
                                    type="datetime-local"
                                    value={sessionForm.deadlineAt}
                                    onChange={(event) =>
                                        setSessionForm((prev) => ({ ...prev, deadlineAt: event.target.value }))
                                    }
                                />
                            </label>

                            <label className="us-field us-field--wide us-field--description" data-us-modal-item>
                                <span>Description</span>
                                <textarea
                                    rows="4"
                                    value={sessionForm.description}
                                    onChange={(event) =>
                                        setSessionForm((prev) => ({ ...prev, description: event.target.value }))
                                    }
                                    placeholder="Describe what this document session is for."
                                />
                            </label>

                            {sessionFormError && <div className="us-inline-error" data-us-modal-item>{sessionFormError}</div>}
                        </div>

                        <div className="us-modal-footer" data-us-modal-item>
                            <button
                                type="button"
                                className="us-modal-btn us-modal-btn--ghost"
                                onClick={closeSessionModal}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="us-modal-btn us-modal-btn--primary"
                                onClick={handleSessionFormSave}
                                disabled={saveSessionMutation.isPending}
                            >
                                {saveSessionMutation.isPending
                                    ? sessionModalMode === "edit" ? "Saving..." : "Creating..."
                                    : sessionModalMode === "edit" ? "Save Changes" : "Create Session"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {deleteModalPresence.isRendered && (
                <div
                    className={`us-modal-backdrop ${deleteModalPresence.isVisible ? "open" : "closing"}`}
                    onClick={closeDeleteSessionModal}
                >
                    <div
                        className={`us-modal us-modal--confirm ${deleteModalPresence.isVisible ? "open" : "closing"}`}
                        onClick={(event) => event.stopPropagation()}
                        ref={deleteModalRef}
                    >
                        <div className="us-modal-header" data-us-delete-item>
                            <div>
                                <h2>Delete Session</h2>
                                <p>Type <strong>{deleteSessionState.title}</strong> to permanently remove this session and its related records.</p>
                            </div>
                            <button type="button" className="us-modal-close" onClick={closeDeleteSessionModal}>
                                ×
                            </button>
                        </div>

                        <div className="us-modal-body us-modal-body--confirm" data-us-delete-item>
                            <label className="us-field">
                                <span>Session Name</span>
                                <input
                                    type="text"
                                    value={deleteSessionState.confirmationText}
                                    onChange={handleDeleteSessionConfirmationChange}
                                    placeholder={deleteSessionState.title}
                                    autoFocus
                                    disabled={deleteSessionMutation.isPending}
                                />
                            </label>
                        </div>

                        <div className="us-modal-footer" data-us-delete-item>
                            <button
                                type="button"
                                className="us-modal-btn us-modal-btn--ghost"
                                onClick={closeDeleteSessionModal}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="us-modal-btn us-modal-btn--danger"
                                onClick={() => deleteSessionMutation.mutate(deleteSessionState.sessionId)}
                                disabled={deleteSessionMutation.isPending || !deleteSessionConfirmationValid}
                            >
                                {deleteSessionMutation.isPending ? "Deleting..." : "Delete Session"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default UserSessions;
