import { createRequire } from "node:module";
import { Command } from "commander";

const require = createRequire(import.meta.url);
const { version } = require("../package.json");

import { authCommand } from "./commands/auth.js";
import { registerQueryCommand } from "./commands/query.js";
import { registerSchemaCommand } from "./commands/schema.js";
import { registerWhoamiCommand } from "./commands/whoami.js";

const program = new Command();

program
  .name("mere")
  .description("Mere Analytics CLI — query your analytics from the terminal")
  .version(version)
  .option("--json", "Output raw JSON instead of a table");

program.addCommand(authCommand());
registerQueryCommand(program);
registerSchemaCommand(program);
registerWhoamiCommand(program);

if (process.argv.length <= 2) {
  program.outputHelp();
} else {
  await program.parseAsync(process.argv);
}
