import {KEYUTIL, KJUR} from "jsrsasign";
import {useCallback, useEffect, useMemo, useState} from "react";
import {loadConfig} from "./config";

type EnrollmentResult = {
    certificate?: string;
    crt?: string;
    cert?: string;
    ca?: string;
    ca_certificate?: string;
    ca_chain?: string[];
};

const storageKeys = {
    enrollRequested: "enroll:requested",
    pkceVerifier: "enroll:pkce_verifier",
    oidcState: "enroll:oidc_state"
} as const;

function base64UrlEncode(input: Uint8Array | string): string {
    const buffer = typeof input === "string" ? new TextEncoder().encode(input) : input;
    let binary = "";
    const chunkSize = 0x8000;
    for (let i = 0; i < buffer.length; i += chunkSize) {
        const chunk = buffer.subarray(i, i + chunkSize);
        binary += String.fromCharCode(...chunk);
    }
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function createPkce(): Promise<{ verifier: string; challenge: string }> {
    const randomBytes = new Uint8Array(32);
    crypto.getRandomValues(randomBytes);
    const verifier = base64UrlEncode(randomBytes);
    const challengeBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
    const challenge = base64UrlEncode(new Uint8Array(challengeBuffer));
    return {verifier, challenge};
}

function clearFlowState(): void {
    sessionStorage.removeItem(storageKeys.pkceVerifier);
    sessionStorage.removeItem(storageKeys.oidcState);
    sessionStorage.removeItem(storageKeys.enrollRequested);
}

export default function App(): JSX.Element {
    const {config, missing} = useMemo(() => loadConfig(), []);
    const [status, setStatus] = useState<string>("");
    const [busy, setBusy] = useState<boolean>(false);
    const [certificateUrl, setCertificateUrl] = useState<string | null>(null);
    const [keyUrl, setKeyUrl] = useState<string | null>(null);
    const [caText, setCaText] = useState<string | null>(null);

    useEffect(() => {
        return () => {
            if (certificateUrl) {
                URL.revokeObjectURL(certificateUrl);
            }
        };
    }, [certificateUrl]);

    useEffect(() => {
        return () => {
            if (keyUrl) {
                URL.revokeObjectURL(keyUrl);
            }
        };
    }, [keyUrl]);

    const resetDownloads = useCallback(() => {
        setCertificateUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return null;
        });
        setKeyUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return null;
        });
        setCaText(null);
    }, []);

    const performEnrollment = useCallback(
        async (token: string) => {
            setBusy(true);
            resetDownloads();

            try {
                setStatus("Generating a new private key...");
                const keypair = KEYUTIL.generateKeypair("RSA", 2048);
                const privateKeyPem = KEYUTIL.getPEM(keypair.prvKeyObj, "PKCS1PRV");
                const csrPem = KJUR.asn1.csr.CSRUtil.newCSRPEM({
                    subject: {str: config.certificate.subject},
                    sbjpubkey: keypair.pubKeyObj,
                    sigalg: "SHA256withRSA",
                    sbjprvkey: keypair.prvKeyObj
                });

                setStatus("Requesting certificate from step-ca...");
                const url = new URL("/api/1.0/sign", window.location.origin);
                if (config.stepCaProfile) {
                    url.searchParams.set("profile", config.stepCaProfile);
                }

                const response = await fetch(url.toString(), {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        csr: csrPem,
                        ott: token,
                        notAfter: "2190h",
                    })
                });

                const rawBody = await response.text();
                if (!response.ok) {
                    throw new Error(rawBody || `Enrollment failed (${response.status})`);
                }

                let payload: EnrollmentResult;
                try {
                    payload = JSON.parse(rawBody) as EnrollmentResult;
                } catch (error) {
                    throw new Error("Invalid JSON returned from step-ca");
                }

                const certificatePem = payload.certificate ?? payload.crt ?? payload.cert;
                if (!certificatePem) {
                    throw new Error("No certificate present in response");
                }

                const certificateBlob = new Blob([certificatePem], {type: "application/x-pem-file"});
                setCertificateUrl((prev) => {
                    if (prev) URL.revokeObjectURL(prev);
                    return URL.createObjectURL(certificateBlob);
                });

                const privateKeyBlob = new Blob([privateKeyPem], {type: "application/x-pem-file"});
                setKeyUrl((prev) => {
                    if (prev) URL.revokeObjectURL(prev);
                    return URL.createObjectURL(privateKeyBlob);
                });

                const caPem = payload.ca ?? payload.ca_certificate ?? (Array.isArray(payload.ca_chain) ? payload.ca_chain.join("\n") : null);
                setCaText(caPem ?? null);

                setStatus("Certificate ready.");
            } catch (error) {
                console.error(error);
                const message = error instanceof Error ? error.message : "Unexpected enrollment error";
                setStatus(message);
            } finally {
                clearFlowState();
                setBusy(false);
            }
        },
        [config, resetDownloads]
    );

    const completeOidc = useCallback(async () => {
        const params = new URLSearchParams(window.location.search);
        const error = params.get("error");
        if (error) {
            clearFlowState();
            throw new Error(params.get("error_description") || error);
        }

        const code = params.get("code");
        if (!code) {
            return;
        }

        const returnedState = params.get("state") ?? "";
        const expectedState = sessionStorage.getItem(storageKeys.oidcState);
        if (!expectedState || returnedState !== expectedState) {
            clearFlowState();
            throw new Error("OIDC state mismatch. Please try again.");
        }

        const verifier = sessionStorage.getItem(storageKeys.pkceVerifier);
        if (!verifier) {
            clearFlowState();
            throw new Error("Missing PKCE verifier. Please restart the request.");
        }

        setBusy(true);
        setStatus("Completing sign-in...");

        const redirectUri = window.location.origin + window.location.pathname;
        const body = new URLSearchParams({
            grant_type: "authorization_code",
            code,
            redirect_uri: redirectUri,
            client_id: config.oidc.clientId,
            client_secret: config.oidc.clientSecret,
            code_verifier: verifier
        });

        const tokenResponse = await fetch(config.oidc.tokenEndpoint, {
            method: "POST",
            headers: {"Content-Type": "application/x-www-form-urlencoded"},
            credentials: "include",
            body
        });

        const tokenJson = (await tokenResponse.json().catch(() => ({}))) as Record<string, string>;
        if (!tokenResponse.ok) {
            clearFlowState();
            throw new Error(tokenJson.error_description || tokenJson.error || `Token request failed (${tokenResponse.status})`);
        }

        const token = tokenJson.id_token || tokenJson.access_token || tokenJson.token;
        if (!token) {
            clearFlowState();
            throw new Error("No token found in response");
        }

        window.history.replaceState(null, document.title, window.location.pathname + window.location.hash);

        if (sessionStorage.getItem(storageKeys.enrollRequested)) {
            await performEnrollment(token);
        } else {
            clearFlowState();
            setBusy(false);
            setStatus("Sign-in complete. Click the button to request a certificate.");
        }
    }, [config, performEnrollment]);

    useEffect(() => {
        completeOidc().catch((error) => {
            console.error(error);
            setStatus(error instanceof Error ? error.message : "Unexpected error");
            clearFlowState();
            setBusy(false);
        });
    }, [completeOidc]);

    const startEnrollment = useCallback(async () => {
        try {
            setBusy(true);
            setStatus("Redirecting to sign-in...");
            resetDownloads();
            sessionStorage.setItem(storageKeys.enrollRequested, "1");

            const {verifier, challenge} = await createPkce();
            sessionStorage.setItem(storageKeys.pkceVerifier, verifier);

            const stateBytes = new Uint8Array(16);
            crypto.getRandomValues(stateBytes);
            const state = base64UrlEncode(stateBytes);
            sessionStorage.setItem(storageKeys.oidcState, state);

            const authUrl = new URL(config.oidc.authorizationEndpoint);
            const redirectUri = window.location.origin + window.location.pathname;
            authUrl.searchParams.set("response_type", "code");
            authUrl.searchParams.set("client_id", config.oidc.clientId);
            authUrl.searchParams.set("scope", config.oidc.scope);
            authUrl.searchParams.set("redirect_uri", redirectUri);
            authUrl.searchParams.set("code_challenge", challenge);
            authUrl.searchParams.set("code_challenge_method", "S256");
            authUrl.searchParams.set("state", state);

            window.location.assign(authUrl.toString());
        } catch (error) {
            console.error(error);
            setStatus(error instanceof Error ? error.message : "Unexpected error");
            clearFlowState();
            setBusy(false);
        }
    }, [config, resetDownloads]);

    const buttonDisabled = busy || missing.length > 0;

    return (
        <main className="app">
            <h1>Download a Client Certificate</h1>
            <p>
                Generate a fresh key pair in your browser, complete an OIDC sign-in, and ask step-ca to sign a
                certificate without ever
                persisting private material on the server.
            </p>
            <button type="button" onClick={startEnrollment} disabled={buttonDisabled}>
                Get certificate
            </button>
            <p role="status" className="status">
                {missing.length > 0 ? `Missing configuration: ${missing.join(", ")}` : status}
            </p>
            <div className="actions">
                {certificateUrl && (
                    <a href={certificateUrl} download={config.certificate.certificateFilename}>
                        Download certificate
                    </a>
                )}
                {keyUrl && (
                    <a href={keyUrl} download={config.certificate.privateKeyFilename}>
                        Download private key
                    </a>
                )}
            </div>
            {caText && (
                <section className="ca-block">
                    <h2>CA certificate</h2>
                    <pre>{caText}</pre>
                </section>
            )}
        </main>
    );
}
