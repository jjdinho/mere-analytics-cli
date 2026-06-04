import { Command } from "commander";
import chalk from "chalk";
import { runCommand } from "./runner.js";
import { resolveOutputMode, printJson, renderTable } from "../output.js";

export function registerSchemaCommand(program: Command): void {
  program
    .command("schema")
    .description("Show the queryable tables and columns for your project")
    .action(async (_opts, command) => {
      const globalOpts = command.optsWithGlobals();
      await runCommand(globalOpts, async ({ client }) => {
        const result = await client.schema();

        if (resolveOutputMode(globalOpts) === "json") {
          printJson(result);
          return;
        }

        for (const table of result.tables) {
          console.log(chalk.bold(`\n${table.name}`));
          if (table.description) {
            console.log(chalk.dim(table.description));
          }
          console.log(
            renderTable(
              ["COLUMN", "TYPE", "DESCRIPTION"],
              table.columns.map((c) => [c.name, c.type, c.description])
            )
          );
        }
      });
    });
}
