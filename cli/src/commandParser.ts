import { CommandDefinition } from "./commands.js";

export type ParsedCommand = {
  command: CommandDefinition;
  params: Record<string, string>;
  displayedCommand: string;
};

export function parseCommand(
  input: string,
  commands: CommandDefinition[]
): ParsedCommand | null {
  const inputParts = input.trim().split(/\s+/);

  for (const command of commands) {
    const commandParts = command.id.split(/\s+/);
    const paramNames: string[] = [];
    const paramValues: Record<string, string> = {};

    let matches = true;
    let inputIndex = 0;

    for (let i = 0; i < commandParts.length; i++) {
      const part = commandParts[i];

      if (!part) {
        continue;
      }

      if (part.startsWith("<") && part.endsWith(">")) {
        const paramName = part.slice(1, -1);
        paramNames.push(paramName);

        if (inputIndex >= inputParts.length) {
          matches = false;
          break;
        }

        const value = inputParts[inputIndex];
        if (!value) {
          matches = false;
          break;
        }

        paramValues[paramName] = value;
        inputIndex++;
      } else {
        if (inputIndex >= inputParts.length || inputParts[inputIndex] !== part) {
          matches = false;
          break;
        }
        inputIndex++;
      }
    }

    if (matches && inputIndex === inputParts.length) {
      return {
        command,
        params: paramValues,
        displayedCommand: input,
      };
    }
  }

  return null;
}

export function requiresParams(commandId: string): boolean {
  return commandId.includes("<") && commandId.includes(">");
}
