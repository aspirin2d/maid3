# Maid3 - Code Review & Architecture Documentation

## Executive Summary

**maid3** is a TypeScript-based backend service with authentication, user management, and memory/story tracking capabilities. The project uses modern tooling including Hono, Better Auth, Drizzle ORM, and PostgreSQL with pgvector for embeddings.

**Overall Code Quality:** Good foundation with some areas needing improvement
**Security Status:** Moderate - requires validation improvements
**Maintainability:** Good structure, needs more error handling

---

## Coding Style Guidelines

### General Rules

1. **No Emojis in Code**: Never use emojis in source code, UI text, or user-facing messages. Use plain text alternatives instead:
   - ✓ → [Success] or [OK]
   - ❌ → [Error] or [Failed]
   - ⚠ → [Warning]
   - 💡 → [Tip] or [Note]
   - ⏳ → [Loading...] or [Processing...]

   **Rationale:** Emojis can cause rendering issues in terminals, may not be accessible to screen readers, and can look unprofessional in production applications.

2. **Keyboard Navigation**: All interactive CLI components should support both arrow keys and Tab for navigation to improve accessibility and user experience.

---

## Project Architecture

### Technology Stack

- **Runtime:** Node.js (ESM modules)
- **Web Framework:** Hono v4.10.4
- **Authentication:** Better Auth v1.3.34 with plugins (bearer, admin, apiKey)
- **Database:** PostgreSQL with Drizzle ORM v0.44.7
- **Vector Storage:** pgvector for embeddings (1536 dimensions)
- **CLI:** Ink (React for terminal UIs)
- **Language:** TypeScript 5.8.3 with strict mode

### Project Structure

```
maid3/
├── src/
│   ├── index.ts           # Server bootstrap & routing
│   ├── auth.ts            # Better Auth configuration
│   ├── admin.ts           # Admin initialization & middleware
│   └── db/
│       ├── index.ts       # Database client
│       └── schema.ts      # Drizzle schema definitions
├── cli/
│   └── src/
│       ├── cli.tsx        # CLI entry point
│       └── app.tsx        # Ink UI components
├── drizzle.config.ts      # Database migration config
└── tsconfig.json          # TypeScript configuration
```

### Database Schema

#### Core Tables

1. **user** - User accounts with role-based access
   - Fields: id, name, email, emailVerified, image, role, banned, banReason, banExpires
   - Supports admin roles and user banning

2. **session** - Active user sessions
   - Token-based with expiration
   - Tracks IP address, user agent, and impersonation

3. **account** - OAuth & password accounts
   - Multiple provider support
   - Stores tokens and refresh tokens

4. **verification** - Email verification codes

5. **apikey** - API key management
   - Rate limiting capabilities (time window, max requests)
   - Refill intervals for token bucket
   - Per-key permissions and metadata

#### Application Tables

6. **story** - User story/conversation threads
   - Multi-provider support (OpenAI, Ollama, DashScope)
   - Configurable LLM and embedding providers
   - Handler field for different processing strategies

7. **message** - Chat messages within stories
   - Roles: system, user, assistant
   - Extraction tracking flag
   - Optimized indexes for story queries

8. **memory** - Long-term memory storage with embeddings
   - Vector embeddings (1536 dimensions) for semantic search
   - HNSW index for efficient similarity search
   - Metadata: category, importance, confidence, action type
   - Tracks previous content for updates

---

## Code Review Findings

### 🔴 Critical Issues

#### 1. Environment Variable Validation (src/index.ts:38, src/db/index.ts:5)

**Issue:** Non-null assertions on environment variables without validation.

```typescript
// Current code
serve({
  fetch: app.fetch,
  port: parseInt(process.env.PORT!), // ❌ NaN if PORT undefined
});

export const db = drizzle(process.env.DB_URL!); // ❌ undefined if not set
```

**Impact:** Server will start with invalid configuration, leading to runtime failures.

**Recommendation:**
```typescript
// Validate at startup
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
if (isNaN(PORT)) {
  throw new Error('PORT must be a valid number');
}

const DB_URL = process.env.DB_URL;
if (!DB_URL) {
  throw new Error('DB_URL environment variable is required');
}
```

#### 2. Unsafe User Access (src/admin.ts:95)

**Issue:** Non-null assertion without null check in middleware.

```typescript
export const requireAdmin = async (c: AdminContext, next: AdminNext) => {
  const user = c.get("user")!; // ❌ Could be null
  if (!user.role || user.role !== "admin") {
    return c.json({ error: "Unauthorized" }, 403);
  }
  await next();
};
```

**Impact:** Runtime error if session middleware fails or is bypassed.

**Recommendation:**
```typescript
export const requireAdmin = async (c: AdminContext, next: AdminNext) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Authentication required" }, 401);
  }
  if (user.role !== "admin") {
    return c.json({ error: "Unauthorized: Admin access required" }, 403);
  }
  await next();
};
```

### 🟡 Moderate Issues

