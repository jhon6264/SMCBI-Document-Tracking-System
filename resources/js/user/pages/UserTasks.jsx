import React, { useMemo } from "react";
import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import "../../../css/user/pages/user-tasks.css";

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

function UserTasks() {
    const queryClient = useQueryClient();

    const tasksQuery = useQuery({
        queryKey: ["user-session-invitations"],
        queryFn: async () => {
            const { data } = await axios.get("/api/user/tasks/session-invitations", buildAuthConfig());
            return data;
        },
    });

    const respondMutation = useMutation({
        mutationFn: async ({ memberId, action }) => {
            const { data } = await axios.patch(
                `/api/user/tasks/session-invitations/${memberId}/${action}`,
                {},
                buildAuthConfig()
            );
            return data;
        },
        onSuccess: async ({ task }) => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ["user-session-invitations"] }),
                queryClient.invalidateQueries({ queryKey: ["user-sessions"] }),
                queryClient.invalidateQueries({ queryKey: ["user-notifications"] }),
            ]);

            if (task?.session_id) {
                window.location.href = `/user/sessions/${task.session_id}`;
            }
        },
    });

    const tasks = useMemo(() => {
        return Array.isArray(tasksQuery.data?.tasks) ? tasksQuery.data.tasks : [];
    }, [tasksQuery.data]);

    return (
        <div className="user-tasks-page">
            <header className="user-tasks-header">
                <span>My Tasks</span>
                <h1>Session Invitations</h1>
                <p>
                    Review every session you were invited to join. Approving moves the session
                    into your active session list. Declining removes it from your queue.
                </p>
            </header>

            {tasksQuery.isLoading && (
                <div className="user-tasks-empty">
                    <p>Loading your invitation queue...</p>
                </div>
            )}

            {tasksQuery.isError && (
                <div className="user-tasks-empty user-tasks-empty--error">
                    <p>{tasksQuery.error?.response?.data?.message || "Failed to load your invitation queue."}</p>
                </div>
            )}

            {!tasksQuery.isLoading && !tasksQuery.isError && tasks.length === 0 && (
                <div className="user-tasks-empty">
                    <p>No pending session invitations right now.</p>
                </div>
            )}

            {!tasksQuery.isLoading && !tasksQuery.isError && tasks.length > 0 && (
                <div className="user-tasks-grid">
                    {tasks.map((task) => {
                        const actionDisabled = respondMutation.isPending;

                        return (
                            <article key={task.member_id} className="user-task-card">
                                <div className="user-task-card-top">
                                    <div>
                                        <span className="user-task-card-tag">{task.document_type || "Document"}</span>
                                        <h2>{task.title}</h2>
                                    </div>
                                    <span className="user-task-card-pill">Pending Invite</span>
                                </div>

                                <div className="user-task-card-meta">
                                    <div>
                                        <span>Invited by</span>
                                        <strong>{task.creator_name}</strong>
                                    </div>
                                    <div>
                                        <span>Role</span>
                                        <strong>{task.display_role_name}</strong>
                                    </div>
                                    <div>
                                        <span>Invited on</span>
                                        <strong>{formatDate(task.invited_at)}</strong>
                                    </div>
                                    <div>
                                        <span>Primary file</span>
                                        <strong>{task.file_name || "No file found"}</strong>
                                    </div>
                                </div>

                                <div className="user-task-card-summary">
                                    <div>
                                        <span>Deadline</span>
                                        <strong>{formatDate(task.deadline_at)}</strong>
                                    </div>
                                    <div>
                                        <span>Detected placeholders</span>
                                        <strong>{task.placeholder_count}</strong>
                                    </div>
                                    <div>
                                        <span>Signing source</span>
                                        <strong>{task.is_converted_for_signing ? "Converted Google Doc" : "Google Doc"}</strong>
                                    </div>
                                </div>

                                {respondMutation.isError && (
                                    <div className="user-task-inline-error">
                                        {respondMutation.error?.response?.data?.message || "Failed to update the invitation."}
                                    </div>
                                )}

                                <div className="user-task-card-actions">
                                    <button
                                        type="button"
                                        className="user-task-btn user-task-btn--ghost"
                                        onClick={() =>
                                            respondMutation.mutate({ memberId: task.member_id, action: "decline" })
                                        }
                                        disabled={actionDisabled}
                                    >
                                        Decline
                                    </button>
                                    <button
                                        type="button"
                                        className="user-task-btn user-task-btn--primary"
                                        onClick={() =>
                                            respondMutation.mutate({ memberId: task.member_id, action: "accept" })
                                        }
                                        disabled={actionDisabled}
                                    >
                                        {actionDisabled ? "Processing..." : "Approve"}
                                    </button>
                                </div>
                            </article>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export default UserTasks;
