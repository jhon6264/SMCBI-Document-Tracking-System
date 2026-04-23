import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import "../../../css/user/pages/user-gmail.css";
import { requestGoogleWorkspaceAuthCode } from "../utils/googleWorkspaceAuth";
import GmailIcon from "../../assets/images/gmail.png";
import useAnimatedPresence from "../../hooks/useAnimatedPresence";
import { animateStaggerReveal, cleanupMotion } from "../utils/animeMotion";
import {
    LuArrowLeft,
    LuInbox,
    LuMail,
    LuMailOpen,
    LuMinus,
    LuPenLine,
    LuRefreshCw,
    LuReply,
    LuSearch,
    LuSend,
    LuStar,
    LuX,
} from "react-icons/lu";
import { HiArrowTopRightOnSquare } from "react-icons/hi2";
import { ImAttachment } from "react-icons/im";
import { MdOutlineLink, MdOutlineViewComfy, MdOutlineViewList } from "react-icons/md";

const GMAIL_URL = "https://mail.google.com/mail/u/0/#inbox";
const SEARCH_DEBOUNCE_MS = 420;
const RECIPIENT_DEBOUNCE_MS = 260;
const SEARCH_MIN_CHARS = 2;
const SEARCH_MAX_RESULTS = 30;
const FOLDERS = [
    { id: "inbox", label: "Inbox", icon: LuInbox, baseQuery: "in:inbox" },
    { id: "starred", label: "Starred", icon: LuStar, baseQuery: "is:starred" },
    { id: "sent", label: "Sent", icon: LuSend, baseQuery: "in:sent" },
    { id: "drafts", label: "Drafts", icon: LuMailOpen, baseQuery: "in:drafts" },
];

