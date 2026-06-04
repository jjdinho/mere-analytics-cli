import { type CliConfig, isTokenExpired } from "./auth/config.js";
import {
  CliError,
  EXIT_AUTH,
  EXIT_FORBIDDEN,
  EXIT_NOT_FOUND,
  EXIT_USAGE,
  EXIT_RATE_LIMIT,
  EXIT_NETWORK,
  EXIT_API,
} from "./errors.js";

export interface QueryColumn {
  name: string;
  type: string;
}

export interface QueryResult {
  columns: QueryColumn[];
  rows: unknown[][];
  stats: { rows: number; elapsed_ms: number };
}

export interface SchemaColumn {
  name: string;
  type: string;
  description: string;
}

export interface SchemaTable {
  name: string;
  description: string;
  columns: SchemaColumn[];
}

export interface SchemaResult {
  tables: SchemaTable[];
}

export interface WhoamiResult {
  user_id: string;
  project_id: string;
  client_id: string;
  scope: string;
}

/**
 * HTTP client for the Mere Analytics API. Uses native fetch with an OAuth
 * bearer token. Responses are returned verbatim (the API does not wrap them in
 * an envelope).
 */
export class ApiClient {
  private baseUrl: string;
  private token: string;
  private projectId: string;

  constructor(config: CliConfig) {
    if (isTokenExpired(config)) {
      throw new CliError(
        "Token expired. Run `mere auth login` to re-authenticate.",
        EXIT_AUTH
      );
    }
    this.baseUrl = config.api_url.replace(/\/+$/, "");
    this.token = config.access_token;
    this.projectId = config.project_id;
  }

  /** Run read-only ClickHouse SQL scoped to the granted project. */
  async query(sql: string): Promise<QueryResult> {
    return this.request<QueryResult>(
      "POST",
      `/api/v1/projects/${encodeURIComponent(this.projectId)}/query`,
      { sql }
    );
  }

  /** Fetch the queryable table/column catalog for the granted project. */
  async schema(): Promise<SchemaResult> {
    return this.request<SchemaResult>(
      "GET",
      `/api/v1/projects/${encodeURIComponent(this.projectId)}/schema`
    );
  }

  /** Echo the token's grant (user, project, client, scope). */
  async whoami(): Promise<WhoamiResult> {
    return this.request<WhoamiResult>("GET", "/api/v1/whoami");
  }

  private async request<T>(
    method: string,
    path: string,
    body?: Record<string, unknown>
  ): Promise<T> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.token}`,
      Accept: "application/json",
    };
    if (body) {
      headers["Content-Type"] = "application/json";
    }

    const res = await this.safeFetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      await this.handleError(res);
    }
    return (await res.json()) as T;
  }

  private async handleError(res: Response): Promise<never> {
    // Mere returns plain-text bodies for most errors and an RFC 6749 JSON body
    // for OAuth failures; handle both.
    const text = await res.text().catch(() => "");
    let message = text;
    try {
      const json = JSON.parse(text);
      message = json.error_description || json.error || json.message || text;
    } catch {
      // Plain text — use as-is.
    }
    message = message.trim() || res.statusText || "Unknown error";

    switch (res.status) {
      case 401:
        throw new CliError(
          "Authentication failed. Run `mere auth login` to re-authenticate.",
          EXIT_AUTH
        );
      case 403:
        throw new CliError(`Access denied: ${message}`, EXIT_FORBIDDEN);
      case 404:
        throw new CliError(
          "Project not found, or your token doesn't grant access to it.",
          EXIT_NOT_FOUND
        );
      case 429:
        throw new CliError(
          "Rate limited. Wait a moment and try again.",
          EXIT_RATE_LIMIT
        );
      default:
        throw new CliError(
          `API error (${res.status}): ${message}`,
          res.status >= 500 ? EXIT_API : EXIT_USAGE
        );
    }
  }

  /** Wrap fetch so network failures surface as a clean CliError. */
  private async safeFetch(
    target: string,
    init: RequestInit
  ): Promise<Response> {
    try {
      return await fetch(target, init);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Network request failed";
      throw new CliError(`Network error: ${message}`, EXIT_NETWORK);
    }
  }
}
