import yargs from "yargs";
import { CommandDefinition } from "./commands.js";

export type ParsedCommand = {
  command: CommandDefinition;
  params: Record<string, string>;
  displayedCommand: string;
};

type YargsCommandHandler = {
  commandDef: CommandDefinition;
  argv: Record<string, any>;
};

export function createYargsParser(commands: CommandDefinition[]) {
  let lastParsedResult: YargsCommandHandler | null = null;

  // Create yargs instance
  const parser = yargs()
    .scriptName("")
    .exitProcess(false)
    .showHelpOnFail(false)
    .help(false)
    .version(false)
    .strict(false);

  // Register all commands
  for (const cmd of commands) {
    const yargsCommand = convertToYargsCommand(cmd);
    const cmdRef = cmd; // Capture in closure to avoid TypeScript issues

    parser.command(
      yargsCommand,
      cmd.desc,
      (yargs) => {
        // Configure positional arguments from command id
        const matches = cmdRef.id.match(/<([^>]+)>/g);
        if (matches) {
          for (const match of matches) {
            const paramName = match.slice(1, -1);
            yargs.positional(paramName, {
              type: "string",
              describe: `Parameter: ${paramName}`,
            });
          }
        }
        return yargs;
      },
      (argv) => {
        lastParsedResult = {
          commandDef: cmdRef,
          argv: argv as Record<string, any>,
        };
      }
    );
  }

  return {
    parse: (input: string): ParsedCommand | null => {
      lastParsedResult = null;

      try {
        // Remove leading slash and split into args
        const cleanInput = input.trim();
        const args = cleanInput.split(/\s+/);

        // Parse with yargs
        parser.parse(args);

        if (!lastParsedResult) {
          return null;
        }

        // Type assertion to help TypeScript
        const result: YargsCommandHandler = lastParsedResult;

        // Extract params from argv
        const params: Record<string, string> = {};
        const matches = result.commandDef.id.match(/<([^>]+)>/g);

        if (matches) {
          for (const match of matches) {
            const paramName = match.slice(1, -1);
            const value = result.argv[paramName];
            if (value !== undefined) {
              params[paramName] = String(value);
            }
          }
        }

        return {
          command: result.commandDef,
          params,
          displayedCommand: cleanInput,
        };
      } catch (error) {
        return null;
      }
    },
  };
}

function convertToYargsCommand(cmd: CommandDefinition): string {
  // Convert "/admin users delete <user_id>" to "admin users delete <user_id>"
  let yargsCmd = cmd.id;

  // Remove leading slash
  if (yargsCmd.startsWith("/")) {
    yargsCmd = yargsCmd.slice(1);
  }

  return yargsCmd;
}

export function requiresParams(commandId: string): boolean {
  return commandId.includes("<") && commandId.includes(">");
}
