import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import "../../../css/user/pages/user-session-details.css";
import FolderIcon from "../../assets/images/folder.png";
import GoogleDriveIcon from "../../assets/images/google-drive.png";
import useAnimatedPresence from "../../hooks/useAnimatedPresence";
import { animateStaggerReveal, cleanupMotion } from "../utils/animeMotion";

/* ── Dummy Data ─────────────────────────────────────────────────────────── */
const DUMMY_SESSION = {
    id:          1,
    title:       "March Payroll Notice",
    type:        "Payroll",
    status:      "active",
    createdBy:   "Jhon Potestas",
    createdAt:   "Apr 3, 2026",
    deadline:    "Apr 7, 2026",
    description: "Monthly payroll notice for all faculty and staff for March 2026. All signatories must acknowledge receipt.",
    driveFile:   "smcbi-dts / payroll / 2026 / march-payroll-notice",
    driveLink:   "https://drive.google.com/drive/my-drive",
    docsLink:    "https://docs.google.com/document",
    emailsSent:  3,
    totalEmails: 5,
    lastNotified: "Apr 4, 2026 · 9:00 AM",
    signatories: [
        { id: 1, initials: "JP", name: "Jhon Potestas",   role: "Faculty · Initiator", email: "jhon.potestas@smcbi.edu.ph",   status: "signed",  signedAt: "Apr 3 · 2:45 PM",  order: 1, isViewer: false },
        { id: 2, initials: "MA", name: "Maria Alcantara",  role: "Department Head",     email: "maria.alcantara@smcbi.edu.ph",  status: "viewed",  signedAt: null,               order: 2, isViewer: false },
        { id: 3, initials: "RS", name: "Roberto Santos",   role: "Principal",           email: "roberto.santos@smcbi.edu.ph",   status: "pending", signedAt: null,               order: 3, isViewer: false },
        { id: 4, initials: "LC", name: "Lourdes Cruz",     role: "Finance Officer",     email: "lourdes.cruz@smcbi.edu.ph",     status: "waiting", signedAt: null,               order: 4, isViewer: false },
        { id: 5, initials: "BT", name: "Ben Tolentino",    role: "HR Office",           email: "ben.tolentino@smcbi.edu.ph",    status: "waiting", signedAt: null,               order: 5, isViewer: false },
        { id: 6, initials: "AC", name: "Ana Cortez",       role: "Admin Staff",         email: "ana.cortez@smcbi.edu.ph",       status: "waiting", signedAt: null,               order: null, isViewer: true },
    ],
    activity: [
        { id: 1, type: "signed",   initials: "JP", name: "Jhon Potestas",  text: "signed the document",             time: "Apr 3 · 2:45 PM",  color: "#22c55e" },
        { id: 2, type: "viewed",   initials: "MA", name: "Maria Alcantara", text: "viewed the document",             time: "Apr 4 · 10:12 AM", color: "#3b82f6" },
        { id: 3, type: "email",    initials: null, name: null,              text: "Email sent to Roberto Santos",    time: "Apr 4 · 9:00 AM",  color: "#6366f1" },
        { id: 4, type: "drive",    initials: null, name: null,              text: "Document saved to Google Drive",  time: "Apr 3 · 2:00 PM",  color: "#22c55e" },
        { id: 5, type: "created",  initials: "JP", name: "Jhon Potestas",  text: "created this session",            time: "Apr 3 · 1:55 PM",  color: "#22c55e" },
    ],
    emailLog: [
        { id: 1, to: "jhon.potestas@smcbi.edu.ph",   subject: "Document Session Created",          time: "Apr 3 · 1:56 PM",  status: "delivered" },
        { id: 2, to: "maria.alcantara@smcbi.edu.ph",  subject: "Action Required: Sign Document",    time: "Apr 3 · 2:50 PM",  status: "delivered" },
        { id: 3, to: "roberto.santos@smcbi.edu.ph",   subject: "Action Required: Sign Document",    time: "Apr 4 · 9:00 AM",  status: "delivered" },
        { id: 4, to: "lourdes.cruz@smcbi.edu.ph",     subject: "Pending: Awaiting your signature",  time: "Apr 4 · 9:01 AM",  status: "pending"   },
        { id: 5, to: "ben.tolentino@smcbi.edu.ph",    subject: "Pending: Awaiting your signature",  time: "Apr 4 · 9:01 AM",  status: "pending"   },
    ],
};

const SESSION_SUMMARIES = [
    {
        id: 1,
        title: "March Payroll Notice",
        type: "Payroll",
        status: "active",
        createdBy: "Jhon Potestas",
        createdAt: "Apr 3, 2026",
        deadline: "Apr 7, 2026",
        signatories: [
            { initials: "JP", name: "Jhon Potestas", role: "Faculty", status: "signed" },
            { initials: "MA", name: "Maria Alcantara", role: "Dept. Head", status: "viewed" },
            { initials: "RS", name: "Roberto Santos", role: "Principal", status: "pending" },
            { initials: "LC", name: "Lourdes Cruz", role: "Finance Officer", status: "waiting" },
            { initials: "BT", name: "Ben Tolentino", role: "HR Office", status: "waiting" },
        ],
    },
    {
        id: 2,
        title: "Faculty Meeting Memo",
        type: "Notice",
        status: "active",
        createdBy: "Jhon Potestas",
        createdAt: "Apr 2, 2026",
        deadline: "Apr 8, 2026",
        signatories: [
            { initials: "JP", name: "Jhon Potestas", role: "Faculty", status: "signed" },
            { initials: "MA", name: "Maria Alcantara", role: "Dept. Head", status: "signed" },
            { initials: "RS", name: "Roberto Santos", role: "Principal", status: "signed" },
            { initials: "LC", name: "Lourdes Cruz", role: "Finance", status: "pending" },
        ],
    },
    {
        id: 3,
        title: "Leave Application - Feb 2026",
        type: "Request",
        status: "completed",
        createdBy: "Jhon Potestas",
        createdAt: "Mar 20, 2026",
        deadline: "Mar 28, 2026",
        signatories: [
            { initials: "JP", name: "Jhon Potestas", role: "Faculty", status: "signed" },
            { initials: "RS", name: "Roberto Santos", role: "Principal", status: "signed" },
            { initials: "HR", name: "HR Office", role: "HR", status: "signed" },
        ],
    },
    {
        id: 4,
        title: "Budget Proposal Q2 2026",
        type: "Memo",
        status: "draft",
        createdBy: "Jhon Potestas",
        createdAt: "Apr 1, 2026",
        deadline: "Apr 10, 2026",
        signatories: [
            { initials: "JP", name: "Jhon Potestas", role: "Faculty", status: "waiting" },
            { initials: "MA", name: "Maria Alcantara", role: "Dept. Head", status: "waiting" },
            { initials: "RS", name: "Roberto Santos", role: "Principal", status: "waiting" },
        ],
    },
    {
        id: 5,
        title: "IT Equipment Request",
        type: "Request",
        status: "overdue",
        createdBy: "Jhon Potestas",
        createdAt: "Mar 25, 2026",
        deadline: "Apr 1, 2026",
        signatories: [
            { initials: "JP", name: "Jhon Potestas", role: "Faculty", status: "signed" },
            { initials: "MA", name: "Maria Alcantara", role: "Dept. Head", status: "pending" },
            { initials: "RS", name: "Roberto Santos", role: "Principal", status: "waiting" },
        ],
    },
    {
        id: 6,
        title: "Annual Report Summary",
        type: "Report",
        status: "completed",
        createdBy: "Jhon Potestas",
        createdAt: "Mar 10, 2026",
        deadline: "Mar 20, 2026",
        signatories: [
            { initials: "JP", name: "Jhon Potestas", role: "Faculty", status: "signed" },
            { initials: "MA", name: "Maria Alcantara", role: "Dept. Head", status: "signed" },
            { initials: "RS", name: "Roberto Santos", role: "Principal", status: "signed" },
            { initials: "LC", name: "Lourdes Cruz", role: "Finance Officer", status: "signed" },
        ],
    },
];

