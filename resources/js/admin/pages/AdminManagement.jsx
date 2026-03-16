import React from "react";

function AdminManagement() {
    return (
        <div className="admin-page">
            <div>
                <h1 className="admin-page-title">Admin Management</h1>
                <p className="admin-page-subtitle">
                    Manage super admins and admin accounts here.
                </p>
            </div>

            <div className="admin-content-card">
                <h3>Admin Accounts</h3>
                <p>
                    This page will later contain the admin list, invite or create admin form,
                    role assignment, status control, and action buttons.
                </p>
            </div>
        </div>
    );
}

export default AdminManagement;