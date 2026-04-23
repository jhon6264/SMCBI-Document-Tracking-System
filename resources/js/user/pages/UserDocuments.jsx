import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import { LuChevronRight, LuExternalLink, LuFolderOpen, LuRefreshCw, LuSearch, LuArrowUp } from "react-icons/lu";
import "../../../css/user/pages/user-documents.css";
import FolderIcon from "../../assets/images/folder.png";
import GoogleDriveIcon from "../../assets/images/google-drive.png";

const FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";

const formatDate = (value) => {
    if (!value) return "Unknown update";

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "Unknown update";

    const now = new Date();
    const sameYear = parsed.getFullYear() === now.getFullYear();

    return parsed.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        ...(sameYear ? {} : { year: "numeric" }),
    });
};

const formatFileSize = (value) => {
    const size = Number(value);
    if (!Number.isFinite(size) || size <= 0) return "Google Drive file";

    const units = ["B", "KB", "MB", "GB"];
    let current = size;
    let index = 0;

    while (current >= 1024 && index < units.length - 1) {
        current /= 1024;
        index += 1;
    }

    const digits = current >= 10 || index === 0 ? 0 : 1;
    return `${current.toFixed(digits)} ${units[index]}`;
};

const formatCountLabel = (count, singular, plural = `${singular}s`) =>
    `${count} ${count === 1 ? singular : plural}`;

const getFileKindLabel = (file) => {
    if (file.isFolder) return "Folder";

    const extension = file.name?.split(".").pop()?.trim();
    if (extension && extension !== file.name) return extension.toUpperCase();

    const subtype = file.mimeType?.split("/").pop();
    return subtype ? subtype.toUpperCase() : "FILE";
};

const mapDriveFiles = (files = []) =>
    files.map((file) => ({
        id: file.id,
        name: file.name || "Untitled",
        mimeType: file.mimeType || "",
        isFolder: file.mimeType === FOLDER_MIME_TYPE,
        modifiedTime: file.modifiedTime || "",
        size: file.size || "",
        webViewLink: file.webViewLink || "",
        iconLink: file.iconLink || "",
    }));

