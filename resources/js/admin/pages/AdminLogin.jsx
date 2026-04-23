import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import "../../../css/admin/admin-login.css";
import { defaultThemeMode, theme, themeModes } from "../../../utils/theme";
import GoogleLabel from "../../assets/images/google_Label.png";
import { IoIosColorPalette } from "react-icons/io";

const THEME_STORAGE_KEY = "doc_track_theme_mode";
const THEME_OPTIONS = ["dark", "ivory", "clean"];

function AdminLogin() {
    const themePickerRef = useRef(null);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [pageReady, setPageReady] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
    const [themeMode, setThemeMode] = useState(() => {
        const savedMode = localStorage.getItem(THEME_STORAGE_KEY);
        return savedMode && themeModes[savedMode] ? savedMode : defaultThemeMode;
    });

    const activeTheme = themeModes[themeMode] || themeModes[defaultThemeMode];
    const activeColors = activeTheme.colors;

    useEffect(() => {
        const timer = setTimeout(() => setPageReady(true), 80);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        localStorage.setItem(THEME_STORAGE_KEY, themeMode);
    }, [themeMode]);

    useEffect(() => {
        if (!isThemeMenuOpen) {
            return;
        }

        const handleOutsideClick = (event) => {
            if (!themePickerRef.current?.contains(event.target)) {
                setIsThemeMenuOpen(false);
            }
        };

        document.addEventListener("mousedown", handleOutsideClick);
        return () => {
            document.removeEventListener("mousedown", handleOutsideClick);
        };
    }, [isThemeMenuOpen]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrorMessage("");

        if (!email.endsWith("@smcbi.edu.ph")) {
            setErrorMessage("Only @smcbi.edu.ph email addresses are allowed.");
            return;
        }

        try {
            setLoading(true);

            const response = await axios.post(
                "http://127.0.0.1:8000/api/admin/login",
                {
                    email,
                    password,
                },
                {
                    headers: {
                        Accept: "application/json",
                        "Content-Type": "application/json",
                    },
                }
            );

            const data = response.data;

            localStorage.setItem("admin_token", data.token);
            localStorage.setItem("admin_data", JSON.stringify(data.admin));

            window.location.href = "/admin/dashboard";
        } catch (error) {
            if (error.response?.data?.message) {
                setErrorMessage(error.response.data.message);
            } else {
                setErrorMessage("Unable to connect to the server.");
            }
        } finally {
            setLoading(false);
        }
    };

    const pageStyle = {
        "--admin-bg": activeColors.background,
        "--admin-primary": activeColors.primary,
        "--admin-primary-dark": activeColors.primaryDark,
        "--admin-accent": activeColors.accent,
        "--admin-text": activeColors.text,
        "--admin-text-muted": activeColors.textMuted,
        "--admin-border": activeColors.border,
        "--admin-white": activeColors.white,
        "--admin-font": theme.fonts.primary,
        "--admin-surface": activeColors.surface,
        "--admin-panel": activeColors.panel,
        "--admin-card": activeColors.card,
        "--admin-hint": activeColors.hint,
        "--admin-border-hover": activeColors.borderHover,
        "--admin-blue-tint": activeColors.blueTint,
        "--admin-teal-tint": activeColors.tealTint,
    };

    return (
        <div className={`admin-login-page mode-${themeMode}`} style={pageStyle}>
            <div className="admin-login-glow glow-left" />
            <div className="admin-login-glow glow-right" />

            <div className={`admin-login-shell ${pageReady ? "is-ready" : ""}`}>
                <section className="admin-login-showcase">
                    <div className="admin-login-copy">
                        <h2>
                            Admin
                            <span> Workspace</span>
                        </h2>
                    </div>

                    <div className="admin-login-security">
                        <span>Secured by</span>
                        <img src={GoogleLabel} alt="Google" className="admin-login-security-badge" />
                    </div>
                </section>

                <section className="admin-login-panel">
                    <div className="admin-login-panel-inner">
                        <h2>Welcome back</h2>
                        <p>Enter your admin credentials to continue to the dashboard.</p>

                        <form className="admin-login-form" onSubmit={handleSubmit}>
                            <div className={`admin-field ${email ? "has-value" : ""}`}>
                                <input
                                    type="email"
                                    id="admin-email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder=" "
                                    pattern="^[a-zA-Z0-9._%+-]+@smcbi\.edu\.ph$"
                                    title="Email must end with @smcbi.edu.ph"
                                    required
                                    disabled={loading}
                                />
                                <label htmlFor="admin-email">Admin Email</label>
                            </div>

                            <div className={`admin-field admin-password ${password ? "has-value" : ""}`}>
                                <input
                                    type="password"
                                    id="admin-password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder=" "
                                    required
                                    disabled={loading}
                                />
                                <label htmlFor="admin-password">Password</label>
                            </div>

                            {errorMessage && (
                                <div className="admin-login-status error">{errorMessage}</div>
                            )}

                            <button
                                type="submit"
                                className="admin-login-button"
                                disabled={loading}
                            >
                                {loading ? "Signing in..." : "Sign In"}
                            </button>
                        </form>
                    </div>
                </section>
            </div>

            <div className="admin-theme-picker" ref={themePickerRef}>
                <button
                    type="button"
                    className={`admin-theme-trigger ${isThemeMenuOpen ? "open" : ""}`}
                    onClick={() => setIsThemeMenuOpen((prev) => !prev)}
                    aria-label="Choose theme mode"
                    title="Choose theme mode"
                >
                    <IoIosColorPalette />
                </button>

                <div className={`admin-theme-menu ${isThemeMenuOpen ? "open" : ""}`}>
                    {THEME_OPTIONS.map((mode) => (
                        <button
                            key={mode}
                            type="button"
                            className={`admin-theme-swatch ${mode} ${
                                themeMode === mode ? "active" : ""
                            }`}
                            onClick={() => {
                                setThemeMode(mode);
                                setIsThemeMenuOpen(false);
                            }}
                            title={`${mode} mode`}
                            aria-label={`Use ${mode} mode`}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}

export default AdminLogin;
