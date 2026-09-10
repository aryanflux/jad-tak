# जड़Tak — SIH26043

A crowdsourcing-to-resolution ecosystem for the Government of Jharkhand: citizen intake,
AI triage, academic claims, industry partnerships, and closed-loop governance.

## 1. Project Information
- **Project Title:** जड़Tak
- **PS ID:** SIH26043
- **PS Title:** Digital platform to crowdsource societal challenges and facilitate
  collaborative problem solving through university and industry partnerships
- **Category:** Software
- **Theme:** Smart Education

## 2. Problem Statement
Citizens face slow, opaque grievance-redressal systems (e.g. CPGRAMS/PG Portal) where
complaints are submitted but rarely tracked to resolution. Meanwhile, academic institutions,
NGOs, and industry/CSR programs have capacity to solve real local problems but no structured
way to discover them.

## 3. Proposed Solution
जड़Tak lets citizens report problems through a low-friction intake form (text, photo,
geo-tag, and vernacular voice input). An AI microservice automatically categorizes each report
and detects duplicates. Government admins review and route validated problems to academic
institutions, NGOs, and industry partners, who can claim and solve them. Solutions are verified
by government, and the original citizen is notified at every stage — closing the loop that
existing grievance systems leave open.

## 4. Key Features
- Low-friction citizen complaint submission (photo, geo-tag, vernacular voice)
- AI-powered auto-categorization (SBERT embeddings)
- Duplicate/similar-complaint clustering (pgvector cosine similarity)
- Government admin review and status workflow
- Academic opportunity board for institutions/students
- Industry & CSR partnership marketplace
- Solution submission and verification flow
- Closed-loop status notifications back to citizens
- Analytics dashboard for impact tracking

## 5. Technology Stack
- **Frontend:** Next.js (React), Tailwind CSS
- **Backend:** Next.js API routes (Node.js), custom JWT auth
- **AI/ML Microservice:** Python, FastAPI, Sentence-BERT (`all-MiniLM-L6-v2`)
- **Database:** PostgreSQL with `pgvector` extension (hosted on Supabase)
- **External APIs:** Bhashini (vernacular translation), Mappls (maps/geo-tagging)
- **Deployment:** Vercel (frontend/API), Supabase (database)

## 6. Architecture
Citizen reports flow through AI triage, government review, and academic/industry
partnerships, with status tracked back to the citizen at every stage.
See [`docs/architecture.md`](docs/architecture.md) for the full pipeline diagram and
module-to-folder mapping.

```
CITIZEN
  |
  |  (text / photo / geo-tag / vernacular voice)
  v
CITIZEN INTAKE (PWA)
  v
AI TRIAGE MICROSERVICE (FastAPI)
  - Bhashini: vernacular -> English
  - SBERT embeddings + auto-categorization
  - pgvector similarity: duplicate detection
  v
POSTGRESQL (Supabase + pgvector)
  v
GOVERNMENT ADMIN DASHBOARD
  |
  +---------------------+
  |                      |
  v                      v
ACADEMIC OPPORTUNITIES   INDUSTRY / CSR MARKETPLACE
  |                      |
  +----------+-----------+
             v
   TEAM CLAIMS & SUBMITS SOLUTION
             v
   GOVERNMENT VERIFICATION
             v
   STATUS UPDATE + NOTIFICATION
             v
   BACK TO CITIZEN (closed loop)
             v
   ANALYTICS DASHBOARD
```

## 7. Repository Structure
```
जड़Tak/
├── README.md
├── SUBMISSION_GUIDE.md
├── submission/
│   ├── PRESENTATION.md
│   └── DEMO.md
├── frontend/          # Next.js app (citizen, admin, academic, industry modules)
├── apps/
│   └── citizen-web-pwa/   # Citizen-facing intake PWA
├── ml/                 # FastAPI AI triage microservice
├── db/                 # Schema and migrations
├── docs/
│   └── architecture.md
├── assets/
│   └── screenshots/
├── .env.example
└── .gitignore
```

## 8. Team
| Name | Role |
|---|---|
| Vansh Dua | AI Triage & NLP (FastAPI, Bhashini, SBERT) |
| Ayaan Nath | AI Triage & DBMS Bridge (pgvector, similarity search) |
| Avishi Khanna | Citizen Intake & Frontend (PWA — complaint form, geo-tag, voice input) |
| Aryan Kumar Singh | Government & Routing Backend (admin APIs, status workflow, claims/solutions) |
| Vedang Sahu | Academic & Industry Modules (opportunity board, CSR marketplace UI) |
| Akshat Kumar Singh | Auth, DevOps & Analytics (login/JWT, deployment, analytics dashboard) |

## 9. Final Presentation
The presentation provides an overview of project.
See [`submission/PRESENTATION.md`](submission/PRESENTATION.md) for the presentation.

## 10. Demo Video
The demo video walks through the functionality of each module working as a complete portal.
See [`submission/DEMO.md`](submission/DEMO.md) for the full walkthrough video.

## 11. Prototype Screenshots
The Screenshots provide an insight of each module working in the portal.
See [`assets/screenshots/`](assets/screenshots/) for key screens.

## 12. Installation
```bash
git clone https://github.com/aryanflux/jad-tak.git
cd jad-tak

# Frontend
cd frontend
npm install

# ML microservice
cd ../ml
pip install -r requirements.txt
```

Copy `.env.example` to `.env.local` (frontend) and fill in real values for
`DATABASE_URL`, `JWT_SECRET`, `NEXT_PUBLIC_MAPPLS_API_KEY`, Bhashini keys, etc.
Never commit the filled-in `.env.local`.

## 13. Run
```bash
# Frontend (from frontend/)
npm run dev

# ML microservice (from ml/)
uvicorn main:app --reload
```

## 14. Live Deployment
[https://jhar-samadhaan.vercel.app](https://jhar-samadhaan.vercel.app)

## 15. Future Scope
- Full Bhashini integration across all Indian languages supported by the platform
- SMS-based notifications for citizens without reliable internet access
- Offline-first PWA mode for low-connectivity areas
- WhatsApp Business API integration for even lower-friction intake
