# Maid CLI

A terminal-based interface for interacting with the Maid API.

## Features

- **Command Palette**: Fuzzy search for commands with keyboard navigation
- **Interactive Forms**: Multi-step authentication forms with progressive disclosure
- **Secure Session Storage**: Sessions saved with 0600 permissions (owner-only access)
- **Session Validation**: Automatic verification of stored sessions on startup
- **Smart Authentication**: Auto-login with saved session, expires invalid tokens
- **Dynamic Commands**: Shows `/logout` when authenticated, `/login` and `/signup` when not
- **Full Keyboard Navigation**: Tab (forward), Shift+Tab (backward), Escape (cancel)
- **Input Validation**: Real-time email and password validation with clear error messages
- **Request Timeouts**: 10-second timeout for all API requests
- **Type-Safe**: Built with strict TypeScript, no `any` types

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
- `/signup` - Create a new Maid account
- `/exit` - Exit the application

**When authenticated:**
- `/logout` - Sign out and clear saved session
- `/exit` - Exit the application

**Coming soon:**
- `/help` - Show help and documentation
- Story and memory management commands

## Authentication Forms

### Login Flow

The login form provides a step-by-step authentication experience:

1. **Email Field**: Enter your email address
   - Real-time validation
   - Press Tab or Enter to continue
2. **Password Field**: Enter your password (masked with *)
   - Minimum 8 characters
   - Press Enter to submit

### Signup Flow

The signup form collects information progressively:

1. **Name Field**: Enter your display name
2. **Email Field**: Enter your email address (validated)
3. **Password Field**: Choose a secure password (8+ characters)

### Keyboard Shortcuts

- `Tab` - Move to next field (validates current field)
- `Shift+Tab` - Move to previous field
- `Enter` - Submit current field or form
- `Esc` - Cancel and return to command palette
- `/` - Type commands in command palette

## Development

```bash
npm run dev  # Watch mode for development
npm run build  # Build for production
```

## Session Management

The CLI implements secure session management with automatic validation:

- **Secure Storage**: Sessions saved with 0600 permissions (owner-only read/write)
- **Auto-save**: When you log in, your session is encrypted and saved to `~/.maid_session`
- **Auto-load**: On startup, the CLI loads and validates your session with the API
- **Session Validation**: Expired or invalid sessions are automatically cleared
- **Bearer Token**: Authenticated requests use the bearer token from your session
- **Request Timeout**: All API requests timeout after 10 seconds
- **Error Handling**: Network errors and timeouts are handled gracefully
- **Logout**: The `/logout` command securely clears your saved session

### Session File Location

- Linux/macOS: `~/.maid_session` (permissions: 0600)
- Windows: `C:\Users\<username>\.maid_session`

### Security Features

- **File Permissions**: Session file is only readable/writable by owner
- **Startup Validation**: Verifies token is still valid on launch
- **Generic Error Messages**: Login errors don't leak account information
- **No Silent Failures**: All errors are logged for debugging

## API Integration

The CLI communicates with the Maid API using the following endpoints:

- `POST /auth/sign-in/email` - Email/password authentication
- `POST /auth/sign-up/email` - Create new account
- `GET /auth/get-session` - Verify session with bearer token

The API base URL is configurable via the `--url` flag.

### Request Features

- **Timeout Protection**: All requests timeout after 10 seconds
- **Bearer Authentication**: Tokens sent via `Authorization` header
- **Error Handling**: Network errors and API errors handled separately
- **HTTPS Enforcement**: Production URLs must use HTTPS

## Features Coming Soon

- `/help` - Help documentation viewer
- `/story/new` - Create new conversation
- `/story/list` - List all stories
- `/memory/search` - Search memories
- API key management
- Multi-account support

## Recent Improvements (v0.1.0)

### Security
- Session files now use 0600 permissions (owner-only access)
- Session validation on startup detects expired tokens
- Request timeouts prevent hanging connections
- Generic error messages prevent username enumeration

### User Experience
- Full Tab/Shift+Tab navigation through forms
- Real-time validation feedback with shared validation utilities
- Better error messages with request timeout detection
- Visual hints for available keyboard shortcuts

### Code Quality
- Removed all `any` types for better type safety
- Extracted validation logic into reusable utilities
- Stable React keys prevent reconciliation issues
- Proper error type checking with `instanceof`
