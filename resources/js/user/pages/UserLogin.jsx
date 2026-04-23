import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import "../../../css/user/pages/user-login.css";
import { defaultThemeMode, theme, themeModes } from "../../../utils/theme";
import SchoolLogo from "../../assets/images/schoollogo.png";
import GoogleLogo from "../../assets/images/google.png";
import { IoIosColorPalette } from "react-icons/io";

const GOOGLE_SCRIPT = "https://accounts.google.com/gsi/client";
const THEME_STORAGE_KEY = "doc_track_theme_mode";
const THEME_OPTIONS = ["dark", "ivory", "clean"];

function UserLogin() {
    const googleButtonRef = useRef(null);
    const themePickerRef = useRef(null);
    const [errorMessage, setErrorMessage] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isGoogleReady, setIsGoogleReady] = useState(false);
    const [isRedirecting, setIsRedirecting] = useState(false);
    const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
    const [themeMode, setThemeMode] = useState(() => {
        const savedMode = localStorage.getItem(THEME_STORAGE_KEY);
        return savedMode && themeModes[savedMode] ? savedMode : defaultThemeMode;
    });

    const googleClientId = window.appConfig?.googleClientId || "";
    const institutionDomain = window.appConfig?.institutionDomain || "smcbi.edu.ph";
    const activeTheme = themeModes[themeMode] || themeModes[defaultThemeMode];
    const activeColors = activeTheme.colors;

    useEffect(() => {
        const existingToken = localStorage.getItem("user_token");

        if (existingToken) {
            window.location.href = "/user/dashboard";
        }
    }, []);

    useEffect(() => {
        if (!googleClientId) {
            setErrorMessage("Google client ID is missing in the project configuration.");
            return;
        }

        let mounted = true;

        const initializeGoogle = () => {
            if (!mounted || !window.google?.accounts?.id || !googleButtonRef.current) {
                return;
            }

            const buttonWidth = Math.ceil(googleButtonRef.current.offsetWidth || 360);

            window.google.accounts.id.initialize({
                client_id: googleClientId,
                callback: handleGoogleResponse,
                auto_select: false,
                cancel_on_tap_outside: true,
                hd: institutionDomain,
            });

            googleButtonRef.current.innerHTML = "";

            window.google.accounts.id.renderButton(googleButtonRef.current, {
                theme: "outline",
                size: "large",
                shape: "pill",
                text: "continue_with",
                width: buttonWidth,
            });

            if (mounted) {
                setIsGoogleReady(true);
            }
        };

        const scriptAlreadyExists = document.querySelector(`script[src="${GOOGLE_SCRIPT}"]`);

        if (scriptAlreadyExists) {
            initializeGoogle();
        } else {
            const script = document.createElement("script");
            script.src = GOOGLE_SCRIPT;
            script.async = true;
            script.defer = true;
            script.onload = initializeGoogle;
            script.onerror = () => {
                if (mounted) {
                    setErrorMessage("Failed to load Google Sign-In. Please refresh the page.");
                }
            };
            document.body.appendChild(script);
        }

        return () => {
            mounted = false;
        };
    }, [googleClientId, institutionDomain]);

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

    const triggerGoogleSignIn = () => {
        if (isLoading || isRedirecting) {
            return;
        }

        const googleButton =
            googleButtonRef.current?.querySelector('[role="button"]') ||
            googleButtonRef.current?.firstElementChild ||
            googleButtonRef.current?.querySelector("iframe");

        googleButton?.click?.();
    };

    const handleGoogleResponse = async (response) => {
        if (!response?.credential) {
            setErrorMessage("Google did not return a valid sign-in credential.");
            return;
        }

        try {
            setIsLoading(true);
            setErrorMessage("");

            const { data } = await axios.post(
                "/api/user/login",
                {
                    credential: response.credential,
                },
                {
                    headers: {
                        Accept: "application/json",
                        "Content-Type": "application/json",
                    },
                }
            );

            localStorage.setItem("user_token", data.token);
            localStorage.setItem("user_data", JSON.stringify(data.user));
            setIsRedirecting(true);

            setTimeout(() => {
                window.location.href = "/user/dashboard";
            }, 700);
        } catch (error) {
            setErrorMessage(
                error.response?.data?.message ||
                    "Unable to complete Google login right now."
            );
        } finally {
            setIsLoading(false);
        }
    };

    const pageStyle = {
        "--user-bg": activeColors.background,
        "--user-primary": activeColors.primary,
        "--user-primary-dark": activeColors.primaryDark,
        "--user-accent": activeColors.accent,
        "--user-text": activeColors.text,
        "--user-text-muted": activeColors.textMuted,
        "--user-border": activeColors.border,
        "--user-white": activeColors.white,
        "--user-font": theme.fonts.primary,
        "--user-surface": activeColors.surface,
        "--user-panel": activeColors.panel,
        "--user-card": activeColors.card,
        "--user-hint": activeColors.hint,
        "--user-border-hover": activeColors.borderHover,
        "--user-blue-tint": activeColors.blueTint,
        "--user-teal-tint": activeColors.tealTint,
    };

    return (
        <div className={`user-login-page mode-${themeMode}`} style={pageStyle}>
            <div className="user-login-glow glow-one" />
            <div className="user-login-glow glow-two" />

            <div className="user-login-shell">
                <section className="user-login-showcase">
                    <div className="user-login-brand">
                        <div>
                            <span className="user-login-brand-label">SMCBI</span>
                            <h1>Document Tracking System</h1>
                        </div>
                    </div>

                    <div className="user-login-copy">
                        <h2>
                            Track and approve school documents <span>in one place.</span>
                        </h2>
                        <p>
                            Sign in with your official <strong>@{institutionDomain}</strong>{" "}
                            account to access your personnel workspace.
                        </p>
                    </div>

                    <div className="user-login-meta">
                        <div className="user-login-meta-item">
                            <span>Secured by</span>
                            <strong>Google</strong>
                        </div>

                        <div className="user-login-meta-item">
                            <span>Authorized by</span>
                            <strong>Admin</strong>
                        </div>
                    </div>
                </section>

                <section className="user-login-panel">
                    <div className="user-login-panel-inner">
                        <div className="user-login-panel-brand">
                            <img src={SchoolLogo} alt="SMCBI logo" className="user-login-logo" />
                            <span>St. Mary's College of Bansalan Inc.</span>
                        </div>

                        <h2>Welcome back</h2>
                        <p>Continue with Google to access your personnel workspace.</p>

                        <div className="user-login-google-box">
                            {!isRedirecting ? (
                                <div
                                    className={`user-login-google-button-host ${
                                        isLoading ? "is-loading" : ""
                                    }`}
                                >
                                    <button
                                        type="button"
                                        className="user-login-google-shell"
                                        onClick={triggerGoogleSignIn}
                                        disabled={!isGoogleReady || isLoading}
                                    >
                                        <div className="user-login-google-label">
                                            <span className="user-login-google-mark">
                                                <img src={GoogleLogo} alt="" />
                                            </span>
                                            <strong>Continue to Google</strong>
                                        </div>
                                        <div
                                            ref={googleButtonRef}
                                            className="user-login-google-slot"
                                            aria-hidden="true"
                                        />
                                    </button>
                                </div>
                            ) : (
                                <div className="user-login-loader-card" aria-live="polite">
                                    <span className="user-login-loader" />
                                </div>
                            )}

                            {errorMessage && (
                                <div className="user-login-status error">{errorMessage}</div>
                            )}
                        </div>
                    </div>
                </section>
            </div>

            <div className="user-theme-picker" ref={themePickerRef}>
                <button
                    type="button"
                    className={`user-theme-trigger ${isThemeMenuOpen ? "open" : ""}`}
                    onClick={() => setIsThemeMenuOpen((prev) => !prev)}
                    aria-label="Choose theme mode"
                    title="Choose theme mode"
                >
                    <IoIosColorPalette />
                </button>

                <div className={`user-theme-menu ${isThemeMenuOpen ? "open" : ""}`}>
                    {THEME_OPTIONS.map((mode) => (
                        <button
                            key={mode}
                            type="button"
                            className={`user-theme-swatch ${mode} ${
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

export default UserLogin;