function UserDocuments() {
    const [folderTrail, setFolderTrail] = useState([]);
    const [selectedFile, setSelectedFile] = useState(null);
    const [searchQuery, setSearchQuery] = useState("");

    const buildAuthConfig = useCallback(() => {
        const token = localStorage.getItem("user_token");

        return {
            headers: {
                Accept: "application/json",
                Authorization: `Bearer ${token || ""}`,
            },
        };
    }, []);

    const rootQuery = useQuery({
        queryKey: ["user-documents-root"],
        queryFn: async () => {
            const { data } = await axios.get(
                "/api/user/google/drive/system-library",
                buildAuthConfig()
            );

            return data;
        },
    });

    const rootFolder = rootQuery.data?.data?.folder || null;
    const currentFolder = folderTrail[folderTrail.length - 1] || rootFolder;
    const currentFolderId = currentFolder?.id || "";

    const contentsQuery = useQuery({
        queryKey: ["user-documents-contents", currentFolderId],
        enabled: Boolean(currentFolderId),
        queryFn: async () => {
            const { data } = await axios.get("/api/user/google/drive/files", {
                ...buildAuthConfig(),
                params: {
                    pageSize: 300,
                    parentId: currentFolderId,
                    section: "my-drive",
                },
            });

            return data;
        },
    });

    const entries = useMemo(
        () => mapDriveFiles(contentsQuery.data?.data?.files || []),
        [contentsQuery.data]
    );

    const filteredEntries = useMemo(() => {
        const needle = searchQuery.trim().toLowerCase();
        if (!needle) return entries;

        return entries.filter((item) => {
            const haystack = `${item.name} ${item.mimeType}`.toLowerCase();
            return haystack.includes(needle);
        });
    }, [entries, searchQuery]);

    const folders = useMemo(
        () => filteredEntries.filter((item) => item.isFolder),
        [filteredEntries]
    );

    const files = useMemo(
        () => filteredEntries.filter((item) => !item.isFolder),
        [filteredEntries]
    );
    const hasResults = folders.length > 0 || files.length > 0;

    const activeDriveLink =
        selectedFile?.webViewLink || currentFolder?.webViewLink || rootFolder?.webViewLink || "";

    useEffect(() => {
        if (!selectedFile) return;

        const fileStillVisible = entries.some((item) => item.id === selectedFile.id && !item.isFolder);
        if (!fileStillVisible) {
            setSelectedFile(null);
        }
    }, [entries, selectedFile]);

    const handleOpenFolder = (folder) => {
        setSelectedFile(null);
        setFolderTrail((previous) => {
            if (previous[previous.length - 1]?.id === folder.id) return previous;
            return [
                ...previous,
                { id: folder.id, name: folder.name, webViewLink: folder.webViewLink || "" },
            ];
        });
    };

    const handleOpenFile = (file) => {
        setSelectedFile(file);

        if (file.webViewLink) {
            window.open(file.webViewLink, "_blank", "noopener,noreferrer");
        }
    };

    const handleSelectCrumb = (index) => {
        setSelectedFile(null);
        setFolderTrail((previous) => previous.slice(0, index + 1));
    };

    const handleGoRoot = () => {
        setSelectedFile(null);
        setFolderTrail([]);
    };

    const handleGoUp = () => {
        setSelectedFile(null);
        setFolderTrail((previous) => previous.slice(0, -1));
    };

    const handleRefresh = async () => {
        await rootQuery.refetch();
        await contentsQuery.refetch();
    };

    const isLoading = rootQuery.isLoading || (Boolean(currentFolderId) && contentsQuery.isLoading);
    const isRefreshing = rootQuery.isFetching || contentsQuery.isFetching;
    const isError = rootQuery.isError || contentsQuery.isError;
    const errorMessage =
        rootQuery.error?.response?.data?.message ||
        contentsQuery.error?.response?.data?.message ||
        "Failed to load your document library.";

    return (
        <div className="user-documents-page">
            <section className="user-documents-browser">

                {/* ── Toolbar ── */}
                <div className="user-documents-toolbar">
                    <div className="user-documents-title-stack">
                        <h1>My Documents</h1>
                        <div className="user-documents-breadcrumbs" aria-label="Breadcrumb">
                            <button type="button" onClick={handleGoRoot}>
                                {rootFolder?.name || "SMCBI_DTS"}
                            </button>

                            {folderTrail.map((folder, index) => (
                                <React.Fragment key={folder.id}>
                                    <span className="user-documents-breadcrumb-sep" aria-hidden="true">
                                        <LuChevronRight size={13} />
                                    </span>
                                    <button type="button" onClick={() => handleSelectCrumb(index)}>
                                        {folder.name}
                                    </button>
                                </React.Fragment>
                            ))}

                            {selectedFile && (
                                <>
                                    <span className="user-documents-breadcrumb-sep" aria-hidden="true">
                                        <LuChevronRight size={13} />
                                    </span>
                                    <span
                                        className="user-documents-breadcrumb-current"
                                        title={selectedFile.name}
                                    >
                                        {selectedFile.name}
                                    </span>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="user-documents-toolbar-actions">
                        <label className="user-documents-search">
                            <LuSearch size={15} />
                            <input
                                type="search"
                                value={searchQuery}
                                onChange={(event) => setSearchQuery(event.target.value)}
                                placeholder="Search files and folders..."
                            />
                        </label>

                        <button
                            type="button"
                            className="user-documents-toolbar-btn"
                            onClick={handleRefresh}
                            disabled={isRefreshing}
                        >
                            <LuRefreshCw size={15} className={isRefreshing ? "is-spinning" : ""} />
                            <span>{isRefreshing ? "Refreshing..." : "Refresh"}</span>
                        </button>

                        {activeDriveLink && (
                            <a
                                href={activeDriveLink}
                                target="_blank"
                                rel="noreferrer"
                                className="user-documents-toolbar-btn user-documents-toolbar-btn--primary"
                            >
                                <img src={GoogleDriveIcon} alt="" aria-hidden="true" />
                                <span>Open in Drive</span>
                                <LuExternalLink size={14} />
                            </a>
                        )}
                    </div>
                </div>

                {/* ── Up one level + current folder label ── */}
                {folderTrail.length > 0 && !selectedFile && (
                    <div className="user-documents-context-row">
                        <button
                            type="button"
                            className="user-documents-up-btn"
                            onClick={handleGoUp}
                        >
                            <LuArrowUp size={14} />
                            <span>Up one level</span>
                        </button>
                        <div className="user-documents-context-meta">
                            <LuFolderOpen size={14} />
                            <span>{currentFolder?.name || rootFolder?.name || "SMCBI_DTS"}</span>
                        </div>
                    </div>
                )}

                {/* ── Selected file bar ── */}
                {selectedFile && (
                    <div className="user-documents-selection-bar">
                        <div className="user-documents-selection-info">
                            <strong>{selectedFile.name}</strong>
                            <span>
                                {getFileKindLabel(selectedFile)} · Updated {formatDate(selectedFile.modifiedTime)}
                            </span>
                        </div>
                        {selectedFile.webViewLink && (
                            <a
                                href={selectedFile.webViewLink}
                                target="_blank"
                                rel="noreferrer"
                                className="user-documents-selection-link"
                            >
                                <span>Open file</span>
                                <LuExternalLink size={14} />
                            </a>
                        )}
                    </div>
                )}

                {/* ── States ── */}
                {isLoading && (
                    <div className="user-documents-state">
                        Loading your documents…
                    </div>
                )}

                {isError && (
                    <div className="user-documents-state user-documents-state--error">
                        {errorMessage}
                    </div>
                )}

                {/* ── Main content ── */}
                {!isLoading && !isError && (
                    <div className="user-documents-sections">
                        {!hasResults ? (
                            <div className="user-documents-empty-block">
                                {searchQuery.trim()
                                    ? "No files or folders match your search."
                                    : "This location is empty."}
                            </div>
                        ) : (
                            <>
                                {/* Folders */}
                                <section className="user-documents-section">
                                    <div className="user-documents-section-head">
                                        <span className="user-documents-section-label">Folders</span>
                                        <span className="user-documents-section-count">
                                            {formatCountLabel(folders.length, "folder")}
                                        </span>
                                    </div>

                                    {folders.length > 0 ? (
                                        <div className="user-documents-folder-grid">
                                            {folders.map((folder) => (
                                                <button
                                                    type="button"
                                                    key={folder.id}
                                                    className="user-documents-folder-card"
                                                    onClick={() => handleOpenFolder(folder)}
                                                >
                                                    <div className="user-documents-folder-icon">
                                                        <img src={FolderIcon} alt="" aria-hidden="true" />
                                                    </div>
                                                    {/* wrapper added for horizontal layout */}
                                                    <div className="user-documents-folder-info">
                                                        <div className="user-documents-folder-name">{folder.name}</div>
                                                        <div className="user-documents-folder-meta">
                                                            Updated {formatDate(folder.modifiedTime)}
                                                        </div>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="user-documents-section-note">
                                            No folders here.
                                        </div>
                                    )}
                                </section>

                                {/* Files */}
                                <section className="user-documents-section">
                                    <div className="user-documents-section-head">
                                        <span className="user-documents-section-label">Files</span>
                                        <span className="user-documents-section-count">
                                            {formatCountLabel(files.length, "file")}
                                        </span>
                                    </div>

                                    {files.length > 0 ? (
                                        <div className="user-documents-file-grid">
                                            {files.map((file) => (
                                                <button
                                                    type="button"
                                                    key={file.id}
                                                    className={`user-documents-file-card ${
                                                        selectedFile?.id === file.id ? "is-selected" : ""
                                                    }`}
                                                    onClick={() => handleOpenFile(file)}
                                                >
                                                    <div className="user-documents-file-preview">
                                                        <div className="user-documents-file-badge">
                                                            {file.iconLink ? (
                                                                <img src={file.iconLink} alt="" aria-hidden="true" />
                                                            ) : (
                                                                <img src={GoogleDriveIcon} alt="" aria-hidden="true" />
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="user-documents-file-body">
                                                        <div className="user-documents-file-name">{file.name}</div>
                                                        <div className="user-documents-file-meta">
                                                            {formatFileSize(file.size)} · {formatDate(file.modifiedTime)}
                                                        </div>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="user-documents-section-note">
                                            No files here.
                                        </div>
                                    )}
                                </section>
                            </>
                        )}
                    </div>
                )}

            </section>
        </div>
    );
}

export default UserDocuments;