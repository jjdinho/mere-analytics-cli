import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ApiClient } from "../src/client.js";
import { CliError, EXIT_AUTH, EXIT_NOT_FOUND, EXIT_USAGE } from "../src/errors.js";
import type { CliConfig } from "../src/auth/config.js";

const config: CliConfig = {
  api_url: "https://app.usemere.com",
  access_token: "tok_abc",
  project_id: "proj-123",
  client_id: "client_xyz",
  expires_at: new Date(Date.now() + 3600_000).toISOString(),
};

function mockResponse(opts: {
  ok: boolean;
  status: number;
  body?: unknown;
  text?: string;
}): Response {
  return {
    ok: opts.ok,
    status: opts.status,
    statusText: "",
    json: async () => opts.body,
    text: async () => opts.text ?? "",
  } as unknown as Response;
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ApiClient construction", () => {
  it("rejects an expired token", () => {
    expect(
      () => new ApiClient({ ...config, expires_at: "2000-01-01T00:00:00Z" })
    ).toThrow(CliError);
  });
});

describe("query", () => {
  it("POSTs SQL to the project query endpoint with a bearer token", async () => {
    const result = {
      columns: [{ name: "n", type: "UInt64" }],
      rows: [[5]],
      stats: { rows: 1, elapsed_ms: 3 },
    };
    fetchMock.mockResolvedValue(
      mockResponse({ ok: true, status: 200, body: result })
    );

    const client = new ApiClient(config);
    const out = await client.query("SELECT count() AS n FROM events");

    expect(out).toEqual(result);
    const [target, init] = fetchMock.mock.calls[0];
    expect(target).toBe(
      "https://app.usemere.com/api/v1/projects/proj-123/query"
    );
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer tok_abc");
    expect(JSON.parse(init.body)).toEqual({
      sql: "SELECT count() AS n FROM events",
    });
  });

  it("surfaces a verbatim ClickHouse error (plain text 400) as a usage error", async () => {
    fetchMock.mockResolvedValue(
      mockResponse({ ok: false, status: 400, text: "Syntax error: boom" })
    );
    const client = new ApiClient(config);
    await expect(client.query("SELEKT 1")).rejects.toMatchObject({
      exitCode: EXIT_USAGE,
      message: expect.stringContaining("Syntax error: boom"),
    });
  });
});

describe("schema", () => {
  it("GETs the project schema endpoint", async () => {
    const result = { tables: [{ name: "events", description: "", columns: [] }] };
    fetchMock.mockResolvedValue(
      mockResponse({ ok: true, status: 200, body: result })
    );
    const client = new ApiClient(config);
    const out = await client.schema();
    expect(out).toEqual(result);
    const [target, init] = fetchMock.mock.calls[0];
    expect(target).toBe(
      "https://app.usemere.com/api/v1/projects/proj-123/schema"
    );
    expect(init.method).toBe("GET");
  });
});

describe("whoami", () => {
  it("GETs the (non project-scoped) whoami endpoint", async () => {
    const result = {
      user_id: "u1",
      project_id: "proj-123",
      client_id: "client_xyz",
      scope: "api",
    };
    fetchMock.mockResolvedValue(
      mockResponse({ ok: true, status: 200, body: result })
    );
    const client = new ApiClient(config);
    expect(await client.whoami()).toEqual(result);
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://app.usemere.com/api/v1/whoami"
    );
  });
});

describe("error mapping", () => {
  it("maps 401 to an auth error", async () => {
    fetchMock.mockResolvedValue(
      mockResponse({ ok: false, status: 401, text: "unauthorized" })
    );
    const client = new ApiClient(config);
    await expect(client.schema()).rejects.toMatchObject({
      exitCode: EXIT_AUTH,
    });
  });

  it("maps 404 to a not-found error", async () => {
    fetchMock.mockResolvedValue(
      mockResponse({ ok: false, status: 404, text: "" })
    );
    const client = new ApiClient(config);
    await expect(client.schema()).rejects.toMatchObject({
      exitCode: EXIT_NOT_FOUND,
    });
  });

  it("parses an RFC 6749 JSON error body", async () => {
    fetchMock.mockResolvedValue(
      mockResponse({
        ok: false,
        status: 400,
        text: JSON.stringify({
          error: "invalid_grant",
          error_description: "code is invalid",
        }),
      })
    );
    const client = new ApiClient(config);
    await expect(client.query("x")).rejects.toMatchObject({
      message: expect.stringContaining("code is invalid"),
    });
  });
});
