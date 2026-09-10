# Jhar Samadhan — SIH26043

A crowdsourcing-to-resolution ecosystem for the Government of Jharkhand: citizen intake,
AI triage, academic claims, industry partnerships, and closed-loop governance.

## 1. Project Information
- **Project Title:** Jhar Samadhan
- **PS ID:** SIH26043
- **PS Title:** Digital platform to crowdsource societal challenges and facilitate
  collaborative problem solving through university and industry partnerships
- **Category:** Software
- **Theme:** Smart Automation *(confirm exact theme label on the SIH portal)*

## 2. Problem Statement
Citizens face slow, opaque grievance-redressal systems (e.g. CPGRAMS/PG Portal) where
complaints are submitted but rarely tracked to resolution. Meanwhile, academic institutions,
NGOs, and industry/CSR programs have capacity to solve real local problems but no structured
way to discover them.

## 3. Proposed Solution
Jhar Samadhan lets citizens report problems through a low-friction intake form (text, photo,
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
See [`docs/architecture.md`](docs/architecture.md) for the full pipeline diagram and
module-to-folder mapping.

## 7. Repository Structure
```
jhar-samadhaan/
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
| [Add name] | AI Triage & NLP (FastAPI, Bhashini, SBERT) |
| [Add name] | AI Triage & DBMS Bridge (pgvector, similarity search) |
| [Add name] | Routing & pipeline (government/academic/industry modules) |
| [Add name] | [Role] |
| [Add name] | [Role] |
| [Add name] | [Role] |

## 9. Installation
```bash
git clone https://github.com/aryanflux/jhar-samadhaan.git
cd jhar-samadhaan

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

## 10. Run
```bash
# Frontend (from frontend/)
npm run dev

# ML microservice (from ml/)
uvicorn main:app --reload
```

## 11. Live Deployment
[https://jhar-samadhaan.vercel.app](https://jhar-samadhaan.vercel.app)

## 12. Final Output
See [`assets/screenshots/`](assets/screenshots/) for key screens, and
[`submission/DEMO.md`](submission/DEMO.md) for the full walkthrough video.

## 13. Future Scope
- Full Bhashini integration across all Indian languages supported by the platform
- SMS-based notifications for citizens without reliable internet access
- Offline-first PWA mode for low-connectivity areas
- WhatsApp Business API integration for even lower-friction intake
