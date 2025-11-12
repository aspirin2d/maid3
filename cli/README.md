# Maid CLI

A terminal-based interface for interacting with the Maid API.

## Features

- **Command Palette**: Fuzzy search for commands with keyboard navigation
- **Login Form**: Interactive authentication form with email/password
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

- `/login` - Authenticate with your Maid account
- `/signup` - Create a new Maid account (coming soon)
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

## API Integration

The CLI communicates with the Maid API using the following endpoints:

- `POST /auth/sign-in/email` - Email/password authentication

The API base URL is configurable via the `--url` flag.

## Features Coming Soon

- User signup form
- Session persistence
- API key management
- Story and memory management
- Help documentation viewer
