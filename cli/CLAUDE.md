# Maid CLI - Technical Documentation

## Executive Summary

**Maid CLI** is a terminal-based interface for the Maid3 backend service, built with React using Ink (React for CLI). It provides an interactive command palette interface for managing authentication, stories, and memories.

**Status:** In Active Development
**UI Framework:** Ink v6.4.0 (React for Terminal)
**Build System:** TypeScript v5.0.3
**Code Quality:** Good foundation with room for feature expansion

---

## Architecture Overview

### Technology Stack

- **UI Framework:** Ink v6.4.0 - React renderer for terminal applications
- **Input Handling:** ink-text-input v6.0.0 - Text input component
- **CLI Framework:** meow v14.0.0 - CLI argument parser
- **Runtime:** Node.js >=16 (ESM modules)
- **Language:** TypeScript 5.0.3

### Project Structure

```
cli/
├── src/
│   ├── cli.tsx              # Entry point, CLI argument parsing
│   ├── app.tsx              # Main application component
│   └── command-palette.tsx  # Command palette UI component
├── dist/                    # Build output (gitignored)
├── package.json
├── tsconfig.json
└── CLAUDE.md               # This file
```

---

## Core Components

### 1. Entry Point (cli.tsx)

**Purpose:** Bootstrap the CLI application, parse arguments, render the React app.

**Key Features:**
- Uses `meow` for argument parsing
- Requires `--url` flag for API base URL
- Renders Ink React app using `render()`
- Handles uncaught errors at top level

**Usage:**
```bash
# Development
pnpm --filter cli dev
node dist/cli.js --url=http://localhost:3000/api

# Production
npm install -g .
cli --url=https://api.example.com
```

**Configuration:**
```typescript
// Required flags
--url, -u    API base URL (required)

// Examples
cli --url=http://localhost:3000/api
cli -u https://production.api.com/v1
```

---

### 2. Main Application (app.tsx)

**Purpose:** Main UI container, defines available commands, manages state.

**Component Hierarchy:**
```
App
├── Header (shows app title + API URL)
└── CommandPalette (interactive command selector)
```

**Available Commands:**

| Command | Category | Shortcut | Description |
|---------|----------|----------|-------------|
| `/login` | Auth | ⌘L | Authenticate with account |
| `/signup` | Auth | ⌘S | Create new account |
| `/logout` | Auth | - | Sign out |
| `/story/new` | Story | ⌘N | Create conversation |
| `/story/list` | Story | - | List all stories |
| `/memory/search` | Memory | ⌘F | Search memories |
| `/help` | General | ? | Show help |
| `/quit` | General | ⌘Q | Exit application |

**Adding New Commands:**

```typescript
// In app.tsx, add to commands array
const commands = useMemo(() => [
  {
    id: "/new-command",           // Unique identifier
    label: "/new-command",         // Display text
    description: "What it does",   // Help text
    category: "Category",          // Grouping label
    shortcut: "⌘X",               // Optional keyboard hint
  },
  // ... other commands
], []);

// Then implement handler in handlePaletteSubmit
const handlePaletteSubmit = useCallback((selection) => {
  if (selection.type === "known") {
    switch (selection.command.id) {
      case "/new-command":
        // Implementation here
        break;
      // ... other cases
    }
  }
}, []);
```

---

### 3. Command Palette (command-palette.tsx)

**Purpose:** Interactive fuzzy-searchable command picker with keyboard navigation.

#### Features

✅ **Fuzzy Matching**
- Smart scoring algorithm prioritizes:
  - Exact matches (score: 1000)
  - Prefix matches (score: 500)
  - Contains matches (score: 100)
  - Character sequence matches (score: 1-10)
- Results sorted by relevance

✅ **Keyboard Navigation**
- `↑` / `↓` - Navigate through commands
- `⏎` - Select highlighted command
- `⎋` - Clear input / exit command mode
- `/` - Enter command search mode

✅ **Visual Feedback**
- Active item highlighted with cyan color
- Background highlighting for selected item
- Arrow indicator (`▶`) for current selection
- Category and shortcut badges
- Dynamic result count footer

✅ **Smart Filtering**
- Searches across label, description, and category
- Case-insensitive matching
- Real-time filtering as you type
- Shows all commands when query is empty

