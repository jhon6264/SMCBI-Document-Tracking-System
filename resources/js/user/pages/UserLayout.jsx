import React, { useEffect, useMemo, useRef, useState } from "react";
import "../../../css/user/pages/user-layout.css";
import { defaultThemeMode, theme, themeModes } from "../../../utils/theme";
import SchoolLogo from "../../assets/images/schoollogo.png";
import { animateStaggerReveal, cleanupMotion } from "../utils/animeMotion";

import { RxDashboard } from "react-icons/rx";
import { TbLayoutSidebarRight } from "react-icons/tb";
import { IoIosColorPalette } from "react-icons/io";
import {
    LuFolderKanban,
    LuBell,
    LuListTodo,
    LuFileText,
    LuCloud,
    LuMail,
    LuSettings2,
} from "react-icons/lu";
import { MdOutlineLogout } from "react-icons/md";

const workspaceItems = [
    { label: "Dashboard", path: "/user/dashboard", icon: <RxDashboard /> },
    { label: "Sessions", path: "/user/sessions", icon: <LuFolderKanban /> },
    { label: "Documents", path: "/user/documents", icon: <LuFileText /> },
    { label: "My Tasks", path: "/user/tasks", icon: <LuListTodo /> },
];

const googleItems = [
    { label: "Google Drive", path: "/user/google-drive", icon: <LuCloud /> },
    { label: "Gmail", path: "/user/gmail", icon: <LuMail /> },
];

const accountItems = [
    { label: "Notifications", path: "/user/notifications", icon: <LuBell /> },
    { label: "Settings", path: "/user/settings", icon: <LuSettings2 /> },
];

const mobileItems = [
    workspaceItems[0],
    workspaceItems[1],
    workspaceItems[2],
    workspaceItems[3],
    accountItems[0],
];