function UserGmail() {
    const [activeFolder, setActiveFolder] = useState("inbox");
    const [selectedMessageId, setSelectedMessageId] = useState("");
    const [searchInput, setSearchInput] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [searchFocused, setSearchFocused] = useState(false);
    const [replyOpen, setReplyOpen] = useState(false);
    const [replyBody, setReplyBody] = useState("");
    const [errorMessage, setErrorMessage] = useState("");
    const [infoMessage, setInfoMessage] = useState("");
    const [listDensity, setListDensity] = useState("comfortable");
    const [toasts, setToasts] = useState([]);
    const [composeOpen, setComposeOpen] = useState(false);
    const [composeMinimized, setComposeMinimized] = useState(false);
    const [composeTo, setComposeTo] = useState("");
    const [composeToQuery, setComposeToQuery] = useState("");
    const [composeToFocused, setComposeToFocused] = useState(false);
    const [composeSubject, setComposeSubject] = useState("");
    const [composeBody, setComposeBody] = useState("");
    const [composeAttachments, setComposeAttachments] = useState([]);
    const [linkModalOpen, setLinkModalOpen] = useState(false);
    const [linkModalUrl, setLinkModalUrl] = useState("");
    const [linkModalText, setLinkModalText] = useState("");
    const [accountMenuOpen, setAccountMenuOpen] = useState(false);
    const [pendingFolderSwitch, setPendingFolderSwitch] = useState(false);
    const [messages, setMessages] = useState([]);
    const [listPageToken, setListPageToken] = useState("");
    const [nextPageToken, setNextPageToken] = useState("");
    const [loadingMore, setLoadingMore] = useState(false);
    const linkModalPresence = useAnimatedPresence(linkModalOpen, { exitDurationMs: 220 });
    const accountMenuRef = useRef(null);
    const searchWrapRef = useRef(null);
    const composeToWrapRef = useRef(null);
    const searchInputRef = useRef(null);
    const workspaceRef = useRef(null);
    const listPaneRef = useRef(null);
    const messageViewRef = useRef(null);
    const composeSheetRef = useRef(null);
    const linkModalRef = useRef(null);
    const toastStackRef = useRef(null);

    const queryClient = useQueryClient();
    const googleClientId = window.appConfig?.googleClientId || "";
    const googleRedirectUri = window.appConfig?.googleRedirectUri || "postmessage";
    const institutionDomain = window.appConfig?.institutionDomain || "smcbi.edu.ph";

    const userData = useMemo(() => {
        try { return JSON.parse(localStorage.getItem("user_data") || "null"); } catch { return null; }
    }, []);
    const userId = userData?.id ? String(userData.id) : "unknown";
    const connectedName = userData?.name || "User";
    const connectedEmail = userData?.email || "";
    const connectedPhoto = userData?.profile_picture || userData?.picture || userData?.avatar || userData?.photo || "";
    const connectedInitial = (connectedName || "U").trim().charAt(0).toUpperCase();

    const buildAuthConfig = useCallback(() => {
        const token = localStorage.getItem("user_token");
        return { headers: { Accept: "application/json", Authorization: `Bearer ${token || ""}` } };
    }, []);

    const buildGmailQuery = useCallback((folderId, userSearch) => {
        const folder = FOLDERS.find((f) => f.id === folderId) || FOLDERS[0];
        return [folder.baseQuery, userSearch].filter(Boolean).join(" ").trim();
    }, []);

    const formatListDate = useCallback((value) => {
        if (!value) return "-";
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) return "-";
        const month = parsed.toLocaleString("en-US", { month: "short" });
        const day = String(parsed.getDate()).padStart(2, "0");
        return `${month} ${day}`;
    }, []);

    const statusQuery = useQuery({
        queryKey: ["user-google-status", userId],
        staleTime: 5 * 60 * 1000,
        queryFn: async () => (await axios.get("/api/user/google/status", buildAuthConfig())).data,
    });
    const isGoogleConnected = Boolean(statusQuery.data?.status?.connected);
    const summaryQuery = useQuery({
        queryKey: ["user-google-gmail-summary", userId],
        enabled: isGoogleConnected,
        staleTime: 60 * 1000,
        gcTime: 10 * 60 * 1000,
        queryFn: async () => (await axios.get("/api/user/google/gmail/summary", buildAuthConfig())).data,
    });

    const effectiveSearch = searchQuery.trim();
    const shouldSearch = effectiveSearch.length === 0 || effectiveSearch.length >= SEARCH_MIN_CHARS;
    const gmailQuery = buildGmailQuery(activeFolder, shouldSearch ? effectiveSearch : "");

    const messagesQuery = useQuery({
        queryKey: ["user-google-gmail-messages", userId, activeFolder, shouldSearch ? effectiveSearch : "", listPageToken],
        enabled: isGoogleConnected,
        placeholderData: keepPreviousData,
        staleTime: 2 * 60 * 1000,
        gcTime: 20 * 60 * 1000,
        queryFn: async () =>
            (
                await axios.get("/api/user/google/gmail/messages", {
                    ...buildAuthConfig(),
                    params: {
                        maxResults: SEARCH_MAX_RESULTS,
                        q: gmailQuery,
                        pageToken: listPageToken || undefined,
                    },
                })
            ).data,
    });
    const pageUnreadCount = messages.filter((m) => m.status === "Unread").length;
    const summaryUnreadRaw = summaryQuery.data?.data?.inboxUnread;
    const summaryUnread = Number(summaryUnreadRaw);
    const unreadCount = Number.isFinite(summaryUnread) && summaryUnread >= 0 ? summaryUnread : pageUnreadCount;

    const selectedMessageQuery = useQuery({
        queryKey: ["user-google-gmail-message", userId, selectedMessageId],
        enabled: isGoogleConnected && Boolean(selectedMessageId),
        staleTime: 2 * 60 * 1000,
        gcTime: 20 * 60 * 1000,
        queryFn: async () =>
            (await axios.get(`/api/user/google/gmail/messages/${selectedMessageId}`, buildAuthConfig())).data,
    });
    const selectedMessage = selectedMessageQuery.data?.data || null;

    const recipientNeedle = composeToQuery.trim();
    const recipientSuggestionsQuery = useQuery({
        queryKey: ["user-google-gmail-recipients", userId, recipientNeedle],
        enabled: isGoogleConnected && composeOpen && recipientNeedle.length > 0,
        staleTime: 3 * 60 * 1000,
        gcTime: 20 * 60 * 1000,
        queryFn: async () =>
            (
                await axios.get("/api/user/google/gmail/recipients", {
                    ...buildAuthConfig(),
                    params: { search: recipientNeedle, limit: 8 },
                })
            ).data,
    });
    const recipientSuggestions = recipientSuggestionsQuery.data?.data || [];

    const searchSuggestions = useMemo(() => {
        const list = queryClient.getQueriesData({ queryKey: ["user-google-gmail-messages", userId] });
        const byLower = new Map();
        const needle = searchInput.trim().toLowerCase();

        const normalizeSuggestion = (rawValue) => {
            const text = String(rawValue || "")
                .replace(/\s+/g, " ")
                .replace(/[\r\n\t]/g, " ")
                .trim();
            return text;
        };

        const addSuggestion = (rawValue) => {
            const text = normalizeSuggestion(rawValue);
            if (!text) return;
            if (text.length < 3) return;
            if (text === "-" || text === "(No subject)") return;
            if (/^["']?[A-Za-z](\.[A-Za-z])*\.?["']?$/.test(text)) return;
            if (/^[^a-zA-Z0-9]*$/.test(text)) return;
            if (needle && !text.toLowerCase().includes(needle)) return;
            const key = text.toLowerCase();
            if (!byLower.has(key)) byLower.set(key, text);
        };

        const parseSender = (fromRaw) => {
            const source = normalizeSuggestion(fromRaw);
            if (!source) return "";

            const match = source.match(/^(.*?)(?:\s*<([^>]+)>)?$/);
            const rawName = normalizeSuggestion(match?.[1] || "");
            const rawEmail = normalizeSuggestion(match?.[2] || "");
            const looksLikeInitials = /^[A-Z](\.[A-Z]\.)*\.?$/i.test(rawName);

            if (rawName && rawEmail && !looksLikeInitials) return `${rawName} <${rawEmail}>`;
            if (rawEmail) return rawEmail;
            if (rawName) return rawName;
            return source;
        };

        list.forEach(([, cached]) => {
            const msgs = cached?.data?.messages;
            if (!Array.isArray(msgs)) return;

            msgs.forEach((message) => {
                addSuggestion(parseSender(message.from));
            });
        });

        return Array.from(byLower.values()).slice(0, 8);
    }, [queryClient, userId, searchInput, messagesQuery.dataUpdatedAt]);

    const connectMutation = useMutation({
        mutationFn: async () => {
            const codeResponse = await requestGoogleWorkspaceAuthCode({
                clientId: googleClientId,
                hostedDomain: institutionDomain,
                redirectUri: googleRedirectUri,
            });
            await axios.post("/api/user/google/connect-code", { code: codeResponse.code }, buildAuthConfig());
        },
        onSuccess: async () => {
            setErrorMessage("");
            await statusQuery.refetch();
            await queryClient.invalidateQueries({ queryKey: ["user-google-gmail-messages", userId] });
            await queryClient.invalidateQueries({ queryKey: ["user-google-gmail-summary", userId] });
        },
        onError: (error) => setErrorMessage(error.response?.data?.message || "Google connect failed."),
    });

    const disconnectMutation = useMutation({
        mutationFn: async () => axios.post("/api/user/google/disconnect", {}, buildAuthConfig()),
        onSuccess: async () => {
            setErrorMessage("");
            setAccountMenuOpen(false);
            setSelectedMessageId("");
            await statusQuery.refetch();
            await queryClient.invalidateQueries({ queryKey: ["user-google-gmail-messages", userId] });
            await queryClient.invalidateQueries({ queryKey: ["user-google-gmail-message", userId] });
            await queryClient.invalidateQueries({ queryKey: ["user-google-gmail-summary", userId] });
        },
        onError: (error) => setErrorMessage(error.response?.data?.message || "Disconnect failed."),
    });

    const sendMutation = useMutation({
        mutationFn: async (formData) => axios.post("/api/user/google/gmail/send", formData, buildAuthConfig()),
        onSuccess: async () => {
            setErrorMessage("");
            await queryClient.invalidateQueries({ queryKey: ["user-google-gmail-messages", userId] });
            await queryClient.invalidateQueries({ queryKey: ["user-google-gmail-summary", userId] });
        },
        onError: (error) => setErrorMessage(error.response?.data?.message || "Send failed."),
    });

    const replyMutation = useMutation({
        mutationFn: async ({ messageId, body }) =>
            axios.post(`/api/user/google/gmail/messages/${messageId}/reply`, { body }, buildAuthConfig()),
        onSuccess: async () => {
            setErrorMessage("");
            setReplyBody("");
            setReplyOpen(false);
            await queryClient.invalidateQueries({ queryKey: ["user-google-gmail-messages", userId] });
            await queryClient.invalidateQueries({ queryKey: ["user-google-gmail-message", userId, selectedMessageId] });
        },
        onError: (error) => setErrorMessage(error.response?.data?.message || "Reply failed."),
    });

    const markMutation = useMutation({
        mutationFn: async ({ messageId, markAsRead }) =>
            axios.patch(`/api/user/google/gmail/messages/${messageId}/mark`, { mark_as_read: markAsRead }, buildAuthConfig()),
        onSuccess: async (_, vars) => {
            await queryClient.invalidateQueries({ queryKey: ["user-google-gmail-messages", userId] });
            await queryClient.invalidateQueries({ queryKey: ["user-google-gmail-message", userId, selectedMessageId] });
            await queryClient.invalidateQueries({ queryKey: ["user-google-gmail-summary", userId] });
        },
        onError: (error) => setErrorMessage(error.response?.data?.message || "Update failed."),
    });

    const onRefresh = () => {
        setListPageToken("");
        setNextPageToken("");
        setMessages([]);
        setLoadingMore(false);
        summaryQuery.refetch();
        return messagesQuery.refetch();
    };

    const setCachedMessageReadState = useCallback((messageId, markAsRead) => {
        setMessages((prev) =>
            prev.map((item) =>
                item.id === messageId
                    ? { ...item, status: markAsRead ? "Read" : "Unread" }
                    : item
            )
        );
        queryClient.setQueriesData({ queryKey: ["user-google-gmail-messages", userId] }, (existing) => {
            if (!existing?.data?.messages || !Array.isArray(existing.data.messages)) return existing;

            return {
                ...existing,
                data: {
                    ...existing.data,
                    messages: existing.data.messages.map((item) =>
                        item.id === messageId
                            ? { ...item, status: markAsRead ? "Read" : "Unread" }
                            : item
                    ),
                },
            };
        });
    }, [queryClient, userId]);

    const pushToast = useCallback((text, type = "info") => {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        setToasts((prev) => [...prev, { id, text, type }]);
        window.setTimeout(() => {
            setToasts((prev) => prev.filter((item) => item.id !== id));
        }, 3200);
    }, []);

    const onLoadMoreMessages = () => {
        if (!nextPageToken || messagesQuery.isFetching) return;
        setLoadingMore(true);
        setListPageToken(nextPageToken);
    };

    const onSendCompose = async () => {
        if (!composeTo.trim() || !composeSubject.trim() || !composeBody.trim()) return;
        const draftTo = composeTo.trim();
        const draftSubject = composeSubject.trim();
        const draftBody = composeBody.trim();
        const draftAttachments = [...composeAttachments];

        setInfoMessage("Sending email...");
        const formData = new FormData();
        formData.append("to", draftTo);
        formData.append("subject", draftSubject);
        formData.append("body", draftBody);
        draftAttachments.forEach((file) => formData.append("attachments[]", file));

        setComposeOpen(false);
        setComposeMinimized(false);
        setComposeTo("");
        setComposeToQuery("");
        setComposeToFocused(false);
        setComposeSubject("");
        setComposeBody("");
        setComposeAttachments([]);

        try {
            await sendMutation.mutateAsync(formData);
            setInfoMessage("Email sent.");
        } catch {
            setErrorMessage("Failed to send email. Draft has been restored.");
            setComposeOpen(true);
            setComposeMinimized(false);
            setComposeTo(draftTo);
            setComposeToQuery(draftTo);
            setComposeSubject(draftSubject);
            setComposeBody(draftBody);
            setComposeAttachments(draftAttachments);
        }
    };

    const onComposeFilesSelect = (event) => {
        const files = Array.from(event.target.files || []);
        if (files.length === 0) return;
        setComposeAttachments((prev) => [...prev, ...files]);
        event.target.value = "";
    };

    const onRemoveComposeAttachment = (index) => {
        setComposeAttachments((prev) => prev.filter((_, idx) => idx !== index));
    };

    const onInsertLink = () => {
        setLinkModalUrl("");
        setLinkModalText("");
        setLinkModalOpen(true);
    };

    const onSubmitLinkModal = () => {
        const rawUrl = linkModalUrl.trim();
        if (!rawUrl) return;
        const normalizedUrl = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
        const rawText = linkModalText.trim();
        const snippet = rawText ? `${rawText}: ${normalizedUrl}` : normalizedUrl;
        setComposeBody((prev) => (prev ? `${prev}\n${snippet}` : snippet));
        setLinkModalOpen(false);
        setLinkModalUrl("");
        setLinkModalText("");
    };

    useEffect(() => {
        const timer = window.setTimeout(() => setSearchQuery(searchInput.trim()), SEARCH_DEBOUNCE_MS);
        return () => window.clearTimeout(timer);
    }, [searchInput]);

    useEffect(() => {
        const timer = window.setTimeout(() => setComposeToQuery(composeTo.trim()), RECIPIENT_DEBOUNCE_MS);
        return () => window.clearTimeout(timer);
    }, [composeTo]);

    useEffect(() => {
        const onKeyDown = (event) => {
            const target = event.target;
            const tagName = target?.tagName?.toLowerCase();
            const typingInField =
                tagName === "input" ||
                tagName === "textarea" ||
                Boolean(target?.isContentEditable);

            if (!typingInField && event.key === "/") {
                event.preventDefault();
                searchInputRef.current?.focus();
                return;
            }

            if (!typingInField && event.key.toLowerCase() === "c" && isGoogleConnected) {
                setComposeOpen(true);
                setComposeMinimized(false);
                return;
            }

            if ((event.ctrlKey || event.metaKey) && event.key === "Enter" && composeOpen && !composeMinimized) {
                if (!isSending && composeTo.trim() && composeSubject.trim() && composeBody.trim()) {
                    event.preventDefault();
                    onSendCompose();
                }
            }
        };

        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [composeBody, composeMinimized, composeOpen, composeSubject, composeTo, isGoogleConnected, isSending]);

    useEffect(() => {
        setMessages([]);
        setListPageToken("");
        setNextPageToken("");
        setLoadingMore(false);
    }, [activeFolder, effectiveSearch, isGoogleConnected]);

    useEffect(() => {
        const handleOutside = (event) => {
            if (!accountMenuRef.current?.contains(event.target)) setAccountMenuOpen(false);
            if (!searchWrapRef.current?.contains(event.target)) setSearchFocused(false);
            if (!composeToWrapRef.current?.contains(event.target)) setComposeToFocused(false);
        };
        if (accountMenuOpen || searchFocused || composeToFocused) document.addEventListener("mousedown", handleOutside);
        return () => document.removeEventListener("mousedown", handleOutside);
    }, [accountMenuOpen, searchFocused, composeToFocused]);

    useEffect(() => { if (statusQuery.error) setErrorMessage(statusQuery.error.message || "Failed to load Google status."); }, [statusQuery.error]);
    useEffect(() => { if (summaryQuery.error) setErrorMessage(summaryQuery.error.message || "Failed to load Gmail summary."); }, [summaryQuery.error]);
    useEffect(() => { if (messagesQuery.error) setErrorMessage(messagesQuery.error.message || "Failed to load messages."); }, [messagesQuery.error]);
    useEffect(() => { if (selectedMessageQuery.error) setErrorMessage(selectedMessageQuery.error.message || "Failed to load message."); }, [selectedMessageQuery.error]);
    useEffect(() => { if (recipientSuggestionsQuery.error) setErrorMessage(recipientSuggestionsQuery.error.message || "Failed to load recipient suggestions."); }, [recipientSuggestionsQuery.error]);
    useEffect(() => {
        if (!errorMessage) return;
        pushToast(errorMessage, "error");
        setErrorMessage("");
    }, [errorMessage, pushToast]);
    useEffect(() => {
        if (!infoMessage) return;
        pushToast(infoMessage, "info");
        setInfoMessage("");
    }, [infoMessage, pushToast]);
    useEffect(() => { setReplyOpen(false); setReplyBody(""); }, [selectedMessageId]);
    useEffect(() => {
        const pageMessages = messagesQuery.data?.data?.messages;
        if (!Array.isArray(pageMessages)) return;

        const next = messagesQuery.data?.data?.nextPageToken || "";
        setNextPageToken(next);
        setLoadingMore(false);

        if (listPageToken) {
            setMessages((prev) => {
                const byId = new Map(prev.map((item) => [item.id, item]));
                pageMessages.forEach((item) => {
                    if (!byId.has(item.id)) byId.set(item.id, item);
                });
                return Array.from(byId.values());
            });
            return;
        }

        setMessages(pageMessages);
    }, [messagesQuery.data, listPageToken]);

    useEffect(() => {
        if (!pendingFolderSwitch) return;
        if (messagesQuery.isFetching) return;
        setPendingFolderSwitch(false);
    }, [messagesQuery.isFetching, pendingFolderSwitch]);

    const folderMeta = FOLDERS.find((f) => f.id === activeFolder) || FOLDERS[0];
    const isLoadingMessages =
        pendingFolderSwitch ||
        messagesQuery.isPending ||
        (messagesQuery.isFetching && messages.length === 0);
    const isSending = sendMutation.isPending || replyMutation.isPending;

    useEffect(() => {
        const motion = animateStaggerReveal(workspaceRef.current, {
            selector: "[data-gm-layout-item]",
            duration: 680,
            staggerMs: 44,
            startDelayMs: 12,
        });

        if (!motion) {
            return undefined;
        }

        return () => {
            cleanupMotion(motion);
        };
    }, [activeFolder, listDensity, selectedMessageId, isGoogleConnected]);

    useEffect(() => {
        const selector = !selectedMessageId
            ? isLoadingMessages
                ? "[data-gm-empty-item], [data-gm-skeleton-item]"
                : messages.length === 0
                    ? "[data-gm-empty-item]"
                    : "[data-gm-list-item]"
            : !selectedMessage
                ? "[data-gm-empty-item]"
                : "[data-gm-message-item]";

        const targetRef = selectedMessageId ? messageViewRef.current : listPaneRef.current;
        const motion = animateStaggerReveal(targetRef, {
            selector,
            duration: 600,
            staggerMs: selectedMessageId ? 34 : 22,
            startDelayMs: 8,
        });

        if (!motion) {
            return undefined;
        }

        return () => {
            cleanupMotion(motion);
        };
    }, [selectedMessageId, selectedMessage?.id, isLoadingMessages, messages.length, replyOpen]);

    useEffect(() => {
        if (!composeOpen || composeMinimized) {
            return undefined;
        }

        const motion = animateStaggerReveal(composeSheetRef.current, {
            selector: "[data-gm-compose-item]",
            duration: 460,
            staggerMs: 32,
            startDelayMs: 0,
        });

        if (!motion) {
            return undefined;
        }

        return () => {
            cleanupMotion(motion);
        };
    }, [composeOpen, composeMinimized, composeAttachments.length]);

    useEffect(() => {
        if (!linkModalPresence.isVisible) {
            return undefined;
        }

        const motion = animateStaggerReveal(linkModalRef.current, {
            selector: "[data-gm-modal-item]",
            duration: 420,
            staggerMs: 28,
            startDelayMs: 0,
        });

        if (!motion) {
            return undefined;
        }

        return () => {
            cleanupMotion(motion);
        };
    }, [linkModalPresence.isVisible]);

    useEffect(() => {
        const motion = animateStaggerReveal(toastStackRef.current, {
            selector: "[data-gm-toast-item]",
            duration: 380,
            staggerMs: 18,
            startDelayMs: 0,
        });

        if (!motion) {
            return undefined;
        }

        return () => {
            cleanupMotion(motion);
        };
    }, [toasts.length]);

    return (
        <div ref={workspaceRef} className={`gmail-workspace gmail-density-${listDensity}`}>
            <header className="gmail-toolbar" data-gm-layout-item>
                <div className="gmail-brand">
                    <img src={GmailIcon} alt="" className="gmail-brand-logo" aria-hidden="true" />
                    <strong>Gmail</strong>
                </div>
                <div className="gmail-toolbar-search" ref={searchWrapRef}>
                    <LuSearch size={16} />
                    <input
                        ref={searchInputRef}
                        type="text"
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        onFocus={() => setSearchFocused(true)}
                        placeholder="Search mail"
                        disabled={!isGoogleConnected}
                    />
                    {searchInput && <button type="button" className="gmail-search-clear-btn" onClick={() => { setSearchInput(""); setSearchQuery(""); }}><LuX size={14} /></button>}
                    {searchFocused && searchInput.trim().length > 0 && searchSuggestions.length > 0 && (
                        <div className="gmail-search-suggestions">
                            {searchSuggestions.map((value) => (
                                <button
                                    key={value}
                                    type="button"
                                    className="gmail-search-suggestion-item"
                                    onClick={() => {
                                        setSearchInput(value);
                                        setSearchQuery(value);
                                        setSearchFocused(false);
                                    }}
                                >
                                    {value}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                <div className="gmail-toolbar-actions">
                    {isGoogleConnected ? (
                        <div className="gmail-connected-wrap" ref={accountMenuRef}>
                            <button
                                type="button"
                                className="gmail-connected-chip"
                                onClick={() => setAccountMenuOpen((prev) => !prev)}
                                disabled={disconnectMutation.isPending}
                            >
                            {connectedPhoto ? (
                                <img src={connectedPhoto} alt={connectedName} className="gmail-connected-avatar" />
                            ) : (
                                <span className="gmail-connected-avatar gmail-connected-avatar--fallback">{connectedInitial}</span>
                            )}
                            <div className="gmail-connected-text"><strong>Connected</strong><small>{connectedEmail || connectedName}</small></div>
                            </button>
                            {accountMenuOpen && (
                                <div className="gmail-account-menu">
                                    <button
                                        type="button"
                                        className="gmail-account-menu-item"
                                        onClick={() => disconnectMutation.mutate()}
                                        disabled={disconnectMutation.isPending}
                                    >
                                        {disconnectMutation.isPending ? "Logging out..." : "Log out"}
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <button type="button" className="gmail-btn gmail-btn--connect" onClick={() => connectMutation.mutate()} disabled={connectMutation.isPending}>
                            {connectMutation.isPending ? "Connecting..." : "Connect"}
                        </button>
                    )}
                    <button
                        type="button"
                        className="gmail-btn"
                        onClick={() => setListDensity((prev) => (prev === "comfortable" ? "compact" : "comfortable"))}
                        title="Toggle message density"
                    >
                        {listDensity === "comfortable" ? <MdOutlineViewList size={16} /> : <MdOutlineViewComfy size={16} />}
                    </button>
                    <button type="button" className="gmail-btn" onClick={onRefresh} disabled={!isGoogleConnected || messagesQuery.isFetching}><LuRefreshCw size={14} /><span>Refresh</span></button>
                    <a href={GMAIL_URL} target="_blank" rel="noreferrer" className="gmail-btn"><HiArrowTopRightOnSquare size={14} /><span>Open Gmail</span></a>
                </div>
            </header>

            <div className="gmail-explorer">
                <aside className="gmail-sidebar" data-gm-layout-item>
                    <button
                        type="button"
                        className="gmail-compose-trigger"
                        onClick={() => { setComposeOpen(true); setComposeMinimized(false); }}
                        disabled={!isGoogleConnected}
                    ><LuPenLine size={16} /><span>Compose</span></button>
                    <nav className="gmail-nav">
                        {FOLDERS.map((folder) => {
                            const Icon = folder.icon;
                            const active = activeFolder === folder.id;
                            return (
                                <button
                                    key={folder.id}
                                    type="button"
                                    className={`gmail-nav-item${active ? " active" : ""}`}
                                    onClick={() => {
                                        setPendingFolderSwitch(true);
                                        setActiveFolder(folder.id);
                                        setSelectedMessageId("");
                                    }}
                                >
                                    <Icon size={16} />
                                    <span>{folder.label}</span>
                                    {folder.id === "inbox" && unreadCount > 0 ? <em className="gmail-nav-count">{unreadCount}</em> : null}
                                </button>
                            );
                        })}
                    </nav>
                </aside>

                <section className="gmail-main" data-gm-layout-item>
                    {!selectedMessageId ? (
                        <>
                            <div className="gmail-main-head" data-gm-layout-item><h2>{folderMeta.label}</h2><small>{messages.length} message(s)</small></div>
                            <div className="gmail-list" ref={listPaneRef}>
                                {!isGoogleConnected ? (
                                    <div className="gmail-empty-state" data-gm-empty-item><p>Connect Google Workspace to access Gmail.</p></div>
                                ) : isLoadingMessages ? (
                                    <div className="gmail-list-skeletons">
                                        {Array.from({ length: 12 }).map((_, idx) => (
                                            <div key={idx} className="gmail-row-skeleton" data-gm-skeleton-item><span className="skeleton skeleton-from" /><span className="skeleton skeleton-subject" /><span className="skeleton skeleton-date" /></div>
                                        ))}
                                    </div>
                                ) : messages.length === 0 ? (
                                    <div className="gmail-empty" data-gm-empty-item>No messages found.</div>
                                ) : (
                                    <>
                                        {messages.map((message) => (
                                            <button
                                                key={message.id}
                                                type="button"
                                                data-gm-list-item
                                                className={`gmail-row${message.status === "Unread" ? " unread" : ""}`}
                                                onClick={() => {
                                                    setSelectedMessageId(message.id);
                                                    if (message.status === "Unread") {
                                                        setCachedMessageReadState(message.id, true);
                                                        markMutation.mutate({ messageId: message.id, markAsRead: true });
                                                    }
                                                }}
                                            >
                                                <span className="gmail-row-from">{message.from || "-"}</span>
                                                <span className="gmail-row-subject"><strong>{message.subject || "(No subject)"}</strong><em>{message.snippet || ""}</em></span>
                                                <span className="gmail-row-date">{formatListDate(message.receivedAt)}</span>
                                            </button>
                                        ))}
                                        {nextPageToken && (
                                            <div className="gmail-list-load-more">
                                                <button type="button" className="gmail-btn" onClick={onLoadMoreMessages} disabled={loadingMore || messagesQuery.isFetching}>
                                                    {loadingMore || messagesQuery.isFetching ? "Loading..." : "Load more"}
                                                </button>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="gmail-message-view" ref={messageViewRef}>
                            <div className="gmail-message-head" data-gm-message-item>
                                <button type="button" className="gmail-back-btn" onClick={() => setSelectedMessageId("")}><LuArrowLeft size={16} /><span>Back to {folderMeta.label}</span></button>
                                <div className="gmail-message-actions">
                                    <button type="button" className="gmail-btn" onClick={() => { setCachedMessageReadState(selectedMessageId, true); markMutation.mutate({ messageId: selectedMessageId, markAsRead: true }); }} disabled={markMutation.isPending}><LuMailOpen size={14} /><span>Mark Read</span></button>
                                    <button type="button" className="gmail-btn" onClick={() => { setCachedMessageReadState(selectedMessageId, false); markMutation.mutate({ messageId: selectedMessageId, markAsRead: false }); }} disabled={markMutation.isPending}><LuMail size={14} /><span>Mark Unread</span></button>
                                    <a href={GMAIL_URL} target="_blank" rel="noreferrer" className="gmail-btn"><HiArrowTopRightOnSquare size={14} /><span>Open Gmail</span></a>
                                </div>
                            </div>
                            {!selectedMessage ? (
                                <div className="gmail-message-loading" data-gm-empty-item><LuRefreshCw size={16} className="gmail-spin" />Loading message...</div>
                            ) : (
                                <>
                                    <div className="gmail-message-title-row" data-gm-message-item><h3>{selectedMessage.subject || "(No subject)"}</h3><a href={GMAIL_URL} target="_blank" rel="noreferrer" className="gmail-btn"><HiArrowTopRightOnSquare size={14} /><span>Open in Gmail</span></a></div>
                                    <div className="gmail-message-meta" data-gm-message-item><span className="gmail-avatar">{(selectedMessage.from || "?").charAt(0).toUpperCase()}</span><div className="gmail-message-meta-text"><strong>{selectedMessage.from || "-"}</strong><small>to {selectedMessage.to || "-"}</small></div><time>{selectedMessage.receivedAt || "-"}</time></div>
                                    <article className="gmail-message-body" data-gm-message-item><pre>{selectedMessage.body || selectedMessage.snippet || ""}</pre></article>
                                    {!replyOpen ? (
                                        <button type="button" className="gmail-reply-trigger" data-gm-message-item onClick={() => setReplyOpen(true)}><LuReply size={14} /><span>Reply</span></button>
                                    ) : (
                                        <div className="gmail-reply-box" data-gm-message-item><div className="gmail-reply-head"><span>Reply to {selectedMessage.from || "-"}</span><button type="button" onClick={() => { setReplyOpen(false); setReplyBody(""); }}><LuX size={13} /></button></div><textarea value={replyBody} onChange={(e) => setReplyBody(e.target.value)} placeholder="Write your reply..." /><div className="gmail-reply-actions"><button type="button" className="gmail-send-btn" onClick={() => replyMutation.mutate({ messageId: selectedMessageId, body: replyBody.trim() })} disabled={!replyBody.trim() || isSending}>Send Reply</button></div></div>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </section>
            </div>

            {toasts.length > 0 && (
                <div className="gmail-toast-stack" ref={toastStackRef} role="status" aria-live="polite">
                    {toasts.map((toast) => (
                        <div key={toast.id} className={`gmail-toast gmail-toast--${toast.type}`} data-gm-toast-item>
                            {toast.text}
                        </div>
                    ))}
                </div>
            )}

            {composeOpen && (
                <div className="gmail-compose-sheet" ref={composeSheetRef}>
                    <div className="gmail-compose-head" data-gm-compose-item>
                        <strong>New Message</strong>
                        <div className="gmail-compose-head-actions">
                            <button type="button" onClick={() => setComposeMinimized((prev) => !prev)}><LuMinus size={12} /></button>
                            <button type="button" onClick={() => { setComposeOpen(false); setComposeMinimized(false); }}><LuX size={12} /></button>
                        </div>
                    </div>
                    {!composeMinimized && (
                        <>
                            <div className="gmail-compose-fields">
                                <div className="gmail-compose-to-wrap" ref={composeToWrapRef} data-gm-compose-item>
                                    <input
                                        type="text"
                                        placeholder="To"
                                        value={composeTo}
                                        onChange={(e) => setComposeTo(e.target.value)}
                                        onFocus={() => setComposeToFocused(true)}
                                        autoComplete="off"
                                    />
                                    {composeToFocused && recipientNeedle.length > 0 && recipientSuggestions.length > 0 && (
                                        <div className="gmail-compose-to-suggestions">
                                            {recipientSuggestions.map((item) => (
                                                <button
                                                    key={item.email}
                                                    type="button"
                                                    className="gmail-compose-to-suggestion-item"
                                                    onClick={() => {
                                                        setComposeTo(item.email);
                                                        setComposeToQuery(item.email);
                                                        setComposeToFocused(false);
                                                    }}
                                                >
                                                    {item.label || item.email}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <input type="text" placeholder="Subject" value={composeSubject} onChange={(e) => setComposeSubject(e.target.value)} data-gm-compose-item />
                            </div>
                            <textarea className="gmail-compose-body" placeholder="Write your message..." value={composeBody} onChange={(e) => setComposeBody(e.target.value)} data-gm-compose-item />
                            {composeAttachments.length > 0 && (
                                <div className="gmail-compose-attachments" data-gm-compose-item>
                                    {composeAttachments.map((file, idx) => (
                                        <span key={`${file.name}-${file.size}-${idx}`} className="gmail-compose-chip">
                                            <ImAttachment size={10} />
                                            <span>{file.name}</span>
                                            <button type="button" onClick={() => onRemoveComposeAttachment(idx)} aria-label={`Remove ${file.name}`}>
                                                <LuX size={11} />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            )}
                            <div className="gmail-compose-footer" data-gm-compose-item>
                                <button type="button" className="gmail-send-btn" onClick={onSendCompose} disabled={isSending || !composeTo.trim() || !composeSubject.trim() || !composeBody.trim()}>Send</button>
                                <button type="button" className="gmail-compose-icon-btn" onClick={onInsertLink} title="Insert link">
                                    <MdOutlineLink size={16} />
                                </button>
                                <label className="gmail-compose-icon-btn" title="Attach files">
                                    <input type="file" multiple className="gmail-hidden-file" onChange={onComposeFilesSelect} />
                                    <ImAttachment size={14} />
                                </label>
                            </div>
                        </>
                    )}
                </div>
            )}

            {linkModalPresence.isRendered && (
                <div
                    className={`gmail-link-modal-backdrop ${linkModalPresence.isVisible ? "open" : "closing"}`}
                    onClick={() => setLinkModalOpen(false)}
                >
                    <div
                        ref={linkModalRef}
                        className={`gmail-link-modal ${linkModalPresence.isVisible ? "open" : "closing"}`}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h4 data-gm-modal-item>Add link</h4>
                        <input
                            type="text"
                            placeholder="https://example.com"
                            value={linkModalUrl}
                            onChange={(e) => setLinkModalUrl(e.target.value)}
                            autoFocus
                            data-gm-modal-item
                        />
                        <input
                            type="text"
                            placeholder="Link text (optional)"
                            value={linkModalText}
                            onChange={(e) => setLinkModalText(e.target.value)}
                            data-gm-modal-item
                        />
                        <div className="gmail-link-modal-actions" data-gm-modal-item>
                            <button type="button" className="gmail-btn" onClick={() => setLinkModalOpen(false)}>Cancel</button>
                            <button type="button" className="gmail-send-btn" onClick={onSubmitLinkModal} disabled={!linkModalUrl.trim()}>Insert</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default UserGmail;
