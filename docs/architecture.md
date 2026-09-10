# Architecture — जड़Tak

## Pipeline overview

```
Citizen
  |
  v
Citizen Intake (apps/citizen-web-pwa)
  | (text / photo / geo-tag / vernacular voice)
  v
AI Triage Microservice (ml/, FastAPI)
  | - Bhashini API: vernacular speech/text -> English
  | - SBERT embeddings (all-MiniLM-L6-v2)
  | - Zero-shot categorization
  | - pgvector cosine-similarity duplicate clustering
  v
PostgreSQL (Supabase) — complaints, users, categories, claims,
  solutions, status_logs, notifications (with pgvector extension)
  v
Government Admin Dashboard (frontend/app/admin)
  | reviews, categorizes, advances status
  v
   +--------------------------+
   |                          |
   v                          v
Academic Opportunities    Industry & CSR Marketplace
(frontend/app/academic)   (frontend/app/industry)
   |                          |
   v                          v
Claim -> Solution Submission (frontend/app/academic/solutions)
   |
   v
Government Verification Queue (frontend/app/admin/solutions)
   |
   v
Status update + notification -> back to original citizen
   |
   v
Analytics Command Center (frontend/app/admin/analytics)
```

## Module-to-folder mapping

| Module | Responsibility | Folder |
|---|---|---|
| 1. Citizen intake | Complaint submission (text/photo/geo/voice) | `apps/citizen-web-pwa` |
| 2. AI triage | Translation, categorization, embeddings | `ml/` |
| 3. Government routing | Admin complaint queue, status workflow | `frontend/app/admin/complaints` |
| 4. Academic routing | Opportunity board for institutions | `frontend/app/academic/opportunities` |
| 5. Industry/NGO routing | CSR marketplace, claims | `frontend/app/industry/marketplace` |
| 6. Solution submission | Teams submit solutions back | `frontend/app/academic/solutions` |
| 7. Verification & closed loop | Admin approves, notifies citizen | `frontend/app/admin/solutions` |
| 8. Analytics | Aggregate impact dashboard | `frontend/app/admin/analytics` |

## Database

See [`db/schema.sql`](../db/schema.sql) (or `db/migrations/`) for full table definitions:
`users`, `categories`, `complaints`, `claims`, `solutions`, `status_logs`, `notifications`.

`complaints.embedding` is a `vector(384)` column (pgvector extension) storing SBERT output,
used for zero-shot categorization and cosine-similarity duplicate clustering.

## Authentication

Custom JWT-based auth using `bcryptjs` (password hashing) and `jsonwebtoken` (session tokens),
stored as an HTTP-only cookie. Role is read from the `users.role` column and used by
`frontend/middleware.ts` to restrict each of the five roles (`citizen`, `student`, `ngo`,
`institution`, `govt_admin`) to their own module.

## External APIs

- **Bhashini** (bhashini.gov.in) — vernacular speech/text to English translation
- **Mappls** — geo-tagging and map rendering for complaint locations

## Deployment

- Frontend + API routes: Vercel
- Database: Supabase (managed PostgreSQL with pgvector enabled)
- ML microservice: [add hosting platform once deployed, e.g. Render]
