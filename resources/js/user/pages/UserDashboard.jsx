import React from "react";
import "../../../css/user/pages/user-dashboard.css";

function UserDashboard() {
    let user = null;

    try {
        user = JSON.parse(localStorage.getItem("user_data")) || null;
    } catch {
        user = null;
    }

    return (
        <div className="user-dashboard-page">
            <div className="user-dashboard-head">
                <span className="user-dashboard-kicker">Dashboard</span>
                <h1>Welcome back, {user?.name || "Personnel"}.</h1>
                <p>
                    Monitor your routing sessions, pending signatures, and real-time document
                    activity from one workspace.
                </p>
            </div>

            <div className="user-dashboard-summary">
                <article>
                    <span>Active Sessions</span>
                    <strong>12</strong>
                    <small>3 updated in the last hour</small>
                </article>
                <article>
                    <span>Needs Your Action</span>
                    <strong>4</strong>
                    <small>Review, edit, or sign required</small>
                </article>
                <article>
                    <span>Signed Today</span>
                    <strong>7</strong>
                    <small>Across all departments</small>
                </article>
            </div>

            <div className="user-dashboard-grid">
                <section className="user-dashboard-module">
                    <header>
                        <h2>Recent Session Activity</h2>
                        <a href="/user/sessions">View all</a>
                    </header>
                    <ul>
                        <li>
                            <div>
                                <strong>Budget Endorsement Q2</strong>
                                <span>Edited by Registrar</span>
                            </div>
                            <small>8m ago</small>
                        </li>
                        <li>
                            <div>
                                <strong>Faculty Clearance Form</strong>
                                <span>Viewed by Cashier</span>
                            </div>
                            <small>26m ago</small>
                        </li>
                        <li>
                            <div>
                                <strong>Memorandum Approval</strong>
                                <span>Signed by President</span>
                            </div>
                            <small>1h ago</small>
                        </li>
                    </ul>
                </section>

                <section className="user-dashboard-module">
                    <header>
                        <h2>Your Role</h2>
                    </header>
                    <div className="user-dashboard-profile">
                        <p>
                            <span>Name</span>
                            <strong>{user?.name || "-"}</strong>
                        </p>
                        <p>
                            <span>Email</span>
                            <strong>{user?.email || "-"}</strong>
                        </p>
                        <p>
                            <span>Role</span>
                            <strong>{user?.role || "-"}</strong>
                        </p>
                        <p>
                            <span>Department</span>
                            <strong>{user?.department?.name || "Not set yet"}</strong>
                        </p>
                    </div>
                </section>

                <section className="user-dashboard-module wide">
                    <header>
                        <h2>Queue Preview</h2>
                        <a href="/user/tasks">Open task queue</a>
                    </header>
                    <div className="user-dashboard-queue">
                        <article>
                            <strong>Incoming Signatures</strong>
                            <p>2 documents are waiting for your signature.</p>
                        </article>
                        <article>
                            <strong>Documents Under Review</strong>
                            <p>3 documents are being reviewed by assigned personnel.</p>
                        </article>
                        <article>
                            <strong>Completed This Week</strong>
                            <p>15 sessions completed and archived in Drive.</p>
                        </article>
                    </div>
                    </section>
                </div>
            </div>
    );
}

export default UserDashboard;