#### 3. No Global Error Handler (src/index.ts)

**Issue:** Unhandled promise rejections or route errors could crash the server.

**Recommendation:**
```typescript
// Add error handler middleware
app.onError((err, c) => {
  console.error('Server error:', err);
  return c.json({ error: 'Internal server error' }, 500);
});

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
```

#### 4. Missing Base URL Configuration (src/auth.ts)

**Issue:** Better Auth needs a base URL for proper redirect handling in production.

**Recommendation:**
```typescript
export const auth = betterAuth({
  baseURL: process.env.BASE_URL || 'http://localhost:3000',
  database: drizzleAdapter(db, { provider: "pg" }),
  // ... rest of config
});
```

#### 5. Unused Zod Dependency

**Issue:** Zod is installed but not used for request validation.

**Recommendation:** Add input validation for API endpoints:
```typescript
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

app.post('/api/signup', zValidator('json', signupSchema), async (c) => {
  const data = c.req.valid('json');
  // ... handle signup
});
```

#### 6. Memory/Embedding Implementation Missing

**Issue:** Database schema supports vector embeddings, but no implementation code exists.

**Impact:** Memory table cannot be effectively used without embedding generation and search.

**Recommendation:** Implement embedding utilities:
- OpenAI embeddings client
- Ollama embeddings client
- DashScope embeddings client
- Semantic similarity search functions

#### 7. Inconsistent Password Security (src/auth.ts:14)

**Issue:** Email verification is disabled, which is insecure for production.

```typescript
emailAndPassword: {
  enabled: true,
  autoSignIn: true,
  requireEmailVerification: false, // ❌ Should be true in production
}
```

**Recommendation:** Use environment-based configuration:
```typescript
requireEmailVerification: process.env.NODE_ENV === 'production',
```

### 🟢 Minor Issues

#### 8. Incomplete CLI Implementation (cli/src/app.tsx:26)

**Issue:** Placeholder text suggests work in progress.

```typescript
<Text>Fills all remaining space</Text> // ❌ Placeholder
```

**Recommendation:** Complete CLI features or add TODO comment explaining roadmap.

#### 9. No Logging Strategy

**Issue:** Only console.log used for logging, no structured logging or log levels.

**Recommendation:** Use a logging library like `pino` or `winston`:
```typescript
import pino from 'pino';
const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
```

#### 10. Magic Numbers in Schema (src/db/schema.ts)

**Issue:** Hard-coded values without constants:
- Rate limit time window: 86400000ms (24 hours)
- Rate limit max: 10 requests
- Embedding dimensions: 1536

**Recommendation:** Extract to constants:
```typescript
export const RATE_LIMIT_DEFAULTS = {
  TIME_WINDOW: 24 * 60 * 60 * 1000, // 24 hours
  MAX_REQUESTS: 10,
} as const;

export const EMBEDDING_DIMENSIONS = {
  OPENAI: 1536,
  OLLAMA: 384,
} as const;
```

---

## Security Analysis

### ✅ Security Strengths

1. **Cascade Deletes:** Proper foreign key relationships prevent orphaned data
2. **Password Hashing:** Better Auth handles password hashing automatically
3. **CSRF Protection:** Better Auth includes CSRF tokens by default
4. **Session Management:** Token-based sessions with expiration
5. **Admin Role System:** Basic RBAC implementation
6. **SQL Injection Protection:** Drizzle ORM parameterizes queries

### ⚠️ Security Concerns

1. **No Rate Limiting:** API endpoints lack rate limiting (except API keys)
2. **Email Verification Disabled:** Allows unverified accounts
3. **No Input Sanitization:** Missing validation on user inputs
4. **Secrets in Environment:** `.env` file risk (ensure .gitignore is correct)
5. **No CORS Configuration:** Could allow unwanted origins
6. **Admin Seeding:** Default admin credentials in environment variables

### Recommendations

1. **Add Rate Limiting:**
```typescript
import { rateLimiter } from 'hono-rate-limiter';
app.use('*', rateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 100,
}));
```

2. **Enable CORS:**
```typescript
import { cors } from 'hono/cors';
app.use('*', cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
}));
```

3. **Rotate Admin Credentials:** After first setup, change default admin password

---

## Best Practices Analysis

### ✅ What's Working Well

1. **TypeScript Strict Mode:** Excellent type safety
2. **ESM Modules:** Modern module system with explicit `.js` extensions
3. **Database Indexes:** Well-thought-out indexes for query optimization
4. **Migration System:** Proper Drizzle Kit setup for schema evolution
5. **Modular Structure:** Clear separation of concerns
6. **Idempotent Admin Init:** Can be run multiple times safely
7. **Updated At Hooks:** Automatic timestamp updates using `$onUpdate`

### 🔄 Areas for Improvement

