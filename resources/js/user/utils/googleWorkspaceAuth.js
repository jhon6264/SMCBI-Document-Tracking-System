const GOOGLE_SCRIPT = "https://accounts.google.com/gsi/client";

export const GOOGLE_WORKSPACE_SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/contacts.readonly",
    "https://www.googleapis.com/auth/documents",
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/drive.photos.readonly",
];

let scriptPromise = null;

function loadGoogleScript() {
    if (window.google?.accounts?.oauth2) {
        return Promise.resolve();
    }

    if (scriptPromise) {
        return scriptPromise;
    }

    scriptPromise = new Promise((resolve, reject) => {
        const existing = document.querySelector(`script[src="${GOOGLE_SCRIPT}"]`);

        if (existing) {
            existing.addEventListener("load", () => resolve(), { once: true });
            existing.addEventListener(
                "error",
                () => reject(new Error("Failed to load Google Identity Services.")),
                { once: true }
            );

            if (window.google?.accounts?.oauth2) {
                resolve();
            }

            return;
        }

        const script = document.createElement("script");
        script.src = GOOGLE_SCRIPT;
        script.async = true;
        script.defer = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error("Failed to load Google Identity Services."));
        document.body.appendChild(script);
    });

    return scriptPromise;
}

export async function requestGoogleWorkspaceAccessToken({
    clientId,
    scopes = GOOGLE_WORKSPACE_SCOPES,
    prompt = "consent",
    hostedDomain = "smcbi.edu.ph",
}) {
    if (!clientId) {
        throw new Error("Google Client ID is missing.");
    }

    await loadGoogleScript();

    return new Promise((resolve, reject) => {
        const tokenClient = window.google.accounts.oauth2.initTokenClient({
            client_id: clientId,
            scope: scopes.join(" "),
            prompt,
            hd: hostedDomain,
            callback: (response) => {
                if (response?.error) {
                    reject(new Error(response.error_description || response.error));
                    return;
                }

                resolve(response);
            },
        });

        tokenClient.requestAccessToken();
    });
}

export async function requestGoogleWorkspaceAuthCode({
    clientId,
    scopes = GOOGLE_WORKSPACE_SCOPES,
    hostedDomain = "smcbi.edu.ph",
    redirectUri = "postmessage",
}) {
    if (!clientId) {
        throw new Error("Google Client ID is missing.");
    }

    await loadGoogleScript();

    return new Promise((resolve, reject) => {
        const codeClient = window.google.accounts.oauth2.initCodeClient({
            client_id: clientId,
            scope: scopes.join(" "),
            ux_mode: "popup",
            redirect_uri: redirectUri || "postmessage",
            access_type: "offline",
            include_granted_scopes: true,
            prompt: "consent select_account",
            hd: hostedDomain,
            callback: (response) => {
                if (response?.error) {
                    reject(new Error(response.error_description || response.error));
                    return;
                }

                if (!response?.code) {
                    reject(new Error("Google did not return an authorization code."));
                    return;
                }

                resolve(response);
            },
        });

        codeClient.requestCode();
    });
}
