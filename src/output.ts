import Table from "cli-table3";
import chalk from "chalk";

export type OutputMode = "table" | "json";

export interface GlobalFlags {
  json?: boolean;
}

/** Resolve the output mode from global CLI flags. */
export function resolveOutputMode(opts: GlobalFlags): OutputMode {
  return opts.json ? "json" : "table";
}

/** Write pretty-printed JSON to stdout. */
export function printJson(data: unknown): void {
  process.stdout.write(JSON.stringify(data, null, 2) + "\n");
}

/** Format an ISO timestamp for human-readable display. */
export function formatDate(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }
  return new Date(value).toLocaleString();
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) {
    return chalk.dim("—");
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

/** Render column headers + rows as an ASCII table, with an optional footer. */
export function renderTable(
  headers: string[],
  rows: unknown[][],
  footer?: string
): string {
  const table = new Table({
    head: headers.map((h) => chalk.cyan(h)),
    style: { head: [], border: [] },
  });
  for (const row of rows) {
    table.push(row.map(formatCell));
  }
  let output = table.toString();
  if (footer) {
    output += `\n${chalk.dim(footer)}`;
  }
  return output;
}

/** Render key/value pairs vertically (for status, whoami, etc.). */
export function renderKeyValue(pairs: Array<[string, unknown]>): string {
  const table = new Table({ style: { head: [], border: [] } });
  for (const [key, value] of pairs) {
    table.push({ [chalk.cyan(key)]: formatCell(value) });
  }
  return table.toString();
}
