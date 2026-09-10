/**
 * In-memory Mock Data & Query Handler for AI Studio
 * 
 * Provides live, stateful Jharkhand civic resolution data when DATABASE_URL
 * is not configured or PostgreSQL is offline.
 */

export interface MockCategory {
  id: number;
  code: string;
  name: string;
  description: string;
  parent_id: number | null;
  parent_code?: string | null;
  parent_name?: string | null;
  is_active: boolean;
}

export interface MockUser {
  id: number;
  auth_user_id: string;
  full_name: string;
  email: string;
  phone: string;
  role: 'citizen' | 'govt_admin' | 'institution' | 'student' | 'ngo' | 'csr';
  org_name: string | null;
  district: string;
  is_active: boolean;
}

export interface MockComplaint {
  id: number;
  user_id: number;
  category_id: number;
  title: string;
  description: string;
  latitude: number | null;
  longitude: number | null;
  address: string | null;
  district: string;
  submission_mode: string;
  source_language: string;
  is_anonymous: boolean;
  status: 'submitted' | 'under_review' | 'assigned' | 'in_progress' | 'resolved';
  status_reason?: string | null;
  cluster_id: number | null;
  cluster_score: number | null;
  images: Array<{ url: string; size?: number }>;
  created_at: string;
  updated_at: string;
}

