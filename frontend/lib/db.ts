import { Pool } from 'pg';
import {
  initialCategories,
  initialUsers,
  initialComplaints,
  initialClaims,
  initialSolutions,
  initialPartnerships,
  initialUpvotes,
  type MockComplaint,
  type MockClaim,
  type MockSolution,
  type MockPartnership,
} from './mockData';

const globalForDb = globalThis as unknown as {
  pgPool?: Pool;
  mockDb?: {
    categories: typeof initialCategories;
    users: typeof initialUsers;
    complaints: MockComplaint[];
    claims: MockClaim[];
    solutions: MockSolution[];
    partnerships: MockPartnership[];
    upvotes: Array<{ complaint_id: number; user_id: number }>;
  };
};

function getMockDb() {
  if (!globalForDb.mockDb) {
    globalForDb.mockDb = {
      categories: [...initialCategories],
      users: [...initialUsers],
      complaints: [...initialComplaints],
      claims: [...initialClaims],
      solutions: [...initialSolutions],
      partnerships: [...initialPartnerships],
      upvotes: [...initialUpvotes],
    };
  }
  return globalForDb.mockDb;
}

function createMockPool(): Pool {
  const mock = {
    async query<T = unknown>(text: string, params: unknown[] = []): Promise<{ rows: T[]; rowCount: number }> {
      const q = text.toLowerCase().replace(/\s+/g, ' ').trim();
      const db = getMockDb();

      // 1. Users queries
      if (q.includes('from users')) {
        if (q.includes('where id =') || q.includes('where id=$')) {
          const id = Number(params[0]);
          const user = db.users.find((u) => u.id === id);
          const rows = user ? [user] : [];
          return { rows: rows as unknown as T[], rowCount: rows.length };
        }
        if (q.includes('where auth_user_id =') || q.includes('where auth_user_id=')) {
          const authId = String(params[0]);
          const user = db.users.find((u) => u.auth_user_id === authId) || db.users.find((u) => u.role === 'citizen');
          const rows = user ? [user] : [];
          return { rows: rows as unknown as T[], rowCount: rows.length };
        }
        return { rows: db.users as unknown as T[], rowCount: db.users.length };
      }

      // 2. Categories queries
      if (q.includes('from categories')) {
        if (q.includes('parent.code as parent_code')) {
          const rows = db.categories.map((c) => ({
            code: c.code,
            name: c.name,
            parent_code: c.parent_code ?? null,
            parent_name: c.parent_name ?? null,
          }));
          return { rows: rows as unknown as T[], rowCount: rows.length };
        }
        const rows = db.categories.map((c) => ({ code: c.code, name: c.name }));
        return { rows: rows as unknown as T[], rowCount: rows.length };
      }

      // 3. Upvotes queries
      if (q.includes('from complaint_upvotes')) {
        if (q.includes('where complaint_id =') || q.includes('where complaint_id=')) {
          const cid = Number(params[0]);
          const count = db.upvotes.filter((u) => u.complaint_id === cid).length;
          return { rows: [{ count: String(count), upvotes: count }] as unknown as T[], rowCount: 1 };
        }
      }
      if (q.includes('insert into complaint_upvotes')) {
        const cid = Number(params[0]);
        const uid = Number(params[1]);
        const exists = db.upvotes.some((u) => u.complaint_id === cid && u.user_id === uid);
        if (!exists) {
          db.upvotes.push({ complaint_id: cid, user_id: uid });
        }
        return { rows: [{ complaint_id: cid }] as unknown as T[], rowCount: exists ? 0 : 1 };
      }

      // 4. Problems list query (/api/problems)
      if (q.includes('count(cu.user_id)::int as upvotes') && q.includes('from complaints c join categories cat')) {
        const rows = db.complaints
          .filter((c) => c.status !== 'resolved')
          .map((c) => {
            const cat = db.categories.find((k) => k.id === c.category_id);
            const upvotes = db.upvotes.filter((u) => u.complaint_id === c.id).length;
            return {
              id: c.id,
              title: c.title,
              description: c.description,
              status: c.status,
              address: c.address,
              created_at: c.created_at,
              photo_url: c.images[0]?.url ?? null,
              category: cat?.name ?? 'General',
              upvotes,
            };
          })
          .sort((a, b) => b.upvotes - a.upvotes);
        return { rows: rows as unknown as T[], rowCount: rows.length };
      }

      // 5. Claims list query (/api/claims GET)
      if (q.includes('from complaints c join categories cat') && q.includes("c.status = 'under_review'")) {
        const adoptedIds = new Set(db.claims.map((cl) => cl.complaint_id));
        const rows = db.complaints
          .filter((c) => c.status === 'under_review' && !c.cluster_id && !adoptedIds.has(c.id))
          .map((c) => {
            const cat = db.categories.find((k) => k.id === c.category_id);
            const clusterMembers = db.complaints.filter((m) => m.cluster_id === c.id).length;
            return {
              id: c.id,
              title: c.title,
              description: c.description,
              category_code: cat?.code ?? 'OTH',
              category_label: cat?.name ?? 'Other',
              district: c.district,
              latitude: c.latitude,
              longitude: c.longitude,
              cluster_members: clusterMembers,
              created_at: c.created_at,
            };
          });
        return { rows: rows as unknown as T[], rowCount: rows.length };
      }

      // 6. Claims insert (/api/claims POST)
      if (q.includes('insert into claims')) {
        const newId = (db.claims.reduce((max, c) => Math.max(max, c.id), 0) || 0) + 1;
        const complaintId = Number(params[0]);
        const teamLeadId = Number(params[1]);
        const teamName = String(params[2]);
        const teamType = (params[3] || 'student') as 'student' | 'ngo' | 'institution';
        const instName = params[4] ? String(params[4]) : null;
        const proposal = String(params[5]);

        const claim: MockClaim = {
          id: newId,
          complaint_id: complaintId,
          team_lead_id: teamLeadId,
          team_name: teamName,
          team_type: teamType,
          institution_name: instName,
          proposal,
          approval_status: 'pending',
          created_at: new Date().toISOString(),
        };
        db.claims.push(claim);
        return {
          rows: [
            {
              id: claim.id,
              complaint_id: claim.complaint_id,
              approval_status: claim.approval_status,
              created_at: claim.created_at,
            },
          ] as unknown as T[],
          rowCount: 1,
        };
      }

      // 7. Solutions queries
      if (q.includes('from claims cl join complaints c') && q.includes('cl.team_lead_id = $1')) {
        const leadId = Number(params[0]);
        const claims = db.claims.filter((cl) => cl.team_lead_id === leadId && cl.approval_status === 'approved');
        const rows = claims.map((cl) => {
          const comp = db.complaints.find((c) => c.id === cl.complaint_id);
          return {
            claim_id: cl.id,
            complaint_id: cl.complaint_id,
            team_name: cl.team_name,
            complaint_title: comp?.title ?? 'Civic issue',
          };
        });
        return { rows: rows as unknown as T[], rowCount: rows.length };
      }

      if (q.includes('from solutions s') && q.includes('s.claim_id = any(')) {
        const claimIds = Array.isArray(params[0]) ? params[0] : [params[0]];
        const rows = db.solutions.filter((s) => claimIds.includes(s.claim_id));
        return { rows: rows as unknown as T[], rowCount: rows.length };
      }

      if (q.includes('insert into solutions')) {
        const newId = (db.solutions.reduce((max, s) => Math.max(max, s.id), 0) || 0) + 1;
        const claimId = Number(params[0]);
        const iter = Number(params[1]);
        const title = String(params[2]);
        const summary = String(params[3]);
        const tech = Array.isArray(params[4]) ? params[4] : [];
        const docs = typeof params[5] === 'string' ? JSON.parse(params[5]) : params[5] || [];
        const repo = typeof params[6] === 'string' ? params[6] : null;
        const proto = typeof params[7] === 'string' ? params[7] : null;

        const sol: MockSolution = {
          id: newId,
          claim_id: claimId,
          iteration: iter,
          title,
          summary,
          tech_stack: tech,
          documentation: docs,
          repository_url: repo,
          prototype_url: proto,
          status: 'submitted',
          review_comment: null,
          reviewed_by: null,
          reviewed_at: null,
          created_at: new Date().toISOString(),
        };
        db.solutions.push(sol);
        return {
          rows: [
            {
              id: sol.id,
              iteration: sol.iteration,
              status: sol.status,
              created_at: sol.created_at,
            },
          ] as unknown as T[],
          rowCount: 1,
        };
      }

      // 8. Admin complaints queue (/api/admin/complaints)
      if (q.includes('from complaints c join categories cat') && q.includes('c.images')) {
        const rows = db.complaints.map((c) => {
          const cat = db.categories.find((k) => k.id === c.category_id);
          const reporter = db.users.find((u) => u.id === c.user_id);
          const clusterMembers = db.complaints.filter((m) => m.cluster_id === c.id).length;
          return {
            id: c.id,
            title: c.title,
            description: c.description,
            status: c.status,
            latitude: c.latitude,
            longitude: c.longitude,
            district: c.district,
            address: c.address,
            images: c.images,
            cluster_id: c.cluster_id,
            cluster_score: c.cluster_score,
            created_at: c.created_at,
            updated_at: c.updated_at,
            is_anonymous: c.is_anonymous,
            category_code: cat?.code ?? 'OTH',
            category_label: cat?.name ?? 'Other',
            reporter_name: c.is_anonymous ? null : reporter?.full_name ?? null,
            reporter_email: c.is_anonymous ? null : reporter?.email ?? null,
            reporter_phone: c.is_anonymous ? null : reporter?.phone ?? null,
            cluster_members: clusterMembers,
            status_reason: c.status_reason ?? null,
          };
        });
        return { rows: rows as unknown as T[], rowCount: rows.length };
      }

      // Advance complaint status
      if (q.includes('update complaints set status = $1')) {
        const nextStatus = params[0] as MockComplaint['status'];
        const reason = (params[1] as string | undefined) ?? null;
        const id = Number(params[3] ?? params[params.length - 1]);
        const complaint = db.complaints.find((c) => c.id === id);
        if (complaint) {
          complaint.status = nextStatus;
          complaint.status_reason = reason;
          complaint.updated_at = new Date().toISOString();
        }
        return {
          rows: [
            {
              id,
              status: nextStatus,
              updated_at: complaint?.updated_at ?? new Date().toISOString(),
            },
          ] as unknown as T[],
          rowCount: 1,
        };
      }

      // 9. Admin solutions queue (/api/admin/solutions)
      if (q.includes('from solutions s join claims cl on cl.id = s.claim_id join complaints c')) {
        const rows = db.solutions.map((s) => {
          const cl = db.claims.find((c) => c.id === s.claim_id);
          const comp = db.complaints.find((c) => c.id === cl?.complaint_id);
          const lead = db.users.find((u) => u.id === cl?.team_lead_id);
          return {
            id: s.id,
            iteration: s.iteration,
            title: s.title,
            summary: s.summary,
            status: s.status,
            tech_stack: s.tech_stack,
            documentation: s.documentation,
            repository_url: s.repository_url,
            prototype_url: s.prototype_url,
            submitted_at: s.created_at,
            reviewed_at: s.reviewed_at,
            review_comment: s.review_comment,
            claim_id: cl?.id ?? 0,
            team_name: cl?.team_name ?? 'Team',
            team_type: cl?.team_type ?? 'student',
            institution_name: cl?.institution_name ?? null,
            team_lead_name: lead?.full_name ?? null,
            complaint_id: comp?.id ?? 0,
            complaint_title: comp?.title ?? 'Civic problem',
            complaint_status: comp?.status ?? 'under_review',
          };
        });
        return { rows: rows as unknown as T[], rowCount: rows.length };
      }

      // Review solution
      if (q.includes('update solutions set status = $1')) {
        const nextStatus = params[0] as MockSolution['status'];
        const comment = String(params[1]);
        const reviewedBy = Number(params[2]);
        const solId = Number(params[3]);
        const sol = db.solutions.find((s) => s.id === solId);
        if (sol) {
          sol.status = nextStatus;
          sol.review_comment = comment;
          sol.reviewed_by = reviewedBy;
          sol.reviewed_at = new Date().toISOString();
        }
        return {
          rows: [{ id: solId, status: nextStatus, reviewed_at: sol?.reviewed_at }] as unknown as T[],
          rowCount: 1,
        };
      }

      // 10. Industry marketplace (/api/industry/partnerships)
      if (q.includes('from solutions s join claims cl on cl.id = s.claim_id join complaints c') && q.includes("s.status = 'approved'")) {
        const approvedSolutions = db.solutions.filter((s) => s.status === 'approved');
        const rows = approvedSolutions.map((s) => {
          const cl = db.claims.find((c) => c.id === s.claim_id);
          const comp = db.complaints.find((c) => c.id === cl?.complaint_id);
          const cat = db.categories.find((k) => k.id === comp?.category_id);
          const lead = db.users.find((u) => u.id === cl?.team_lead_id);
          return {
            solution_id: s.id,
            iteration: s.iteration,
            title: s.title,
            summary: s.summary,
            tech_stack: s.tech_stack,
            repository_url: s.repository_url,
            prototype_url: s.prototype_url,
            submitted_at: s.created_at,
            claim_id: cl?.id ?? 0,
            team_name: cl?.team_name ?? 'Team',
            team_type: cl?.team_type ?? 'student',
            institution_name: cl?.institution_name ?? null,
            team_lead_name: lead?.full_name ?? null,
            complaint_id: comp?.id ?? 0,
            complaint_title: comp?.title ?? 'Civic problem',
            complaint_district: comp?.district ?? 'Ranchi',
            category_code: cat?.code ?? 'OTH',
            category_name: cat?.name ?? 'Other',
          };
        });
        return { rows: rows as unknown as T[], rowCount: rows.length };
      }

      if (q.includes('from partnerships p')) {
        const rows = db.partnerships;
        return { rows: rows as unknown as T[], rowCount: rows.length };
      }

      if (q.includes('insert into partnerships')) {
        const newId = (db.partnerships.reduce((max, p) => Math.max(max, p.id), 0) || 0) + 1;
        const solId = Number(params[0]);
        const partnerId = Number(params[1]);
        const pledgeType = params[2] as 'grant' | 'mentorship' | 'pilot';
        const amount = params[3] ? Number(params[3]) : null;
        const title = String(params[4]);
        const desc = String(params[5]);
        const email = String(params[6]);
        const phone = params[7] ? String(params[7]) : null;

        const part: MockPartnership = {
          id: newId,
          solution_id: solId,
          partner_id: partnerId,
          pledge_type: pledgeType,
          amount_inr: amount,
          title,
          description: desc,
          contact_email: email,
          contact_phone: phone,
          status: 'active',
          created_at: new Date().toISOString(),
        };
        db.partnerships.push(part);
        return {
          rows: [
            {
              id: part.id,
              pledge_type: part.pledge_type,
              amount_inr: part.amount_inr,
              status: part.status,
              created_at: part.created_at,
            },
          ] as unknown as T[],
          rowCount: 1,
        };
      }

      // 11. Complaints creation (/api/complaints POST)
      if (q.includes('insert into complaints')) {
        const newId = (db.complaints.reduce((max, c) => Math.max(max, c.id), 0) || 0) + 1;
        const userId = Number(params[0] || 17);
        const catId = Number(params[1] || 1);
        const title = String(params[2] || '');
        const desc = String(params[3] || '');
        const lat = params[4] ? Number(params[4]) : null;
        const lng = params[5] ? Number(params[5]) : null;
        const addr = params[6] ? String(params[6]) : null;
        const dist = params[7] ? String(params[7]) : 'Ranchi';

        const complaint: MockComplaint = {
          id: newId,
          user_id: userId,
          category_id: catId,
          title,
          description: desc,
          latitude: lat,
          longitude: lng,
          address: addr,
          district: dist,
          submission_mode: 'text',
          source_language: 'en',
          is_anonymous: false,
          status: 'submitted',
          cluster_id: null,
          cluster_score: null,
          images: [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        db.complaints.unshift(complaint);
        return { rows: [{ id: complaint.id }] as unknown as T[], rowCount: 1 };
      }

      // 12. Profile complaints
      if (q.includes('from complaints c inner join users u on u.id = c.user_id')) {
        const rows = db.complaints.map((c) => ({
          id: c.id,
          title: c.title,
          status: c.status,
          created_at: c.created_at,
        }));
        return { rows: rows as unknown as T[], rowCount: rows.length };
      }

      // 13. Admin Analytics Queries
      if (q.includes("nullif(btrim(district), '') as district, count(*)::int as complaints")) {
        const counts: Record<string, number> = {};
        db.complaints.forEach((c) => {
          if (c.district) counts[c.district] = (counts[c.district] || 0) + 1;
        });
        const rows = Object.entries(counts).map(([district, complaints]) => ({ district, complaints }));
        return { rows: rows as unknown as T[], rowCount: rows.length };
      }

      if (q.includes("count(*) filter (where status <> 'resolved')::int as open")) {
        const total = db.complaints.length;
        const open = db.complaints.filter((c) => c.status !== 'resolved').length;
        const resolved = db.complaints.filter((c) => c.status === 'resolved').length;
        const duplicates = db.complaints.filter((c) => c.cluster_id !== null).length;
        return { rows: [{ total, open, resolved, duplicates }] as unknown as T[], rowCount: 1 };
      }

      if (q.includes('group by status')) {
        const counts: Record<string, number> = {};
        db.complaints.forEach((c) => {
          counts[c.status] = (counts[c.status] || 0) + 1;
        });
        const rows = Object.entries(counts).map(([status, n]) => ({ status, n }));
        return { rows: rows as unknown as T[], rowCount: rows.length };
      }

      if (q.includes('avg(') && q.includes('resolved')) {
        return { rows: [{ avg_resolution_days: 12.4 }] as unknown as T[], rowCount: 1 };
      }

      if (q.includes('count(cl.id)::int as claims_total')) {
        const claims_total = db.claims.length;
        const claims_approved = db.claims.filter((c) => c.approval_status === 'approved').length;
        const solutions_total = db.solutions.length;
        const solutions_approved = db.solutions.filter((s) => s.status === 'approved').length;
        return { rows: [{ claims_total, claims_approved, solutions_total, solutions_approved }] as unknown as T[], rowCount: 1 };
      }

      if (q.includes('count(p.id)::int as pledges_total')) {
        const pledges_total = db.partnerships.length;
        const pledges_active = db.partnerships.filter((p) => p.status === 'active').length;
        const committed_inr = db.partnerships.reduce((sum, p) => sum + (p.amount_inr || 0), 0);
        const pledging_partners = new Set(db.partnerships.map((p) => p.partner_id)).size;
        return { rows: [{ pledges_total, pledges_active, committed_inr, pledging_partners }] as unknown as T[], rowCount: 1 };
      }

      if (q.includes('count(distinct cl.institution_name)::int as institutions_total')) {
        const count = new Set(db.claims.map((c) => c.institution_name).filter(Boolean)).size;
        return { rows: [{ institutions_total: count || 2 }] as unknown as T[], rowCount: 1 };
      }

      if (q.includes('c.category_id, cat.code, cat.name, count(c.id)::int as complaints')) {
        const rows = db.categories.filter((cat) => !cat.parent_id).map((cat) => {
          const comps = db.complaints.filter((c) => c.category_id === cat.id);
          const resolved = comps.filter((c) => c.status === 'resolved').length;
          const claims = db.claims.filter((cl) => {
            const comp = db.complaints.find((c) => c.id === cl.complaint_id);
            return comp?.category_id === cat.id;
          }).length;
          const solutionsApproved = db.solutions.filter((s) => {
            if (s.status !== 'approved') return false;
            const cl = db.claims.find((c) => c.id === s.claim_id);
            const comp = db.complaints.find((c) => c.id === cl?.complaint_id);
            return comp?.category_id === cat.id;
          }).length;
          return {
            category_id: cat.id,
            code: cat.code,
            name: cat.name,
            complaints: comps.length,
            resolved,
            claims,
            solutions_approved: solutionsApproved,
          };
        });
        return { rows: rows as unknown as T[], rowCount: rows.length };
      }

      if (q.includes('c.district, count(c.id)::int as complaints')) {
        const dists = ['Ranchi', 'Gumla', 'Bokaro', 'Latehar', 'Deoghar', 'Jamshedpur', 'Hazaribagh', 'Dhanbad'];
        const rows = dists.map((district) => {
          const comps = db.complaints.filter((c) => c.district === district);
          const resolved = comps.filter((c) => c.status === 'resolved').length;
          return {
            district,
            complaints: comps.length,
            open_complaints: comps.length - resolved,
            resolved,
            avg_resolution_days: 8.5,
          };
        });
        return { rows: rows as unknown as T[], rowCount: rows.length };
      }

      if (q.includes("count(*) filter (where created_at >= now() - interval '7 days')::int as b_0_7")) {
        return {
          rows: [
            {
              b_0_7: 2,
              b_8_30: 3,
              b_31_90: 2,
              b_91_plus: 1,
            },
          ] as unknown as T[],
          rowCount: 1,
        };
      }

      if (q.includes("date_trunc('month', created_at)")) {
        return {
          rows: [
            { ym: '2026-06', new_complaints: 4, resolved: 2 },
            { ym: '2026-07', new_complaints: 6, resolved: 3 },
            { ym: '2026-08', new_complaints: 5, resolved: 4 },
          ] as unknown as T[],
          rowCount: 3,
        };
      }

      if (q.includes("date_trunc('month', p.created_at)")) {
        return {
          rows: [
            { ym: '2026-07', pledged_inr: 250000 },
            { ym: '2026-08', pledged_inr: 250000 },
          ] as unknown as T[],
          rowCount: 2,
        };
      }

      if (q.includes('p.pledge_type, count(p.id)::int as count, sum(coalesce(p.amount_inr, 0))::bigint as amount')) {
        const rows = [
          { pledge_type: 'grant', count: 1, amount: 500000 },
          { pledge_type: 'pilot', count: 1, amount: 0 },
        ];
        return { rows: rows as unknown as T[], rowCount: rows.length };
      }

      if (q.includes('cl.institution_name, count(cl.id)::int as claims')) {
        const rows = [
          { name: 'Birla Institute of Technology, Mesra', claims: 1, solutions_approved: 1 },
          { name: 'IIT (ISM) Dhanbad', claims: 1, solutions_approved: 0 },
        ];
        return { rows: rows as unknown as T[], rowCount: rows.length };
      }

      if (q.includes('cl.team_type, count(cl.id)::int as n')) {
        const rows = [
          { team_type: 'student', n: 2 },
          { team_type: 'ngo', n: 0 },
        ];
        return { rows: rows as unknown as T[], rowCount: rows.length };
      }

      // Default fallback
      return { rows: [] as unknown as T[], rowCount: 0 };
    },
    async connect() {
      return {
        query: mock.query,
        release: () => {},
      };
    },
  };

  return mock as unknown as Pool;
}

export function getDbPool(): Pool {
  if (process.env.DATABASE_URL) {
    try {
      const existing = globalForDb.pgPool;
      if (existing) return existing;

      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        max: 10,
        idleTimeoutMillis: 30_000,
      });

      if (process.env.NODE_ENV !== 'production') globalForDb.pgPool = pool;
      return pool;
    } catch {
      console.warn('[AI Studio] PostgreSQL not connected — using mock database');
      return createMockPool();
    }
  }

  // In-memory fallback for development & preview
  return createMockPool();
}
