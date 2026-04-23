import React from "react";
import "../../../css/user/pages/user-profile.css";

function UserProfile() {
    let user = null;

    try {
        user = JSON.parse(localStorage.getItem("user_data")) || null;
    } catch {
        user = null;
    }

    return (
        <div className="user-profile-page">
            <header className="user-profile-header">
                <span>Profile</span>
                <h1>Personnel Account</h1>
                <p>
                    View your account role and identity that participate in the document routing
                    workflow.
                </p>
            </header>

            <section className="user-profile-grid">
                <article>
                    <h2>Name</h2>
                    <p>{user?.name || "-"}</p>
                </article>
                <article>
                    <h2>Email</h2>
                    <p>{user?.email || "-"}</p>
                </article>
                <article>
                    <h2>Role</h2>
                    <p>{user?.role || "-"}</p>
                </article>
            </section>
        </div>
    );
}

export default UserProfile;