export interface MockClaim {
  id: number;
  complaint_id: number;
  team_lead_id: number;
  team_name: string;
  team_type: 'student' | 'ngo' | 'institution';
  institution_name: string | null;
  proposal: string;
  approval_status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

export interface MockSolution {
  id: number;
  claim_id: number;
  iteration: number;
  title: string;
  summary: string;
  tech_stack: string[];
  documentation: Array<{ label: string | null; url: string }>;
  repository_url: string | null;
  prototype_url: string | null;
  status: 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected' | 'revision_requested';
  review_comment: string | null;
  reviewed_by: number | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface MockPartnership {
  id: number;
  solution_id: number;
  partner_id: number;
  pledge_type: 'grant' | 'mentorship' | 'pilot';
  amount_inr: number | null;
  title: string;
  description: string;
  contact_email: string;
  contact_phone: string | null;
  status: 'active' | 'completed' | 'withdrawn';
  created_at: string;
}

// Initial Taxonomy
export const initialCategories: MockCategory[] = [
  { id: 1, code: 'AGR', name: 'Agriculture & Farmer Welfare', description: 'Crops, irrigation, MSP, subsidy', parent_id: null, is_active: true },
  { id: 2, code: 'WAT', name: 'Water & Sanitation', description: 'Drinking water, borewells, drainage', parent_id: null, is_active: true },
  { id: 3, code: 'HLT', name: 'Health & Wellness', description: 'Hospitals, PHCs, vaccines, disease', parent_id: null, is_active: true },
  { id: 4, code: 'EDU', name: 'Education & Skill Development', description: 'Schools, Anganwadis, midday meals', parent_id: null, is_active: true },
  { id: 5, code: 'PWR', name: 'Power & Energy', description: 'Electricity supply, transformers, solar', parent_id: null, is_active: true },
  { id: 6, code: 'INF', name: 'Infrastructure & Roads', description: 'Roads, bridges, culverts, transport', parent_id: null, is_active: true },
  { id: 7, code: 'SWM', name: 'Waste Management', description: 'Garbage collection, dumping yards', parent_id: null, is_active: true },
  { id: 8, code: 'OTH', name: 'Other / Citizen Services', description: 'General civic services and support', parent_id: null, is_active: true },
  { id: 9, code: 'AGR_IRR', name: 'Irrigation & Water Access', description: 'Canals, borewells', parent_id: 1, parent_code: 'AGR', parent_name: 'Agriculture & Farmer Welfare', is_active: true },
  { id: 10, code: 'AGR_CROP', name: 'Crops, Seeds & Subsidies', description: 'Crop damage, seeds', parent_id: 1, parent_code: 'AGR', parent_name: 'Agriculture & Farmer Welfare', is_active: true },
  { id: 11, code: 'WAT_SUP', name: 'Drinking Water Supply', description: 'Pipelines, handpumps', parent_id: 2, parent_code: 'WAT', parent_name: 'Water & Sanitation', is_active: true },
  { id: 12, code: 'WAT_DRAIN', name: 'Drainage & Sewage', description: 'Blocked drains, flooding', parent_id: 2, parent_code: 'WAT', parent_name: 'Water & Sanitation', is_active: true },
  { id: 13, code: 'HLT_FAC', name: 'Health Facilities', description: 'Hospitals, PHCs and clinics', parent_id: 3, parent_code: 'HLT', parent_name: 'Health & Wellness', is_active: true },
  { id: 14, code: 'HLT_MED', name: 'Medicines & Emergency Care', description: 'Medicines, ambulances', parent_id: 3, parent_code: 'HLT', parent_name: 'Health & Wellness', is_active: true },
  { id: 15, code: 'EDU_SCH', name: 'Schools & Teachers', description: 'School buildings, teachers', parent_id: 4, parent_code: 'EDU', parent_name: 'Education & Skill Development', is_active: true },
  { id: 16, code: 'EDU_AID', name: 'Scholarships & Student Services', description: 'Scholarships, meals', parent_id: 4, parent_code: 'EDU', parent_name: 'Education & Skill Development', is_active: true },
  { id: 17, code: 'PWR_SUP', name: 'Electricity Supply', description: 'Outages, transformers', parent_id: 5, parent_code: 'PWR', parent_name: 'Power & Energy', is_active: true },
  { id: 18, code: 'PWR_LIGHT', name: 'Street Lighting', description: 'Streetlights, poles', parent_id: 5, parent_code: 'PWR', parent_name: 'Power & Energy', is_active: true },
  { id: 19, code: 'INF_ROAD', name: 'Roads & Potholes', description: 'Road repairs, potholes', parent_id: 6, parent_code: 'INF', parent_name: 'Infrastructure & Roads', is_active: true },
  { id: 20, code: 'INF_BRIDGE', name: 'Bridges & Public Works', description: 'Bridges, culverts', parent_id: 6, parent_code: 'INF', parent_name: 'Infrastructure & Roads', is_active: true },
  { id: 21, code: 'SWM_COLLECTION', name: 'Garbage Collection', description: 'Collection schedules, bins', parent_id: 7, parent_code: 'SWM', parent_name: 'Waste Management', is_active: true },
  { id: 22, code: 'SWM_DUMP', name: 'Dumping & Cleanliness', description: 'Illegal dumping', parent_id: 7, parent_code: 'SWM', parent_name: 'Waste Management', is_active: true },
  { id: 23, code: 'OTH_SERVICES', name: 'Other Citizen Services', description: 'General civic services', parent_id: 8, parent_code: 'OTH', parent_name: 'Other / Citizen Services', is_active: true },
];

export const initialUsers: MockUser[] = [
  { id: 1, auth_user_id: 'auth_admin_1', full_name: 'Aarti Sinha', email: 'aarti.sinha@jharkhand.gov.in', phone: '+91 94310 00001', role: 'govt_admin', org_name: 'Govt of Jharkhand', district: 'Ranchi', is_active: true },
  { id: 2, auth_user_id: 'auth_csr_2', full_name: 'Vikramaditya Roy', email: 'csr.lead@tatasteel.com', phone: '+91 94310 00002', role: 'csr', org_name: 'Tata Steel Foundation', district: 'Jamshedpur', is_active: true },
  { id: 3, auth_user_id: 'auth_startup_3', full_name: 'Shweta Kujur', email: 'founder@agrivistara.in', phone: '+91 94310 00003', role: 'ngo', org_name: 'AgriVistara Innovations', district: 'Ranchi', is_active: true },
  { id: 4, auth_user_id: 'auth_msme_4', full_name: 'Manoj Agarwal', email: 'director@chotanagpurengg.com', phone: '+91 94310 00004', role: 'csr', org_name: 'Chotanagpur Engineering Works', district: 'Bokaro', is_active: true },
  { id: 5, auth_user_id: 'auth_inst_5', full_name: 'Dr. Alok Verma', email: 'alok.verma@bitmesra.ac.in', phone: '+91 94310 00005', role: 'institution', org_name: 'BIT Mesra', district: 'Ranchi', is_active: true },
  { id: 6, auth_user_id: 'auth_student_6', full_name: 'Priya Murmu', email: 'priya.murmu@bitmesra.ac.in', phone: '+91 94310 00006', role: 'student', org_name: 'BIT Mesra Innovation Club', district: 'Ranchi', is_active: true },
  { id: 7, auth_user_id: 'auth_student_7', full_name: 'Rahul Oraon', email: 'rahul.oraon@iitism.ac.in', phone: '+91 94310 00007', role: 'student', org_name: 'IIT (ISM) Dhanbad EcoTech', district: 'Dhanbad', is_active: true },
  { id: 17, auth_user_id: 'auth_citizen_17', full_name: 'Sunita Soren', email: 'sunita.soren@example.com', phone: '+91 94310 00017', role: 'citizen', org_name: null, district: 'Ranchi', is_active: true },
];

export const initialComplaints: MockComplaint[] = [
  {
    id: 1,
    user_id: 17,
    category_id: 2, // WAT
    title: 'Borewell water turns brown after monsoon rains',
    description: 'The community borewell at the village square pumps brown, silt-laden water after every heavy rain. Children and elders have developed stomach issues this month.',
    latitude: 23.041,
    longitude: 84.539,
    address: 'Village square, Kamdara block',
    district: 'Gumla',
    submission_mode: 'text',
    source_language: 'en',
    is_anonymous: false,
    status: 'resolved',
    cluster_id: null,
    cluster_score: null,
    images: [],
    created_at: new Date(Date.now() - 148 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 100 * 86400000).toISOString(),
  },
  {
    id: 2,
    user_id: 17,
    category_id: 2, // WAT
    title: 'Borewell at ward 9 turns brown too — same waterline',
    description: 'Same muddy water issue reported from ward 9 which is on the same borewell waterline as the village square pump. Filtration unit is not maintained.',
    latitude: 23.0442,
    longitude: 84.5455,
    address: 'Ward 9, Kamdara block',
    district: 'Gumla',
    submission_mode: 'text',
    source_language: 'en',
    is_anonymous: false,
    status: 'in_progress',
    cluster_id: 1,
    cluster_score: 0.89,
    images: [],
    created_at: new Date(Date.now() - 139 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 60 * 86400000).toISOString(),
  },
  {
    id: 3,
    user_id: 17,
    category_id: 1, // AGR
    title: 'Paddy crop pest outbreak — farmers need guidance',
    description: 'Brown plant hopper infestation has spread across at least 40 acres of paddy. Farmers are spraying random pesticides because the extension officer visit is delayed.',
    latitude: 23.68,
    longitude: 86.152,
    address: 'Chas block',
    district: 'Bokaro',
    submission_mode: 'text',
    source_language: 'hi',
    is_anonymous: false,
    status: 'under_review',
    cluster_id: null,
    cluster_score: null,
    images: [],
    created_at: new Date(Date.now() - 45 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 40 * 86400000).toISOString(),
  },
  {
    id: 4,
    user_id: 17,
    category_id: 5, // PWR
    title: 'Transformer on village feeder trips daily after 6pm',
    description: 'Distribution transformer on the Harnam feeder trips 3-4 times a day after 6pm, cutting power to 200 households and the dairy cooperative.',
    latitude: 23.35,
    longitude: 85.29,
    address: 'Harnam feeder, Kanke',
    district: 'Ranchi',
    submission_mode: 'text',
    source_language: 'en',
    is_anonymous: false,
    status: 'under_review',
    cluster_id: null,
    cluster_score: null,
    images: [],
    created_at: new Date(Date.now() - 32 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 25 * 86400000).toISOString(),
  },
  {
    id: 5,
    user_id: 17,
    category_id: 4, // EDU
    title: 'Anganwadi ration stock missing after festival week',
    description: 'Take-home ration stock for July is missing from the Anganwadi godown after the festival week. Parents have not received the promised nutrition kits.',
    latitude: 24.48,
    longitude: 86.7,
    address: 'Jasidih block',
    district: 'Deoghar',
    submission_mode: 'text',
    source_language: 'hi',
    is_anonymous: false,
    status: 'under_review',
    cluster_id: null,
    cluster_score: null,
    images: [],
    created_at: new Date(Date.now() - 28 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 20 * 86400000).toISOString(),
  },
  {
    id: 6,
    user_id: 17,
    category_id: 6, // INF
    title: 'NH-33 stretch deep potholes near Kanke ring road',
    description: 'A 2 km stretch of NH-33 near the Ranchi ring road has deep potholes. Three complaints filed since May but no repair order has been issued.',
    latitude: 23.355,
    longitude: 85.31,
    address: 'NH-33, Kanke',
    district: 'Ranchi',
    submission_mode: 'text',
    source_language: 'en',
    is_anonymous: false,
    status: 'assigned',
    cluster_id: null,
    cluster_score: null,
    images: [],
    created_at: new Date(Date.now() - 20 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 10 * 86400000).toISOString(),
  },
  {
    id: 7,
    user_id: 17,
    category_id: 7, // SWM
    title: 'Garbage van skips lane every alternate week',
    description: 'The ward garbage van skips this lane on alternate weeks. Bins overflow near the school gate and stray animals scatter waste on the road.',
    latitude: 22.8,
    longitude: 86.2,
    address: 'Dimna Road, ward 12',
    district: 'Jamshedpur',
    submission_mode: 'text',
    source_language: 'en',
    is_anonymous: false,
    status: 'submitted',
    cluster_id: null,
    cluster_score: null,
    images: [],
    created_at: new Date(Date.now() - 12 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 12 * 86400000).toISOString(),
  },
  {
    id: 8,
    user_id: 17,
    category_id: 3, // HLT
    title: 'PHC solar refrigerator down, cold-chain vaccines at risk',
    description: 'The vaccine refrigerator at the primary health centre has been down for a week; cold chain temperature excursions detected for measles and polio stocks.',
    latitude: 23.745,
    longitude: 84.47,
    address: 'Chandwa referral clinic',
    district: 'Latehar',
    submission_mode: 'voice',
    source_language: 'en',
    is_anonymous: false,
    status: 'under_review',
    cluster_id: null,
    cluster_score: null,
    images: [],
    created_at: new Date(Date.now() - 15 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 8 * 86400000).toISOString(),
  },
];

export const initialClaims: MockClaim[] = [
  {
    id: 1,
    complaint_id: 1,
    team_lead_id: 6, // Priya Murmu (student)
    team_name: 'BIT Mesra AquaPure Innovations',
    team_type: 'student',
    institution_name: 'Birla Institute of Technology, Mesra',
    proposal: 'Deploying a low-cost bio-sand and activated carbon gravity filter column designed under NEP 2020 experiential learning rubric.',
    approval_status: 'approved',
    created_at: new Date(Date.now() - 90 * 86400000).toISOString(),
  },
  {
    id: 2,
    complaint_id: 6,
    team_lead_id: 7, // Rahul Oraon (student)
    team_name: 'IIT ISM RoadSurv AI',
    team_type: 'student',
    institution_name: 'IIT (ISM) Dhanbad',
    proposal: 'Computer vision pothole profiling using smartphone accelerometers and dashcam telemetry with automated PWD GIS ticketing.',
    approval_status: 'approved',
    created_at: new Date(Date.now() - 18 * 86400000).toISOString(),
  },
];

export const initialSolutions: MockSolution[] = [
  {
    id: 1,
    claim_id: 1,
    iteration: 1,
    title: 'Solar-Powered Automated Silt Filtration & Water Quality Monitoring Column',
    summary: 'A multi-layer gravity sand/carbon filter cartridge with IoT turbidity and TDS telemetry transmitting hourly telemetry to ward engineers via LoRaWAN.',
    tech_stack: ['Arduino ESP32', 'LoRaWAN', 'Activated Carbon', 'Next.js Dashboard'],
    documentation: [
      { label: 'Technical Whitepaper', url: 'https://github.com/jharsamadhaan/aquapure-spec' },
      { label: 'Field Test Data (Gumla)', url: 'https://aquapure.jharkhand.demo/field-results' },
    ],
    repository_url: 'https://github.com/jharsamadhaan/aquapure-hardware',
    prototype_url: 'https://aquapure-demo.jharkhand.gov.in',
    status: 'approved',
    review_comment: 'Excellent field testing and validation of turbidity reduction (< 5 NTU) under monsoon test runs. Approved for pilot deployment.',
    reviewed_by: 1,
    reviewed_at: new Date(Date.now() - 40 * 86400000).toISOString(),
    created_at: new Date(Date.now() - 50 * 86400000).toISOString(),
  },
  {
    id: 2,
    claim_id: 2,
    iteration: 1,
    title: 'RoadSurv Mobile Edge Detection & Automated PWD Escalation Pipeline',
    summary: 'Flutter mobile application using TensorFlow Lite on device to classify pavement roughness index and log coordinates directly into state maintenance queue.',
    tech_stack: ['TensorFlow Lite', 'Flutter', 'PostGIS', 'FastAPI'],
    documentation: [
      { label: 'Model Accuracy Benchmark', url: 'https://github.com/jharsamadhaan/roadsurv-benchmarks' },
    ],
    repository_url: 'https://github.com/jharsamadhaan/roadsurv-app',
    prototype_url: 'https://roadsurv-demo.jharkhand.gov.in',
    status: 'submitted',
    review_comment: null,
    reviewed_by: null,
    reviewed_at: null,
    created_at: new Date(Date.now() - 5 * 86400000).toISOString(),
  },
];

export const initialPartnerships: MockPartnership[] = [
  {
    id: 1,
    solution_id: 1,
    partner_id: 2, // Tata Steel Foundation (CSR)
    pledge_type: 'grant',
    amount_inr: 500000,
    title: 'CSR Seed Grant for 10 Village Borewell Filtration Units',
    description: 'Providing grant funding to manufacture and install 10 gravity filtration columns across Kamdara block, Gumla.',
    contact_email: 'csr.lead@tatasteel.com',
    contact_phone: '+91 94310 00002',
    status: 'active',
    created_at: new Date(Date.now() - 35 * 86400000).toISOString(),
  },
  {
    id: 2,
    solution_id: 1,
    partner_id: 4, // Chotanagpur Engineering Works
    pledge_type: 'pilot',
    amount_inr: null,
    title: 'Pilot Deployment Site & Sheet Metal Fabrication',
    description: 'Offering machine shop fabrication of stainless steel filter housings and pilot deployment in Bokaro industrial fringe.',
    contact_email: 'director@chotanagpurengg.com',
    contact_phone: '+91 94310 00004',
    status: 'active',
    created_at: new Date(Date.now() - 25 * 86400000).toISOString(),
  },
];

export const initialUpvotes: Array<{ complaint_id: number; user_id: number }> = [
  { complaint_id: 1, user_id: 17 },
  { complaint_id: 1, user_id: 6 },
  { complaint_id: 3, user_id: 17 },
  { complaint_id: 3, user_id: 5 },
  { complaint_id: 4, user_id: 17 },
  { complaint_id: 4, user_id: 6 },
  { complaint_id: 4, user_id: 7 },
  { complaint_id: 6, user_id: 17 },
];