function UserLayout({ children, currentPath = "/user/dashboard", immersive = false }) {
    const USER_THEME_STORAGE_KEY = "user_theme_mode";
    const USER_COLLAPSED_STORAGE_KEY = "user_sidebar_collapsed";

    const [collapsed, setCollapsed] = useState(() => {
        return localStorage.getItem(USER_COLLAPSED_STORAGE_KEY) === "true";
    });
    const [themeMode, setThemeMode] = useState(() => {
        const savedMode = localStorage.getItem(USER_THEME_STORAGE_KEY);
        return savedMode && themeModes[savedMode] ? savedMode : defaultThemeMode;
    });
    const sidebarRef = useRef(null);
    const hasSidebarMountedRef = useRef(false);

    let user = null;

    try {
        user = JSON.parse(localStorage.getItem("user_data")) || null;
    } catch {
        user = null;
    }

    const activeTheme = themeModes[themeMode] || themeModes[defaultThemeMode];
    const activeColors = activeTheme.colors;
    const selectedThemeLabel =
        themeMode.charAt(0).toUpperCase() + themeMode.slice(1).toLowerCase();

    const userName = user?.google_name || user?.name || "Personnel";
    const userRole = user?.role || "User";
    const userPhoto =
        user?.profile_picture ||
        user?.picture ||
        user?.avatar ||
        user?.photo ||
        "";
    const userInitial = (userName || "U").trim().charAt(0).toUpperCase();
    useEffect(() => {
        localStorage.setItem(USER_COLLAPSED_STORAGE_KEY, String(collapsed));
    }, [collapsed]);

    useEffect(() => {
        localStorage.setItem(USER_THEME_STORAGE_KEY, themeMode);
    }, [themeMode]);

    useEffect(() => {
        const handleStorage = (event) => {
            if (event.key !== USER_THEME_STORAGE_KEY) {
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
        if (immersive) {
            return undefined;
        }

        if (!hasSidebarMountedRef.current) {
            hasSidebarMountedRef.current = true;
            return undefined;
        }

        const motion = animateStaggerReveal(sidebarRef.current, {
            selector: "[data-ul-sidebar-item]",
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
    }, [collapsed, immersive]);

    const themeOptions = useMemo(() => Object.keys(themeModes), []);

    const handleNavigate = (path) => {
        if (window.location.pathname !== path) {
            window.location.href = path;
        }
    };

    const handleLogout = () => {
        localStorage.removeItem("user_token");
        localStorage.removeItem("user_data");
        window.location.href = "/user/login";
    };

    const cycleThemeMode = () => {
        const currentIndex = themeOptions.indexOf(themeMode);

        if (currentIndex < 0) {
            setThemeMode(defaultThemeMode);
            return;
        }

        const nextIndex = (currentIndex + 1) % themeOptions.length;
        setThemeMode(themeOptions[nextIndex]);
    };

    const renderNavItem = (item) => {
        const isActive = currentPath === item.path;

        return (
            <button
                key={item.path}
                type="button"
                className={`user-layout-nav-item ${isActive ? "active" : ""}`}
                data-ul-sidebar-item
                onClick={() => handleNavigate(item.path)}
                title={collapsed ? item.label : ""}
            >
                <div className="user-layout-nav-left">
                    <span className="user-layout-nav-icon">{item.icon}</span>
                    {!collapsed && <span>{item.label}</span>}
                </div>

                {!collapsed && item.badge > 0 && (
                    <span className="user-layout-nav-badge">{item.badge}</span>
                )}

                {collapsed && item.badge > 0 && (
                    <span className="user-layout-nav-badge user-layout-nav-badge-collapsed">
                        {item.badge}
                    </span>
                )}
            </button>
        );
    };

    const shellStyle = {
        "--user-primary": activeColors.primary,
        "--user-primary-dark": activeColors.primaryDark || "#0d3d8f",
        "--user-accent": activeColors.accent,
        "--user-text": activeColors.text,
        "--user-text-muted": activeColors.textMuted,
        "--user-white": activeColors.white,
        "--user-bg": activeColors.background,
        "--user-surface": activeColors.surface || "#ffffff",
        "--user-panel": activeColors.panel || "#eef3ff",
        "--user-border": activeColors.border || "rgba(13, 26, 50, 0.12)",
        "--user-border-hover": activeColors.borderHover || "rgba(13, 26, 50, 0.24)",
        "--user-hint": activeColors.hint || "rgba(13, 26, 50, 0.16)",
        "--user-font": theme.fonts.primary,
        "--user-radius-md": theme.radius.md,
        "--user-radius-lg": theme.radius.lg,
        "--user-shadow": activeTheme.shadows.card,
    };

    return (
        <div
            className={`user-layout-shell ${collapsed ? "collapsed" : ""} ${immersive ? "immersive" : ""} mode-${themeMode}`}
            style={shellStyle}
        >
            {!immersive && (
                <aside className="user-layout-sidebar" ref={sidebarRef}>
                    <div className="user-layout-sidebar-top">
                        <div className="user-layout-brand" data-ul-sidebar-item>
                            {!collapsed ? (
                                <div className="user-layout-brand-left">
                                    <div className="user-layout-brand-logo">
                                        <img src={SchoolLogo} alt="SMCBI Logo" />
                                    </div>
                                    <div className="user-layout-brand-text">
                                        <h1>SMCBI</h1>
                                        <p>Personnel Portal</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="user-layout-brand-left user-layout-brand-collapsed" />
                            )}

                            <button
                                className="user-layout-toggle"
                                type="button"
                                onClick={() => setCollapsed((prev) => !prev)}
                                title={collapsed ? "Open sidebar" : "Collapse sidebar"}
                            >
                                <TbLayoutSidebarRight />
                            </button>
                        </div>

                        <div className="user-layout-section">
                            {!collapsed && <p className="user-layout-label" data-ul-sidebar-item>Workspace</p>}
                            <nav className="user-layout-nav" aria-label="User navigation">
                                {workspaceItems.map(renderNavItem)}
                            </nav>
                        </div>

                        <div className="user-layout-section">
                            {!collapsed && <p className="user-layout-label" data-ul-sidebar-item>Google</p>}
                            <nav className="user-layout-nav" aria-label="Google navigation">
                                {googleItems.map(renderNavItem)}
                            </nav>
                        </div>

                        <div className="user-layout-section">
                            {!collapsed && <p className="user-layout-label" data-ul-sidebar-item>Personal</p>}
                            <nav className="user-layout-nav" aria-label="User account navigation">
                                {renderNavItem(accountItems[0])}
                                <button
                                    type="button"
                                    className="user-layout-nav-item user-layout-mode-trigger"
                                    data-ul-sidebar-item
                                    onClick={cycleThemeMode}
                                    title={`Switch color mode (current: ${selectedThemeLabel})`}
                                >
                                    <div className="user-layout-nav-left">
                                        <span className="user-layout-nav-icon">
                                            <IoIosColorPalette />
                                        </span>
                                        {!collapsed && <span>Color modes</span>}
                                    </div>
                                    {!collapsed && (
                                        <span className="user-layout-mode-text">
                                            {selectedThemeLabel}
                                        </span>
                                    )}
                                </button>
                                {renderNavItem(accountItems[1])}
                            </nav>
                        </div>
                    </div>

                    <div className="user-layout-sidebar-footer">
                        <div className="user-layout-profile" data-ul-sidebar-item>
                            <div className="user-layout-profile-icon">
                                {userPhoto ? (
                                    <img
                                        src={userPhoto}
                                        alt={userName}
                                        className="user-layout-profile-avatar"
                                    />
                                ) : (
                                    <span className="user-layout-profile-fallback">{userInitial}</span>
                                )}
                            </div>
                            {!collapsed && (
                                <div className="user-layout-profile-text">
                                    <p>{userName}</p>
                                    <span>{userRole}</span>
                                </div>
                            )}
                        </div>
                        <button type="button" className="user-layout-logout" onClick={handleLogout} data-ul-sidebar-item>
                            <MdOutlineLogout />
                            {!collapsed && <span>Logout</span>}
                        </button>
                    </div>
                </aside>
            )}

            <main
                className={`user-layout-main ${immersive ? "user-layout-main--immersive" : ""} ${
                    currentPath === "/user/settings" ? "user-layout-main--settings" : ""
                }`}
            >
                <section className="user-layout-content">{children}</section>
            </main>

            {!immersive && (
                <nav className="user-layout-bottom-nav" aria-label="User mobile navigation">
                    {mobileItems.map((item) => {
                        const isActive = currentPath === item.path;

                        return (
                            <button
                                key={item.path}
                                type="button"
                                className={`user-layout-bottom-item ${isActive ? "active" : ""}`}
                                onClick={() => handleNavigate(item.path)}
                            >
                                <span className="user-layout-bottom-icon">{item.icon}</span>
                                <small>{item.label}</small>
                            </button>
                        );
                    })}
                </nav>
            )}
        </div>
    );
}

export default UserLayout;
