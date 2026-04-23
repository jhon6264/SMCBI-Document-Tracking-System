import React, { useEffect, useMemo, useRef, useState } from "react";
import "../../../css/admin/admin-layout.css";
import { defaultThemeMode, theme, themeModes } from "../../../utils/theme";
import SchoolLogo from "../../assets/images/schoollogo.png";
import AdminThemeContext, {
    ADMIN_THEME_OPTIONS,
    ADMIN_THEME_STORAGE_KEY,
} from "../context/AdminThemeContext";

import { RxDashboard } from "react-icons/rx";
import { GrUserAdmin } from "react-icons/gr";
import { FaRegUser } from "react-icons/fa";
import { TbLayoutSidebarRight } from "react-icons/tb";
import { LuMessageCircle, LuSettings } from "react-icons/lu";
import { MdOutlineLogout } from "react-icons/md";
import { HiOutlineUserCircle } from "react-icons/hi2";
import { IoIosColorPalette } from "react-icons/io";
import { FiKey } from "react-icons/fi";
import { animateStaggerReveal, cleanupMotion } from "../../user/utils/animeMotion";

function AdminLayout({ children, unreadMessages = 0 }) {
    const [collapsed, setCollapsed] = useState(() => {
        return localStorage.getItem("admin_sidebar_collapsed") === "true";
    });
    const [themeMode, setThemeMode] = useState(() => {
        const savedMode = localStorage.getItem(ADMIN_THEME_STORAGE_KEY);
        return savedMode && themeModes[savedMode] ? savedMode : defaultThemeMode;
    });
    const sidebarRef = useRef(null);
    const hasSidebarMountedRef = useRef(false);

    const currentPath = window.location.pathname;
    const activeTheme = themeModes[themeMode] || themeModes[defaultThemeMode];
    const activeColors = activeTheme.colors;
    const selectedThemeLabel =
        ADMIN_THEME_OPTIONS.find((option) => option.value === themeMode)?.label || "Dark";

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

    useEffect(() => {
        localStorage.setItem(ADMIN_THEME_STORAGE_KEY, themeMode);
    }, [themeMode]);

    useEffect(() => {
        const handleStorage = (event) => {
            if (event.key !== ADMIN_THEME_STORAGE_KEY) {
                return;
            }

            const nextMode = event.newValue;
            if (nextMode && themeModes[nextMode]) {
                setThemeMode(nextMode);
            }
        };

        window.addEventListener("storage", handleStorage);
        return () => {
            window.removeEventListener("storage", handleStorage);
        };
    }, []);

    useEffect(() => {
        if (!hasSidebarMountedRef.current) {
            hasSidebarMountedRef.current = true;
            return undefined;
        }

        const motion = animateStaggerReveal(sidebarRef.current, {
            selector: "[data-al-sidebar-item]",
            duration: 560,
            staggerMs: collapsed ? 18 : 34,
            startDelayMs: 12,
        });

        if (!motion) {
            return undefined;
        }

        return () => {
            cleanupMotion(motion);
        };
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
        {
            label: "Signatories",
            icon: <FiKey />,
            path: "/admin/signatories",
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
        window.location.href = "/admin/login";
    };

    const cycleThemeMode = () => {
        const optionValues = ADMIN_THEME_OPTIONS.map((option) => option.value);
        const currentIndex = optionValues.indexOf(themeMode);

        if (currentIndex < 0) {
            setThemeMode(defaultThemeMode);
            return;
        }

        const nextIndex = (currentIndex + 1) % optionValues.length;
        setThemeMode(optionValues[nextIndex]);
    };

    const pageStyle = {
        "--bg-color": activeColors.background,
        "--sidebar-color": activeColors.panel,
        "--surface-color": activeColors.surface,
        "--panel-color": activeColors.panel,
        "--card-color": activeColors.card,
        "--border-color": activeColors.border,
        "--border-hover-color": activeColors.borderHover,
        "--primary-color": activeColors.primary,
        "--primary-dark-color": activeColors.primaryDark,
        "--accent-color": activeColors.accent,
        "--text-color": activeColors.text,
        "--text-muted-color": activeColors.textMuted,
        "--white-color": activeColors.white,
        "--hint-color": activeColors.hint,
        "--blue-tint-color": activeColors.blueTint,
        "--teal-tint-color": activeColors.tealTint,
        "--font-primary": theme.fonts.primary,
        "--sidebar-shadow": activeTheme.shadows.card,
        "--radius-md": theme.radius.md,
        "--radius-lg": theme.radius.lg,
    };

    const renderNavItem = (item) => {
        const active = currentPath === item.path;

        return (
            <button
                key={item.label}
                className={`admin-nav-item ${active ? "active" : ""}`}
                data-al-sidebar-item
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
        <AdminThemeContext.Provider value={{ themeMode, setThemeMode, activeTheme }}>
            <div
                className={`admin-layout ${collapsed ? "collapsed" : ""} mode-${themeMode}`}
                style={pageStyle}
            >
                <aside className="admin-sidebar" ref={sidebarRef}>
                    <div className="sidebar-top">
                        <div className="sidebar-brand" data-al-sidebar-item>
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
                            {!collapsed && <p className="sidebar-label" data-al-sidebar-item>Overview</p>}

                            <div className="nav-list">{navItems.map(renderNavItem)}</div>
                        </div>

                        <div className="sidebar-section">
                            {!collapsed && <p className="sidebar-label" data-al-sidebar-item>Account</p>}

                            <div className="nav-list">
                                {accountItems.map(renderNavItem)}

                                <button
                                    type="button"
                                    className="admin-nav-item admin-color-mode-trigger"
                                    data-al-sidebar-item
                                    onClick={cycleThemeMode}
                                    title={`Switch color mode (current: ${selectedThemeLabel})`}
                                >
                                    <div className="nav-left">
                                        <span className="nav-icon">
                                            <IoIosColorPalette />
                                        </span>
                                        {!collapsed && <span className="nav-text">Color modes</span>}
                                    </div>

                                    {!collapsed && (
                                        <span className="admin-color-mode-text">
                                            {selectedThemeLabel}
                                        </span>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="sidebar-footer">
                        <div className="admin-profile" data-al-sidebar-item>
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

                        <button className="logout-btn" onClick={handleLogout} type="button" data-al-sidebar-item>
                            <MdOutlineLogout />
                            {!collapsed && <span>Logout</span>}
                        </button>
                    </div>
                </aside>

                <main className="admin-main">{children}</main>
            </div>
        </AdminThemeContext.Provider>
    );
}

export default AdminLayout;
