import React, { useEffect, useState } from "react";
import axios from "axios";
import "../../../css/admin/admin-login.css";
import { theme } from "../../../utils/theme";
import LoginAnimation from "../../assets/lottie/Login.json";
import Lottie from "lottie-react";
import { FaEyeSlash, FaRegEye } from "react-icons/fa";

function AdminLogin() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);

    const [cardVisible, setCardVisible] = useState(false);
    const [contentVisible, setContentVisible] = useState(false);
    const [isExiting, setIsExiting] = useState(false);

    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");

    useEffect(() => {
        const enterTimer = setTimeout(() => setCardVisible(true), 60);
        const contentTimer = setTimeout(() => setContentVisible(true), 360);

        return () => {
            clearTimeout(enterTimer);
            clearTimeout(contentTimer);
        };
    }, []);

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

            setContentVisible(false);

            setTimeout(() => {
                setIsExiting(true);
            }, 250);

            setTimeout(() => {
                window.location.href = "/admin/dashboard";
            }, 950);
        } catch (error) {
            if (error.response && error.response.data) {
                setErrorMessage(
                    error.response.data.message || "Login failed. Please try again."
                );
            } else {
                setErrorMessage("Unable to connect to the server.");
            }
        } finally {
            setLoading(false);
        }
    };

    const pageStyle = {
        "--bg-color": theme.colors.primary,
        "--card-color": theme.colors.white,
        "--text-color": theme.colors.text,
        "--border-color": "#000000",
        "--accent-color": theme.colors.accent,
        "--font-primary": theme.fonts.primary,
        "--input-color": "#000000",
        "--bubble-accent": theme.colors.accent,
        "--bubble-pending": theme.colors.status.pending,
        "--bubble-opened": theme.colors.status.opened,
        "--bubble-signed": theme.colors.status.signed,
    };

    return (
        <div className="admin-login-page" style={pageStyle}>
            <div className="bubble bubble-1" />
            <div className="bubble bubble-2" />
            <div className="bubble bubble-3" />
            <div className="bubble bubble-4" />
            <div className="bubble bubble-5" />
            <div className="bubble bubble-6" />
            <div className="bubble bubble-7" />
            <div className="bubble bubble-8" />
            <div className="bubble bubble-9" />
            <div className="bubble bubble-10" />
            <div className="bubble bubble-11" />
            <div className="bubble bubble-12" />
            <div className="bubble bubble-13" />
            <div className="bubble bubble-14" />
            <div className="bubble bubble-15" />

            <div
                className={[
                    "admin-login-card",
                    cardVisible ? "enter" : "",
                    isExiting ? "exit" : "",
                ].join(" ")}
            >
                <div
                    className={[
                        "admin-login-content",
                        contentVisible ? "content-show" : "",
                        isExiting ? "content-hide" : "",
                    ].join(" ")}
                >
                    <div className="admin-login-left">
                        <Lottie
                            animationData={LoginAnimation}
                            loop
                            autoplay
                            className="admin-login-lottie"
                        />
                    </div>

                    <div className="admin-login-right">
                        <div className="admin-login-header">
                            <h1>Admin Login</h1>
                            <p>Sign in to manage the document tracking system.</p>
                        </div>

                        <form className="admin-login-form" onSubmit={handleSubmit}>
                            <div className={`floating-field ${email ? "has-value" : ""}`}>
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
                                <label htmlFor="admin-email">Email</label>
                            </div>

                            <div
                                className={`floating-field password-field ${
                                    password ? "has-value" : ""
                                }`}
                            >
                                <input
                                    type={showPassword ? "text" : "password"}
                                    id="admin-password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder=" "
                                    required
                                    disabled={loading}
                                />
                                <label htmlFor="admin-password">Password</label>

                                <button
                                    type="button"
                                    className="password-toggle"
                                    onClick={() => setShowPassword((prev) => !prev)}
                                    aria-label={showPassword ? "Hide password" : "Show password"}
                                    disabled={loading}
                                >
                                    {showPassword ? <FaEyeSlash /> : <FaRegEye />}
                                </button>
                            </div>

                            {errorMessage && (
                                <p
                                    style={{
                                        color: "red",
                                        fontSize: "14px",
                                        marginTop: "8px",
                                        marginBottom: "8px",
                                    }}
                                >
                                    {errorMessage}
                                </p>
                            )}

                            <button
                                type="submit"
                                className="admin-login-button"
                                disabled={loading}
                            >
                                {loading ? "Logging in..." : "Login"}
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default AdminLogin;