1. **Testing:** No tests implemented yet (see AGENTS.md guidelines)
2. **Documentation:** Missing API documentation and inline comments
3. **Error Messages:** Could be more descriptive for debugging
4. **Health Checks:** No `/health` or `/readiness` endpoints
5. **Graceful Shutdown:** No SIGTERM/SIGINT handling
6. **Environment Validation:** Should validate all required env vars at startup

---

## Performance Considerations

### Database Optimization

1. **Excellent Indexing Strategy:**
   - Composite index on `message.storyId + extracted`
   - HNSW index on memory embeddings for fast similarity search
   - User ID indexes on all user-related tables

2. **Vector Search Performance:**
   - HNSW index with cosine distance is optimal for 1536D embeddings
   - Consider adding more index configuration options (m, ef_construction)

3. **Connection Pooling:**
   - Drizzle uses `pg` library which pools by default
   - Consider explicit pool configuration for high load

### API Performance

1. **Session Lookup:** Runs on every `/api/*` request
   - Consider caching session data in Redis
   - Current implementation queries DB on each request

2. **N+1 Query Risk:**
   - No code shows joins between stories/messages/memories
   - Watch for sequential queries in loops

---

## Recommended Action Items

### Priority 1 (Critical - Fix Before Production)

- [ ] Add environment variable validation at startup
- [ ] Fix null checks in `requireAdmin` middleware
- [ ] Add global error handler
- [ ] Enable email verification for production
- [ ] Add CORS configuration
- [ ] Add rate limiting to public endpoints

### Priority 2 (Important - Fix Soon)

- [ ] Implement embedding generation and search
- [ ] Add request validation with Zod
- [ ] Implement structured logging
- [ ] Add health check endpoints
- [ ] Implement graceful shutdown
- [ ] Extract magic numbers to constants

### Priority 3 (Maintenance - Plan Ahead)

- [ ] Write unit and integration tests
- [ ] Add API documentation (OpenAPI/Swagger)
- [ ] Complete CLI implementation
- [ ] Add session caching with Redis
- [ ] Implement request tracing
- [ ] Add monitoring and metrics

---

## API Endpoints

### Authentication
- `POST /api/auth/sign-up/email` - Email/password signup
- `POST /api/auth/sign-in/email` - Email/password login
- `GET /api/auth/session` - Get current session

### Admin (requires admin role via `requireAdmin` middleware)
*(No admin routes implemented yet, but middleware exists)*

### Future Endpoints (Inferred from Schema)
- Stories CRUD (`/api/stories`)
- Messages CRUD (`/api/stories/:id/messages`)
- Memories CRUD with vector search (`/api/memories`)
- API Key management (`/api/keys`)

---

## Development Workflow

### Setup
```bash
# Install dependencies
pnpm install

# Configure environment
cp .env.example .env  # Create this template
# Edit .env with your credentials

# Generate and run migrations
npx drizzle-kit generate --config drizzle.config.ts
npx drizzle-kit push

# Start development server
npm run dev
```

### Migration Workflow
```bash
# After modifying src/db/schema.ts
npx drizzle-kit generate --config drizzle.config.ts
npx drizzle-kit push
```

### Build & Deploy
```bash
npm run build
npm start
```

---

## Environment Variables Reference

### Required
```env
PORT=3000
DB_URL=postgresql://user:password@localhost:5432/maid3
```

### Optional (Admin Seeding)
```env
DEFAULT_ADMIN_EMAIL=admin@example.com
DEFAULT_ADMIN_PASSWORD=change-me-in-production
DEFAULT_ADMIN_NAME=Admin
```

### Recommended
```env
NODE_ENV=production
BASE_URL=https://your-domain.com
ALLOWED_ORIGINS=https://your-frontend.com
LOG_LEVEL=info
```

---

## Future Architecture Recommendations

1. **Microservices Split:**
   - Separate embedding generation service
   - Separate LLM interaction service
   - Keep core API as orchestrator

2. **Caching Layer:**
   - Redis for session caching
   - Redis for rate limiting
   - Consider caching frequently accessed stories/memories

3. **Message Queue:**
   - Process message extraction asynchronously
   - Generate embeddings in background jobs
   - Use BullMQ or similar

4. **Observability:**
   - OpenTelemetry for distributed tracing
   - Prometheus metrics
   - Structured logging with correlation IDs

5. **API Versioning:**
   - Add `/api/v1/` prefix
   - Plan for backward compatibility

---

## Conclusion

**maid3** has a solid foundation with modern tooling and good architectural decisions. The main areas needing attention are:

1. **Security hardening** (input validation, rate limiting, CORS)
2. **Error handling** (global handlers, validation)
3. **Feature completion** (embedding implementation, CLI)
4. **Testing** (unit and integration tests)

The codebase is well-structured and maintainable. With the recommended fixes applied, it will be production-ready.

**Estimated Effort to Production:**
- Priority 1 fixes: 1-2 days
- Priority 2 fixes: 3-5 days
- Priority 3 tasks: 2-3 weeks

---

*Code review completed on 2025-11-12*
*Reviewer: Claude (Sonnet 4.5)*
