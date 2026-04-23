import React, { useMemo } from "react";
import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import "../../../css/user/pages/user-notifications.css";

const buildAuthConfig = () => {
    const token = localStorage.getItem("user_token");
    return {
        headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token || ""}`,
        },
    };
};

const formatDate = (value) => {
    if (!value) return "-";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "-";
    return parsed.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });
};

function UserNotifications() {
    const queryClient = useQueryClient();

    const notificationsQuery = useQuery({
        queryKey: ["user-notifications"],
        queryFn: async () => {
            const { data } = await axios.get("/api/user/notifications", buildAuthConfig());
            return data;
        },
    });

    const markReadMutation = useMutation({
        mutationFn: async (notificationId) => {
            const { data } = await axios.patch(
                `/api/user/notifications/${notificationId}/read`,
                {},
                buildAuthConfig()
            );
            return data;
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ["user-notifications"] });
        },
    });

    const notifications = useMemo(() => {
        return Array.isArray(notificationsQuery.data?.notifications)
            ? notificationsQuery.data.notifications
            : [];
    }, [notificationsQuery.data]);

    const unreadCount = notificationsQuery.data?.unread_count || 0;

    const handleOpenNotification = (notification) => {
        if (!notification?.read_at) {
            markReadMutation.mutate(notification.id);
        }

        if (notification?.type === "session_invitation") {
            window.location.href = "/user/tasks";
        }
    };

    return (
        <div className="user-notifications-page">
            <header className="user-notifications-header">
                <span>Notifications</span>
                <h1>In-App Notification Center</h1>
                <p>
                    Session invitations and workflow updates appear here inside the app. This page
                    only shows in-app notifications, not your Gmail inbox.
                </p>
            </header>

            <section className="user-notifications-summary">
                <article>
                    <strong>{notifications.length}</strong>
                    <span>Total notifications</span>
                </article>
                <article>
                    <strong>{unreadCount}</strong>
                    <span>Unread items</span>
                </article>
            </section>

            {notificationsQuery.isLoading && (
                <div className="user-notifications-empty">
                    <p>Loading notifications...</p>
                </div>
            )}

            {notificationsQuery.isError && (
                <div className="user-notifications-empty user-notifications-empty--error">
                    <p>{notificationsQuery.error?.response?.data?.message || "Failed to load notifications."}</p>
                </div>
            )}

            {!notificationsQuery.isLoading && !notificationsQuery.isError && notifications.length === 0 && (
                <div className="user-notifications-empty">
                    <p>No in-app notifications yet.</p>
                </div>
            )}

            {!notificationsQuery.isLoading && !notificationsQuery.isError && notifications.length > 0 && (
                <section className="user-notifications-list">
                    {notifications.map((notification) => (
                        <article
                            key={notification.id}
                            className={`user-notification-card ${notification.read_at ? "" : "is-unread"}`}
                        >
                            <div className="user-notification-card-top">
                                <div>
                                    <span className="user-notification-card-tag">
                                        {notification.type === "session_invitation" ? "Session Invitation" : "Update"}
                                    </span>
                                    <h2>{notification.title}</h2>
                                </div>
                                {!notification.read_at && <span className="user-notification-unread">Unread</span>}
                            </div>

                            <p>{notification.body}</p>

                            <div className="user-notification-card-meta">
                                <span>{formatDate(notification.created_at)}</span>
                                {notification.data?.session_title && (
                                    <strong>{notification.data.session_title}</strong>
                                )}
                            </div>

                            <div className="user-notification-card-actions">
                                <button
                                    type="button"
                                    className="user-notification-btn"
                                    onClick={() => handleOpenNotification(notification)}
                                    disabled={markReadMutation.isPending}
                                >
                                    {notification.type === "session_invitation" ? "Review invitation" : "Open"}
                                </button>
                                {!notification.read_at && notification.type !== "session_invitation" && (
                                    <button
                                        type="button"
                                        className="user-notification-btn user-notification-btn--ghost"
                                        onClick={() => markReadMutation.mutate(notification.id)}
                                        disabled={markReadMutation.isPending}
                                    >
                                        Mark as read
                                    </button>
                                )}
                            </div>
                        </article>
                    ))}
                </section>
            )}
        </div>
    );
}

export default UserNotifications;
