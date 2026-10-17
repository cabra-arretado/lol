import { Command } from "commander";
import { action } from "../action.js";
import { createCliBbSdk } from "../client.js";
import { outputJson } from "./helpers.js";

interface CapabilitiesCommandOptions {
  json?: boolean;
}

export function registerCapabilitiesCommand(
  program: Command,
  getUrl: () => string,
): void {
  program
    .command("capabilities")
    .description("Show which network-facing capabilities this edition allows")
    .option("--json", "Print machine-readable JSON output")
    .action(
      action(async (opts: CapabilitiesCommandOptions) => {
        const policy = await createCliBbSdk(getUrl()).system.capabilities();
        if (outputJson(opts, policy)) return;
        console.log(`Edition: ${policy.edition}`);
        const width = Math.max(...policy.capabilities.map((c) => c.id.length));
        for (const capability of policy.capabilities) {
          console.log(
            `  ${capability.id.padEnd(width)}  ${capability.state.padEnd(7)}  ${capability.description}`,
          );
        }
      }),
    );
}
