import chalk from "chalk";
import { CliError } from "../errors.js";
import { requireAuth } from "../auth/config.js";
import { ApiClient } from "../client.js";
import { type GlobalFlags, printJson } from "../output.js";

export interface CommandContext {
  config: ReturnType<typeof requireAuth>;
  client: ApiClient;
}

/** Run a command that requires authentication, with unified error handling. */
export async function runCommand(
  globalOpts: GlobalFlags,
  fn: (ctx: CommandContext) => Promise<void>
): Promise<void> {
  try {
    const config = requireAuth();
    const client = new ApiClient(config);
    await fn({ config, client });
  } catch (err) {
    fail(err, globalOpts);
  }
}

/** Run a command that does not require authentication (e.g. login). */
export async function runUnauthenticated(
  globalOpts: GlobalFlags,
  fn: () => Promise<void>
): Promise<void> {
  try {
    await fn();
  } catch (err) {
    fail(err, globalOpts);
  }
}

function fail(err: unknown, globalOpts: GlobalFlags): never {
  const message = err instanceof Error ? err.message : String(err);
  const exitCode = err instanceof CliError ? err.exitCode : 1;
  if (globalOpts.json) {
    printJson({ ok: false, error: message, code: exitCode });
  } else {
    console.error(chalk.red(`Error: ${message}`));
  }
  process.exit(exitCode);
}
