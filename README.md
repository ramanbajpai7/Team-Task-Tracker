# Team Task Tracker API

A production-grade REST API for managing tasks within a team, featuring JWT authentication with refresh token rotation, role-based access control (RBAC), Redis caching, and containerized deployment.

## 🚀 Quick Start

### Prerequisites
- [Docker](https://docs.docker.com/get-docker/) & [Docker Compose](https://docs.docker.com/compose/install/)

### Run with Docker (Recommended)

```bash
# Clone the repository
git clone <repository-url>
cd team-task-tracker

# Start all services (API + PostgreSQL + Redis)
docker compose up --build
```

That's it! The API will be available at:
- **API**: http://localhost:3000
- **Swagger Docs**: http://localhost:3000/api-docs
- **Health Check**: http://localhost:3000/api/health

### Default Seed Data

The database is automatically seeded with:

| Email | Password | Role |
|-------|----------|------|
| admin@acme.com | Password1 | ADMIN |
| manager@acme.com | Password1 | MANAGER |
| member1@acme.com | Password1 | MEMBER |
| member2@acme.com | Password1 | MEMBER |

### Local Development (Without Docker)

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your PostgreSQL and Redis connection strings

# Generate Prisma client
npx prisma generate --schema=./src/prisma/schema.prisma

# Run migrations
npx prisma migrate dev --schema=./src/prisma/schema.prisma

# Seed database
npm run prisma:seed

# Start dev server
npm run dev
```

---

## 📋 API Endpoints

### Authentication
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/auth/register` | Register user + create org | No |
| POST | `/api/auth/login` | Login, get tokens | No |
| POST | `/api/auth/refresh` | Rotate refresh token | No |
| POST | `/api/auth/logout` | Invalidate refresh token | Yes |

### Users (ADMIN only)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users` | List org users |
| GET | `/api/users/:id` | Get user by ID |
| POST | `/api/users` | Create user in org |
| PATCH | `/api/users/:id` | Update user |
| DELETE | `/api/users/:id` | Delete user |

### Tasks
| Method | Endpoint | Roles | Description |
|--------|----------|-------|-------------|
| POST | `/api/tasks` | ADMIN, MANAGER | Create task |
| GET | `/api/tasks` | ALL (scoped) | List with pagination/filters |
| GET | `/api/tasks/:id` | ALL (scoped) | Get task by ID |
| PATCH | `/api/tasks/:id` | ADMIN, MANAGER | Update task fields |
| PATCH | `/api/tasks/:id/status` | Assignee, MANAGER, ADMIN | Change status |
| DELETE | `/api/tasks/:id` | ADMIN, MANAGER | Delete task |

### Analytics (Bonus)
| Method | Endpoint | Roles | Description |
|--------|----------|-------|-------------|
| GET | `/api/analytics/tasks` | ADMIN, MANAGER | Overdue counts + avg completion time |

---

## 🔐 Authentication & Authorization

### JWT Token Flow
1. **Register/Login** → Receive `accessToken` (15min) + `refreshToken` (7d)
2. **API Requests** → Include `Authorization: Bearer <accessToken>`
3. **Token Expired** → Call `/api/auth/refresh` with the refresh token
4. **Token Rotation** → Each refresh issues a new pair and invalidates the old one

### RBAC (Role-Based Access Control)

| Permission | ADMIN | MANAGER | MEMBER |
|-----------|-------|---------|--------|
| Manage users | ✅ | ❌ | ❌ |
| Manage projects & tasks | ✅ | ✅ | ❌ |
| Assign members | ✅ | ✅ | ❌ |
| View/update assigned tasks | ✅ | ✅ | ✅ (own only) |
| Change task status | ✅ | ✅ | ✅ (own only) |

**RBAC is enforced at the middleware level**, not inside controller logic. Each route declaration includes `authorize(Role.ADMIN, Role.MANAGER)` middleware that checks the user's role before the request reaches the controller.

### Status Transitions

```
TODO → IN_PROGRESS → IN_REVIEW → DONE
  ↘        ↘             ↘
    ────── BLOCKED ──────
            ↓
    TODO / IN_PROGRESS / IN_REVIEW
```

- Only the **assignee** or a **MANAGER/ADMIN** can advance a task's status
- **DONE** is a terminal state (no further transitions)
- **BLOCKED** can be reached from any active state and can return to any active state

---

## 🗄️ Database Design

### Schema

```
Organization (1) ──── (*) User
Organization (1) ──── (*) Task
User (1) ──── (*) Task (assigned)
User (1) ──── (*) Task (created)
```

### Indexes

| Index | Columns | Justification |
|-------|---------|---------------|
| `idx_task_org_status_assignee` | `(organization_id, status, assignee_id)` | **Composite index** for the primary query pattern |
| `idx_task_assignee` | `(assignee_id)` | Fast lookup for "my tasks" |
| `idx_task_due_date` | `(due_date)` | Sort/filter by deadline |
| `idx_task_status` | `(status)` | Filter by status alone |
| `idx_user_org` | `(organization_id)` | List users in org |
| Unique | `(email)` | Login lookup |

### Design Decision: Composite Index

The most critical query pattern is: *"List all tasks in my organization, optionally filtered by status and/or assignee."*

A **composite index on `(organization_id, status, assignee_id)`** efficiently covers:
- All tasks in org → uses just the first column
- Tasks in org filtered by status → uses first two columns
- Tasks in org filtered by status AND assignee → uses all three columns
- Tasks in org filtered by assignee → partial coverage (with individual `assignee_id` index as backup)

This single index replaces what would otherwise require 3+ separate indexes, reducing write overhead while maintaining read performance for the primary access patterns.

---

## 📦 Caching Strategy

### Approach: Cache-Aside with Proactive Invalidation

**What is cached**: Task list query results, keyed by organization + assignee + pagination + filters.

**Cache key pattern**:
```
tasks:org:{orgId}:assignee:{assigneeId}:page:{page}:limit:{limit}:status:{status}:priority:{priority}
```

### Read Path
1. Client requests `GET /api/tasks?assignee=...&status=...`
2. Check Redis for cached result
3. **Cache HIT** → Return cached data immediately
4. **Cache MISS** → Query PostgreSQL → Store in Redis with 5-minute TTL → Return

### Write Path (Invalidation)
On **any task mutation** (create, update, delete, status change):
1. Perform the database operation
2. Invalidate **all cached task lists** for the organization using `SCAN` + `DEL`

### Why Org-Level Invalidation?

- **Simplicity**: A task mutation can affect any cached query (e.g., creating a task changes pagination counts for all users). Org-level invalidation is correct by default.
- **Safety**: TTL (5 minutes) acts as a safety net — stale data is bounded.
- **Performance**: `SCAN` with pattern matching is efficient for moderate key counts. The tradeoff is slightly more cache misses after mutations vs. complex per-query invalidation logic.

---

## 🧪 Testing

```bash
# Run tests (requires running PostgreSQL and Redis)
npm test

# Run with coverage
npm run test:coverage
```

### Test Coverage
- **Auth**: Registration, login, token refresh/rotation, logout, protected routes
- **Tasks**: CRUD, status transitions (valid + invalid), RBAC enforcement, pagination, filtering, analytics

---

## 📁 Project Structure

```
src/
├── config/           # Environment, database, Redis, Swagger config
├── middleware/        # Auth (JWT), RBAC, validation, error handler
├── modules/
│   ├── auth/         # Register, login, refresh, logout
│   ├── user/         # User CRUD (ADMIN only)
│   └── task/         # Task CRUD, status transitions, analytics
├── utils/            # Error classes, constants, cache helpers
├── prisma/           # Schema, migrations, seed
├── app.ts            # Express app setup
└── server.ts         # Entry point
```

---

## ⚙️ Error Handling

All errors follow a consistent format:

```json
{
  "status": 400,
  "code": "VALIDATION_ERROR",
  "message": "due_date must be a future date"
}
```

Error codes:
- `VALIDATION_ERROR` (400) — Invalid input
- `UNAUTHORIZED` (401) — Missing/invalid token
- `FORBIDDEN` (403) — Insufficient role permissions
- `NOT_FOUND` (404) — Resource doesn't exist
- `CONFLICT` (409) — Duplicate resource
- `INVALID_STATUS_TRANSITION` (400) — Invalid status change
- `INTERNAL_SERVER_ERROR` (500) — Unexpected error

---

## 🔮 What I Would Improve Given More Time

1. **Rate limiting** — Add express-rate-limit to prevent abuse, especially on auth endpoints
2. **WebSocket notifications** — Real-time notifications when assigned task status changes (SSE or Socket.io)
3. **Audit logging** — Track who changed what and when for compliance
4. **Pagination cursor-based** — Replace offset-based pagination with cursor-based for large datasets
5. **Email notifications** — Send email when tasks are assigned or due dates approach
6. **Soft deletes** — Mark records as deleted instead of hard deleting
7. **API versioning** — Prefix routes with `/api/v1/` for future compatibility
8. **More granular caching** — Per-query cache invalidation instead of org-level for better cache hit rates
9. **CI/CD pipeline** — GitHub Actions for automated testing, linting, and deployment
10. **Comprehensive logging** — Structured logging with Winston/Pino with correlation IDs

---

## 📄 Tech Stack

- **Runtime**: Node.js 20 + TypeScript
- **Framework**: Express.js
- **ORM**: Prisma
- **Database**: PostgreSQL 16
- **Cache**: Redis 7
- **Auth**: JWT (jsonwebtoken) with bcrypt
- **Validation**: Zod
- **Docs**: Swagger (swagger-jsdoc + swagger-ui-express)
- **Testing**: Jest + Supertest
- **Containerization**: Docker + Docker Compose
