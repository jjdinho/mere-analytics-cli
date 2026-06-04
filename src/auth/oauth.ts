import * as crypto from "node:crypto";
import * as http from "node:http";
import * as url from "node:url";

// Mere's OAuth server advertises a single scope.
const SCOPE = "api";

interface OAuthMetadata {
  authorization_endpoint: string;
  token_endpoint: string;
  registration_endpoint: string;
}

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

interface WhoamiResponse {
  user_id: string;
  project_id: string;
  client_id: string;
  scope: string;
}

/** Discover OAuth endpoints via RFC 8414 metadata. */
async function discoverOAuthEndpoints(apiUrl: string): Promise<OAuthMetadata> {
  const metadataUrl = `${apiUrl}/.well-known/oauth-authorization-server`;
  const res = await fetch(metadataUrl);
  if (!res.ok) {
    throw new Error(
      `Could not discover OAuth endpoints (${res.status}). Is ${apiUrl} a Mere Analytics server?`
    );
  }
  return (await res.json()) as OAuthMetadata;
}

/** Register as a dynamic public OAuth client (RFC 7591). */
async function registerClient(
  registrationEndpoint: string,
  callbackUrl: string
): Promise<string> {
  const res = await fetch(registrationEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_name: "Mere Analytics CLI",
      redirect_uris: [callbackUrl],
      grant_types: ["authorization_code"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
      scope: SCOPE,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Client registration failed (${res.status}): ${text}`);
  }
  const data = (await res.json()) as { client_id: string };
  return data.client_id;
}

/** Generate a PKCE code verifier and S256 challenge. */
function generatePKCE(): { verifier: string; challenge: string } {
  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto
    .createHash("sha256")
    .update(verifier)
    .digest("base64url");
  return { verifier, challenge };
}

/**
 * Start a local HTTP server to receive the OAuth callback. Resolves with the
 * authorization code and state once the browser redirects back.
 */
function startCallbackServer(): Promise<{
  server: http.Server;
  port: number;
  codePromise: Promise<{ code: string; state: string }>;
}> {
  return new Promise((resolve, reject) => {
    let resolveCode: (value: { code: string; state: string }) => void;
    let rejectCode: (reason: Error) => void;
    const codePromise = new Promise<{ code: string; state: string }>(
      (res, rej) => {
        resolveCode = res;
        rejectCode = rej;
      }
    );

    const server = http.createServer((req, res) => {
      const parsed = url.parse(req.url || "", true);
      if (parsed.pathname !== "/callback") {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Not found");
        return;
      }
      const code = parsed.query.code as string | undefined;
      const state = parsed.query.state as string | undefined;
      const error = parsed.query.error as string | undefined;

      if (error) {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(
          "<html><body><h1>Authorization failed</h1><p>You can close this tab.</p></body></html>"
        );
        rejectCode(new Error(`Authorization denied: ${error}`));
        return;
      }
      if (code && state) {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(
          "<html><body><h1>Authorized — you're all set.</h1><p>You can close this tab and return to the terminal.</p></body></html>"
        );
        resolveCode({ code, state });
        return;
      }
      res.writeHead(400, { "Content-Type": "text/plain" });
      res.end("Missing code or state parameter");
    });

    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        reject(new Error("Failed to start local callback server"));
        return;
      }
      resolve({ server, port: addr.port, codePromise });
    });
    server.on("error", reject);
  });
}

/** Exchange the authorization code for an access token. */
async function exchangeCode(
  tokenEndpoint: string,
  code: string,
  redirectUri: string,
  clientId: string,
  codeVerifier: string
): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    code_verifier: codeVerifier,
  });
  const res = await fetch(tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed (${res.status}): ${text}`);
  }
  return (await res.json()) as TokenResponse;
}

/**
 * Resolve the granted project for an access token.
 *
 * Mere's token response does not include the project (it's chosen on the
 * consent screen), so we read it back from the bearer-protected whoami endpoint.
 */
async function fetchGrantedProject(
  apiUrl: string,
  accessToken: string
): Promise<string> {
  const res = await fetch(`${apiUrl}/api/v1/whoami`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    throw new Error(`Failed to read granted project (whoami ${res.status})`);
  }
  const data = (await res.json()) as WhoamiResponse;
  return data.project_id || "";
}

export interface LoginResult {
  access_token: string;
  project_id: string;
  client_id: string;
  expires_at: string;
}

/**
 * Run the full OAuth 2.1 authorization-code + PKCE browser login flow:
 * discover endpoints, register a client, open the browser for consent, receive
 * the callback, exchange the code, then resolve the granted project.
 */
export async function oauthLogin(apiUrl: string): Promise<LoginResult> {
  const metadata = await discoverOAuthEndpoints(apiUrl);
  const { server, port, codePromise } = await startCallbackServer();
  const redirectUri = `http://127.0.0.1:${port}/callback`;

  try {
    const clientId = await registerClient(
      metadata.registration_endpoint,
      redirectUri
    );
    const pkce = generatePKCE();
    const state = crypto.randomBytes(16).toString("hex");

    const authParams = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: SCOPE,
      state,
      code_challenge: pkce.challenge,
      code_challenge_method: "S256",
    });
    const authUrl = `${metadata.authorization_endpoint}?${authParams}`;

    console.log("\nOpening your browser to authorize…");
    console.log(`If it doesn't open, visit this URL:\n${authUrl}\n`);

    // 'open' is ESM-only; import lazily.
    const open = (await import("open")).default;
    await open(authUrl).catch(() => {
      // Headless / no browser — the URL above is the fallback.
    });

    console.log("Waiting for authorization…");
    const { code, state: returnedState } = await codePromise;
    if (returnedState !== state) {
      throw new Error("OAuth state mismatch — possible CSRF, aborting.");
    }

    const token = await exchangeCode(
      metadata.token_endpoint,
      code,
      redirectUri,
      clientId,
      pkce.verifier
    );
    const projectId = await fetchGrantedProject(apiUrl, token.access_token);
    const expiresAt = new Date(
      Date.now() + token.expires_in * 1000
    ).toISOString();

    return {
      access_token: token.access_token,
      project_id: projectId,
      client_id: clientId,
      expires_at: expiresAt,
    };
  } finally {
    server.close();
  }
}
