import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import ReactDOM from "react-dom";
import axios from "axios";
import "../../../css/admin/admin-user-management.css";
import { theme } from "../../../utils/theme";
import { useAdminTheme } from "../context/AdminThemeContext";
import AddUserModal from "../components/User/AddUserModal";
import ConfirmActionModal from "../components/User/ConfirmActionModal";
import { FiUsers, FiUserCheck, FiUserX } from "react-icons/fi";

const IconSearch = () => (
    <svg
        className="um-search-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
);

const IconEdit = () => (
    <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
);

const IconDisable = () => (
    <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        <circle cx="12" cy="12" r="10" />
        <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
    </svg>
);

const IconActivate = () => (
    <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        <polyline points="20 6 9 17 4 12" />
    </svg>
);

const IconDelete = () => (
    <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
        <path d="M10 11v6M14 11v6" />
        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
);

const IconUsers = () => (
    <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
);

const IconFilter = () => (
    <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
);

const IconChevronRight = () => (
    <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        <polyline points="9 18 15 12 9 6" />
    </svg>
);

const getInitials = (name = "") => {
    const parts = name.trim().split(" ");
    if (parts.length === 1) return parts[0][0]?.toUpperCase() || "?";
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

/* ─────────────────────────────────────────────────────────────────
   Portal-based Filter Popover
   Supports hover + click to open submenu.
   Renders into document.body so it's never clipped by table overflow.
───────────────────────────────────────────────────────────────── */
function FilterPortal({
    triggerRef,
    isOpen,
    themeMode,
    portalThemeStyle,
    activeFilterMenu,
    roleFilter,
    departmentFilter,
    statusFilter,
    roleOptions,
    departmentMenu,
    statusOptions,
    onSubmenuOpen,
    onFilterOptionClick,
    onClose,
}) {
    const mainPopoverRef = useRef(null);
    const submenuRef = useRef(null);
    const [pos, setPos] = useState({ top: 0, left: 0 });
    const [submenuPos, setSubmenuPos] = useState({ top: 0, left: 0 });

    // Hover intent timer — small delay so moving between popover → submenu doesn't flicker
    const hoverTimer = useRef(null);

    const recalc = useCallback(() => {
        if (!triggerRef.current || !mainPopoverRef.current) return;
        const rect = triggerRef.current.getBoundingClientRect();
        const POPOVER_WIDTH = 240;
        const popoverHeight = mainPopoverRef.current.offsetHeight;
        const GAP = 8;

        const finalTop = rect.top + window.scrollY - popoverHeight - GAP;
        const finalLeft = rect.right + window.scrollX - POPOVER_WIDTH;
        setPos({ top: finalTop, left: finalLeft });
    }, [triggerRef]);

    // Initial position calculation (before we know the height)
    useEffect(() => {
        if (!isOpen) return;
        // Run once after render so offsetHeight is available
        const id = requestAnimationFrame(() => recalc());
        window.addEventListener("scroll", recalc, true);
        window.addEventListener("resize", recalc);
        return () => {
            cancelAnimationFrame(id);
            window.removeEventListener("scroll", recalc, true);
            window.removeEventListener("resize", recalc);
        };
    }, [isOpen, recalc]);

    // Recalc when content changes (e.g. submenu opens/closes changes nothing here but keep reactive)
    useEffect(() => {
        recalc();
    }, [activeFilterMenu, recalc]);

    // Position submenu to the LEFT of the main popover
    useEffect(() => {
        if (!activeFilterMenu || !mainPopoverRef.current) return;
        const mainRect = mainPopoverRef.current.getBoundingClientRect();
        const SUBMENU_WIDTH = 220;
        const GAP = 8;

        setSubmenuPos({
            top: mainRect.top + window.scrollY,
            left: mainRect.left + window.scrollX - SUBMENU_WIDTH - GAP,
        });
    }, [activeFilterMenu, pos]);

    // Click-outside to close
    useEffect(() => {
        if (!isOpen) return;
        const handler = (e) => {
            const clickedMain = mainPopoverRef.current?.contains(e.target);
            const clickedSub = submenuRef.current?.contains(e.target);
            const clickedTrigger = triggerRef.current?.contains(e.target);
            if (!clickedMain && !clickedSub && !clickedTrigger) {
                onClose();
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [isOpen, onClose, triggerRef]);

    // Hover handlers with a small intent delay to prevent flicker
    const handleRowMouseEnter = useCallback((key) => {
        clearTimeout(hoverTimer.current);
        hoverTimer.current = setTimeout(() => {
            onSubmenuOpen(key);
        }, 80);
    }, [onSubmenuOpen]);

    const handleRowMouseLeave = useCallback(() => {
        clearTimeout(hoverTimer.current);
    }, []);

    // When leaving the entire popover+submenu area, close the submenu
    const handleMainLeave = useCallback((e) => {
        // Check if we're moving into the submenu
        const toElement = e.relatedTarget;
        if (submenuRef.current?.contains(toElement)) return;
        clearTimeout(hoverTimer.current);
        hoverTimer.current = setTimeout(() => {
            onSubmenuOpen(null);
        }, 120);
    }, [onSubmenuOpen]);

    const handleSubmenuEnter = useCallback(() => {
        clearTimeout(hoverTimer.current);
    }, []);

    const handleSubmenuLeave = useCallback((e) => {
        const toElement = e.relatedTarget;
        if (mainPopoverRef.current?.contains(toElement)) return;
        clearTimeout(hoverTimer.current);
        hoverTimer.current = setTimeout(() => {
            onSubmenuOpen(null);
        }, 120);
    }, [onSubmenuOpen]);

    if (!isOpen) return null;

    const getSubmenuOptions = () => {
        if (activeFilterMenu === "role")       return { title: "Role",       options: roleOptions,   selected: roleFilter,       type: "role" };
        if (activeFilterMenu === "department") return { title: "Department", options: departmentMenu, selected: departmentFilter,  type: "department" };
        if (activeFilterMenu === "status")     return { title: "Status",     options: statusOptions, selected: statusFilter,      type: "status" };
        return null;
    };

    const submenuData = getSubmenuOptions();

    const filterRows = [
        { key: "role",       label: "Role",       value: roleFilter },
        { key: "department", label: "Department",  value: departmentFilter },
        { key: "status",     label: "Status",      value: statusFilter },
    ];

    return ReactDOM.createPortal(
        <>
            {/* ── Main filter popover ── */}
            <div
                ref={mainPopoverRef}
                className={`um-filter-popover um-filter-popover--portal mode-${themeMode}`}
                style={{
                    position: "absolute",
                    top: pos.top,
                    left: pos.left,
                    zIndex: 9999,
                    ...portalThemeStyle,
                }}
                onMouseLeave={handleMainLeave}
            >
                {filterRows.map((item) => (
                    <button
                        key={item.key}
                        type="button"
                        className={`um-filter-section-btn ${activeFilterMenu === item.key ? "active" : ""}`}
                        onClick={() => onSubmenuOpen(activeFilterMenu === item.key ? null : item.key)}
                        onMouseEnter={() => handleRowMouseEnter(item.key)}
                        onMouseLeave={handleRowMouseLeave}
                    >
                        <span className="um-filter-section-label">{item.label}</span>
                        <span className="um-filter-current-value">{item.value}</span>
                        <span className="um-filter-arrow">
                            <IconChevronRight />
                        </span>
                    </button>
                ))}
            </div>

            {/* ── Submenu — positioned to the LEFT of the main popover ── */}
            {submenuData && (
                <div
                    ref={submenuRef}
                    className={`um-filter-submenu um-filter-submenu--portal mode-${themeMode}`}
                    style={{
                        position: "absolute",
                        top: submenuPos.top,
                        left: submenuPos.left,
                        zIndex: 9999,
                        ...portalThemeStyle,
                    }}
                    onMouseEnter={handleSubmenuEnter}
                    onMouseLeave={handleSubmenuLeave}
                >
                    <div className="um-filter-submenu-title">{submenuData.title}</div>
                    <div className="um-filter-option-list">
                        {submenuData.options.map((option) => (
                            <button
                                key={option}
                                type="button"
                                className={`um-filter-option-btn ${submenuData.selected === option ? "selected" : ""}`}
                                onClick={() => {
                                    onFilterOptionClick(submenuData.type, option);
                                    onClose();
                                }}
                            >
                                {option}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </>,
        document.body
    );
}

function AdminUserManagement() {
    const { activeTheme, themeMode } = useAdminTheme();
    const activeColors = activeTheme.colors;

    const [isUserModalOpen, setIsUserModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState("add");
    const [selectedUser, setSelectedUser] = useState(null);

    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [confirmActionType, setConfirmActionType] = useState("");
    const [actionUser, setActionUser] = useState(null);

    const [search, setSearch] = useState("");
    const [roleFilter, setRoleFilter] = useState("All");
    const [departmentFilter, setDepartmentFilter] = useState("All");
    const [statusFilter, setStatusFilter] = useState("All");
    const [currentPage, setCurrentPage] = useState(1);

    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [activeFilterMenu, setActiveFilterMenu] = useState(null);

    const [users, setUsers] = useState([]);
    const [departments, setDepartments] = useState([]);

    const [loadingUsers, setLoadingUsers] = useState(true);
    const [loadingDepartments, setLoadingDepartments] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [actionSubmitting, setActionSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");

    const USERS_PER_PAGE = 10;

    const filterTriggerRef = useRef(null);

    const roleOptions = [
        "All",
        "Faculty",
        "Staff",
        "Instructor",
        "Cashier",
        "Registrar",
        "President",
    ];

    const statusOptions = ["All", "Active", "Inactive"];

    const pageStyle = {
        "--um-page-bg": activeColors.background,
        "--um-surface": activeColors.surface,
        "--um-panel": activeColors.panel,
        "--um-card": activeColors.card,
        "--um-primary-dark": activeColors.primaryDark,
        "--um-primary": activeColors.primary,
        "--um-accent": activeColors.accent,
        "--um-border": activeColors.border,
        "--um-border-hover": activeColors.borderHover,
        "--um-white": activeColors.white,
        "--um-black": activeColors.black,
        "--um-text": activeColors.text,
        "--um-text-muted": activeColors.textMuted,
        "--um-hint": activeColors.hint,
        "--um-blue-tint": activeColors.blueTint,
        "--um-teal-tint": activeColors.tealTint,
        "--um-font": theme.fonts.primary,
        "--um-radius-sm": theme.radius.sm,
        "--um-radius-md": theme.radius.md,
        "--um-radius-lg": theme.radius.lg,
        "--um-shadow": activeTheme.shadows.card,
    };

    const isPageLoading = loadingUsers || loadingDepartments;

    useEffect(() => {
        const fetchDepartments = async () => {
            try {
                setLoadingDepartments(true);
                const response = await axios.get(
                    "http://127.0.0.1:8000/api/admin/departments",
                    { headers: { Accept: "application/json" } }
                );
                if (response.data.success) {
                    setDepartments(response.data.departments || []);
                }
            } catch (error) {
                console.error("Failed to fetch departments:", error);
                setErrorMessage("Failed to load departments.");
            } finally {
                setLoadingDepartments(false);
            }
        };

        const fetchUsers = async () => {
            try {
                setLoadingUsers(true);
                const response = await axios.get(
                    "http://127.0.0.1:8000/api/admin/users",
                    { headers: { Accept: "application/json" } }
                );
                if (response.data.success) {
                    setUsers(response.data.users || []);
                }
            } catch (error) {
                console.error("Failed to fetch users:", error);
                setErrorMessage("Failed to load users.");
            } finally {
                setLoadingUsers(false);
            }
        };

        fetchDepartments();
        fetchUsers();
    }, []);

    useEffect(() => {
        setCurrentPage(1);
    }, [search, roleFilter, departmentFilter, statusFilter]);

    const filteredUsers = useMemo(() => {
        return users.filter((user) => {
            const matchesSearch =
                user.name.toLowerCase().includes(search.toLowerCase()) ||
                user.email.toLowerCase().includes(search.toLowerCase());
            const matchesRole = roleFilter === "All" || user.role === roleFilter;
            const matchesDepartment =
                departmentFilter === "All" || user.department === departmentFilter;
            const matchesStatus =
                statusFilter === "All" || user.status === statusFilter;
            return matchesSearch && matchesRole && matchesDepartment && matchesStatus;
        });
    }, [users, search, roleFilter, departmentFilter, statusFilter]);

    const totalPages = Math.max(1, Math.ceil(filteredUsers.length / USERS_PER_PAGE));

    const paginatedUsers = useMemo(() => {
        const startIndex = (currentPage - 1) * USERS_PER_PAGE;
        return filteredUsers.slice(startIndex, startIndex + USERS_PER_PAGE);
    }, [filteredUsers, currentPage]);

    const buildFieldError = (error) => {
        const fieldErrors = {};
        if (error.response?.data?.errors) {
            Object.entries(error.response.data.errors).forEach(([field, messages]) => {
                fieldErrors[field] = Array.isArray(messages) ? messages[0] : messages;
            });
        }
        const message =
            error.response?.data?.message ||
            Object.values(fieldErrors)[0] ||
            "Failed to save user.";
        const enhancedError = new Error(message);
        enhancedError.fieldErrors = fieldErrors;
        return enhancedError;
    };

    const handleOpenAddModal = () => {
        setModalMode("add");
        setSelectedUser(null);
        setIsUserModalOpen(true);
    };

    const handleOpenEditModal = (user) => {
        setModalMode("edit");
        setSelectedUser(user);
        setIsUserModalOpen(true);
    };

    const handleCloseUserModal = () => {
        setIsUserModalOpen(false);
        setSelectedUser(null);
    };

    const handleOpenStatusModal = (user) => {
        setActionUser(user);
        setConfirmActionType("toggleStatus");
        setIsConfirmModalOpen(true);
    };

    const handleOpenDeleteModal = (user) => {
        setActionUser(user);
        setConfirmActionType("delete");
        setIsConfirmModalOpen(true);
    };

    const handleCloseConfirmModal = () => {
        setIsConfirmModalOpen(false);
        setConfirmActionType("");
        setActionUser(null);
    };

    const handleSaveUser = async (userPayload) => {
        try {
            setSubmitting(true);
            setErrorMessage("");

            if (modalMode === "edit" && selectedUser?.id) {
                const response = await axios.put(
                    `http://127.0.0.1:8000/api/admin/users/${selectedUser.id}`,
                    userPayload,
                    { headers: { Accept: "application/json", "Content-Type": "application/json" } }
                );
                if (response.data.success) {
                    setUsers((prev) =>
                        prev.map((u) => (u.id === selectedUser.id ? response.data.user : u))
                    );
                    setIsUserModalOpen(false);
                    setSelectedUser(null);
                }
                return;
            }

            const response = await axios.post(
                "http://127.0.0.1:8000/api/admin/users",
                userPayload,
                { headers: { Accept: "application/json", "Content-Type": "application/json" } }
            );
            if (response.data.success) {
                setUsers((prev) => [response.data.user, ...prev]);
                setIsUserModalOpen(false);
                setSelectedUser(null);
            }
        } catch (error) {
            console.error("Failed to save user:", error);
            throw buildFieldError(error);
        } finally {
            setSubmitting(false);
        }
    };

    const handleConfirmAction = async () => {
        if (!actionUser) return;
        try {
            setActionSubmitting(true);
            setErrorMessage("");

            if (confirmActionType === "toggleStatus") {
                const response = await axios.patch(
                    `http://127.0.0.1:8000/api/admin/users/${actionUser.id}/status`,
                    {},
                    { headers: { Accept: "application/json", "Content-Type": "application/json" } }
                );
                if (response.data.success) {
                    setUsers((prev) =>
                        prev.map((u) => (u.id === actionUser.id ? response.data.user : u))
                    );
                }
            }

            if (confirmActionType === "delete") {
                const response = await axios.delete(
                    `http://127.0.0.1:8000/api/admin/users/${actionUser.id}`,
                    { headers: { Accept: "application/json" } }
                );
                if (response.data.success) {
                    setUsers((prev) => prev.filter((u) => u.id !== actionUser.id));
                }
            }

            handleCloseConfirmModal();
        } catch (error) {
            console.error("Failed to process user action:", error);
            setErrorMessage(error.response?.data?.message || "Failed to process user action.");
        } finally {
            setActionSubmitting(false);
        }
    };

    const getConfirmModalConfig = () => {
        if (!actionUser) {
            return {
                title: "Confirm Action",
                message: "",
                confirmText: "Confirm",
                confirmVariant: "delete",
                highlightText: "",
            };
        }

        if (confirmActionType === "delete") {
            return {
                title: "Delete User",
                message: `Are you sure you want to permanently delete ${actionUser.name}? This action cannot be undone.`,
                confirmText: "Delete User",
                confirmVariant: "delete",
                highlightText: actionUser.name,
            };
        }

        if (confirmActionType === "toggleStatus") {
            return actionUser.status === "Active"
                ? {
                      title: "Disable User",
                      message: `Are you sure you want to disable ${actionUser.name}? This user will no longer be able to actively use the system until reactivated.`,
                      confirmText: "Disable User",
                      confirmVariant: "disable",
                      highlightText: actionUser.name,
                  }
                : {
                      title: "Activate User",
                      message: `Are you sure you want to activate ${actionUser.name}? This user will regain active access to the system.`,
                      confirmText: "Activate User",
                      confirmVariant: "success",
                      highlightText: actionUser.name,
                  };
        }

        return {
            title: "Confirm Action",
            message: "",
            confirmText: "Confirm",
            confirmVariant: "delete",
            highlightText: "",
        };
    };

    const toggleFilterPopover = () => {
        setIsFilterOpen((prev) => {
            if (prev) setActiveFilterMenu(null);
            return !prev;
        });
    };

    const handleFilterOptionClick = (type, value) => {
        if (type === "role")       setRoleFilter(value);
        if (type === "department") setDepartmentFilter(value);
        if (type === "status")     setStatusFilter(value);
    };

    const handleCloseFilter = useCallback(() => {
        setIsFilterOpen(false);
        setActiveFilterMenu(null);
    }, []);

    const roleMenu = roleOptions;
    const departmentMenu = ["All", ...departments.map((d) => d.name)];
    const confirmModalConfig = getConfirmModalConfig();

    const totalUsers = users.length;
    const activeUsers = users.filter((u) => u.status === "Active").length;
    const inactiveUsers = users.filter((u) => u.status === "Inactive").length;

    if (isPageLoading) {
        return (
            <div className="admin-user-management-page" style={pageStyle}>
                <div className="um-header-card">
                    <div className="um-header-main">
                        <div className="um-header-top">
                            <div className="um-header-left">
                                <div className="um-breadcrumb-skeleton">
                                    <div className="um-skeleton title"></div>
                                </div>
                                <div className="um-header-copy">
                                    <div className="um-skeleton title"></div>
                                    <div className="um-skeleton subtitle"></div>
                                </div>
                            </div>
                            <div className="um-header-actions">
                                <div className="um-skeleton button"></div>
                                <div className="um-skeleton input"></div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="um-stat-skeleton-grid">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="um-stat-skeleton-card">
                            <div className="um-skeleton avatar"></div>
                            <div className="um-stat-skeleton-content">
                                <div className="um-skeleton text-lg"></div>
                                <div className="um-skeleton text-md"></div>
                                <div className="um-skeleton text-md" style={{ width: "80%" }}></div>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="um-table-card">
                    <div className="um-table-wrap">
                        <table className="um-user-table">
                            <thead>
                                <tr>
                                    {Array.from({ length: 6 }).map((_, i) => (
                                        <th key={i}>
                                            <div className="um-skeleton dark header-cell"></div>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {Array.from({ length: 6 }).map((_, rowIndex) => (
                                    <tr key={rowIndex}>
                                        <td>
                                            <div className="um-table-skeleton-avatar-cell">
                                                <div className="um-skeleton avatar"></div>
                                                <div className="um-skeleton text-lg" style={{ flex: 1 }}></div>
                                            </div>
                                        </td>
                                        <td><div className="um-skeleton text-md"></div></td>
                                        <td><div className="um-skeleton badge"></div></td>
                                        <td><div className="um-skeleton badge"></div></td>
                                        <td><div className="um-skeleton badge"></div></td>
                                        <td><div className="um-skeleton actions"></div></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="admin-user-management-page" style={pageStyle}>
            <section className="um-header-card">
                <div className="um-header-main">
                    <div className="um-header-top">
                        <div className="um-header-left">
                            <nav className="um-breadcrumb">
                                <a href="/admin/dashboard" className="um-breadcrumb-link">
                                    Admin
                                </a>
                                <span className="um-breadcrumb-sep">/</span>
                                <span className="um-breadcrumb-current">User Management</span>
                            </nav>

                            <div className="um-header-copy">
                                <h1 className="admin-page-title">User Management</h1>
                                <p className="um-header-description">
                                    Manage authorized school personnel accounts and control system
                                    access through a centralized admin workflow.
                                </p>
                            </div>
                        </div>

                        <div className="um-header-actions">
                            <button
                                type="button"
                                className="um-add-user-btn"
                                onClick={handleOpenAddModal}
                            >
                                + Add User
                            </button>

                            <div className="um-header-search-wrap">
                                <div className="um-search-wrapper">
                                    <IconSearch />
                                    <input
                                        id="um-search"
                                        type="text"
                                        className="um-search-input"
                                        placeholder="Search by name or email…"
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section className="um-stat-cards-row">
                <div className="um-stat-card total">
                    <div className="um-stat-icon-wrap total">
                        <FiUsers size={18} />
                    </div>
                    <div className="um-stat-info">
                        <span className="um-stat-number">{totalUsers}</span>
                        <span className="um-stat-label">Total Users</span>
                        <span className="um-stat-subtext">All registered personnel accounts</span>
                    </div>
                </div>

                <div className="um-stat-card active">
                    <div className="um-stat-icon-wrap active">
                        <FiUserCheck size={18} />
                    </div>
                    <div className="um-stat-info">
                        <span className="um-stat-number">{activeUsers}</span>
                        <span className="um-stat-label">Active</span>
                        <span className="um-stat-subtext">Currently allowed to access</span>
                    </div>
                </div>

                <div className="um-stat-card inactive">
                    <div className="um-stat-icon-wrap inactive">
                        <FiUserX size={18} />
                    </div>
                    <div className="um-stat-info">
                        <span className="um-stat-number">{inactiveUsers}</span>
                        <span className="um-stat-label">Inactive</span>
                        <span className="um-stat-subtext">Temporarily disabled accounts</span>
                    </div>
                </div>
            </section>

            {errorMessage && <div className="um-error-banner">{errorMessage}</div>}

            <section className="um-table-card">
                <div className="um-table-wrap">
                    <table className="um-user-table">
                        <thead>
                            <tr>
                                <th className="um-th-first">Full Name</th>
                                <th>Email</th>
                                <th>Role</th>
                                <th>Department</th>
                                <th>Status</th>
                                <th className="um-th-last">
                                    <div className="um-actions-header-inline">
                                        <span>Actions</span>
                                        <button
                                            ref={filterTriggerRef}
                                            type="button"
                                            className={`um-filter-trigger ${isFilterOpen ? "active" : ""}`}
                                            onClick={toggleFilterPopover}
                                        >
                                            <IconFilter />
                                            <span>Filter</span>
                                        </button>
                                    </div>
                                </th>
                            </tr>
                        </thead>

                        <tbody>
                            {paginatedUsers.length > 0 ? (
                                paginatedUsers.map((user) => (
                                    <tr key={user.id}>
                                        <td>
                                            <div className="um-user-cell">
                                                <div className="um-user-avatar">
                                                    {getInitials(user.name)}
                                                </div>
                                                <span className="um-user-name-text">{user.name}</span>
                                            </div>
                                        </td>
                                        <td className="um-user-email">{user.email}</td>
                                        <td>
                                            <span className="um-role-pill">{user.role}</span>
                                        </td>
                                        <td>
                                            <span className="um-dept-pill">{user.department}</span>
                                        </td>
                                        <td>
                                            <span
                                                className={`um-status-badge ${
                                                    user.status === "Active" ? "active" : "inactive"
                                                }`}
                                            >
                                                {user.status}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="um-action-group">
                                                <button
                                                    type="button"
                                                    className="um-action-btn edit"
                                                    onClick={() => handleOpenEditModal(user)}
                                                    title="Edit user"
                                                >
                                                    <IconEdit /> Edit
                                                </button>

                                                <button
                                                    type="button"
                                                    className={`um-action-btn toggle${
                                                        user.status !== "Active" ? " activate" : ""
                                                    }`}
                                                    onClick={() => handleOpenStatusModal(user)}
                                                    title={
                                                        user.status === "Active"
                                                            ? "Disable user"
                                                            : "Activate user"
                                                    }
                                                >
                                                    {user.status === "Active" ? (
                                                        <><IconDisable /> Disable</>
                                                    ) : (
                                                        <><IconActivate /> Activate</>
                                                    )}
                                                </button>

                                                <button
                                                    type="button"
                                                    className="um-action-btn delete"
                                                    onClick={() => handleOpenDeleteModal(user)}
                                                    title="Delete user"
                                                >
                                                    <IconDelete /> Delete
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="6" className="um-empty-state">
                                        <div className="um-empty-inner">
                                            <div className="um-empty-icon">
                                                <IconUsers />
                                            </div>
                                            <strong>No users found</strong>
                                            <span>
                                                Try adjusting the search or filter options to find
                                                matching user records.
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {filteredUsers.length > 0 && (
                    <div className="um-pagination">
                        <div className="um-pagination-info">
                            Page {currentPage} of {totalPages}
                        </div>

                        <div className="um-pagination-controls">
                            <button
                                type="button"
                                className="um-pagination-btn"
                                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                                disabled={currentPage === 1}
                            >
                                Previous
                            </button>

                            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                                <button
                                    key={page}
                                    type="button"
                                    className={`um-pagination-btn ${currentPage === page ? "active" : ""}`}
                                    onClick={() => setCurrentPage(page)}
                                >
                                    {page}
                                </button>
                            ))}

                            <button
                                type="button"
                                className="um-pagination-btn"
                                onClick={() =>
                                    setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                                }
                                disabled={currentPage === totalPages}
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </section>

            {/* Portal-based filter — renders into document.body, never clipped */}
            <FilterPortal
                triggerRef={filterTriggerRef}
                isOpen={isFilterOpen}
                themeMode={themeMode}
                portalThemeStyle={pageStyle}
                activeFilterMenu={activeFilterMenu}
                roleFilter={roleFilter}
                departmentFilter={departmentFilter}
                statusFilter={statusFilter}
                roleOptions={roleMenu}
                departmentMenu={departmentMenu}
                statusOptions={statusOptions}
                onSubmenuOpen={setActiveFilterMenu}
                onFilterOptionClick={handleFilterOptionClick}
                onClose={handleCloseFilter}
            />

            <AddUserModal
                isOpen={isUserModalOpen}
                mode={modalMode}
                initialData={selectedUser}
                onClose={handleCloseUserModal}
                onSave={handleSaveUser}
                departments={departments}
                loadingDepartments={loadingDepartments}
                submitting={submitting}
            />

            <ConfirmActionModal
                isOpen={isConfirmModalOpen}
                onClose={handleCloseConfirmModal}
                onConfirm={handleConfirmAction}
                title={confirmModalConfig.title}
                message={confirmModalConfig.message}
                highlightText={confirmModalConfig.highlightText}
                confirmText={confirmModalConfig.confirmText}
                confirmVariant={confirmModalConfig.confirmVariant}
                submitting={actionSubmitting}
            />
        </div>
    );
}

export default AdminUserManagement;