#### Type Definitions

```typescript
export type CommandPaletteOption = {
  id: string;           // Unique identifier
  label: string;        // Display text (typically the command itself)
  description?: string; // Help text shown alongside
  category?: string;    // Grouping label (e.g., "Auth", "Story")
  shortcut?: string;    // Keyboard shortcut hint (e.g., "⌘L")
};

export type CommandPaletteSelection =
  | { type: "known"; command: CommandPaletteOption }
  | { type: "custom"; value: string };

export type CommandPaletteProps = {
  options: CommandPaletteOption[];
  placeholder?: string;
  emptyLabel?: string;
  showHelp?: boolean;
  onSubmit: (selection: CommandPaletteSelection) => void;
};
```

#### Fuzzy Matching Algorithm

**Strategy:** Multi-level scoring system for optimal search UX.

```typescript
function fuzzyScore(haystack: string, needle: string): number {
  // 1. Exact match - highest priority
  if (haystackLower === needleLower) return 1000;

  // 2. Prefix match - high priority
  if (haystackLower.startsWith(needleLower)) return 500;

  // 3. Contains match - medium priority
  if (haystackLower.includes(needleLower)) return 100;

  // 4. Character sequence - low priority
  // Scores based on character proximity
  return characterSequenceScore(haystack, needle);
}
```

**Examples:**
```typescript
fuzzyScore("/login", "login")      // 500 (prefix match)
fuzzyScore("/logout", "login")     // 10-50 (character sequence)
fuzzyScore("/signup", "sign")      // 500 (prefix match)
fuzzyScore("Create story", "story") // 100 (contains match)
```

#### UI States

**1. Idle State (no input):**
```
╭────────────────────────────────╮
│ › Type '/' to search commands… │
╰────────────────────────────────╯

💡 Press "/" to search available commands

Keyboard shortcuts:
  ↑/↓  Navigate commands
  ⏎   Select command
  ⎋   Clear input
```

**2. Command Mode (typing "/login"):**
```
╭──────────────────────────────╮
│ › /login                     │
╰──────────────────────────────╯

┌────────────────────────────────────────┐
│ ▶ /login     Authenticate with account │
│   /logout    Sign out of account       │
└────────────────────────────────────────┘

2 commands • Use ↑↓ to navigate • ⏎ to select
```

**3. Empty Results:**
```
╭──────────────────────────────╮
│ › /xyz                       │
╰──────────────────────────────╯

⚠ No matching commands
```

---

## Development Workflow

### Setup

```bash
# Install dependencies
cd cli
pnpm install

# Build
pnpm build

# Development with auto-rebuild
pnpm dev

# Run (after build)
node dist/cli.js --url=http://localhost:3000/api
```

### TypeScript Configuration

Uses `@sindresorhus/tsconfig` as base with ESM module compilation:

```json
{
  "extends": "@sindresorhus/tsconfig",
  "compilerOptions": {
    "outDir": "dist",
    "jsx": "react"
  },
  "include": ["src"]
}
```

### File Naming Conventions

- Use `.tsx` extension for files with JSX (React components)
- Use `.ts` extension for pure TypeScript files
- Always use `.js` extension in imports (ESM requirement)

```typescript
// ✅ Correct
import App from "./app.js";

// ❌ Wrong (will fail at runtime)
import App from "./app";
import App from "./app.tsx";
```

---

## Best Practices

### 1. Component Design

**Keep components focused:**
```typescript
// ✅ Good - single responsibility
function Header({ url }: { url: string }) {
  return <Box>...</Box>;
}

// ❌ Bad - mixing concerns
function HeaderAndPalette({ url, commands }) {
  return (
    <>
      <Header />
      <CommandPalette />
      <Footer />
    </>
  );
}
```

### 2. State Management

**Use React hooks appropriately:**
```typescript
// ✅ Good - memoize static data
const commands = useMemo(() => [
  { id: "/login", label: "/login", ... }
], []); // Empty deps - never changes

// ✅ Good - memoize callbacks
const handleSubmit = useCallback((selection) => {
  // Implementation
}, [/* only required deps */]);

// ❌ Bad - recreating on every render
const commands = [{ id: "/login", ... }]; // New array every render
```

