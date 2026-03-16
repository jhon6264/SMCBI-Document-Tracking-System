import React, { useEffect, useMemo, useState } from "react";
import "../../../css/admin/admin-layout.css";
import { theme } from "../../../utils/theme";
import SchoolLogo from "../../assets/images/schoollogo.png";

import { RxDashboard } from "react-icons/rx";
import { GrUserAdmin } from "react-icons/gr";
import { FaRegUser } from "react-icons/fa";
import { TbLayoutSidebarRight } from "react-icons/tb";
import { LuMessageCircle, LuSettings } from "react-icons/lu";
import { MdOutlineLogout } from "react-icons/md";
import { HiOutlineUserCircle } from "react-icons/hi2";

function AdminLayout({ children, unreadMessages = 0 }) {
    const [collapsed, setCollapsed] = useState(() => {
        return localStorage.getItem("admin_sidebar_collapsed") === "true";
    });

    const currentPath = window.location.pathname;

    const adminData = useMemo(() => {
        try {
            return JSON.parse(localStorage.getItem("admin_data")) || {};
        } catch {
            return {};
        }
    }, []);

    const adminName = adminData?.name || "Admin";
    const adminRole = adminData?.role || "Administrator";

    useEffect(() => {
        localStorage.setItem("admin_sidebar_collapsed", String(collapsed));
    }, [collapsed]);

    const navItems = [
        {
            label: "Dashboard",
            icon: <RxDashboard />,
            path: "/admin/dashboard",
        },
        {
            label: "Admin Management",
            icon: <GrUserAdmin />,
            path: "/admin/admin-management",
        },
        {
            label: "User Management",
            icon: <FaRegUser />,
            path: "/admin/user-management",
        },
    ];

    const accountItems = [
        {
            label: "Messages",
            icon: <LuMessageCircle />,
            path: "/admin/messages",
            badge: unreadMessages,
        },
        {
            label: "Settings",
            icon: <LuSettings />,
            path: "/admin/settings",
        },
    ];

    const handleNavigate = (path) => {
        window.location.href = path;
    };

    const handleLogout = () => {
        localStorage.removeItem("admin_token");
        localStorage.removeItem("admin_data");
        window.location.href = "/";
    };

    const pageStyle = {
        "--bg-color": theme.colors.background,
        "--sidebar-color": theme.colors.primaryDark || "#0d4ea8",
        "--border-color": theme.colors.border,
        "--primary-color": theme.colors.primary,
        "--primary-dark-color": theme.colors.primaryDark || "#0d4ea8",
        "--accent-color": theme.colors.accent,
        "--text-color": theme.colors.text,
        "--white-color": theme.colors.white,
        "--font-primary": theme.fonts.primary,
        "--sidebar-shadow": theme.shadows.card,
        "--radius-md": theme.radius.md,
        "--radius-lg": theme.radius.lg,
    };

    const renderNavItem = (item) => {
        const active = currentPath === item.path;

        return (
            <button
                key={item.label}
                className={`admin-nav-item ${active ? "active" : ""}`}
                onClick={() => handleNavigate(item.path)}
                title={collapsed ? item.label : ""}
                type="button"
            >
                <div className="nav-left">
                    <span className="nav-icon">{item.icon}</span>
                    {!collapsed && <span className="nav-text">{item.label}</span>}
                </div>

                {!collapsed && item.badge > 0 && (
                    <span className="nav-badge">{item.badge}</span>
                )}

                {collapsed && item.badge > 0 && (
                    <span className="nav-badge nav-badge-collapsed">{item.badge}</span>
                )}
            </button>
        );
    };

    return (
        <div className={`admin-layout ${collapsed ? "collapsed" : ""}`} style={pageStyle}>
            <aside className="admin-sidebar">
                <div className="sidebar-top">
                    <div className="sidebar-brand">
                        {!collapsed ? (
                            <div className="brand-left">
                                <div className="brand-logo">
                                    <img
                                        src={SchoolLogo}
                                        alt="SMCBI Logo"
                                        className="brand-logo-image"
                                    />
                                </div>

                                <div className="brand-text">
                                    <h1>SMCBI</h1>
                                    <p>Document System</p>
                                </div>
                            </div>
                        ) : (
                            <div className="brand-left brand-left-collapsed" />
                        )}

                        <button
                            className="sidebar-toggle"
                            onClick={() => setCollapsed((prev) => !prev)}
                            type="button"
                            title={collapsed ? "Open sidebar" : "Collapse sidebar"}
                        >
                            <TbLayoutSidebarRight />
                        </button>
                    </div>

                    <div className="sidebar-section">
                        {!collapsed && <p className="sidebar-label">Overview</p>}

                        <div className="nav-list">
                            {navItems.map(renderNavItem)}
                        </div>
                    </div>

                    <div className="sidebar-section">
                        {!collapsed && <p className="sidebar-label">Account</p>}

                        <div className="nav-list">
                            {accountItems.map(renderNavItem)}
                        </div>
                    </div>
                </div>

                <div className="sidebar-footer">
                    <div className="admin-profile">
                        <div className="user-icon">
                            <HiOutlineUserCircle />
                        </div>

                        {!collapsed && (
                            <div className="profile-text">
                                <p className="profile-name">{adminName}</p>
                                <p className="profile-role">{adminRole}</p>
                            </div>
                        )}
                    </div>

                    <button className="logout-btn" onClick={handleLogout} type="button">
                        <MdOutlineLogout />
                        {!collapsed && <span>Logout</span>}
                    </button>
                </div>
            </aside>

            <main className="admin-main">{children}</main>
        </div>
    );
}

export default AdminLayout;