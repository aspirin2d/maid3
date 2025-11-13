import { View } from "./context.js";

export type CommandParam = {
  name: string;
  required: boolean;
};

export type CommandDefinition = {
  id: string;
  desc: string;
  handler: string;
  requiresAuth?: boolean;
};

export type CommandContext = {
  addViews: (view: View, ...views: View[]) => void;
  setActive: (active: boolean) => void;
  displayedCommand?: string;
};

export type CommandHandler = (
  params: Record<string, string>,
  context: CommandContext
) => void;

class CommandRegistry {
  private handlers = new Map<string, CommandHandler>();

  register(handler: string, fn: CommandHandler): void {
    this.handlers.set(handler, fn);
  }

  execute(
    handler: string,
    params: Record<string, string>,
    context: CommandContext
  ): boolean {
    const fn = this.handlers.get(handler);
    if (!fn) return false;
    fn(params, context);
    return true;
  }

  has(handler: string): boolean {
    return this.handlers.has(handler);
  }
}

export const registry = new CommandRegistry();

const EXIT_DELAY_MS = 100;
const COMMANDER_RESTART_DELAY_MS = 50;

// Auth commands
registry.register("/login", (_params, ctx) => {
  ctx.addViews(
    { kind: "text", option: { label: ctx.displayedCommand || "/login", dimColor: true } },
    { kind: "/login" }
  );
});

registry.register("/signup", (_params, ctx) => {
  ctx.addViews(
    { kind: "text", option: { label: ctx.displayedCommand || "/signup", dimColor: true } },
    { kind: "/signup" }
  );
});

registry.register("/logout", (_params, ctx) => {
  ctx.addViews(
    { kind: "text", option: { label: ctx.displayedCommand || "/logout", dimColor: true } },
    { kind: "/logout" }
  );
});

// System commands
registry.register("/exit", (_params, ctx) => {
  ctx.addViews({
    kind: "text",
    option: { label: "Bye!", color: "green" },
  });
  setTimeout(() => process.exit(0), EXIT_DELAY_MS);
});

// Admin commands
registry.register("/admin/users/list", (_params, ctx) => {
  ctx.addViews(
    { kind: "text", option: { label: ctx.displayedCommand || "/admin users list", dimColor: true } },
    { kind: "/admin/users/list" }
  );
});

registry.register("/admin/users/delete", (params, ctx) => {
  const userId = params["user_id"];
  if (!userId) {
    ctx.addViews(
      {
        kind: "text",
        option: { label: "Error: user_id is required", color: "red" },
      },
      { kind: "commander" }
    );
    setTimeout(() => ctx.setActive(true), COMMANDER_RESTART_DELAY_MS);
    return;
  }

  ctx.addViews(
    {
      kind: "text",
      option: {
        label: ctx.displayedCommand || `/admin users delete ${userId}`,
        dimColor: true,
      },
    },
    { kind: "/admin/users/delete", option: { userId } }
  );
});

// Command definitions
export const guestCommands: CommandDefinition[] = [
  {
    id: "/login",
    desc: "login with your email and password",
    handler: "/login",
  },
  {
    id: "/signup",
    desc: "signup with your email",
    handler: "/signup",
  },
  {
    id: "/exit",
    desc: "exit Maid3",
    handler: "/exit",
  },
];

export const authedCommands: CommandDefinition[] = [
  {
    id: "/logout",
    desc: "logout of your current session",
    handler: "/logout",
  },
  {
    id: "/admin users list",
    desc: "list all users (admin only)",
    handler: "/admin/users/list",
    requiresAuth: true,
  },
  {
    id: "/admin users delete <user_id>",
    desc: "delete a user by ID (admin only)",
    handler: "/admin/users/delete",
    requiresAuth: true,
  },
  {
    id: "/exit",
    desc: "exit Maid3",
    handler: "/exit",
  },
];
