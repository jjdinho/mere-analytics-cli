import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  loadConfig,
  saveConfig,
  clearConfig,
  isTokenExpired,
  requireAuth,
  type CliConfig,
} from "../src/auth/config.js";
import { CliError } from "../src/errors.js";

// config.ts resolves its directory from os.homedir(), which honours $HOME on
// POSIX — point it at a throwaway dir so tests never touch the real config.
let tmpHome: string;
let originalHome: string | undefined;

const sample: CliConfig = {
  api_url: "https://app.usemere.com",
  access_token: "tok_abc",
  project_id: "proj-123",
  client_id: "client_xyz",
  expires_at: new Date(Date.now() + 3600_000).toISOString(),
};

beforeEach(() => {
  originalHome = process.env.HOME;
  tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "mere-cli-test-"));
  process.env.HOME = tmpHome;
});

afterEach(() => {
  process.env.HOME = originalHome;
  fs.rmSync(tmpHome, { recursive: true, force: true });
});

describe("config persistence", () => {
  it("returns null when no config exists", () => {
    expect(loadConfig()).toBeNull();
  });

  it("round-trips a saved config", () => {
    saveConfig(sample);
    expect(loadConfig()).toEqual(sample);
  });

  it("writes the config file with 0600 permissions", () => {
    saveConfig(sample);
    const file = path.join(tmpHome, ".mere", "config.json");
    const mode = fs.statSync(file).mode & 0o777;
    expect(mode).toBe(0o600);
  });

  it("clears the config", () => {
    saveConfig(sample);
    clearConfig();
    expect(loadConfig()).toBeNull();
  });

  it("ignores a config missing required fields", () => {
    fs.mkdirSync(path.join(tmpHome, ".mere"), { recursive: true });
    fs.writeFileSync(
      path.join(tmpHome, ".mere", "config.json"),
      JSON.stringify({ api_url: "x" })
    );
    expect(loadConfig()).toBeNull();
  });
});

describe("isTokenExpired", () => {
  it("is false for a future expiry, true for a past one", () => {
    expect(isTokenExpired(sample)).toBe(false);
    expect(
      isTokenExpired({ ...sample, expires_at: "2000-01-01T00:00:00Z" })
    ).toBe(true);
  });

  it("is true when expires_at is missing", () => {
    expect(isTokenExpired({ ...sample, expires_at: "" })).toBe(true);
  });
});

describe("requireAuth", () => {
  it("throws when not logged in", () => {
    expect(() => requireAuth()).toThrow(CliError);
  });

  it("throws when the token is expired", () => {
    saveConfig({ ...sample, expires_at: "2000-01-01T00:00:00Z" });
    expect(() => requireAuth()).toThrow(/expired/i);
  });

  it("returns the config when valid", () => {
    saveConfig(sample);
    expect(requireAuth()).toEqual(sample);
  });
});
