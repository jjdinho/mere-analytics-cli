import { Command } from "commander";
import { runCommand } from "./runner.js";
import { resolveOutputMode, printJson, renderTable } from "../output.js";
import { CliError, EXIT_USAGE } from "../errors.js";
import { readStdin } from "../stdin.js";

export function registerQueryCommand(program: Command): void {
  program
    .command("query [sql]")
    .description("Run read-only ClickHouse SQL against your analytics data")
    .action(async (sql: string | undefined, _opts, command) => {
      const globalOpts = command.optsWithGlobals();
      await runCommand(globalOpts, async ({ client }) => {
        const statement = (sql ?? (await readStdin())).trim();
        if (!statement) {
          throw new CliError(
            'No SQL provided. Pass it as an argument or pipe it via stdin.\n' +
              '  mere query "SELECT event, count() FROM events GROUP BY event"\n' +
              "  cat query.sql | mere query",
            EXIT_USAGE
          );
        }

        const result = await client.query(statement);

        if (resolveOutputMode(globalOpts) === "json") {
          printJson(result);
          return;
        }

        const headers = result.columns.map((c) => c.name);
        const rowCount = result.rows.length;
        const footer = `${rowCount} row${rowCount === 1 ? "" : "s"} in ${result.stats.elapsed_ms}ms`;
        console.log(renderTable(headers, result.rows, footer));
      });
    });
}