const toSlug = (value) =>
    String(value || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

const toEmail = (name) =>
    `${String(name || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ".")
        .replace(/^\.+|\.+$/g, "") || "user"}@smcbi.edu.ph`;

const GOOGLE_RESOURCE_ID_REGEX = /^[A-Za-z0-9_-]{10,200}$/;

const isSafeGoogleResourceId = (value) =>
    GOOGLE_RESOURCE_ID_REGEX.test(String(value || "").trim());

const getDriveLikePreviewUrl = (file, nonce = 0) => {
    const fileId = String(file?.id || "").trim();
    if (!isSafeGoogleResourceId(fileId)) return "";
    const qs = `rm=minimal&embedded=true&t=${nonce || Date.now()}`;
    if (file?.mimeType === "application/vnd.google-apps.document") {
        return `https://docs.google.com/document/d/${fileId}/preview?${qs}`;
    }
    if (file?.mimeType === "application/vnd.google-apps.spreadsheet") {
        return `https://docs.google.com/spreadsheets/d/${fileId}/preview?${qs}`;
    }
    if (file?.mimeType === "application/vnd.google-apps.presentation") {
        return `https://docs.google.com/presentation/d/${fileId}/preview?${qs}`;
    }
    return `https://drive.google.com/file/d/${fileId}/preview?t=${nonce || Date.now()}`;
};

const buildSessionFromSummary = (summary) => {
    if (!summary) return DUMMY_SESSION;

    const normalizedSignatories = (summary.signatories || []).map((sig, index) => ({
        id: index + 1,
        initials: sig.initials || (sig.name || "?").slice(0, 2).toUpperCase(),
        name: sig.name || "Unknown",
        role: sig.role || "Personnel",
        email: toEmail(sig.name),
        status: sig.status || "waiting",
        signedAt: sig.status === "signed" ? `${summary.createdAt} · 2:45 PM` : null,
        order: sig.status === "waiting" ? index + 1 : index + 1,
        isViewer: false,
    }));

    const signedCount = normalizedSignatories.filter((sig) => sig.status === "signed").length;
    const nonSigned = normalizedSignatories.filter((sig) => sig.status !== "signed");

    return {
        ...DUMMY_SESSION,
        ...summary,
        description: `${summary.type} document session for "${summary.title}".`,
        driveFile: `smcbi-dts / ${summary.type.toLowerCase()} / 2026 / ${toSlug(summary.title)}`,
        emailsSent: signedCount,
        totalEmails: normalizedSignatories.length,
        lastNotified: `${summary.createdAt} · 9:00 AM`,
        signatories: normalizedSignatories,
        activity: [
            {
                id: 1,
                type: "created",
                initials: normalizedSignatories[0]?.initials || "JP",
                name: summary.createdBy,
                text: "created this session",
                time: `${summary.createdAt} · 1:55 PM`,
                color: "#22c55e",
            },
            {
                id: 2,
                type: "email",
                initials: null,
                name: null,
                text: "Email notifications sent to signatories",
                time: `${summary.createdAt} · 2:00 PM`,
                color: "#6366f1",
            },
            ...normalizedSignatories
                .filter((sig) => sig.status === "signed" || sig.status === "viewed")
                .slice(0, 3)
                .map((sig, index) => ({
                    id: index + 3,
                    type: sig.status,
                    initials: sig.initials,
                    name: sig.name,
                    text: sig.status === "signed" ? "signed the document" : "viewed the document",
                    time: `${summary.createdAt} · 2:${10 + index} PM`,
                    color: sig.status === "signed" ? "#22c55e" : "#3b82f6",
                })),
        ],
        emailLog: normalizedSignatories.map((sig, index) => ({
            id: index + 1,
            to: sig.email,
            subject: `Action Required: ${summary.title}`,
            time: `${summary.createdAt} · ${2 + Math.floor(index / 2)}:${index % 2 ? "35" : "15"} PM`,
            status: sig.status === "signed" || sig.status === "viewed" ? "delivered" : "pending",
        })),
        nextApprover: nonSigned[0]?.name || "",
    };
};

const formatSessionDate = (value) => {
    if (!value) return "-";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "-";
    return parsed.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
};

const formatSessionDateTime = (value) => {
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

const isWordMimeType = (mimeType) =>
    [
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/msword",
    ].includes(String(mimeType || ""));

const getSessionFileSigningMeta = (file) => {
    if (!file) {
        return {
            sourceLabel: "Unknown source",
            signingLabel: "Signable target unavailable",
            converted: false,
        };
    }

    const converted = Boolean(file.is_converted_for_signing);
    const sourceLabel = isWordMimeType(file.source_mime_type)
        ? "Word source"
        : (file.source_mime_type === "application/vnd.google-apps.document" ? "Google Doc source" : "Drive source");

    return {
        sourceLabel,
        signingLabel: converted ? "Converted Google Doc" : "Google Doc signable copy",
        converted,
    };
};

const getActivityColor = (type) => ({
    created_session: "#22c55e",
    added_signatory: "#6366f1",
    accepted_session_invitation: "#0f766e",
    declined_session_invitation: "#dc2626",
    rescanned_placeholders: "#8b5cf6",
    updated_signatory: "#3b82f6",
    assigned_placeholder: "#f59e0b",
    unassigned_placeholder: "#ef4444",
    attached_file: "#0f766e",
    signed: "#22c55e",
})[type] || "#6366f1";

const getActivityText = (activity) => ({
    created_session: "created this session",
    added_signatory: `added ${activity?.meta?.target_user_name || "a signatory"} to the session`,
    accepted_session_invitation: `${activity?.meta?.target_user_name || "A signatory"} accepted the session invitation`,
    declined_session_invitation: `${activity?.meta?.target_user_name || "A signatory"} declined the session invitation`,
    rescanned_placeholders: "rescanned registered placeholders for this session",
    updated_signatory: `updated ${activity?.meta?.target_user_id ? "a session member" : "session member settings"}`,
    assigned_placeholder: `assigned ${activity?.meta?.placeholder_key || "a placeholder"}`,
    unassigned_placeholder: `unassigned ${activity?.meta?.placeholder_key || "a placeholder"}`,
    attached_file: `attached ${activity?.meta?.name || "a file"} to the session`,
    signed: "signed the document",
})[activity?.type] || "updated the session";

const buildSessionFromApi = (apiSession) => {
    if (!apiSession) return DUMMY_SESSION;

    const members = Array.isArray(apiSession.members) ? apiSession.members : [];
    const placeholders = Array.isArray(apiSession.placeholders) ? apiSession.placeholders : [];
    const files = Array.isArray(apiSession.files) ? apiSession.files : [];
    const activities = Array.isArray(apiSession.activities) ? apiSession.activities : [];
    const primaryFile = files.find((file) => file.is_primary_document) || files[0] || null;

    const normalizedSignatories = members.map((member, index) => ({
        id: member.id,
        initials: (member.name || "?").split(" ").map((part) => part[0] || "").join("").slice(0, 2).toUpperCase(),
        name: member.name || "Unknown",
        role:
            member.role === "session_admin"
                ? "Creator"
                : (member.display_role_name || member.role || "Personnel"),
        email: member.email || toEmail(member.name),
        status: member.member_status || "waiting",
        signedAt: member.signed_at ? formatSessionDateTime(member.signed_at) : null,
        order: member.sign_order || index + 1,
        isViewer: !member.permissions?.can_sign,
        isCreator: member.role === "session_admin",
    }));

    const signedCount = placeholders.filter((placeholder) => placeholder.status === "signed").length;
    const nonSigned = normalizedSignatories.filter((sig) => !sig.isViewer && sig.status !== "signed");
    const signatoryCount = normalizedSignatories.filter((sig) => !sig.isViewer).length;
    const activityItems = activities.map((activity) => ({
        id: activity.id,
        type: activity.type,
        initials: activity.user_name
            ? activity.user_name.split(" ").map((part) => part[0] || "").join("").slice(0, 2).toUpperCase()
            : null,
        name: activity.user_name || null,
        text: getActivityText(activity),
        time: formatSessionDateTime(activity.created_at),
        color: getActivityColor(activity.type),
    }));

    return {
        ...DUMMY_SESSION,
        id: apiSession.id,
        title: apiSession.title || DUMMY_SESSION.title,
        type: apiSession.document_type || "Document",
        status: apiSession.status || "draft",
        createdBy: apiSession.creator?.name || "Unknown",
        createdAt: formatSessionDate(apiSession.created_at),
        deadline: formatSessionDate(apiSession.deadline_at),
        description: apiSession.description || DUMMY_SESSION.description,
        driveFile: primaryFile?.name || DUMMY_SESSION.driveFile,
        driveLink: primaryFile?.web_view_link || DUMMY_SESSION.driveLink,
        docsLink: apiSession.google_doc_file_id
            ? `https://docs.google.com/document/d/${apiSession.google_doc_file_id}/edit`
            : DUMMY_SESSION.docsLink,
        emailsSent: activityItems.filter((item) => item.type === "assigned_placeholder").length,
        totalEmails: signatoryCount,
        lastNotified: activityItems[0]?.time || "-",
        signatories: normalizedSignatories,
        activity: activityItems.length > 0 ? activityItems : DUMMY_SESSION.activity,
        emailLog: DUMMY_SESSION.emailLog,
        nextApprover: nonSigned[0]?.name || "",
        currentMember: apiSession.current_member || null,
        sessionFiles: files,
        googleDocFileId: apiSession.google_doc_file_id || "",
        placeholders,
        scanResults: apiSession.scan_results || null,
        matchedPlaceholderCount: placeholders.length,
        signedPlaceholderCount: signedCount,
    };
};

const STATUS_LABEL = { signed: "Signed", viewed: "Viewed", pending: "Pending", waiting: "Waiting", accepted: "Accepted" };
const STATUS_COLOR = { signed: "#22c55e", viewed: "#3b82f6", pending: "#f59e0b", waiting: "#d1d5db", accepted: "#14b8a6" };
const STATUS_TEXT  = { signed: "#166534", viewed: "#1d4ed8", pending: "#92400e", waiting: "#6b7280", accepted: "#115e59" };
const STATUS_BG    = { signed: "#dcfce7", viewed: "#dbeafe", pending: "#fef3c7", waiting: "#f3f4f6", accepted: "#ccfbf1" };

/* ── Layouts ────────────────────────────────────────────────────────────── */
const LAYOUTS = [
    { id: "default",  label: "Default",  icon: "◫" },
    { id: "expanded", label: "Expanded", icon: "▣" },
    { id: "compact",  label: "Compact",  icon: "⊟" },
    { id: "immersive",label: "Immersive",icon: "⊞" },
];

/* ── Component ──────────────────────────────────────────────────────────── */
function UserSessionDetails() {
    const navigate = (path) => {
        if (window.location.pathname !== path) {
            window.location.href = path;
        }
    };
    const sessionIdFromPath = useMemo(() => {
        const match = window.location.pathname.match(/\/user\/sessions\/([^/?#]+)/i);
        const parsed = Number(match?.[1]);
        return Number.isFinite(parsed) ? parsed : null;
    }, []);

    const fallbackSession = useMemo(() => {
        const matched = SESSION_SUMMARIES.find((item) => item.id === sessionIdFromPath);
        return buildSessionFromSummary(matched || SESSION_SUMMARIES[0]);
    }, [sessionIdFromPath]);

    const [activeTab,  setActiveTab]  = useState("details");  // details | activity | emaillog
    const [layout,     setLayout]     = useState("default");
    const [showAddModal,    setShowAddModal]    = useState(false);
    const [showCloseModal,  setShowCloseModal]  = useState(false);
    const [showNotifModal,  setShowNotifModal]  = useState(false);
    const [leftWidth, setLeftWidth] = useState(250);
    const [rightWidth, setRightWidth] = useState(230);
    const [driveWidth, setDriveWidth] = useState(560);
    const [immersiveSignWidth, setImmersiveSignWidth] = useState(300);
    const [footerHeight, setFooterHeight] = useState(180);
    const [docDropActive, setDocDropActive] = useState(false);
    const [panelPreviewFile, setPanelPreviewFile] = useState(null);
    const [panelPreviewError, setPanelPreviewError] = useState("");
    const [panelPreviewNonce, setPanelPreviewNonce] = useState(0);
    const [pageReady, setPageReady] = useState(false);
    const [driveItems, setDriveItems] = useState([]);
    const [driveLoading, setDriveLoading] = useState(false);
    const [driveError, setDriveError] = useState("");
    const [driveTrail, setDriveTrail] = useState([]);
    const [memberSearch, setMemberSearch] = useState("");
    const [addMemberForm, setAddMemberForm] = useState({
        userId: "",
        role: "signatory",
        displayRoleName: "",
        signOrder: "",
        useRoutingOrder: true,
    });
    const [memberActionError, setMemberActionError] = useState("");
    const [assigningPlaceholderId, setAssigningPlaceholderId] = useState(null);
    const [showAddFileModal, setShowAddFileModal] = useState(false);
    const [showAddSignatureModal, setShowAddSignatureModal] = useState(false);
    const addModalPresence = useAnimatedPresence(showAddModal, { exitDurationMs: 240 });
    const closeModalPresence = useAnimatedPresence(showCloseModal, { exitDurationMs: 220 });
    const notifModalPresence = useAnimatedPresence(showNotifModal, { exitDurationMs: 240 });
    const addFileModalPresence = useAnimatedPresence(showAddFileModal, { exitDurationMs: 220 });
    const addSignatureModalPresence = useAnimatedPresence(showAddSignatureModal, { exitDurationMs: 240 });
    const [attachFileError, setAttachFileError] = useState("");
    const [attachFileSelection, setAttachFileSelection] = useState(null);
    const [activePlaceholderFileTab, setActivePlaceholderFileTab] = useState(null);
    const [activeSignatureFileTab, setActiveSignatureFileTab] = useState(null);
    const [signingPlaceholderId, setSigningPlaceholderId] = useState(null);
    const [signatureActionError, setSignatureActionError] = useState("");
    const [rescanActionError, setRescanActionError] = useState("");
    const [activeMemberMenuId, setActiveMemberMenuId] = useState(null);
    const [activeMemberMenuMode, setActiveMemberMenuMode] = useState("actions");
    const [memberMenuError, setMemberMenuError] = useState("");
    const resizeStateRef = useRef(null);
    const pageRef = useRef(null);
    const driveGridRef = useRef(null);
    const docFilesRailRef = useRef(null);
    const addMemberModalRef = useRef(null);
    const addFileOverlayRef = useRef(null);
    const addSignatureModalRef = useRef(null);
    const closeSessionModalRef = useRef(null);
    const notifModalRef = useRef(null);
    const queryClient = useQueryClient();

    const buildAuthConfig = () => {
        const token = localStorage.getItem("user_token");
        return { headers: { Accept: "application/json", Authorization: `Bearer ${token || ""}` } };
    };

    const sessionQuery = useQuery({
        queryKey: ["user-session-details", sessionIdFromPath],
        enabled: Boolean(sessionIdFromPath),
        queryFn: async () => {
            const { data } = await axios.get(`/api/user/sessions/${sessionIdFromPath}`, buildAuthConfig());
            return data;
        },
        refetchInterval: 4000,
        refetchIntervalInBackground: true,
        refetchOnWindowFocus: true,
    });

    const session = useMemo(() => {
        if (sessionQuery.data?.session) {
            return buildSessionFromApi(sessionQuery.data.session);
        }
        return fallbackSession;
    }, [fallbackSession, sessionQuery.data]);

    const signatories = session.signatories.filter((s) => !s.isViewer);
    const creatorMembers = session.signatories.filter((s) => s.isCreator);
    const viewers = session.signatories.filter((s) => s.isViewer && !s.isCreator);
    const sessionMemberRecords = Array.isArray(sessionQuery.data?.session?.members) ? sessionQuery.data.session.members : [];
    const sessionMemberMap = useMemo(
        () => new Map(sessionMemberRecords.map((member) => [Number(member.id), member])),
        [sessionMemberRecords]
    );
    const signed      = signatories.filter((s) => s.status === "signed").length;
    const pct         = Math.round((signed / signatories.length) * 100);
    const next        = signatories.find((s) => s.status !== "signed");
    const currentMemberPermissions = session.currentMember?.permissions || {};
    const sessionStatusLabel = String(session.status || "")
        .replace(/_/g, " ")
        .replace(/\b\w/g, (char) => char.toUpperCase());

    const isCompact   = layout === "compact";
    const isImmersive = layout === "immersive";
    const isExpanded  = layout === "expanded";
    const canManageSignatories = Boolean(currentMemberPermissions.can_manage_signatories);
    const canSendNotifications = Boolean(currentMemberPermissions.can_send_notifications);
    const canCloseSession = Boolean(currentMemberPermissions.can_close_session);
    const canViewDrivePanel = currentMemberPermissions.can_view_drive_panel !== false;
    const canAddFiles = Boolean(currentMemberPermissions.can_add_files);
    const canSign = Boolean(currentMemberPermissions.can_sign);
    const currentMemberIsCreator = session.currentMember?.role === "session_admin";
    const usersQuery = useQuery({
        queryKey: ["session-member-options"],
        enabled: canManageSignatories,
        queryFn: async () => {
            const { data } = await axios.get("/api/admin/users", { headers: { Accept: "application/json" } });
            return data;
        },
    });
    const accountSignaturesQuery = useQuery({
        queryKey: ["user-account-signatures"],
        enabled: showAddSignatureModal && canSign,
        queryFn: async () => {
            const { data } = await axios.get("/api/user/account/signatures", buildAuthConfig());
            return data;
        },
    });
    const currentDriveFolder = driveTrail[driveTrail.length - 1] || null;
    const currentDriveFolderId = currentDriveFolder?.id || "";
    const panelPreviewUrl = useMemo(
        () => getDriveLikePreviewUrl(panelPreviewFile, panelPreviewNonce),
        [panelPreviewFile, panelPreviewNonce]
    );
    const memberOptions = useMemo(() => {
        const users = Array.isArray(usersQuery.data?.users) ? usersQuery.data.users : [];
        const existingEmails = new Set((session.signatories || []).map((member) => member.email));
        const query = memberSearch.trim().toLowerCase();

        return users.filter((user) => {
            if (existingEmails.has(user.email)) return false;
            if (query === "") return true;
            return (
                String(user.name || "").toLowerCase().includes(query) ||
                String(user.email || "").toLowerCase().includes(query) ||
                String(user.role || "").toLowerCase().includes(query)
            );
        });
    }, [memberSearch, session.currentMember, session.signatories, usersQuery.data]);
    const selectedMemberOption = useMemo(
        () => memberOptions.find((user) => String(user.id) === String(addMemberForm.userId)) || null,
        [addMemberForm.userId, memberOptions]
    );
    const assignableMembers = useMemo(() => {
        return (sessionQuery.data?.session?.members || []).filter((member) => member.permissions?.can_sign);
    }, [sessionQuery.data]);
    const sessionFiles = useMemo(
        () => (Array.isArray(session.sessionFiles) ? session.sessionFiles : []),
        [session.sessionFiles]
    );
    const primarySessionFile = useMemo(
        () => sessionFiles.find((file) => file.is_primary_document) || sessionFiles[0] || null,
        [sessionFiles]
    );
    const sessionDocumentFiles = useMemo(
        () => sessionFiles.filter((file) => file.google_drive_file_id),
        [sessionFiles]
    );
    const placeholders = useMemo(
        () => (Array.isArray(sessionQuery.data?.session?.placeholders) ? sessionQuery.data.session.placeholders : []),
        [sessionQuery.data]
    );
    const memberAssignablePlaceholders = useMemo(() => {
        const map = new Map();
        sessionMemberRecords.forEach((member) => {
            const options = placeholders.filter((placeholder) => {
                if (placeholder.status === "signed") return false;
                if (!placeholder.assigned_member_id) return true;
                return Number(placeholder.assigned_member_id) === Number(member.id);
            });
            map.set(Number(member.id), options);
        });
        return map;
    }, [placeholders, sessionMemberRecords]);
    const activeSessionFile = useMemo(() => {
        const previewId = String(panelPreviewFile?.id || "");
        return sessionDocumentFiles.find((file) => String(file.google_drive_file_id || "") === previewId)
            || primarySessionFile
            || null;
    }, [panelPreviewFile, primarySessionFile, sessionDocumentFiles]);
    const activeSessionFileMeta = useMemo(
        () => getSessionFileSigningMeta(activeSessionFile),
        [activeSessionFile]
    );
    const placeholderFiles = useMemo(() => {
        if (sessionFiles.length === 0) return [];
        return sessionFiles.map((file) => ({
            id: file.id,
            name: file.name || "Untitled file",
            placeholders: placeholders.filter((placeholder) => {
                if (placeholder.session_file_id) {
                    return Number(placeholder.session_file_id) === Number(file.id);
                }
                return file.is_primary_document;
            }),
        }));
    }, [placeholders, sessionFiles]);
    const currentPlaceholderFileId = useMemo(() => {
        if (activePlaceholderFileTab && placeholderFiles.some((file) => Number(file.id) === Number(activePlaceholderFileTab))) {
            return activePlaceholderFileTab;
        }
        return placeholderFiles[0]?.id || null;
    }, [activePlaceholderFileTab, placeholderFiles]);
    const signatureFiles = useMemo(() => {
        const currentMemberId = session.currentMember?.id;
        if (!currentMemberId) return [];

        return placeholderFiles
            .map((file) => ({
                ...file,
                placeholders: currentMemberIsCreator
                    ? file.placeholders
                    : file.placeholders.filter(
                        (placeholder) => Number(placeholder.assigned_member_id) === Number(currentMemberId)
                    ),
            }))
            .filter((file) => file.placeholders.length > 0);
    }, [currentMemberIsCreator, placeholderFiles, session.currentMember]);
    const currentSignatureFileId = useMemo(() => {
        if (activeSignatureFileTab && signatureFiles.some((file) => Number(file.id) === Number(activeSignatureFileTab))) {
            return activeSignatureFileTab;
        }
        return signatureFiles[0]?.id || null;
    }, [activeSignatureFileTab, signatureFiles]);
    const activeAccountSignature = accountSignaturesQuery.data?.active_asset || null;
    const creatorSignedPlaceholder = useMemo(() => {
        if (!currentMemberIsCreator) return null;
        return placeholders.find((placeholder) => Number(placeholder.signed_by_user_id) === Number(session.currentMember?.user_id)) || null;
    }, [currentMemberIsCreator, placeholders, session.currentMember]);

    useEffect(() => {
        const motion = animateStaggerReveal(pageRef.current, {
            selector: "[data-usd-layout-item]",
            duration: 700,
            staggerMs: 54,
            startDelayMs: 24,
        });

        if (!motion) {
            return undefined;
        }

        return () => {
            cleanupMotion(motion);
        };
    }, [layout, session.id, isImmersive, isExpanded]);

    useEffect(() => {
        const motion = animateStaggerReveal(driveGridRef.current, {
            selector: "[data-usd-drive-item]",
            duration: 620,
            staggerMs: 36,
            startDelayMs: 12,
        });

        if (!motion) {
            return undefined;
        }

        return () => {
            cleanupMotion(motion);
        };
    }, [driveItems.length, driveLoading, driveError, currentDriveFolderId]);

    useEffect(() => {
        const motion = animateStaggerReveal(docFilesRailRef.current, {
            selector: "[data-usd-doc-file-item]",
            duration: 560,
            staggerMs: 42,
            startDelayMs: 8,
        });

        if (!motion) {
            return undefined;
        }

        return () => {
            cleanupMotion(motion);
        };
    }, [sessionDocumentFiles.length, panelPreviewFile?.id]);

    useEffect(() => {
        if (!addModalPresence.isVisible) {
            return undefined;
        }

        const motion = animateStaggerReveal(addMemberModalRef.current, {
            selector: "[data-usd-modal-item]",
            duration: 520,
            staggerMs: 42,
            startDelayMs: 0,
        });

        if (!motion) {
            return undefined;
        }

        return () => {
            cleanupMotion(motion);
        };
    }, [addModalPresence.isVisible, memberOptions.length, memberActionError]);

    useEffect(() => {
        if (!addFileModalPresence.isVisible) {
            return undefined;
        }

        const motion = animateStaggerReveal(addFileOverlayRef.current, {
            selector: "[data-usd-overlay-item]",
            duration: 500,
            staggerMs: 38,
            startDelayMs: 0,
        });

        if (!motion) {
            return undefined;
        }

        return () => {
            cleanupMotion(motion);
        };
    }, [addFileModalPresence.isVisible, attachFileError, Boolean(attachFileSelection)]);

    useEffect(() => {
        if (!addSignatureModalPresence.isVisible) {
            return undefined;
        }

        const motion = animateStaggerReveal(addSignatureModalRef.current, {
            selector: "[data-usd-modal-item]",
            duration: 540,
            staggerMs: 40,
            startDelayMs: 0,
        });

        if (!motion) {
            return undefined;
        }

        return () => {
            cleanupMotion(motion);
        };
    }, [addSignatureModalPresence.isVisible, signatureFiles.length, signatureActionError]);

    useEffect(() => {
        if (!closeModalPresence.isVisible) {
            return undefined;
        }

        const motion = animateStaggerReveal(closeSessionModalRef.current, {
            selector: "[data-usd-modal-item]",
            duration: 460,
            staggerMs: 36,
            startDelayMs: 0,
        });

        if (!motion) {
            return undefined;
        }

        return () => {
            cleanupMotion(motion);
        };
    }, [closeModalPresence.isVisible]);

    useEffect(() => {
        if (!notifModalPresence.isVisible) {
            return undefined;
        }

        const motion = animateStaggerReveal(notifModalRef.current, {
            selector: "[data-usd-modal-item]",
            duration: 500,
            staggerMs: 38,
            startDelayMs: 0,
        });

        if (!motion) {
            return undefined;
        }

        return () => {
            cleanupMotion(motion);
        };
    }, [notifModalPresence.isVisible, signatories.length]);

    const getSignatureSlotState = (placeholder) => {
        if (!activeAccountSignature) {
            return {
                disabled: true,
                buttonLabel: "Save signature first",
                reason: "No active saved signature is configured in your account yet.",
            };
        }

        if (placeholder.status === "signed") {
            return {
                disabled: true,
                buttonLabel: "Already signed",
                reason: placeholder.signed_by_user_id
                    ? "This placeholder has already been signed."
                    : "This placeholder is no longer available.",
            };
        }

        if (signingPlaceholderId === placeholder.id) {
            return {
                disabled: true,
                buttonLabel: "Applying...",
                reason: "",
            };
        }

        if (currentMemberIsCreator) {
            if (
                placeholder.assigned_member_id &&
                Number(placeholder.assigned_member_id) !== Number(session.currentMember?.id)
            ) {
                return {
                    disabled: true,
                    buttonLabel: "Locked",
                    reason: `Assigned to ${placeholder.assigned_user_name || "another signatory"}.`,
                };
            }

            if (creatorSignedPlaceholder && Number(creatorSignedPlaceholder.id) !== Number(placeholder.id)) {
                return {
                    disabled: true,
                    buttonLabel: "Locked",
                    reason: `You already signed ${creatorSignedPlaceholder.label || creatorSignedPlaceholder.placeholder_key}.`,
                };
            }

            return {
                disabled: false,
                buttonLabel: "Use saved signature",
                reason: "Creator may sign one available placeholder in this session.",
            };
        }

        if (Number(placeholder.assigned_member_id) !== Number(session.currentMember?.id)) {
            return {
                disabled: true,
                buttonLabel: "Not assigned",
                reason: "This placeholder is not assigned to your account.",
            };
        }

        return {
            disabled: false,
            buttonLabel: "Use saved signature",
            reason: "This placeholder is assigned to your account.",
        };
    };

    const refreshSessionData = async () => {
        await Promise.all([
            queryClient.invalidateQueries({ queryKey: ["user-session-details", sessionIdFromPath] }),
            queryClient.invalidateQueries({ queryKey: ["user-sessions"] }),
        ]);
    };

    useEffect(() => {
        setMemberMenuError("");
        if (!activeMemberMenuId) {
            setActiveMemberMenuMode("actions");
        }
    }, [activeMemberMenuId]);

    const addMemberMutation = useMutation({
        mutationFn: async (payload) => {
            const { data } = await axios.post(
                `/api/user/sessions/${sessionIdFromPath}/members`,
                payload,
                buildAuthConfig()
            );
            return data;
        },
        onSuccess: async () => {
            setShowAddModal(false);
            setMemberActionError("");
            setMemberSearch("");
            setAddMemberForm({
                userId: "",
                role: "signatory",
                displayRoleName: "",
                signOrder: "",
                useRoutingOrder: true,
            });
            await refreshSessionData();
        },
        onError: (error) => {
            setMemberActionError(
                error?.response?.data?.message ||
                Object.values(error?.response?.data?.errors || {})[0]?.[0] ||
                "Failed to add session member."
            );
        },
    });

    const assignPlaceholderMutation = useMutation({
        mutationFn: async ({ placeholderId, assignedMemberId }) => {
            const endpoint = assignedMemberId
                ? `/api/user/sessions/${sessionIdFromPath}/placeholders/${placeholderId}/assign`
                : `/api/user/sessions/${sessionIdFromPath}/placeholders/${placeholderId}/unassign`;
            const method = assignedMemberId ? "patch" : "patch";
            const config = buildAuthConfig();
            const response = assignedMemberId
                ? await axios[method](endpoint, { assigned_member_id: assignedMemberId }, config)
                : await axios[method](endpoint, {}, config);
            return response.data;
        },
        onMutate: ({ placeholderId }) => {
            setAssigningPlaceholderId(placeholderId);
            setMemberActionError("");
        },
        onSuccess: async () => {
            await refreshSessionData();
        },
        onError: (error) => {
            setMemberActionError(error?.response?.data?.message || "Failed to update placeholder assignment.");
        },
        onSettled: () => {
            setAssigningPlaceholderId(null);
        },
    });
    const attachFileMutation = useMutation({
        mutationFn: async (googleDriveFileId) => {
            const { data } = await axios.post(
                `/api/user/sessions/${sessionIdFromPath}/files`,
                {
                    google_drive_file_id: googleDriveFileId,
                    source: "drive",
                },
                buildAuthConfig()
            );
            return data;
        },
        onSuccess: async () => {
            setShowAddFileModal(false);
            setAttachFileError("");
            setAttachFileSelection(null);
            await refreshSessionData();
        },
        onError: (error) => {
            setAttachFileError(error?.response?.data?.message || "Failed to attach the selected file.");
        },
    });
    const signPlaceholderMutation = useMutation({
        mutationFn: async (placeholderId) => {
            const { data } = await axios.post(
                `/api/user/sessions/${sessionIdFromPath}/sign`,
                { placeholder_id: placeholderId },
                buildAuthConfig()
            );
            return data;
        },
        onMutate: (placeholderId) => {
            setSigningPlaceholderId(placeholderId);
            setSignatureActionError("");
        },
        onSuccess: async () => {
            await Promise.all([
                refreshSessionData(),
                queryClient.invalidateQueries({ queryKey: ["user-account-signatures"] }),
            ]);
        },
        onError: (error) => {
            setSignatureActionError(error?.response?.data?.message || "Failed to apply your saved signature.");
        },
        onSettled: () => {
            setSigningPlaceholderId(null);
        },
    });
    const rescanPlaceholdersMutation = useMutation({
        mutationFn: async () => {
            const { data } = await axios.post(
                `/api/user/sessions/${sessionIdFromPath}/rescan-placeholders`,
                {},
                buildAuthConfig()
            );
            return data;
        },
        onMutate: () => {
            setRescanActionError("");
        },
        onSuccess: async () => {
            await refreshSessionData();
        },
        onError: (error) => {
            setRescanActionError(
                error?.response?.data?.message || "Failed to rescan placeholders."
            );
        },
    });
    const updateMemberMutation = useMutation({
        mutationFn: async ({ memberId, payload }) => {
            const { data } = await axios.patch(
                `/api/user/sessions/${sessionIdFromPath}/members/${memberId}`,
                payload,
                buildAuthConfig()
            );
            return data;
        },
        onSuccess: async () => {
            setMemberMenuError("");
            setActiveMemberMenuId(null);
            await refreshSessionData();
        },
        onError: (error) => {
            setMemberMenuError(error?.response?.data?.message || "Failed to update the session member.");
        },
    });
    const removeMemberMutation = useMutation({
        mutationFn: async (memberId) => {
            const { data } = await axios.delete(
                `/api/user/sessions/${sessionIdFromPath}/members/${memberId}`,
                buildAuthConfig()
            );
            return data;
        },
        onSuccess: async () => {
            setMemberMenuError("");
            setActiveMemberMenuId(null);
            await refreshSessionData();
        },
        onError: (error) => {
            setMemberMenuError(error?.response?.data?.message || "Failed to remove the session member.");
        },
    });

    useEffect(() => {
        setPageReady(false);
        const raf = window.requestAnimationFrame(() => setPageReady(true));
        return () => window.cancelAnimationFrame(raf);
    }, [layout, session.id]);

    useEffect(() => {
        setLeftWidth(isCompact ? 220 : 250);
    }, [isCompact]);

    useEffect(() => {
        if (!showAddModal) {
            setMemberSearch("");
            setMemberActionError("");
            setAddMemberForm({
                userId: "",
                role: "signatory",
                displayRoleName: "",
                signOrder: "",
                useRoutingOrder: true,
            });
        }
    }, [showAddModal]);

    useEffect(() => {
        if (!showAddFileModal) {
            setAttachFileError("");
            setAttachFileSelection(null);
        }
    }, [showAddFileModal]);

    useEffect(() => {
        if (!showAddSignatureModal) {
            setSignatureActionError("");
            setSigningPlaceholderId(null);
        }
    }, [showAddSignatureModal]);

    useEffect(() => {
        if (!rescanPlaceholdersMutation.isSuccess) {
            return;
        }

        const timer = window.setTimeout(() => {
            setRescanActionError("");
            rescanPlaceholdersMutation.reset();
        }, 2600);

        return () => window.clearTimeout(timer);
    }, [rescanPlaceholdersMutation.isSuccess]);

    useEffect(() => {
        if (!activePlaceholderFileTab && placeholderFiles[0]?.id) {
            setActivePlaceholderFileTab(placeholderFiles[0].id);
        }
    }, [activePlaceholderFileTab, placeholderFiles]);

    useEffect(() => {
        if (!activeSignatureFileTab && signatureFiles[0]?.id) {
            setActiveSignatureFileTab(signatureFiles[0].id);
        }
    }, [activeSignatureFileTab, signatureFiles]);

    useEffect(() => {
        const primaryFile = session.sessionFiles?.find((file) => file.is_primary_document) || session.sessionFiles?.[0];
        const previewFileId = primaryFile?.google_drive_file_id || session.googleDocFileId || "";

        if (!previewFileId) {
            setPanelPreviewFile(null);
            return;
        }

        openFileInDocumentPanel({
            id: previewFileId,
            name: primaryFile?.name || session.title,
            mimeType: primaryFile?.mime_type || "application/vnd.google-apps.document",
            webViewLink: primaryFile?.web_view_link || session.driveLink || "",
            isFolder: false,
        });
    }, [session.googleDocFileId, session.driveLink, session.sessionFiles, session.title]);

    useEffect(() => {
        if (!canViewDrivePanel) {
            setDriveItems([]);
            setDriveLoading(false);
            setDriveError("");
            return undefined;
        }

        let cancelled = false;
        const fetchDriveItems = async () => {
            setDriveLoading(true);
            setDriveError("");
            try {
                const { data } = await axios.get("/api/user/google/drive/files", {
                    ...buildAuthConfig(),
                    params: {
                        pageSize: 100,
                        section: "my-drive",
                        parentId: currentDriveFolderId || undefined,
                    },
                });
                const files = data?.data?.files;
                if (!cancelled && Array.isArray(files)) {
                    const mapped = files.map((file) => ({
                        id: file.id,
                        name: file.name || "(Unnamed)",
                        mimeType: file.mimeType || "",
                        isFolder: file.mimeType === "application/vnd.google-apps.folder",
                        iconLink: file.iconLink || "",
                        webViewLink: file.webViewLink || "",
                    }));
                    mapped.sort((a, b) => Number(b.isFolder) - Number(a.isFolder));
                    setDriveItems(mapped);
                }
            } catch (error) {
                if (!cancelled) {
                    setDriveError(error?.response?.data?.message || "Failed to load My Drive.");
                    setDriveItems([]);
                }
            } finally {
                if (!cancelled) setDriveLoading(false);
            }
        };

        fetchDriveItems();
        return () => { cancelled = true; };
    }, [canViewDrivePanel, currentDriveFolderId]);


    useEffect(() => {
        const onMove = (event) => {
            if (!resizeStateRef.current) return;
            const drag = resizeStateRef.current;

            if (drag.type === "left") {
                const delta = event.clientX - drag.startX;
                const next = Math.min(420, Math.max(180, drag.startValue + delta));
                setLeftWidth(next);
            }

            if (drag.type === "footer") {
                const delta = drag.startY - event.clientY;
                const next = Math.min(340, Math.max(130, drag.startValue + delta));
                setFooterHeight(next);
            }

            if (drag.type === "right") {
                const delta = drag.startX - event.clientX;
                const next = Math.min(420, Math.max(180, drag.startValue + delta));
                setRightWidth(next);
            }

            if (drag.type === "footer-drive") {
                const delta = event.clientX - drag.startX;
                const next = Math.min(980, Math.max(320, drag.startValue + delta));
                setDriveWidth(next);
            }

            if (drag.type === "footer-sign") {
                const delta = event.clientX - drag.startX;
                const next = Math.min(620, Math.max(220, drag.startValue + delta));
                setImmersiveSignWidth(next);
            }

        };

        const onUp = () => {
            if (!resizeStateRef.current) return;
            resizeStateRef.current = null;
            document.body.style.cursor = "";
            document.body.style.userSelect = "";
        };

        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
        return () => {
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
        };
    }, []);

    const startLeftResize = (event) => {
        if (isImmersive) return;
        resizeStateRef.current = {
            type: "left",
            startX: event.clientX,
            startValue: leftWidth,
        };
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";
    };

    const startFooterDriveResize = (event) => {
        resizeStateRef.current = {
            type: "footer-drive",
            startX: event.clientX,
            startValue: driveWidth,
        };
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";
    };

    const startFooterSignResize = (event) => {
        if (!isImmersive) return;
        resizeStateRef.current = {
            type: "footer-sign",
            startX: event.clientX,
            startValue: immersiveSignWidth,
        };
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";
    };

    const startFooterResize = (event) => {
        resizeStateRef.current = {
            type: "footer",
            startY: event.clientY,
            startValue: footerHeight,
        };
        document.body.style.cursor = "row-resize";
        document.body.style.userSelect = "none";
    };

    const startRightResize = (event) => {
        if (!isExpanded) return;
        resizeStateRef.current = {
            type: "right",
            startX: event.clientX,
            startValue: rightWidth,
        };
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";
    };

    const openFileInDocumentPanel = (item) => {
        if (!item || item.isFolder) return;
        if (!isSafeGoogleResourceId(item.id)) {
            setPanelPreviewError("Invalid file reference. Please refresh Drive and try again.");
            return;
        }
        setPanelPreviewFile({
            id: item.id,
            name: String(item.name || "Untitled"),
            mimeType: String(item.mimeType || ""),
            webViewLink: String(item.webViewLink || ""),
            isFolder: false,
        });
        setPanelPreviewError("");
        setPanelPreviewNonce(Date.now());
    };

    const startDriveItemDrag = (event, item) => {
        if (!item || item.isFolder) return;
        event.dataTransfer.effectAllowed = "copy";
        event.dataTransfer.setData(
            "application/x-usd-drive-item",
            JSON.stringify({
                id: item.id,
                name: item.name,
                mimeType: item.mimeType,
                webViewLink: item.webViewLink,
                isFolder: item.isFolder,
            })
        );
    };

    const handleDocPanelDragOver = (event) => {
        event.preventDefault();
        if (!docDropActive) setDocDropActive(true);
    };

    const handleDocPanelDragLeave = (event) => {
        const nextTarget = event.relatedTarget;
        if (!event.currentTarget.contains(nextTarget)) {
            setDocDropActive(false);
        }
    };

    const handleDocPanelDrop = async (event) => {
        event.preventDefault();
        setDocDropActive(false);

        const raw = event.dataTransfer.getData("application/x-usd-drive-item");
        if (!raw) return;

        let item = null;
        try {
            item = JSON.parse(raw);
        } catch (_error) {
            setPanelPreviewError("Unable to open dropped file.");
            return;
        }

        const droppedId = String(item?.id || "").trim();
        const matched = driveItems.find((entry) => entry.id === droppedId);
        if (!matched) {
            setPanelPreviewError("Dropped file is not from the current Drive list.");
            return;
        }

        try {
            const { data } = await axios.get("/api/user/google/drive/file-meta", {
                ...buildAuthConfig(),
                params: { file_id: droppedId },
            });
            const serverFile = data?.data;
            if (!serverFile?.id) {
                setPanelPreviewError("Dropped file could not be verified.");
                return;
            }

            openFileInDocumentPanel({
                id: serverFile.id,
                name: serverFile.name || matched.name,
                mimeType: serverFile.mimeType || matched.mimeType,
                webViewLink: serverFile.webViewLink || matched.webViewLink || "",
                iconLink: serverFile.iconLink || matched.iconLink || "",
                isFolder: serverFile.mimeType === "application/vnd.google-apps.folder",
            });
            setPanelPreviewError("");
        } catch (error) {
            setPanelPreviewError(error?.response?.data?.message || "Unable to verify dropped file access.");
        }
    };

    const handleAttachDropZone = (event) => {
        event.preventDefault();
        const raw = event.dataTransfer.getData("application/x-usd-drive-item");
        if (!raw) return;

        try {
            const item = JSON.parse(raw);
            if (!item?.id || item?.isFolder) return;

            setAttachFileSelection({
                id: item.id,
                name: item.name || "Untitled file",
                mimeType: item.mimeType || "",
            });
            setAttachFileError("");
        } catch (_error) {
            setAttachFileError("Unable to read the dropped file.");
        }
    };

    const handleAttachFileSubmit = () => {
        if (!attachFileSelection?.id) {
            setAttachFileError("Select or drop a file to attach.");
            return;
        }

        attachFileMutation.mutate(attachFileSelection.id);
    };

    const footerLeftStyle = useMemo(() => {
        if (isImmersive) {
            return { width: `${immersiveSignWidth}px`, minWidth: `${immersiveSignWidth}px`, flex: "0 0 auto" };
        }
        const tabsWidth = isCompact ? 300 : 340;
        return { width: `${tabsWidth}px`, minWidth: `${tabsWidth}px`, flex: "0 0 auto" };
    }, [isImmersive, immersiveSignWidth, isCompact]);
    const openDriveItem = (item) => {
        if (item.isFolder) {
            setDriveTrail((prev) => [...prev, { id: item.id, name: item.name }]);
            return;
        }
        openFileInDocumentPanel(item);
    };
    const goDriveRoot = () => setDriveTrail([]);
    const goDriveToTrail = (index) => setDriveTrail((prev) => prev.slice(0, index + 1));

    const renderDrivePanel = (panelStyle = {}) => (
        <div className="usd-footer-right" style={panelStyle} data-usd-layout-item>
            <div className="usd-drive-header">
                <img src={GoogleDriveIcon} alt="" className="usd-drive-logo" />
                <span>Google Drive</span>
            </div>
            <div className="usd-drive-breadcrumbs">
                <button type="button" className="usd-drive-crumb usd-drive-crumb--root" onClick={goDriveRoot}>My Drive</button>
                {driveTrail.map((folder, index) => (
                    <React.Fragment key={folder.id}>
                        <span className="usd-drive-crumb-sep">/</span>
                        <button type="button" className="usd-drive-crumb" onClick={() => goDriveToTrail(index)}>
                            {folder.name}
                        </button>
                    </React.Fragment>
                ))}
            </div>
            <div className="usd-drive-files-grid" ref={driveGridRef}>
                {driveLoading && <div className="usd-drive-empty">Loading My Drive...</div>}
                {!driveLoading && driveError && <div className="usd-drive-empty">{driveError}</div>}
                {!driveLoading && !driveError && driveItems.length === 0 && (
                    <div className="usd-drive-empty">No files found.</div>
                )}
                {!driveLoading && !driveError && driveItems.map((item) => (
                    <button
                        key={item.id}
                        type="button"
                        data-usd-drive-item
                        className="usd-drive-grid-card"
                        onClick={() => openDriveItem(item)}
                        title={item.name}
                        draggable={!item.isFolder}
                        onDragStart={(event) => startDriveItemDrag(event, item)}
                    >
                        {item.isFolder ? (
                            <img src={FolderIcon} alt="" className="usd-drive-grid-icon usd-drive-grid-icon--folder" />
                        ) : item.iconLink ? (
                            <img src={item.iconLink} alt="" className="usd-drive-grid-icon" />
                        ) : (
                            <span className="usd-drive-file-dot" />
                        )}
                        <span className="usd-drive-grid-name">{item.name}</span>
                    </button>
                ))}
            </div>
        </div>
    );

    const handleAddMemberSubmit = () => {
        if (!addMemberForm.userId) {
            setMemberActionError("Select a user to add to this session.");
            return;
        }

        addMemberMutation.mutate({
            user_id: Number(addMemberForm.userId),
            role: addMemberForm.role,
            display_role_name: addMemberForm.displayRoleName.trim() || undefined,
            sign_order:
                addMemberForm.role === "viewer" ||
                !addMemberForm.useRoutingOrder ||
                addMemberForm.signOrder === ""
                    ? null
                    : Number(addMemberForm.signOrder),
        });
    };

    const renderAssignmentSection = () => {
        if (!canManageSignatories) return null;
        const activeFile = placeholderFiles.find((file) => Number(file.id) === Number(currentPlaceholderFileId)) || placeholderFiles[0] || null;
        const activePlaceholders = activeFile?.placeholders || [];

        return (
            <div className="usd-right-section usd-right-section--assignments">
                <div className="usd-right-section-title">Placeholder Assignments</div>
                {placeholderFiles.length > 1 && (
                    <div className="usd-file-tabs">
                        {placeholderFiles.map((file) => (
                            <button
                                key={file.id}
                                type="button"
                                className={`usd-file-tab ${Number(currentPlaceholderFileId) === Number(file.id) ? "active" : ""}`}
                                onClick={() => setActivePlaceholderFileTab(file.id)}
                            >
                                {file.name}
                            </button>
                        ))}
                    </div>
                )}
                {placeholderFiles.length === 0 ? (
                    <div className="usd-inline-empty">
                        No matched placeholders were found in the session documents yet. Signable placeholder scanning
                        runs against the Google Doc version of each session document.
                    </div>
                ) : activePlaceholders.length === 0 ? (
                    <div className="usd-inline-empty">
                        No registered placeholders were detected in <strong>{activeFile?.name || "this document"}</strong>.
                        If this source file is a Word document, it must be prepared as a Google Doc copy before placeholder
                        scanning and signing can work reliably.
                    </div>
                ) : (
                    <>
                    <div className="usd-inline-empty usd-inline-empty--soft">
                        Placeholder scanning is currently reading the
                        {" "}
                        <strong>{getSessionFileSigningMeta(sessionFiles.find((file) => Number(file.id) === Number(currentPlaceholderFileId)) || activeFile).signingLabel}</strong>
                        {" "}
                        for <strong>{activeFile?.name || "this document"}</strong>.
                        Each invited signatory can hold one active placeholder at a time; assigning a new one will replace their previous unsigned assignment.
                    </div>
                    <div className="usd-assign-list">
                        {activePlaceholders.map((placeholder) => (
                            <div key={placeholder.id} className="usd-assign-card">
                                <div className="usd-assign-meta">
                                    <div className="usd-assign-label">{placeholder.label || placeholder.placeholder_key}</div>
                                    <div className="usd-assign-token">{placeholder.raw_token}</div>
                                </div>
                                <div className="usd-assign-controls">
                                    <select
                                        className="usd-input usd-input--compact"
                                        value={placeholder.assigned_member_id || ""}
                                        onChange={(event) =>
                                            assignPlaceholderMutation.mutate({
                                                placeholderId: placeholder.id,
                                                assignedMemberId: event.target.value ? Number(event.target.value) : null,
                                            })
                                        }
                                        disabled={assigningPlaceholderId === placeholder.id}
                                    >
                                        <option value="">Unassigned</option>
                                        {assignableMembers.map((member) => (
                                            <option key={member.id} value={member.id}>
                                                {member.name} {member.display_role_name ? `(${member.display_role_name})` : ""}
                                            </option>
                                        ))}
                                    </select>
                                    <span className={`usd-assign-status usd-assign-status--${placeholder.status}`}>
                                        {placeholder.status}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                    </>
                )}
            </div>
        );
    };

    const renderMemberRow = (sig, index, options = {}) => {
        const {
            section = "signatory",
            showOrder = true,
            delayBase = 180,
            chipColor = STATUS_COLOR[sig.status] || "#9ca3af",
            chipLabel = `${sig.status === "signed" ? "✓ " : ""}${STATUS_LABEL[sig.status] || sig.status}`,
        } = options;
        const memberRecord = sessionMemberMap.get(Number(sig.id));
        const canManageRow = canManageSignatories && !sig.isCreator && !!memberRecord;
        const isMenuOpen = Number(activeMemberMenuId) === Number(sig.id);
        const menuPlaceholders = memberAssignablePlaceholders.get(Number(sig.id)) || [];

        return (
            <div key={sig.id} className="usd-sig-row" style={{ "--sig-delay": `${delayBase + index * 65}ms` }}>
                {showOrder ? (
                    <div className="usd-sig-order">{sig.order}</div>
                ) : (
                    <div style={{ width: 18 }} />
                )}
                <div
                    className={`usd-sig-avatar ${section !== "signatory" ? "usd-sig-avatar--viewer" : ""}`}
                    style={section === "signatory" ? { background: STATUS_BG[sig.status], color: STATUS_TEXT[sig.status] } : undefined}
                >
                    {sig.initials}
                </div>
                <div className="usd-sig-info">
                    <div className="usd-sig-name">{sig.name}</div>
                    <div className="usd-sig-role">{sig.role}</div>
                </div>
                <span className="usd-sig-chip" style={{ color: chipColor }}>
                    {chipLabel}
                </span>
                {canManageRow && (
                    <div className="usd-sig-actions">
                        <button
                            type="button"
                            className="usd-sig-menu-btn"
                            onClick={() => {
                                setActiveMemberMenuId(isMenuOpen ? null : sig.id);
                                setActiveMemberMenuMode("actions");
                                setMemberMenuError("");
                            }}
                        >
                            ⋮
                        </button>
                        {isMenuOpen && (
                            <div className="usd-sig-menu">
                                {activeMemberMenuMode === "actions" && (
                                    <>
                                        <button type="button" className="usd-sig-menu-item" onClick={() => setActiveMemberMenuMode("assign")}>
                                            Assign
                                        </button>
                                        <button type="button" className="usd-sig-menu-item" onClick={() => setActiveMemberMenuMode("role")}>
                                            Change Role
                                        </button>
                                        <button type="button" className="usd-sig-menu-item usd-sig-menu-item--danger" onClick={() => setActiveMemberMenuMode("remove")}>
                                            Remove
                                        </button>
                                    </>
                                )}
                                {activeMemberMenuMode === "assign" && (
                                    <div className="usd-sig-submenu">
                                        <div className="usd-sig-submenu-head">
                                            <button type="button" className="usd-sig-submenu-back" onClick={() => setActiveMemberMenuMode("actions")}>
                                                ←
                                            </button>
                                            <span>Assign Placeholder</span>
                                        </div>
                                        {menuPlaceholders.length === 0 && (
                                            <div className="usd-sig-submenu-empty">No available placeholders.</div>
                                        )}
                                        {menuPlaceholders.map((placeholder) => (
                                            <button
                                                key={placeholder.id}
                                                type="button"
                                                className="usd-sig-submenu-option"
                                                disabled={assigningPlaceholderId === placeholder.id}
                                                onClick={() =>
                                                    assignPlaceholderMutation.mutate({
                                                        placeholderId: placeholder.id,
                                                        assignedMemberId: sig.id,
                                                    })
                                                }
                                            >
                                                <div>{placeholder.label || placeholder.placeholder_key}</div>
                                                <small>{placeholder.session_file_name || "Session document"}</small>
                                            </button>
                                        ))}
                                    </div>
                                )}
                                {activeMemberMenuMode === "role" && (
                                    <div className="usd-sig-submenu">
                                        <div className="usd-sig-submenu-head">
                                            <button type="button" className="usd-sig-submenu-back" onClick={() => setActiveMemberMenuMode("actions")}>
                                                ←
                                            </button>
                                            <span>Change Role</span>
                                        </div>
                                        {[
                                            { value: "signatory", label: "Signatory" },
                                            { value: "session_editor", label: "Session Editor" },
                                            { value: "viewer", label: "Viewer" },
                                        ].map((roleOption) => (
                                            <button
                                                key={roleOption.value}
                                                type="button"
                                                className={`usd-sig-submenu-option ${
                                                    memberRecord?.role === roleOption.value ? "is-active" : ""
                                                }`}
                                                disabled={updateMemberMutation.isPending}
                                                onClick={() =>
                                                    updateMemberMutation.mutate({
                                                        memberId: sig.id,
                                                        payload: { role: roleOption.value },
                                                    })
                                                }
                                            >
                                                <div>{roleOption.label}</div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                                {activeMemberMenuMode === "remove" && (
                                    <div className="usd-sig-submenu">
                                        <div className="usd-sig-submenu-head">
                                            <button type="button" className="usd-sig-submenu-back" onClick={() => setActiveMemberMenuMode("actions")}>
                                                ←
                                            </button>
                                            <span>Remove Member</span>
                                        </div>
                                        <div className="usd-sig-submenu-empty">
                                            Remove {sig.name} from this session? Unsigned placeholder assignments will be cleared.
                                        </div>
                                        <button
                                            type="button"
                                            className="usd-sig-submenu-option usd-sig-submenu-option--danger"
                                            disabled={removeMemberMutation.isPending}
                                            onClick={() => removeMemberMutation.mutate(sig.id)}
                                        >
                                            <div>{removeMemberMutation.isPending ? "Removing..." : "Confirm remove"}</div>
                                        </button>
                                    </div>
                                )}
                                {memberMenuError && <div className="usd-sig-submenu-error">{memberMenuError}</div>}
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div
            ref={pageRef}
            className={`usd-page usd-layout--${layout} ${pageReady ? "usd-page--ready" : ""}`}
        >

            {/* ── TOP BAR ── */}
            <div className="usd-topbar usd-anim-top" data-usd-layout-item>
                <button className="usd-back" onClick={() => navigate("/user/sessions")}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
                    Sessions
                </button>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{color:"var(--user-text-muted)"}}><path d="M9 18l6-6-6-6"/></svg>
                <span className="usd-crumb">{session.title}</span>

                <div className="usd-topbar-actions">
                    <div className="usd-layout-switcher">
                        {LAYOUTS.map((l) => (
                            <button
                                key={l.id}
                                className={`usd-layout-btn ${layout === l.id ? "active" : ""}`}
                                onClick={() => setLayout(l.id)}
                                title={l.label}
                            >
                                {l.icon}
                            </button>
                        ))}
                    </div>
                    {canManageSignatories && (
                        <button
                            className="usd-btn"
                            onClick={() => rescanPlaceholdersMutation.mutate()}
                            disabled={rescanPlaceholdersMutation.isPending}
                        >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg>
                            {rescanPlaceholdersMutation.isPending ? "Rescanning..." : "Rescan Placeholders"}
                        </button>
                    )}
                    {canSign && (
                        <button className="usd-btn" onClick={() => setShowAddSignatureModal(true)}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 113 3L7 19l-4 1 1-4Z"/></svg>
                            Add Signature
                        </button>
                    )}
                    {canCloseSession && (
                        <button className="usd-btn usd-btn--danger" onClick={() => setShowCloseModal(true)}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>
                            Close session
                        </button>
                    )}
                    {canSendNotifications && (
                        <button className="usd-btn usd-btn--primary" onClick={() => setShowNotifModal(true)}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z"/></svg>
                            Send notification
                        </button>
                    )}
                </div>
            </div>

            {sessionQuery.isLoading && (
                <div className="usd-topbar" style={{ borderTop: 0, borderBottomStyle: "dashed" }} data-usd-layout-item>
                    <span className="usd-crumb">Loading session details...</span>
                </div>
            )}
            {sessionQuery.isError && (
                <div className="usd-topbar" style={{ borderTop: 0, borderBottomStyle: "dashed" }} data-usd-layout-item>
                    <span className="usd-crumb">
                        {sessionQuery.error?.response?.data?.message || "Failed to load live session data. Showing fallback preview."}
                    </span>
                </div>
            )}
            {(rescanActionError || rescanPlaceholdersMutation.isSuccess) && (
                <div className="usd-topbar" style={{ borderTop: 0, borderBottomStyle: "dashed" }} data-usd-layout-item>
                    <span className="usd-crumb">
                        {rescanActionError || "Registered placeholders rescanned successfully."}
                    </span>
                </div>
            )}

            {/* ── BODY ── */}
            <div className="usd-body">

                {/* ── LEFT PANEL — Signatories ── */}
                {!isImmersive && (
                    <aside
                        data-usd-layout-item
                        className={`usd-left usd-anim-left ${isCompact ? "usd-left--compact" : ""}`}
                        style={{ width: `${leftWidth}px`, minWidth: `${leftWidth}px` }}
                    >
                        <>
                                <div className="usd-panel-head">
                                    <span className="usd-panel-label">Signatories</span>
                                    {canManageSignatories && (
                                        <button className="usd-add-btn" onClick={() => setShowAddModal(true)}>
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
                                            Add
                                        </button>
                                    )}
                                </div>

                                <div className="usd-sig-scroll">
                                    <div className="usd-sig-section-label">Routing order</div>
                                    {signatories.map((sig, index) => renderMemberRow(sig, index))}

                                    {creatorMembers.length > 0 && (
                                        <>
                                            <div className="usd-sig-section-label" style={{ marginTop: 8 }}>Creator</div>
                                            {creatorMembers.map((sig, index) => renderMemberRow(sig, index, {
                                                section: "creator",
                                                showOrder: false,
                                                delayBase: 240,
                                                chipColor: "#6366f1",
                                                chipLabel: "Creator",
                                            }))}
                                        </>
                                    )}

                                    {viewers.length > 0 && (
                                        <>
                                            <div className="usd-sig-section-label" style={{ marginTop: 8 }}>Viewers only</div>
                                            {viewers.map((sig, index) => renderMemberRow(sig, index, {
                                                section: "viewer",
                                                showOrder: false,
                                                delayBase: 280,
                                                chipColor: "#9ca3af",
                                                chipLabel: "Viewer",
                                            }))}
                                        </>
                                    )}
                                </div>

                                <div className="usd-panel-foot">
                                    <div className="usd-prog-meta">
                                        <span>Progress</span>
                                        <span className="usd-prog-val">{signed} / {signatories.length} signed</span>
                                    </div>
                                    <div className="usd-prog-bar">
                                        <div className="usd-prog-fill" style={{ width: `${pct}%` }} />
                                    </div>
                                    {next && (
                                        <div className="usd-next-label">Next: {next.name}</div>
                                    )}
                                </div>
                        </>
                    </aside>
                )}
                {!isImmersive && (
                    <div className="usd-resizer usd-resizer--vertical" onMouseDown={startLeftResize} role="separator" aria-label="Resize signatories panel" />
                )}

                {/* ── CENTER — Document Viewport ── */}
                <main className="usd-center">
                    {/* Doc toolbar */}
                    <div className="usd-doc-bar" data-usd-layout-item>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={{color:"var(--user-text-muted)"}}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-4-4z"/><path d="M14 2v6h6"/></svg>
                        <span className="usd-doc-name">{panelPreviewFile?.name || primarySessionFile?.name || session.title}</span>
                        <span className="usd-doc-meta">{sessionFiles.length} {sessionFiles.length === 1 ? "file" : "files"} in session</span>
                        {activeSessionFile && (
                            <div className="usd-doc-signing-meta">
                                <span className={`usd-doc-signing-pill ${activeSessionFileMeta.converted ? "is-converted" : ""}`}>
                                    {activeSessionFileMeta.signingLabel}
                                </span>
                                <span className="usd-doc-signing-copy">
                                    Source: {activeSessionFileMeta.sourceLabel}
                                </span>
                            </div>
                        )}
                    </div>
                    {/* Google Docs viewport */}
                    <div
                        data-usd-layout-item
                        className={`usd-viewport usd-viewport--clean ${docDropActive ? "usd-viewport--drop" : ""}`}
                        onDragOver={handleDocPanelDragOver}
                        onDragLeave={handleDocPanelDragLeave}
                        onDrop={handleDocPanelDrop}
                    >
                        <div className={`usd-doc-workspace ${sessionDocumentFiles.length > 1 ? "usd-doc-workspace--split" : ""}`}>
                            <div className="usd-doc-main">
                                {panelPreviewFile ? (
                                    <>
                                        <div className="usd-doc-preview-floating-actions">
                                            <a
                                                href={panelPreviewFile.webViewLink || session.driveLink}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="usd-int-btn usd-int-btn--docs"
                                            >
                                                Open in Google
                                            </a>
                                        </div>
                                        <div className="usd-doc-preview-wrap usd-doc-preview-wrap--full">
                                            <div className="usd-doc-preview-embed">
                                                {panelPreviewError && (
                                                    <div className="usd-doc-preview-state usd-doc-preview-state--error">
                                                        {panelPreviewError}
                                                    </div>
                                                )}
                                                {!panelPreviewError && panelPreviewUrl && (
                                                    <iframe
                                                        src={panelPreviewUrl}
                                                        title={`Preview ${panelPreviewFile.name}`}
                                                        className="usd-doc-preview-frame"
                                                        allow="autoplay"
                                                    />
                                                )}
                                                {!panelPreviewError && !panelPreviewUrl && (
                                                    <div className="usd-doc-preview-state usd-doc-preview-state--error">
                                                        Preview unavailable for this file.
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <div className="usd-doc-empty-state">
                                        <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
                                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                            <path d="M14 2v6h6" />
                                        </svg>
                                        <div className="usd-doc-empty-label">No file was place by the Session Admin</div>
                                    </div>
                                )}
                            </div>
                            {sessionDocumentFiles.length > 1 && (
                                <aside className="usd-doc-files-rail">
                                    <div className="usd-doc-files-rail-head">Session files</div>
                                    <div className="usd-doc-files-list" ref={docFilesRailRef}>
                                        {sessionDocumentFiles.map((file) => {
                                            const isActive = panelPreviewFile?.id === file.google_drive_file_id;
                                            return (
                                                <button
                                                    key={file.id}
                                                    type="button"
                                                    data-usd-doc-file-item
                                                    className={`usd-doc-file-item ${isActive ? "is-active" : ""}`}
                                                    onClick={() =>
                                                        openFileInDocumentPanel({
                                                            id: file.google_drive_file_id,
                                                            name: file.name,
                                                            mimeType: file.mime_type,
                                                            webViewLink: file.web_view_link || "",
                                                            isFolder: false,
                                                        })
                                                    }
                                                >
                                                    <div className="usd-doc-file-item-name">{file.name}</div>
                                                    <div className="usd-doc-file-item-meta">
                                                        {file.is_primary_document ? "Primary document" : (file.source || "Attached file")}
                                                    </div>
                                                    <div className="usd-doc-file-item-signing">
                                                        {getSessionFileSigningMeta(file).converted
                                                            ? "Converted for signing"
                                                            : "Signable as-is"}
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </aside>
                            )}
                        </div>
                        {canAddFiles && (
                            <button
                                type="button"
                                className="usd-doc-add-float"
                                onClick={() => setShowAddFileModal(true)}
                            >
                                <span>+</span>
                                <span>Add</span>
                            </button>
                        )}
                        {canAddFiles && addFileModalPresence.isRendered && (
                            <div
                                className={`usd-doc-overlay ${addFileModalPresence.isVisible ? "open" : "closing"}`}
                                onClick={() => setShowAddFileModal(false)}
                            >
                                <div
                                    className={`usd-doc-overlay-card ${addFileModalPresence.isVisible ? "open" : "closing"}`}
                                    onClick={(event) => event.stopPropagation()}
                                    ref={addFileOverlayRef}
                                >
                                    <div className="usd-doc-overlay-head" data-usd-overlay-item>
                                        <h3>Add session file</h3>
                                        <button
                                            type="button"
                                            className="usd-modal-close"
                                            onClick={() => setShowAddFileModal(false)}
                                        >
                                            ×
                                        </button>
                                    </div>
                                    <div
                                        data-usd-overlay-item
                                        className="usd-attach-dropzone"
                                        onDragOver={(event) => event.preventDefault()}
                                        onDrop={handleAttachDropZone}
                                    >
                                        <div className="usd-attach-dropzone-title">Drag file here</div>
                                        <div className="usd-attach-dropzone-copy">
                                            Drag a file from the Google Drive panel into this box to attach it to the session.
                                        </div>
                                        {attachFileSelection && (
                                            <div className="usd-attach-selected">
                                                Selected: <strong>{attachFileSelection.name}</strong>
                                            </div>
                                        )}
                                    </div>
                                    {attachFileError && <div className="usd-inline-error" data-usd-overlay-item>{attachFileError}</div>}
                                    <div className="usd-doc-overlay-actions" data-usd-overlay-item>
                                        <button
                                            type="button"
                                            className="usd-modal-btn usd-modal-btn--cancel"
                                            onClick={() => setShowAddFileModal(false)}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="button"
                                            className="usd-modal-btn usd-modal-btn--confirm"
                                            onClick={handleAttachFileSubmit}
                                            disabled={attachFileMutation.isPending}
                                        >
                                            {attachFileMutation.isPending ? "Attaching..." : "Attach file"}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                    {/* -- FOOTER -- */}
                    <div className="usd-resizer usd-resizer--horizontal" onMouseDown={startFooterResize} role="separator" aria-label="Resize bottom panel" />
                    <div
                        className="usd-footer usd-anim-bottom"
                        data-usd-layout-item
                        style={{ minHeight: `${footerHeight}px`, maxHeight: `${footerHeight}px` }}
                    >
                        {/* Left col — Tabs */}
                        <div className="usd-footer-left" style={footerLeftStyle}>
                            <div className="usd-tabs">
                                {[
                                    { id: "details",  label: "Details"   },
                                    { id: "activity", label: "Activity"  },
                                    { id: "emaillog", label: "Email Log" },
                                ].map((tab) => (
                                    <button
                                        key={tab.id}
                                        className={`usd-tab ${activeTab === tab.id ? "active" : ""}`}
                                        onClick={() => setActiveTab(tab.id)}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>

                            <div className="usd-tab-content">
                                {activeTab === "details" && (
                                    <>
                                        <div className="usd-details-grid">
                                            {[
                                                ["Created by",   session.createdBy],
                                                ["Created on",   session.createdAt],
                                                ["Type",         session.type],
                                                ["Deadline",     session.deadline],
                                                ["Signatories",  `${session.signatories.length} people`],
                                                ["Status",       sessionStatusLabel],
                                            ].map(([k, v]) => (
                                                <div key={k} className="usd-detail-row">
                                                    <span className="usd-detail-key">{k}</span>
                                                    <span className="usd-detail-val">{v}</span>
                                                </div>
                                            ))}
                                        </div>
                                        {renderAssignmentSection()}
                                    </>
                                )}

                                {activeTab === "activity" && (
                                    <div className="usd-activity-list">
                                        {session.activity.map((act) => (
                                            <div key={act.id} className="usd-act-item">
                                                <div
                                                    className="usd-act-avatar"
                                                    style={{ background: act.color + "22", color: act.color }}
                                                >
                                                    {act.initials || (
                                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                            {act.type === "email"
                                                                ? <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z"/>
                                                                : <path d="M22 20H2l5-9h10l5 9zM12 3L7 12M12 3l5 9"/>
                                                            }
                                                        </svg>
                                                    )}
                                                </div>
                                                <div>
                                                    <div className="usd-act-text">
                                                        {act.name && <strong>{act.name} </strong>}
                                                        {act.text}
                                                    </div>
                                                    <div className="usd-act-time">{act.time}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {activeTab === "emaillog" && (
                                    <div className="usd-email-list">
                                        {session.emailLog.map((email) => (
                                            <div key={email.id} className="usd-email-item">
                                                <div className="usd-email-to">{email.to}</div>
                                                <div className="usd-email-subject">{email.subject}</div>
                                                <div className="usd-email-meta">
                                                    <span>{email.time}</span>
                                                    <span className={`usd-email-status usd-email-status--${email.status}`}>
                                                        {email.status}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {isImmersive && (
                            <>
                                <div
                                    className="usd-resizer usd-resizer--vertical usd-resizer--footer usd-resizer--footer-sign"
                                    onMouseDown={startFooterSignResize}
                                    role="separator"
                                    aria-label="Resize signatories footer panel"
                                />
                                <aside
                                    data-usd-layout-item
                                    className="usd-footer-signatories"
                                    style={{ width: `${immersiveSignWidth}px`, minWidth: `${immersiveSignWidth}px` }}
                                >
                                    <div className="usd-drive-header">
                                        <span className="usd-signatories-divider-title">Signatories</span>
                                        <div className="usd-signatories-divider-line" />
                                    </div>
                                    <div className="usd-sig-scroll usd-sig-scroll--footer">
                                        {signatories.map((sig) => (
                                            <div key={`footer-signatory-${sig.id}`} className="usd-sig-row">
                                                <div className="usd-sig-order">{sig.order}</div>
                                                <div className="usd-sig-avatar" style={{ background: STATUS_BG[sig.status], color: STATUS_TEXT[sig.status] }}>
                                                    {sig.initials}
                                                </div>
                                                <div className="usd-sig-info">
                                                    <div className="usd-sig-name">{sig.name}</div>
                                                    <div className="usd-sig-role">{sig.role}</div>
                                                </div>
                                                <span className="usd-sig-chip" style={{ color: STATUS_COLOR[sig.status] }}>
                                                    {STATUS_LABEL[sig.status]}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </aside>
                            </>
                        )}
                        {canViewDrivePanel && (
                            <>
                                <div
                                    className="usd-resizer usd-resizer--vertical usd-resizer--footer usd-resizer--footer-drive"
                                    onMouseDown={startFooterDriveResize}
                                    role="separator"
                                    aria-label="Resize drive footer panel"
                                />
                                {renderDrivePanel({ flex: `1 1 ${driveWidth}px`, minWidth: `${driveWidth}px` })}
                            </>
                        )}
                    </div>
                </main>

                {/* ── RIGHT PANEL (expanded layout only) ── */}
                {isExpanded && (
                    <div className="usd-resizer usd-resizer--vertical" onMouseDown={startRightResize} role="separator" aria-label="Resize right panel" />
                )}
                {isExpanded && (
                    <aside
                        className="usd-right usd-anim-right"
                        data-usd-layout-item
                        style={{ width: `${rightWidth}px`, minWidth: `${rightWidth}px` }}
                    >
                        <div className="usd-tabs usd-tabs--vertical">
                            {[
                                { id: "details",  label: "Details"   },
                                { id: "activity", label: "Activity"  },
                                { id: "emaillog", label: "Email Log" },
                            ].map((tab) => (
                                <button
                                    key={tab.id}
                                    className={`usd-tab ${activeTab === tab.id ? "active" : ""}`}
                                    onClick={() => setActiveTab(tab.id)}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        <div className="usd-right-content">
                            {activeTab === "details" && (
                                <>
                                    <div className="usd-right-section">
                                        <div className="usd-right-section-title">Session info</div>
                                        {[
                                            ["Created by",  session.createdBy],
                                            ["Created on",  session.createdAt],
                                            ["Type",        session.type],
                                            ["Deadline",    session.deadline],
                                            ["Signatories", `${session.signatories.length} people`],
                                            ["Status",      sessionStatusLabel],
                                        ].map(([k, v]) => (
                                            <div key={k} className="usd-detail-row">
                                                <span className="usd-detail-key">{k}</span>
                                                <span className="usd-detail-val">{v}</span>
                                            </div>
                                        ))}
                                    </div>
                                    {renderAssignmentSection()}
                                </>
                            )}
                            {activeTab === "activity" && (
                                <div className="usd-activity-list" style={{padding:"8px 0"}}>
                                    {session.activity.map((act) => (
                                        <div key={act.id} className="usd-act-item">
                                            <div className="usd-act-avatar" style={{ background: act.color + "22", color: act.color }}>
                                                {act.initials || "•"}
                                            </div>
                                            <div>
                                                <div className="usd-act-text">{act.name && <strong>{act.name} </strong>}{act.text}</div>
                                                <div className="usd-act-time">{act.time}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {activeTab === "emaillog" && (
                                <div className="usd-email-list">
                                    {session.emailLog.map((email) => (
                                        <div key={email.id} className="usd-email-item">
                                            <div className="usd-email-to">{email.to}</div>
                                            <div className="usd-email-subject">{email.subject}</div>
                                            <div className="usd-email-meta">
                                                <span>{email.time}</span>
                                                <span className={`usd-email-status usd-email-status--${email.status}`}>{email.status}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </aside>
                )}
            </div>

            {/* ══════════════════════════════════════════
                MODALS
            ══════════════════════════════════════════ */}

            {/* Add Signatory Modal */}
            {canManageSignatories && addModalPresence.isRendered && (
                <div
                    className={`usd-modal-backdrop ${addModalPresence.isVisible ? "open" : "closing"}`}
                    onClick={() => setShowAddModal(false)}
                >
                    <div className={`usd-modal ${addModalPresence.isVisible ? "open" : "closing"}`} onClick={(e) => e.stopPropagation()} ref={addMemberModalRef}>
                        <div className="usd-modal-header" data-usd-modal-item>
                            <h3>Add signatory</h3>
                            <button className="usd-modal-close" onClick={() => setShowAddModal(false)}>✕</button>
                        </div>
                        <div className="usd-modal-body">
                            <div className="usd-form-group" data-usd-modal-item>
                                <label>Select personnel</label>
                                <input
                                    type="text"
                                    placeholder="Search name or email..."
                                    className="usd-input"
                                    value={memberSearch}
                                    onChange={(event) => setMemberSearch(event.target.value)}
                                />
                            </div>
                            <div className="usd-member-picker" data-usd-modal-item>
                                {selectedMemberOption && (
                                    <div className="usd-member-picker-selected">
                                        <div className="usd-member-picker-selected-name">{selectedMemberOption.name}</div>
                                        <div className="usd-member-picker-selected-meta">{selectedMemberOption.email}</div>
                                    </div>
                                )}
                                <div className="usd-member-picker-list">
                                    {usersQuery.isLoading && (
                                        <div className="usd-inline-empty">Loading personnel...</div>
                                    )}
                                    {!usersQuery.isLoading && memberOptions.length === 0 && (
                                        <div className="usd-inline-empty">No personnel matched your search.</div>
                                    )}
                                    {!usersQuery.isLoading && memberOptions.map((user) => {
                                        const isSelected = String(addMemberForm.userId) === String(user.id);
                                        return (
                                            <button
                                                key={user.id}
                                                type="button"
                                                className={`usd-member-option ${isSelected ? "is-selected" : ""}`}
                                                onClick={() =>
                                                    setAddMemberForm((prev) => ({
                                                        ...prev,
                                                        userId: String(user.id),
                                                    }))
                                                }
                                            >
                                                <div className="usd-member-option-name">{user.name}</div>
                                                <div className="usd-member-option-meta">{user.email}</div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                            <div className="usd-form-group" data-usd-modal-item>
                                <label>Role in this session</label>
                                <select
                                    className="usd-input"
                                    value={addMemberForm.role}
                                    onChange={(event) =>
                                        setAddMemberForm((prev) => ({ ...prev, role: event.target.value }))
                                    }
                                >
                                    <option value="signatory">Signatory</option>
                                    <option value="viewer">Viewer only</option>
                                    <option value="session_editor">Session editor</option>
                                </select>
                            </div>
                            <div className="usd-form-group" data-usd-modal-item>
                                <label>Display role name</label>
                                <input
                                    type="text"
                                    placeholder="BSIT Program Head"
                                    className="usd-input"
                                    value={addMemberForm.displayRoleName}
                                    onChange={(event) =>
                                        setAddMemberForm((prev) => ({ ...prev, displayRoleName: event.target.value }))
                                    }
                                />
                            </div>
                            <div className="usd-form-group" data-usd-modal-item>
                                <label>Routing flow</label>
                                <div className="usd-routing-toggle">
                                    <button
                                        type="button"
                                        className={addMemberForm.useRoutingOrder ? "is-active" : ""}
                                        disabled={addMemberForm.role === "viewer"}
                                        onClick={() =>
                                            setAddMemberForm((prev) => ({
                                                ...prev,
                                                useRoutingOrder: true,
                                            }))
                                        }
                                    >
                                        With routing order
                                    </button>
                                    <button
                                        type="button"
                                        className={!addMemberForm.useRoutingOrder ? "is-active" : ""}
                                        onClick={() =>
                                            setAddMemberForm((prev) => ({
                                                ...prev,
                                                useRoutingOrder: false,
                                                signOrder: "",
                                            }))
                                        }
                                    >
                                        No routing order
                                    </button>
                                </div>
                            </div>
                            <div className="usd-form-group" data-usd-modal-item>
                                <label>Routing order</label>
                                <input
                                    type="number"
                                    value={addMemberForm.signOrder}
                                    min={1}
                                    disabled={addMemberForm.role === "viewer" || !addMemberForm.useRoutingOrder}
                                    className="usd-input"
                                    style={{ width: 80 }}
                                    onChange={(event) =>
                                        setAddMemberForm((prev) => ({ ...prev, signOrder: event.target.value }))
                                    }
                                />
                            </div>
                            {memberActionError && <div className="usd-inline-error" data-usd-modal-item>{memberActionError}</div>}
                        </div>
                        <div className="usd-modal-footer" data-usd-modal-item>
                            <button className="usd-modal-btn usd-modal-btn--cancel" onClick={() => setShowAddModal(false)}>Cancel</button>
                            <button
                                className="usd-modal-btn usd-modal-btn--confirm"
                                onClick={handleAddMemberSubmit}
                                disabled={addMemberMutation.isPending}
                            >
                                {addMemberMutation.isPending ? "Adding..." : "Add person"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {false && canAddFiles && showAddFileModal && (
                <div className="usd-modal-backdrop" onClick={() => setShowAddFileModal(false)}>
                    <div className="usd-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="usd-modal-header">
                            <h3>Add session file</h3>
                            <button className="usd-modal-close" onClick={() => setShowAddFileModal(false)}>×</button>
                        </div>
                        <div className="usd-modal-body">
                            <div
                                className="usd-attach-dropzone"
                                onDragOver={(event) => event.preventDefault()}
                                onDrop={handleAttachDropZone}
                            >
                                <div className="usd-attach-dropzone-title">Drag file here</div>
                                <div className="usd-attach-dropzone-copy">
                                    Drop a file from the Drive panel, or choose one from the system library below.
                                </div>
                                {attachFileSelection && (
                                    <div className="usd-attach-selected">
                                        Selected: <strong>{attachFileSelection.name}</strong>
                                    </div>
                                )}
                            </div>

                            <div className="usd-attach-library">
                                <div className="usd-attach-library-head">
                                    <span>SMCBI_DTS files</span>
                                    <button
                                        type="button"
                                        className="usd-attach-library-refresh"
                                        onClick={() => libraryFilesQuery.refetch()}
                                        disabled={libraryFilesQuery.isFetching}
                                    >
                                        {libraryFilesQuery.isFetching ? "Refreshing..." : "Refresh"}
                                    </button>
                                </div>
                                <div className="usd-attach-library-list">
                                    {libraryFilesQuery.isLoading && (
                                        <div className="usd-inline-empty">Loading system files...</div>
                                    )}
                                    {!libraryFilesQuery.isLoading && libraryFilesQuery.isError && (
                                        <div className="usd-inline-error">
                                            {libraryFilesQuery.error?.response?.data?.message || "Failed to load the SMCBI_DTS library."}
                                        </div>
                                    )}
                                    {!libraryFilesQuery.isLoading && !libraryFilesQuery.isError && libraryDocs.length === 0 && (
                                        <div className="usd-inline-empty">No attachable files were found.</div>
                                    )}
                                    {!libraryFilesQuery.isLoading && !libraryFilesQuery.isError && libraryDocs.map((file) => {
                                        const isSelected = attachFileSelection?.id === file.id;
                                        return (
                                            <button
                                                key={file.id}
                                                type="button"
                                                className={`usd-attach-library-item ${isSelected ? "is-selected" : ""}`}
                                                onClick={() =>
                                                    setAttachFileSelection({
                                                        id: file.id,
                                                        name: file.name || "Untitled file",
                                                        mimeType: file.mimeType || "",
                                                    })
                                                }
                                            >
                                                <div className="usd-attach-library-name">{file.name}</div>
                                                <div className="usd-attach-library-meta">{file.mimeType || "Google Drive file"}</div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                            {attachFileError && <div className="usd-inline-error">{attachFileError}</div>}
                        </div>
                        <div className="usd-modal-footer">
                            <button className="usd-modal-btn usd-modal-btn--cancel" onClick={() => setShowAddFileModal(false)}>Cancel</button>
                            <button
                                className="usd-modal-btn usd-modal-btn--confirm"
                                onClick={handleAttachFileSubmit}
                                disabled={attachFileMutation.isPending}
                            >
                                {attachFileMutation.isPending ? "Attaching..." : "Attach file"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {canSign && addSignatureModalPresence.isRendered && (
                <div
                    className={`usd-modal-backdrop ${addSignatureModalPresence.isVisible ? "open" : "closing"}`}
                    onClick={() => setShowAddSignatureModal(false)}
                >
                    <div className={`usd-modal ${addSignatureModalPresence.isVisible ? "open" : "closing"}`} onClick={(e) => e.stopPropagation()} ref={addSignatureModalRef}>
                        <div className="usd-modal-header" data-usd-modal-item>
                            <h3>Add signature</h3>
                            <button className="usd-modal-close" onClick={() => setShowAddSignatureModal(false)}>×</button>
                        </div>
                        <div className="usd-modal-body">
                            {signatureFiles.length > 1 && (
                                <div className="usd-file-tabs usd-file-tabs--modal" data-usd-modal-item>
                                    {signatureFiles.map((file) => (
                                        <button
                                            key={file.id}
                                            type="button"
                                            className={`usd-file-tab ${Number(currentSignatureFileId) === Number(file.id) ? "active" : ""}`}
                                            onClick={() => setActiveSignatureFileTab(file.id)}
                                        >
                                            {file.name}
                                        </button>
                                    ))}
                                </div>
                            )}
                            {signatureFiles.length === 0 ? (
                                <div className="usd-inline-empty" data-usd-modal-item>
                                    {currentMemberIsCreator
                                        ? "No detected placeholders are available for creator signing yet."
                                        : "No placeholders are assigned to your account yet."}
                                </div>
                            ) : (
                                (() => {
                                    const activeFile = signatureFiles.find((file) => Number(file.id) === Number(currentSignatureFileId)) || signatureFiles[0];
                                    return (
                                        <div className="usd-signature-slot-list">
                                            <div className="usd-signature-active-card" data-usd-modal-item>
                                                <div className="usd-signature-active-head">
                                                    <div className="usd-signature-slot-title">Active saved signature</div>
                                                    <div className="usd-signature-slot-copy">
                                                        This signature will be used when you confirm a slot below.
                                                    </div>
                                                </div>
                                                {accountSignaturesQuery.isLoading && (
                                                    <div className="usd-inline-empty">Loading your saved signature...</div>
                                                )}
                                                {!accountSignaturesQuery.isLoading && !activeAccountSignature && (
                                                    <div className="usd-inline-empty">
                                                        No active signature is configured in your settings yet. Go to <strong>Settings</strong> and save one first.
                                                    </div>
                                                )}
                                                {!accountSignaturesQuery.isLoading && activeAccountSignature && (
                                                    <div className="usd-signature-active-preview">
                                                        <img src={activeAccountSignature.image_url} alt="Active saved signature" />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="usd-signature-slot-head" data-usd-modal-item>
                                                <div className="usd-signature-slot-title">{activeFile?.name}</div>
                                                <div className="usd-signature-slot-copy">
                                                    {currentMemberIsCreator
                                                        ? "As creator, you can sign one available placeholder in this document. Placeholders already assigned to other signatories stay locked."
                                                        : "Confirm one of your assigned placeholders for this document."}
                                                </div>
                                            </div>
                                            {currentMemberIsCreator && creatorSignedPlaceholder && (
                                                <div className="usd-inline-empty usd-inline-empty--soft" data-usd-modal-item>
                                                    You already used your creator signature slot on
                                                    {" "}
                                                    <strong>{creatorSignedPlaceholder.label || creatorSignedPlaceholder.placeholder_key}</strong>.
                                                    Other placeholders remain visible for review but stay locked.
                                                </div>
                                            )}
                                            {activeFile?.placeholders.map((placeholder) => (
                                                (() => {
                                                    const slotState = getSignatureSlotState(placeholder);
                                                    return (
                                                <div key={placeholder.id} className={`usd-signature-slot-card ${slotState.disabled ? "is-disabled" : ""}`} data-usd-modal-item>
                                                    <div className="usd-signature-slot-main">
                                                        <div className="usd-signature-slot-label">{placeholder.label || placeholder.placeholder_key}</div>
                                                        <div className="usd-signature-slot-token">{placeholder.raw_token}</div>
                                                        <div className="usd-signature-slot-note">{slotState.reason}</div>
                                                    </div>
                                                    <div className="usd-signature-slot-actions">
                                                        <span className={`usd-assign-status usd-assign-status--${placeholder.status}`}>
                                                            {placeholder.status}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            className="usd-modal-btn usd-modal-btn--confirm"
                                                            disabled={slotState.disabled}
                                                            onClick={() => signPlaceholderMutation.mutate(placeholder.id)}
                                                        >
                                                            {slotState.buttonLabel}
                                                        </button>
                                                    </div>
                                                </div>
                                                    );
                                                })()
                                            ))}
                                            {signatureActionError && <div className="usd-inline-error" data-usd-modal-item>{signatureActionError}</div>}
                                        </div>
                                    );
                                })()
                            )}
                        </div>
                        <div className="usd-modal-footer" data-usd-modal-item>
                            <button className="usd-modal-btn usd-modal-btn--cancel" onClick={() => setShowAddSignatureModal(false)}>Close</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Close Session Modal */}
            {canCloseSession && closeModalPresence.isRendered && (
                <div
                    className={`usd-modal-backdrop ${closeModalPresence.isVisible ? "open" : "closing"}`}
                    onClick={() => setShowCloseModal(false)}
                >
                    <div className={`usd-modal ${closeModalPresence.isVisible ? "open" : "closing"}`} onClick={(e) => e.stopPropagation()} ref={closeSessionModalRef}>
                        <div className="usd-modal-header" data-usd-modal-item>
                            <h3>Close session</h3>
                            <button className="usd-modal-close" onClick={() => setShowCloseModal(false)}>✕</button>
                        </div>
                        <div className="usd-modal-body">
                            <div className="usd-modal-warning" data-usd-modal-item>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                                <p>Are you sure you want to close <strong>"{session.title}"</strong>? This will stop all pending signatures and archive the session. This cannot be undone.</p>
                            </div>
                        </div>
                        <div className="usd-modal-footer" data-usd-modal-item>
                            <button className="usd-modal-btn usd-modal-btn--cancel" onClick={() => setShowCloseModal(false)}>Cancel</button>
                            <button className="usd-modal-btn usd-modal-btn--danger">Close session</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Send Notification Modal */}
            {canSendNotifications && notifModalPresence.isRendered && (
                <div
                    className={`usd-modal-backdrop ${notifModalPresence.isVisible ? "open" : "closing"}`}
                    onClick={() => setShowNotifModal(false)}
                >
                    <div className={`usd-modal ${notifModalPresence.isVisible ? "open" : "closing"}`} onClick={(e) => e.stopPropagation()} ref={notifModalRef}>
                        <div className="usd-modal-header" data-usd-modal-item>
                            <h3>Send notification</h3>
                            <button className="usd-modal-close" onClick={() => setShowNotifModal(false)}>✕</button>
                        </div>
                        <div className="usd-modal-body">
                            <div className="usd-form-group" data-usd-modal-item>
                                <label>Send to</label>
                                <div className="usd-notif-recipients">
                                    {signatories.filter((s) => s.status !== "signed").map((sig) => (
                                        <label key={sig.id} className="usd-notif-check">
                                            <input type="checkbox" defaultChecked />
                                            <span>{sig.name} <em>({sig.role})</em></span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <div className="usd-form-group" data-usd-modal-item>
                                <label>Message (optional)</label>
                                <textarea
                                    className="usd-input"
                                    rows={3}
                                    placeholder="Add a custom message to the email..."
                                    style={{ resize: "vertical" }}
                                />
                            </div>
                        </div>
                        <div className="usd-modal-footer" data-usd-modal-item>
                            <button className="usd-modal-btn usd-modal-btn--cancel" onClick={() => setShowNotifModal(false)}>Cancel</button>
                            <button className="usd-modal-btn usd-modal-btn--confirm">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z"/></svg>
                                Send via Gmail
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default UserSessionDetails;