### 3. Keyboard Handling

**Always check for mode/state before handling keys:**
```typescript
useInput((input, key) => {
  // ✅ Good - guard against invalid state
  if (!isCommandMode || !filtered.length) {
    return;
  }

  if (key.upArrow) {
    // Handle navigation
  }
});
```

### 4. Accessibility

**Provide visual feedback:**
- Use colors to indicate state (cyan for active, gray for inactive)
- Show keyboard shortcuts in UI
- Display result counts
- Provide empty state messages

**Example:**
```tsx
<Text color={isActive ? "cyan" : "white"} bold={isActive}>
  {option.label}
</Text>
```

### 5. Error Handling

**Always wrap async operations:**
```typescript
// ✅ Good
(async () => {
  try {
    const { waitUntilExit } = render(<App url={cli.flags.url} />);
    await waitUntilExit();
  } catch (error) {
    console.error("Fatal error:", error);
    process.exit(1);
  }
})();
```

---

## Extending the CLI

### Adding a New Feature Screen

**1. Create new component:**
```typescript
// src/story-list.tsx
import { Box, Text } from "ink";

export function StoryList({ onBack }: { onBack: () => void }) {
  return (
    <Box flexDirection="column">
      <Text>Your Stories</Text>
      {/* Implementation */}
    </Box>
  );
}
```

**2. Add navigation state to App:**
```typescript
export default function App({ url }: { url: string }) {
  const [screen, setScreen] = useState<"palette" | "story-list">("palette");

  if (screen === "story-list") {
    return <StoryList onBack={() => setScreen("palette")} />;
  }

  return <CommandPalette ... />;
}
```

**3. Handle command selection:**
```typescript
const handlePaletteSubmit = useCallback((selection) => {
  if (selection.command.id === "/story/list") {
    setScreen("story-list");
  }
}, []);
```

### Adding API Integration

**Example: Login command**

```typescript
// src/api.ts
export async function login(url: string, email: string, password: string) {
  const response = await fetch(`${url}/auth/sign-in/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    throw new Error("Login failed");
  }

  return response.json();
}

// src/app.tsx
const handlePaletteSubmit = useCallback(async (selection) => {
  if (selection.command.id === "/login") {
    try {
      const result = await login(url, email, password);
      // Handle success
    } catch (error) {
      // Handle error
    }
  }
}, [url]);
```

---

## Performance Considerations

### 1. Rendering Optimization

**Ink re-renders on every state change.** Use `useMemo` and `useCallback`:

```typescript
// ✅ Optimized - only recalculates when dependencies change
const filtered = useMemo(() => {
  // Expensive filtering logic
}, [isCommandMode, options, query]);

// ❌ Not optimized - recalculates every render
const filtered = options.filter(...);
```

### 2. Fuzzy Search Performance

Current implementation is O(n*m) where:
- n = number of options
- m = average length of searchable text

**Acceptable for <1000 commands.** For larger datasets, consider:
- Pre-computing search indices
- Debouncing input
- Virtual scrolling for results

### 3. Terminal Rendering

Ink is efficient but avoid:
- Excessive nested `<Box>` components (keep DOM shallow)
- Rapid state updates (debounce where possible)
- Large lists without virtualization

---

## Testing Strategy

### Recommended Approach

**1. Unit Tests for Logic:**
```typescript
// __tests__/fuzzy-score.test.ts
import { fuzzyScore } from "../command-palette";

describe("fuzzyScore", () => {
  it("gives highest score for exact match", () => {
    expect(fuzzyScore("login", "login")).toBe(1000);
  });

  it("gives high score for prefix match", () => {
    expect(fuzzyScore("login", "log")).toBe(500);
  });
});
```

**2. Component Tests with Ink Testing Library:**
```typescript
import { render } from "ink-testing-library";
import { CommandPalette } from "../command-palette";

