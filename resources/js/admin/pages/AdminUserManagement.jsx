import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import "../../../css/admin/admin-user-management.css";
import { theme } from "../../../utils/theme";
import AddUserModal from "../components/User/AddUserModal";
import ConfirmActionModal from "../components/User/ConfirmActionModal";

function AdminUserManagement() {
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

    const [users, setUsers] = useState([]);
    const [departments, setDepartments] = useState([]);

    const [loadingUsers, setLoadingUsers] = useState(true);
    const [loadingDepartments, setLoadingDepartments] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [actionSubmitting, setActionSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");

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
        "--um-primary-dark": theme.colors.primaryDark || "#0d4ea8",
        "--um-primary": theme.colors.primary,
        "--um-accent": theme.colors.accent,
        "--um-border": theme.colors.border,
        "--um-white": theme.colors.white,
        "--um-text": theme.colors.text,
        "--um-font": theme.fonts.primary,
        "--um-radius-md": theme.radius.md,
        "--um-radius-lg": theme.radius.lg,
        "--um-shadow": theme.shadows.card,
    };

    const isPageLoading = loadingUsers || loadingDepartments;

    const fetchDepartments = async () => {
        try {
            setLoadingDepartments(true);

            const response = await axios.get(
                "http://127.0.0.1:8000/api/admin/departments",
                {
                    headers: {
                        Accept: "application/json",
                    },
                }
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
                {
                    headers: {
                        Accept: "application/json",
                    },
                }
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

    useEffect(() => {
        fetchDepartments();
        fetchUsers();
    }, []);

    const filteredUsers = useMemo(() => {
        return users.filter((user) => {
            const matchesSearch =
                user.name.toLowerCase().includes(search.toLowerCase()) ||
                user.email.toLowerCase().includes(search.toLowerCase());

            const matchesRole =
                roleFilter === "All" || user.role === roleFilter;

            const matchesDepartment =
                departmentFilter === "All" || user.department === departmentFilter;

            const matchesStatus =
                statusFilter === "All" || user.status === statusFilter;

            return (
                matchesSearch &&
                matchesRole &&
                matchesDepartment &&
                matchesStatus
            );
        });
    }, [users, search, roleFilter, departmentFilter, statusFilter]);

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
                    {
                        headers: {
                            Accept: "application/json",
                            "Content-Type": "application/json",
                        },
                    }
                );

                if (response.data.success) {
                    setUsers((prevUsers) =>
                        prevUsers.map((user) =>
                            user.id === selectedUser.id ? response.data.user : user
                        )
                    );
                    setIsUserModalOpen(false);
                    setSelectedUser(null);
                }

                return;
            }

            const response = await axios.post(
                "http://127.0.0.1:8000/api/admin/users",
                userPayload,
                {
                    headers: {
                        Accept: "application/json",
                        "Content-Type": "application/json",
                    },
                }
            );

            if (response.data.success) {
                setUsers((prevUsers) => [response.data.user, ...prevUsers]);
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
        if (!actionUser) {
            return;
        }

        try {
            setActionSubmitting(true);
            setErrorMessage("");

            if (confirmActionType === "toggleStatus") {
                const response = await axios.patch(
                    `http://127.0.0.1:8000/api/admin/users/${actionUser.id}/status`,
                    {},
                    {
                        headers: {
                            Accept: "application/json",
                            "Content-Type": "application/json",
                        },
                    }
                );

                if (response.data.success) {
                    setUsers((prevUsers) =>
                        prevUsers.map((user) =>
                            user.id === actionUser.id ? response.data.user : user
                        )
                    );
                }
            }

            if (confirmActionType === "delete") {
                const response = await axios.delete(
                    `http://127.0.0.1:8000/api/admin/users/${actionUser.id}`,
                    {
                        headers: {
                            Accept: "application/json",
                        },
                    }
                );

                if (response.data.success) {
                    setUsers((prevUsers) =>
                        prevUsers.filter((user) => user.id !== actionUser.id)
                    );
                }
            }

            handleCloseConfirmModal();
        } catch (error) {
            console.error("Failed to process user action:", error);
            setErrorMessage(
                error.response?.data?.message || "Failed to process user action."
            );
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
                confirmVariant: "danger",
            };
        }

        if (confirmActionType === "delete") {
            return {
                title: "Delete User",
                message: `Are you sure you want to permanently delete ${actionUser.name}? This action cannot be undone.`,
                confirmText: "Delete User",
                confirmVariant: "danger",
            };
        }

        if (confirmActionType === "toggleStatus") {
            return actionUser.status === "Active"
                ? {
                      title: "Disable User",
                      message: `Are you sure you want to disable ${actionUser.name}? This user will no longer be able to actively use the system until reactivated.`,
                      confirmText: "Disable User",
                      confirmVariant: "danger",
                  }
                : {
                      title: "Activate User",
                      message: `Are you sure you want to activate ${actionUser.name}? This user will regain active access to the system.`,
                      confirmText: "Activate User",
                      confirmVariant: "success",
                  };
        }

        return {
            title: "Confirm Action",
            message: "",
            confirmText: "Confirm",
            confirmVariant: "danger",
        };
    };

    const confirmModalConfig = getConfirmModalConfig();

    const renderPageSkeleton = () => {
        return (
            <div className="um-page-skeleton">
                <div className="um-header-skeleton">
                    <div className="um-header-skeleton-left">
                        <div className="um-skeleton title"></div>
                        <div className="um-skeleton subtitle"></div>
                    </div>

                    <div className="um-header-skeleton-right">
                        <div className="um-skeleton button"></div>
                    </div>
                </div>

                <div className="um-skeleton-card um-filter-skeleton">
                    <div className="um-filter-skeleton-grid">
                        <div className="um-filter-group um-search-group">
                            <div className="um-skeleton label"></div>
                            <div className="um-skeleton input"></div>
                        </div>

                        <div className="um-filter-group">
                            <div className="um-skeleton label"></div>
                            <div className="um-skeleton input"></div>
                        </div>

                        <div className="um-filter-group">
                            <div className="um-skeleton label"></div>
                            <div className="um-skeleton input"></div>
                        </div>

                        <div className="um-filter-group">
                            <div className="um-skeleton label"></div>
                            <div className="um-skeleton input"></div>
                        </div>
                    </div>
                </div>

                <div className="um-skeleton-card um-table-skeleton">
                    <div className="um-table-wrap">
                        <div className="um-table-skeleton-header">
                            {Array.from({ length: 6 }).map((_, index) => (
                                <div
                                    key={`header-skeleton-${index}`}
                                    className="um-table-skeleton-header-cell"
                                >
                                    <div className="um-skeleton dark header-cell"></div>
                                </div>
                            ))}
                        </div>

                        <div className="um-table-skeleton-body">
                            {Array.from({ length: 6 }).map((_, rowIndex) => (
                                <div
                                    key={`body-skeleton-${rowIndex}`}
                                    className="um-table-skeleton-row"
                                >
                                    <div className="um-table-skeleton-cell">
                                        <div className="um-skeleton text-lg"></div>
                                    </div>
                                    <div className="um-table-skeleton-cell">
                                        <div className="um-skeleton text-md"></div>
                                    </div>
                                    <div className="um-table-skeleton-cell">
                                        <div className="um-skeleton text-md"></div>
                                    </div>
                                    <div className="um-table-skeleton-cell">
                                        <div className="um-skeleton text-md"></div>
                                    </div>
                                    <div className="um-table-skeleton-cell">
                                        <div className="um-skeleton badge"></div>
                                    </div>
                                    <div className="um-table-skeleton-cell">
                                        <div className="um-skeleton actions"></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    if (isPageLoading) {
        return (
            <div className="admin-user-management-page" style={pageStyle}>
                {renderPageSkeleton()}
            </div>
        );
    }

    return (
        <div className="admin-user-management-page" style={pageStyle}>
            <div className="admin-page-header">
                <div>
                    <h1 className="admin-page-title">User Management</h1>
                    <p className="admin-page-subtitle">
                        Manage faculty, staff, and institutional user accounts.
                    </p>
                </div>

                <button
                    type="button"
                    className="um-add-user-btn"
                    onClick={handleOpenAddModal}
                >
                    + Add User
                </button>
            </div>

            {errorMessage && (
                <div
                    style={{
                        background: "rgba(239, 68, 68, 0.10)",
                        color: "#b91c1c",
                        border: "1px solid rgba(239, 68, 68, 0.20)",
                        borderRadius: "12px",
                        padding: "12px 14px",
                        fontSize: "14px",
                    }}
                >
                    {errorMessage}
                </div>
            )}

            <div className="um-filter-card">
                <div className="um-filter-grid">
                    <div className="um-filter-group um-search-group">
                        <label htmlFor="um-search">Search</label>
                        <input
                            id="um-search"
                            type="text"
                            className="um-search-input"
                            placeholder="Search user by name or email"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>

                    <div className="um-filter-group">
                        <label htmlFor="um-role-filter">Role</label>
                        <select
                            id="um-role-filter"
                            value={roleFilter}
                            onChange={(e) => setRoleFilter(e.target.value)}
                        >
                            {roleOptions.map((role) => (
                                <option key={role} value={role}>
                                    {role}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="um-filter-group">
                        <label htmlFor="um-department-filter">Department</label>
                        <select
                            id="um-department-filter"
                            value={departmentFilter}
                            onChange={(e) => setDepartmentFilter(e.target.value)}
                        >
                            <option value="All">All</option>
                            {departments.map((department) => (
                                <option key={department.name} value={department.name}>
                                    {department.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="um-filter-group">
                        <label htmlFor="um-status-filter">Status</label>
                        <select
                            id="um-status-filter"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                        >
                            {statusOptions.map((status) => (
                                <option key={status} value={status}>
                                    {status}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            <div className="um-table-card">
                <div className="um-table-wrap">
                    <table className="um-user-table">
                        <thead>
                            <tr>
                                <th>Full Name</th>
                                <th>Email</th>
                                <th>Role</th>
                                <th>Department</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredUsers.length > 0 ? (
                                filteredUsers.map((user) => (
                                    <tr key={user.id}>
                                        <td className="um-user-name">{user.name}</td>
                                        <td className="um-user-email">{user.email}</td>
                                        <td className="um-user-role">{user.role}</td>
                                        <td className="um-user-department">
                                            {user.department}
                                        </td>
                                        <td>
                                            <span
                                                className={`um-status-badge ${
                                                    user.status === "Active"
                                                        ? "active"
                                                        : "inactive"
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
                                                >
                                                    Edit
                                                </button>

                                                <button
                                                    type="button"
                                                    className="um-action-btn toggle"
                                                    onClick={() => handleOpenStatusModal(user)}
                                                >
                                                    {user.status === "Active"
                                                        ? "Disable"
                                                        : "Activate"}
                                                </button>

                                                <button
                                                    type="button"
                                                    className="um-action-btn delete"
                                                    onClick={() => handleOpenDeleteModal(user)}
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="6" className="um-empty-state">
                                        <strong>No users found</strong>
                                        <span>
                                            Try adjusting the search or filter options to find
                                            matching user records.
                                        </span>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

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
                confirmText={confirmModalConfig.confirmText}
                confirmVariant={confirmModalConfig.confirmVariant}
                submitting={actionSubmitting}
            />
        </div>
    );
}

export default AdminUserManagement;