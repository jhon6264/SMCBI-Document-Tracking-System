import React from "react";

function AdminDashboard() {
    return (
        <div className="admin-page">
            <div>
                <h1 className="admin-page-title">Dashboard</h1>
                <p className="admin-page-subtitle">
                    Welcome to the admin dashboard of the Document Tracking System.
                </p>
            </div>

            <div className="admin-card-grid">
                <div className="admin-stat-card">
                    <p className="admin-stat-title">Total Documents</p>
                    <h2 className="admin-stat-value">0</h2>
                </div>

                <div className="admin-stat-card">
                    <p className="admin-stat-title">Pending Documents</p>
                    <h2 className="admin-stat-value">0</h2>
                </div>

                <div className="admin-stat-card">
                    <p className="admin-stat-title">Signed Documents</p>
                    <h2 className="admin-stat-value">0</h2>
                </div>
            </div>

            <div className="admin-content-card">
                <h3>Overview</h3>
                <p>
                    This is the main dashboard page. Later, you can place summary cards,
                    charts, recent document activity, routing statistics, and notifications here.
                </p>
            </div>
        </div>
    );
}

export default AdminDashboard;