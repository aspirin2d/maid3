# Maid CLI

A terminal-based interface for interacting with the Maid API.

## Features

- **Command Palette**: Fuzzy search for commands with keyboard navigation
- **Login Form**: Interactive authentication form with email/password
- **Session Persistence**: Automatic session saving and loading from `~/.maid-session`
- **Bearer Token Authentication**: Auto-login with saved session on startup
- **Dynamic Commands**: Shows `/logout` when authenticated, `/login` and `/signup` when not
- **Tab Navigation**: Use Tab/Shift+Tab to navigate between form fields
- **Visual Feedback**: Real-time status updates and error messages

## Installation

```bash
cd cli
npm install
npm run build
```

## Usage

```bash
node dist/cli.js --url=http://localhost:3000/api
```

### Available Commands

**When not authenticated:**
- `/login` - Authenticate with your Maid account
- `/signup` - Create a new Maid account (coming soon)
- `/help` - Show help and documentation (coming soon)
- `/quit` - Exit the application

**When authenticated:**
- `/logout` - Sign out and clear saved session
- `/help` - Show help and documentation (coming soon)
- `/quit` - Exit the application

## Login Form

The login form provides an interactive authentication experience:

1. **Email Field**: Enter your email address
2. **Password Field**: Enter your password (masked with •)
3. **Submit Button**: Press Enter to submit the form

### Keyboard Shortcuts

- `Tab` - Move to next field
- `Shift+Tab` - Move to previous field
- `Enter` - Submit form (when on submit button or password field)
- `Esc` - Cancel and return to command palette
- `↑/↓` - Navigate command palette results
- `/` - Activate command palette

## Development

```bash
npm run dev  # Watch mode for development
npm run build  # Build for production
```

## Session Management

The CLI automatically manages your authentication session:

- **Auto-save**: When you log in, your session is saved to `~/.maid-session`
- **Auto-load**: On startup, the CLI checks for a saved session and verifies it with the API
- **Bearer token**: Authenticated requests use the bearer token from your session
- **Expiry**: Sessions expire after 7 days (configurable by the API)
- **Logout**: The `/logout` command clears your saved session

### Session File Location

- Linux/macOS: `~/.maid-session`
- Windows: `C:\Users\<username>\.maid-session`

## API Integration

The CLI communicates with the Maid API using the following endpoints:

- `POST /auth/sign-in/email` - Email/password authentication
- `GET /auth/get-session` - Verify session with bearer token

The API base URL is configurable via the `--url` flag.

## Features Coming Soon

- User signup form
- API key management
- Story and memory management
- Help documentation viewer
- Multi-account support
