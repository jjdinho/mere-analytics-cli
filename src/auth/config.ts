import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { CliError, EXIT_AUTH } from "../errors.js";

export interface CliConfig {
  /** Base URL of the Mere Analytics instance (cloud or self-hosted). */
  api_url: string;
  access_token: string;
  /** Project the token was granted for (resolved via /api/v1/whoami at login). */
  project_id: string;
  client_id: string;
  /** ISO 8601 timestamp when the access token expires. */
  expires_at: string;
}

function getConfigDir(): string {
  return path.join(os.homedir(), ".mere");
}

function getConfigFile(): string {
  return path.join(getConfigDir(), "config.json");
}

function ensureConfigDir(): void {
  const dir = getConfigDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { mode: 0o700, recursive: true });
  }
}

/**
 * Load the CLI config from ~/.mere/config.json.
 * Returns null if no config file exists or if it's invalid.
 */
export function loadConfig(): CliConfig | null {
  try {
    const file = getConfigFile();
    if (!fs.existsSync(file)) {
      return null;
    }
    const parsed = JSON.parse(fs.readFileSync(file, "utf-8"));
    if (!parsed.api_url || !parsed.access_token || !parsed.project_id) {
      return null;
    }
    return parsed as CliConfig;
  } catch {
    return null;
  }
}

/**
 * Save the CLI config to ~/.mere/config.json with restrictive
 * permissions (file mode 0600).
 */
export function saveConfig(config: CliConfig): void {
  ensureConfigDir();
  fs.writeFileSync(getConfigFile(), JSON.stringify(config, null, 2) + "\n", {
    mode: 0o600,
  });
}

/** Delete the config file (logout). */
export function clearConfig(): void {
  try {
    const file = getConfigFile();
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
  } catch {
    // Ignore errors during cleanup.
  }
}

/** Check whether the stored access token is expired. */
export function isTokenExpired(config: CliConfig): boolean {
  if (!config.expires_at) {
    return true;
  }
  return new Date(config.expires_at) <= new Date();
}

/**
 * Load config and validate that the user is authenticated with a valid token.
 * Throws a CliError with a friendly message otherwise.
 */
export function requireAuth(): CliConfig {
  const config = loadConfig();
  if (!config) {
    throw new CliError(
      "Not logged in. Run `mere auth login` to authenticate.",
      EXIT_AUTH
    );
  }
  if (isTokenExpired(config)) {
    throw new CliError(
      "Token expired. Run `mere auth login` to re-authenticate.",
      EXIT_AUTH
    );
  }
  return config;
}
