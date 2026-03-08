# Bitespeed Identity Reconciliation Service

A Node.js + TypeScript REST API that reconciles customer
identities across multiple contact details (email / phone).

## Live Endpoint

```
POST https://bitespeed-identity-jznkf.ondigitalocean.app/api/v1/identify
```

---

## Tech Stack

| Layer      | Technology                        |
|------------|-----------------------------------|
| Runtime    | Node.js 20 + TypeScript           |
| Framework  | Express.js                        |
| ORM        | Prisma                            |
| Database   | PostgreSQL                        |
| Validation | Zod                               |
| Security   | Helmet, CORS, express-rate-limit  |
| Logging    | Winston                           |
| Testing    | Jest + Supertest                  |
| Container  | Docker + docker-compose           |

---

## API Reference

### `POST /api/v1/identify`

**Request Body** (JSON):
```json
{
  "email": "mcfly@hillvalley.edu",
  "phoneNumber": "123456"
}
```
At least one of `email` or `phoneNumber` must be provided.

**Response `200`**:
```json
{
  "contact": {
    "primaryContatctId": 1,
    "emails": ["lorraine@hillvalley.edu", "mcfly@hillvalley.edu"],
    "phoneNumbers": ["123456"],
    "secondaryContactIds": [23]
  }
}
```

**Error responses**:
| Status | Reason |
|--------|--------|
| `400`  | Missing / invalid input |
| `404`  | Route not found |
| `429`  | Rate limit exceeded |
| `500`  | Internal server error |

### `GET /api/v1/health`

Returns server health and uptime.

---

## Local Development

### Prerequisites
- Node.js 20+
- PostgreSQL 14+ 

### Setup

```bash
# 1. Clone & install
git clone https://github.com/shubham-dube/bitespeed-identity-service
cd bitespeed-identity-service
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env — set DATABASE_URL

# 3. Run DB migrations
npm run prisma:migrate

# 4. Start dev server
npm run dev
```

### Using Docker

```bash
docker-compose up --build
```

This starts both PostgreSQL and the app on port 3000.

---

## Testing

```bash
# Unit tests only (no DB needed)
npm test tests/unit

# All tests (requires test DB)
npm test

# With coverage
npm run test:coverage
```

---

## Project Structure

```
src/
├── config/          # Env validation, Prisma singleton
├── controllers/     # HTTP layer only
├── services/        # Business logic (identity reconciliation)
├── repositories/    # All DB queries
├── validators/      # Zod schemas
├── middlewares/     # Validation, rate limit, error handling
├── routes/          # Express routers
├── types/           # Shared TypeScript types
└── utils/           # Logger, AppError, asyncHandler
```

---

## Deployment (DigitalOcean)

1. Connect GitHub repo to DigitalOcean
2. Set **Build Command**: `npm install && npm run build && npx prisma generate`
3. Set **Start Command**: `npx prisma migrate deploy && npm run start`
4. Add a **PostgreSQL** add-on and copy the `DATABASE_URL` into env vars
5. Add all other env vars from `.env.example`