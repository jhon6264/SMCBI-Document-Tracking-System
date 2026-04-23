import React from "react";
import ReactDOM from "react-dom/client";
import "../utils/modes-transition.css";
import { QueryClientProvider } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import {
    userQueryClient,
    userQueryPersister,
    userQueryPersistMaxAgeMs,
} from "./user/queryClient";

import AdminLogin from "./admin/pages/AdminLogin";
import AdminLayout from "./admin/pages/Adminlayout";
import AdminDashboard from "./admin/pages/AdminDashboard";
import AdminManagement from "./admin/pages/AdminManagement";
import AdminUserManagement from "./admin/pages/AdminUserManagement";
import AdminSignatories from "./admin/pages/AdminSignatories";
import UserLogin from "./user/pages/UserLogin";
import UserLayout from "./user/pages/UserLayout";
import UserDashboard from "./user/pages/UserDashboard";
import UserSessions from "./user/pages/UserSessions";
import UserSessionDetails from "./user/pages/UserSessionDetails";
import UserDocuments from "./user/pages/UserDocuments";
import UserTasks from "./user/pages/UserTasks";
import UserNotifications from "./user/pages/UserNotifications";
import UserAccount from "./user/pages/UserAccount";
import UserGoogleDrive from "./user/pages/UserGoogleDrive";
import UserGmail from "./user/pages/UserGmail";

function renderApp() {
    const rootElement = document.getElementById("app");

    if (!rootElement) {
        return;
    }

    const root = ReactDOM.createRoot(rootElement);
    const currentPath = window.location.pathname;
    const adminToken = localStorage.getItem("admin_token");
    const userToken = localStorage.getItem("user_token");

    let page = null;

    if (currentPath === "/" || currentPath === "/user/login") {
        if (userToken) {
            window.location.href = "/user/dashboard";
            return;
        }

        page = <UserLogin />;
    } else if (currentPath === "/admin/login") {
        if (adminToken) {
            window.location.href = "/admin/dashboard";
            return;
        }

        page = <AdminLogin />;
    } else if (currentPath === "/admin/dashboard") {
        if (!adminToken) {
            window.location.href = "/admin/login";
            return;
        }

        page = (
            <AdminLayout unreadMessages={0}>
                <AdminDashboard />
            </AdminLayout>
        );
    } else if (currentPath === "/admin/admin-management") {
        if (!adminToken) {
            window.location.href = "/admin/login";
            return;
        }

        page = (
            <AdminLayout unreadMessages={0}>
                <AdminManagement />
            </AdminLayout>
        );
    } else if (currentPath === "/admin/user-management") {
        if (!adminToken) {
            window.location.href = "/admin/login";
            return;
        }

        page = (
            <AdminLayout unreadMessages={0}>
                <AdminUserManagement />
            </AdminLayout>
        );
    } else if (currentPath === "/admin/signatories") {
        if (!adminToken) {
            window.location.href = "/admin/login";
            return;
        }

        page = (
            <AdminLayout unreadMessages={0}>
                <AdminSignatories />
            </AdminLayout>
        );
    } else if (currentPath === "/user/dashboard") {
        if (!userToken) {
            window.location.href = "/";
            return;
        }

        page = (
            <UserLayout currentPath={currentPath}>
                <UserDashboard />
            </UserLayout>
        );
    } else if (currentPath === "/user/sessions") {
        if (!userToken) {
            window.location.href = "/";
            return;
        }

        page = (
            <UserLayout currentPath={currentPath}>
                <UserSessions />
            </UserLayout>
        );
    } else if (/^\/user\/sessions\/\d+$/.test(currentPath)) {
        if (!userToken) {
            window.location.href = "/";
            return;
        }

        page = (
            <UserLayout currentPath="/user/sessions" immersive={true}>
                <UserSessionDetails />
            </UserLayout>
        );
    } else if (currentPath === "/user/documents") {
        if (!userToken) {
            window.location.href = "/";
            return;
        }

        page = (
            <UserLayout currentPath={currentPath}>
                <UserDocuments />
            </UserLayout>
        );
    } else if (currentPath === "/user/tasks") {
        if (!userToken) {
            window.location.href = "/";
            return;
        }

        page = (
            <UserLayout currentPath={currentPath}>
                <UserTasks />
            </UserLayout>
        );
    } else if (currentPath === "/user/notifications") {
        if (!userToken) {
            window.location.href = "/";
            return;
        }

        page = (
            <UserLayout currentPath={currentPath}>
                <UserNotifications />
            </UserLayout>
        );
    } else if (currentPath === "/user/google-drive") {
        if (!userToken) {
            window.location.href = "/";
            return;
        }

        page = (
            <UserLayout currentPath={currentPath}>
                <UserGoogleDrive />
            </UserLayout>
        );
    } else if (currentPath === "/user/gmail") {
        if (!userToken) {
            window.location.href = "/";
            return;
        }

        page = (
            <UserLayout currentPath={currentPath}>
                <UserGmail />
            </UserLayout>
        );
    } else if (currentPath === "/user/settings") {
        if (!userToken) {
            window.location.href = "/";
            return;
        }

        page = (
            <UserLayout currentPath={currentPath}>
                <UserAccount />
            </UserLayout>
        );
    } else if (currentPath === "/user/account" || currentPath === "/user/profile") {
        window.location.href = "/user/settings";
        return;
    } else {
        page = <UserLogin />;
    }

    if (userQueryPersister) {
        root.render(
            <PersistQueryClientProvider
                client={userQueryClient}
                persistOptions={{
                    persister: userQueryPersister,
                    maxAge: userQueryPersistMaxAgeMs,
                }}
            >
                {page}
            </PersistQueryClientProvider>
        );
        return;
    }

    root.render(<QueryClientProvider client={userQueryClient}>{page}</QueryClientProvider>);
}

renderApp();
