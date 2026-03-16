import React from "react";
import ReactDOM from "react-dom/client";

import AdminLogin from "./admin/pages/AdminLogin";
import AdminLayout from "./admin/pages/Adminlayout";
import AdminDashboard from "./admin/pages/AdminDashboard";
import AdminManagement from "./admin/pages/AdminManagement";
import AdminUserManagement from "./admin/pages/AdminUserManagement";

function renderApp() {
    const rootElement = document.getElementById("app");

    if (!rootElement) {
        return;
    }

    const root = ReactDOM.createRoot(rootElement);
    const currentPath = window.location.pathname;
    const adminToken = localStorage.getItem("admin_token");

    let page = null;

    if (currentPath === "/") {
        page = <AdminLogin />;
    } else if (currentPath === "/admin/dashboard") {
        if (!adminToken) {
            window.location.href = "/";
            return;
        }

        page = (
            <AdminLayout unreadMessages={0}>
                <AdminDashboard />
            </AdminLayout>
        );
    } else if (currentPath === "/admin/admin-management") {
        if (!adminToken) {
            window.location.href = "/";
            return;
        }

        page = (
            <AdminLayout unreadMessages={0}>
                <AdminManagement />
            </AdminLayout>
        );
    } else if (currentPath === "/admin/user-management") {
        if (!adminToken) {
            window.location.href = "/";
            return;
        }

        page = (
            <AdminLayout unreadMessages={0}>
                <AdminUserManagement />
            </AdminLayout>
        );
    } else {
        page = <AdminLogin />;
    }

    root.render(page);
}

renderApp();