test("shows help text when not in command mode", () => {
  const { lastFrame } = render(
    <CommandPalette options={[]} onSubmit={() => {}} />
  );

  expect(lastFrame()).toContain("Press \"/\" to search");
});
```

**3. Integration Tests:**
- Test full command flow (input → selection → handler)
- Test keyboard navigation
- Test edge cases (empty results, special characters)

---

## Known Limitations & Roadmap

### Current Limitations

❌ **No Command Handlers Implemented**
- Commands defined but not connected to API
- TODO: Implement actual authentication, story creation, etc.

❌ **No Persistent State**
- No session storage
- No config file support
- TODO: Add `~/.maidrc` for storing API URL, auth token

❌ **No Error Boundaries**
- React errors crash the app
- TODO: Add error recovery UI

❌ **No Loading States**
- API calls block UI
- TODO: Add spinners/progress indicators

❌ **No Multi-Step Flows**
- Commands are single-action only
- TODO: Add wizards for complex operations (e.g., signup flow)

### Roadmap

**Phase 1: Core Functionality** (Current)
- [x] Command palette UI
- [x] Fuzzy search
- [x] Keyboard navigation
- [ ] API client implementation
- [ ] Session management

**Phase 2: Enhanced UX**
- [ ] Loading spinners
- [ ] Error handling & recovery
- [ ] Multi-step command flows
- [ ] Configuration file support
- [ ] Auto-completion

**Phase 3: Advanced Features**
- [ ] Command history (↑/↓ to recall)
- [ ] Customizable themes
- [ ] Plugin system
- [ ] Scripting support
- [ ] Offline mode

---

## Common Issues & Solutions

### Issue: "Cannot find module './app.js'"

**Cause:** Missing `.js` extension in import
**Solution:** Always use `.js` in imports (TypeScript requirement for ESM)

```typescript
// ✅ Correct
import App from "./app.js";

// ❌ Wrong
import App from "./app";
```

### Issue: Colors not showing in terminal

**Cause:** Terminal doesn't support colors
**Solution:** Use a modern terminal (iTerm2, Hyper, Windows Terminal)

### Issue: Input not responding

**Cause:** Another `useInput` hook is capturing events
**Solution:** Check for conflicting hooks, ensure proper event handling guards

```typescript
useInput((input, key) => {
  // Add guards at the top
  if (!isActive) return;
  if (isProcessing) return;

  // Handle input
});
```

### Issue: Build fails with "Cannot find 'Box'"

**Cause:** Missing Ink types
**Solution:** Ensure `@types/react` is installed

```bash
pnpm add -D @types/react
```

---

## Code Review Checklist

Before committing CLI changes:

- [ ] All imports use `.js` extension
- [ ] No `any` types (use proper TypeScript types)
- [ ] Callbacks wrapped in `useCallback`
- [ ] Expensive computations wrapped in `useMemo`
- [ ] Error handling for async operations
- [ ] Keyboard shortcuts documented
- [ ] Empty states handled gracefully
- [ ] Loading states for async operations
- [ ] Accessible color contrasts
- [ ] Help text provided for new features

---

## API Integration Guide

### Expected Backend Endpoints

Based on `app.tsx` commands, the CLI expects these endpoints:

```
POST   /auth/sign-in/email     → Login
POST   /auth/sign-up/email     → Signup
POST   /auth/sign-out          → Logout
POST   /stories                → Create story
GET    /stories                → List stories
GET    /memories?q=<query>     → Search memories
```

### Session Management

**Recommended approach:**

1. **Store token after login:**
```typescript
// After successful login
const { token } = await api.login(email, password);
await saveToken(token); // Store in config file
```

2. **Load token on startup:**
```typescript
// In cli.tsx
const token = await loadToken();
render(<App url={cli.flags.url} token={token} />);
```

3. **Include in API requests:**
```typescript
fetch(url, {
  headers: {
    "Authorization": `Bearer ${token}`,
  },
});
```

---

## Conclusion

The **Maid CLI** provides a solid foundation for a terminal-based interface to the Maid3 backend. The command palette component is feature-complete with fuzzy search, keyboard navigation, and extensibility.

**Next Steps:**
1. Implement command handlers (connect to API)
2. Add session/config management
3. Improve error handling and loading states
4. Add comprehensive tests

**Estimated Effort:**
- API integration: 2-3 days
- Session management: 1 day
- Error handling & UX polish: 2 days
- Testing: 2-3 days

---

*Documentation created on 2025-11-12*
*CLI Version: 0.0.0*
*Author: Claude (Sonnet 4.5)*
