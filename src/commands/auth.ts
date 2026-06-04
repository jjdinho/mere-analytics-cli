import { Command } from "commander";
import chalk from "chalk";
import {
  saveConfig,
  loadConfig,
  clearConfig,
  isTokenExpired,
} from "../auth/config.js";
import { oauthLogin } from "../auth/oauth.js";
import { runUnauthenticated } from "./runner.js";
import { CliError, EXIT_USAGE } from "../errors.js";
import { printJson, renderKeyValue, formatDate } from "../output.js";

/** Default cloud-hosted instance. Override with --api-url for self-hosting. */
const DEFAULT_API_URL = "https://app.usemere.com";

export function authCommand(): Command {
  const cmd = new Command("auth").description("Authenticate with Mere Analytics");

  cmd
    .command("login")
    .description("Authenticate via your browser (OAuth)")
    .option(
      "--api-url <url>",
      "Mere Analytics base URL (set this to your own URL for a self-hosted instance)",
      DEFAULT_API_URL
    )
    .action(async (opts, command) => {
      const globalOpts = command.optsWithGlobals();
      await runUnauthenticated(globalOpts, async () => {
        const apiUrl = opts.apiUrl.replace(/\/+$/, "");

        if (!globalOpts.json) {
          console.log(chalk.bold("Mere Analytics CLI — Login"));
          console.log(chalk.dim(apiUrl));
        }

        const result = await oauthLogin(apiUrl);
        if (!result.project_id) {
          throw new CliError(
            "No project was granted during authorization.",
            EXIT_USAGE
          );
        }

        saveConfig({
          api_url: apiUrl,
          access_token: result.access_token,
          project_id: result.project_id,
          client_id: result.client_id,
          expires_at: result.expires_at,
        });

        if (globalOpts.json) {
          printJson({
            ok: true,
            project_id: result.project_id,
            expires_at: result.expires_at,
          });
        } else {
          console.log(chalk.green("\n✓ Authenticated"));
          console.log(
            renderKeyValue([
              ["Project", result.project_id],
              ["Expires", formatDate(result.expires_at)],
            ])
          );
        }
      });
    });

  cmd
    .command("logout")
    .description("Clear stored credentials")
    .action((_opts, command) => {
      const globalOpts = command.optsWithGlobals();
      const config = loadConfig();
      clearConfig();
      const message = config
        ? "Logged out."
        : "Not currently logged in.";
      if (globalOpts.json) {
        printJson({ ok: true, logged_out: Boolean(config) });
      } else {
        console.log(message);
      }
    });

  cmd
    .command("status")
    .description("Show current authentication status")
    .action((_opts, command) => {
      const globalOpts = command.optsWithGlobals();
      const config = loadConfig();

      if (!config) {
        if (globalOpts.json) {
          printJson({ ok: true, authenticated: false });
        } else {
          console.log("Not logged in. Run `mere auth login` to authenticate.");
        }
        return;
      }

      const expired = isTokenExpired(config);
      if (globalOpts.json) {
        printJson({
          ok: true,
          authenticated: !expired,
          api_url: config.api_url,
          project_id: config.project_id,
          expires_at: config.expires_at,
          expired,
        });
      } else {
        console.log(
          renderKeyValue([
            [
              "Status",
              expired ? chalk.red("Expired") : chalk.green("Authenticated"),
            ],
            ["API URL", config.api_url],
            ["Project", config.project_id],
            ["Expires", formatDate(config.expires_at)],
          ])
        );
      }
    });

  return cmd;
}
