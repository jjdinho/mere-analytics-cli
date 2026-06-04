import { Command } from "commander";
import { runCommand } from "./runner.js";
import { resolveOutputMode, printJson, renderKeyValue } from "../output.js";

export function registerWhoamiCommand(program: Command): void {
  program
    .command("whoami")
    .description("Show the identity and project your token is bound to")
    .action(async (_opts, command) => {
      const globalOpts = command.optsWithGlobals();
      await runCommand(globalOpts, async ({ client }) => {
        const result = await client.whoami();

        if (resolveOutputMode(globalOpts) === "json") {
          printJson(result);
          return;
        }

        console.log(
          renderKeyValue([
            ["User", result.user_id],
            ["Project", result.project_id],
            ["Client", result.client_id],
            ["Scope", result.scope],
          ])
        );
      });
    });
}
