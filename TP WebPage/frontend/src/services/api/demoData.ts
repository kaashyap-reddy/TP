// Fixture data for Demo Mode (see demoMode.ts). Shaped exactly like the real backend's raw API
// responses (pre-frontend-mapping) so it can be returned from the same interception point
// regardless of which service/store consumes it — nothing downstream needs to know it's fake.
//
// Content mirrors the original frontend-only mock dataset (8 batches across BA/Data
// Engineering/AI ML/UI-UX, its assignments/sessions/feedback/resources) that existed before
// backend integration, so Demo Mode still shows the full breadth of the site rather than a
// trimmed-down slice.

interface PersonRef {
  id: string;
  name: string;
  email: string;
}

export interface DemoUser extends PersonRef {
  role: string;
  isActive: boolean;
  lastLoginAt: string;
  createdAt: string;
  profile: {
    phone: string;
    location: string;
    company: string | null;
    department: string | null;
    idNumber: string;
    avatarStorageKey: string | null;
    batch?: string;
    course?: string;
  };
}

export interface DemoBatch {
  id: string;
  code: string;
  name: string;
  program: string;
  track: string;
  status: string;
  startMonth: string | null;
  endDate: string | null;
  facilitator: PersonRef | null;
  members: string[];
  metrics: {
    traineeCount: number;
    avgScore: number | null;
    completionPct: number | null;
    attendanceRate: number | null;
    submissionRate: number | null;
    feedbackRating: number | null;
  };
}

export interface DemoSubmission {
  id: string;
  assignmentId: string;
  traineeId: string;
  status: string;
  submittedAt: string | null;
  grade: string | null;
  feedback: string | null;
  trainee: PersonRef;
}

export interface DemoAssignment {
  id: string;
  batchId: string;
  batches: { id: string; name: string; code: string }[];
  title: string;
  description: string;
  status: string;
  deadline: string;
  facilitator: PersonRef;
  submissions: DemoSubmission[];
}

export interface DemoSession {
  id: string;
  batchId: string;
  title: string;
  scheduledAt: string;
  platform: string;
  meetingLink: string | null;
  status: string;
  facilitator: PersonRef;
}

export interface DemoResource {
  id: string;
  batchId: string | null;
  title: string;
  category: string;
  version: string;
  sizeBytes: string;
  uploadedBy: string;
  verified: boolean;
  downloadCount: number;
  createdAt: string;
  updatedAt: string;
  uploader: PersonRef;
  batch: { id: string; name: string; code: string } | null;
}

export interface DemoFeedback {
  id: string;
  batchId: string;
  category: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  trainee: PersonRef;
  facilitator: PersonRef;
  direction?: 'FacilitatorToTrainee' | 'TraineeToFacilitator';
}

// ---- facilitators (one per original program POC) ----
const facilitatorJunaid = { id: 'demo-facilitator', name: 'Junaid Mohammed', email: 'facilitator@company.com' };
const facilitatorSrikar = { id: 'demo-facilitator-2', name: 'Srikar Kulkarni', email: 'srikar.kulkarni@company.com' };
const facilitatorDinesh = { id: 'demo-facilitator-3', name: 'Dinesh Paraman', email: 'dinesh.paraman@company.com' };
const facilitatorKaashyap = { id: 'demo-facilitator-4', name: 'Kaashyap Reddy', email: 'kaashyap.reddy@company.com' };

// ---- trainees already used elsewhere (AI/ML BTech roster, unchanged) ----
const traineeRefs = [
  { id: 'demo-trainee', name: 'Priya Sharma', email: 'trainee@company.com' },
  { id: 'demo-trainee-2', name: 'Rahul Verma', email: 'rahul.verma@company.com' },
  { id: 'demo-trainee-3', name: 'Ananya Iyer', email: 'ananya.iyer@company.com' }
];

// ---- additional trainees, restoring the rest of the original 8-batch roster ----
const t = {
  johnDoe: { id: 'demo-trainee-101', name: 'John Doe', email: 'john.doe@company.com' },
  bobWilliams: { id: 'demo-trainee-102', name: 'Bob Williams', email: 'bob.williams@company.com' },
  aliceSmith: { id: 'demo-trainee-103', name: 'Alice Smith', email: 'alice.smith@company.com' },
  vikramSingh: { id: 'demo-trainee-104', name: 'Vikram Singh', email: 'vikram.singh@company.com' },
  sarahConnor: { id: 'demo-trainee-105', name: 'Sarah Connor', email: 'sarah.connor@company.com' },
  nehaKapoor: { id: 'demo-trainee-106', name: 'Neha Kapoor', email: 'neha.kapoor@company.com' },
  arjunNair: { id: 'demo-trainee-107', name: 'Arjun Nair', email: 'arjun.nair@company.com' },
  meeraIyer: { id: 'demo-trainee-108', name: 'Meera Iyer', email: 'meera.iyer@company.com' },
  kunalMehta: { id: 'demo-trainee-109', name: 'Kunal Mehta', email: 'kunal.mehta@company.com' },
  snehaRao: { id: 'demo-trainee-110', name: 'Sneha Rao', email: 'sneha.rao@company.com' },
  adityaJoshi: { id: 'demo-trainee-111', name: 'Aditya Joshi', email: 'aditya.joshi@company.com' },
  divyaMenon: { id: 'demo-trainee-112', name: 'Divya Menon', email: 'divya.menon@company.com' },
  karanMalhotra: { id: 'demo-trainee-113', name: 'Karan Malhotra', email: 'karan.malhotra@company.com' },
  poojaReddy: { id: 'demo-trainee-114', name: 'Pooja Reddy', email: 'pooja.reddy@company.com' },
  rohitSinha: { id: 'demo-trainee-115', name: 'Rohit Sinha', email: 'rohit.sinha@company.com' },
  ishaBansal: { id: 'demo-trainee-116', name: 'Isha Bansal', email: 'isha.bansal@company.com' },
  varunChawla: { id: 'demo-trainee-117', name: 'Varun Chawla', email: 'varun.chawla@company.com' },
  nikhilRao: { id: 'demo-trainee-118', name: 'Nikhil Rao', email: 'nikhil.rao@company.com' },
  tanyaSethi: { id: 'demo-trainee-119', name: 'Tanya Sethi', email: 'tanya.sethi@company.com' },
  priyankaDas: { id: 'demo-trainee-120', name: 'Priyanka Das', email: 'priyanka.das@company.com' },
  rohanKulkarni: { id: 'demo-trainee-121', name: 'Rohan Kulkarni', email: 'rohan.kulkarni@company.com' }
};

function traineeUser(ref: PersonRef, idNumber: string): DemoUser {
  return {
    ...ref,
    role: 'trainee',
    isActive: true,
    lastLoginAt: new Date().toISOString(),
    createdAt: '2026-01-10T00:00:00.000Z',
    profile: { phone: '', location: '', company: null, department: null, idNumber, avatarStorageKey: null }
  };
}

function facilitatorUser(ref: PersonRef, department: string, idNumber: string): DemoUser {
  return {
    ...ref,
    role: 'facilitator',
    isActive: true,
    lastLoginAt: new Date().toISOString(),
    createdAt: '2026-01-05T00:00:00.000Z',
    profile: { phone: '', location: '', company: 'Company Inc.', department, idNumber, avatarStorageKey: null }
  };
}

export const DEMO_USERS: DemoUser[] = [
  { id: 'demo-admin', name: 'Alex Morgan', email: 'admin@company.com', role: 'admin', isActive: true, lastLoginAt: new Date().toISOString(), createdAt: '2026-01-05T00:00:00.000Z', profile: { phone: '', location: '', company: 'Company Inc.', department: 'Operations', idNumber: 'ADM-001', avatarStorageKey: null } },
  facilitatorUser(facilitatorJunaid, 'AI/ML', 'FAC-001'),
  facilitatorUser(facilitatorSrikar, 'Business Analysis', 'FAC-002'),
  facilitatorUser(facilitatorDinesh, 'Data Engineering', 'FAC-003'),
  facilitatorUser(facilitatorKaashyap, 'UI/UX', 'FAC-004'),
  { id: 'demo-trainee', name: 'Priya Sharma', email: 'trainee@company.com', role: 'trainee', isActive: true, lastLoginAt: new Date().toISOString(), createdAt: '2026-01-10T00:00:00.000Z', profile: { phone: '', location: '', company: null, department: null, idNumber: 'TR-014', avatarStorageKey: null, batch: 'AI/ML BTech', course: 'AI/ML' } },
  traineeUser(traineeRefs[1], 'TR-015'),
  traineeUser(traineeRefs[2], 'TR-016'),
  traineeUser(t.johnDoe, 'TR-101'),
  traineeUser(t.bobWilliams, 'TR-102'),
  traineeUser(t.aliceSmith, 'TR-103'),
  traineeUser(t.vikramSingh, 'TR-104'),
  traineeUser(t.sarahConnor, 'TR-105'),
  traineeUser(t.nehaKapoor, 'TR-106'),
  traineeUser(t.arjunNair, 'TR-107'),
  traineeUser(t.meeraIyer, 'TR-108'),
  traineeUser(t.kunalMehta, 'TR-109'),
  traineeUser(t.snehaRao, 'TR-110'),
  traineeUser(t.adityaJoshi, 'TR-111'),
  traineeUser(t.divyaMenon, 'TR-112'),
  traineeUser(t.karanMalhotra, 'TR-113'),
  traineeUser(t.poojaReddy, 'TR-114'),
  traineeUser(t.rohitSinha, 'TR-115'),
  traineeUser(t.ishaBansal, 'TR-116'),
  traineeUser(t.varunChawla, 'TR-117'),
  traineeUser(t.nikhilRao, 'TR-118'),
  traineeUser(t.tanyaSethi, 'TR-119'),
  traineeUser(t.priyankaDas, 'TR-120'),
  traineeUser(t.rohanKulkarni, 'TR-121')
];

export const DEMO_BATCHES: DemoBatch[] = [
  {
    id: 'demo-batch-aiml',
    code: 'aiml-btech-2026',
    name: 'AI/ML BTech 2026',
    program: 'AIML',
    track: 'BTech',
    status: 'Active',
    startMonth: '2026-01-01T00:00:00.000Z',
    endDate: '2026-03-01T00:00:00.000Z',
    facilitator: facilitatorJunaid,
    members: traineeRefs.map((tr) => tr.name),
    metrics: { traineeCount: 24, avgScore: 84.5, completionPct: 72, attendanceRate: 91, submissionRate: 88, feedbackRating: 4.4 }
  },
  {
    id: 'demo-batch-de',
    code: 'de-btech-2026',
    name: 'Data Engineering BTech 2026',
    program: 'DataEngineering',
    track: 'BTech',
    status: 'Active',
    startMonth: '2026-03-01T00:00:00.000Z',
    endDate: '2026-05-01T00:00:00.000Z',
    facilitator: facilitatorDinesh,
    members: ['Rahul Verma', 'Priya Sharma', t.kunalMehta.name, t.snehaRao.name, t.adityaJoshi.name, t.divyaMenon.name],
    metrics: { traineeCount: 26, avgScore: 87, completionPct: 91, attendanceRate: 94, submissionRate: 89, feedbackRating: 4.5 }
  },
  {
    id: 'demo-batch-ba-btech',
    code: 'ba-btech-2026',
    name: 'BA BTech',
    program: 'BA',
    track: 'BTech',
    status: 'Active',
    startMonth: '2026-03-01T00:00:00.000Z',
    endDate: '2026-05-01T00:00:00.000Z',
    facilitator: facilitatorSrikar,
    members: [t.johnDoe.name, 'Priya Sharma', t.bobWilliams.name, t.aliceSmith.name, t.vikramSingh.name],
    metrics: { traineeCount: 28, avgScore: 89, completionPct: 94, attendanceRate: 96, submissionRate: 92, feedbackRating: 4.7 }
  },
  {
    id: 'demo-batch-ba-mba',
    code: 'ba-mba-2026',
    name: 'BA MBA',
    program: 'BA',
    track: 'MBA',
    status: 'Active',
    startMonth: '2026-04-01T00:00:00.000Z',
    endDate: '2026-06-01T00:00:00.000Z',
    facilitator: facilitatorSrikar,
    members: [t.sarahConnor.name, 'Rahul Verma', t.nehaKapoor.name, t.arjunNair.name, t.meeraIyer.name],
    metrics: { traineeCount: 22, avgScore: 85, completionPct: 88, attendanceRate: 91, submissionRate: 85, feedbackRating: 4.3 }
  },
  {
    id: 'demo-batch-de-mba',
    code: 'de-mba-2026',
    name: 'Data Engineering MBA',
    program: 'DataEngineering',
    track: 'MBA',
    status: 'Active',
    startMonth: '2026-05-01T00:00:00.000Z',
    endDate: '2026-07-01T00:00:00.000Z',
    facilitator: facilitatorDinesh,
    members: [t.karanMalhotra.name, t.poojaReddy.name, t.rohitSinha.name, t.ishaBansal.name, t.varunChawla.name],
    metrics: { traineeCount: 20, avgScore: 83, completionPct: 86, attendanceRate: 88, submissionRate: 80, feedbackRating: 4.1 }
  },
  {
    id: 'demo-batch-aiml-mba',
    code: 'aiml-mba-2026',
    name: 'AI ML MBA',
    program: 'AIML',
    track: 'MBA',
    status: 'Upcoming',
    startMonth: '2026-06-01T00:00:00.000Z',
    endDate: '2026-08-01T00:00:00.000Z',
    facilitator: facilitatorJunaid,
    members: [t.nikhilRao.name, t.tanyaSethi.name, t.adityaJoshi.name, t.priyankaDas.name, t.rohanKulkarni.name],
    metrics: { traineeCount: 18, avgScore: null, completionPct: null, attendanceRate: null, submissionRate: null, feedbackRating: null }
  },
  {
    id: 'demo-batch-uiux-btech',
    code: 'uiux-btech-2026',
    name: 'UI/UX BTech',
    program: 'UIUX',
    track: 'BTech',
    status: 'Active',
    startMonth: '2026-04-01T00:00:00.000Z',
    endDate: '2026-06-01T00:00:00.000Z',
    facilitator: facilitatorKaashyap,
    members: [t.vikramSingh.name, 'Priya Sharma', t.aliceSmith.name, t.meeraIyer.name, t.snehaRao.name, t.adityaJoshi.name],
    metrics: { traineeCount: 25, avgScore: 88, completionPct: 90, attendanceRate: 93, submissionRate: 87, feedbackRating: 4.4 }
  },
  {
    id: 'demo-batch-uiux-mba',
    code: 'uiux-mba-2026',
    name: 'UI/UX MBA',
    program: 'UIUX',
    track: 'MBA',
    status: 'Active',
    startMonth: '2026-05-01T00:00:00.000Z',
    endDate: '2026-07-01T00:00:00.000Z',
    facilitator: facilitatorKaashyap,
    members: [t.poojaReddy.name, t.karanMalhotra.name, t.nikhilRao.name, t.ishaBansal.name, t.divyaMenon.name],
    metrics: { traineeCount: 21, avgScore: 84, completionPct: 87, attendanceRate: 90, submissionRate: 84, feedbackRating: 4.2 }
  }
];

function submission(id: string, trainee: PersonRef, status: string, grade: string | null, feedback: string | null, submittedAt: string | null): DemoSubmission {
  return { id, assignmentId: '', traineeId: trainee.id, status, submittedAt, grade, feedback, trainee };
}

// Resolves batch refs from the single DEMO_BATCHES source of truth above, so assignments never
// carry a second, independently-drifting copy of batch names/codes.
function batchRefs(...batchIds: string[]): { id: string; name: string; code: string }[] {
  return batchIds.map((id) => {
    const batch = DEMO_BATCHES.find((b) => b.id === id);
    if (!batch) throw new Error(`Unknown demo batch id: ${id}`);
    return { id: batch.id, name: batch.name, code: batch.code };
  });
}

export const DEMO_ASSIGNMENTS: DemoAssignment[] = [
  {
    id: 'demo-assignment-1',
    batchId: 'demo-batch-aiml',
    batches: batchRefs('demo-batch-aiml'),
    title: 'Linear Regression from Scratch',
    description: 'Implement gradient descent for a linear regression model without using a library, and compare against scikit-learn on the provided dataset.',
    status: 'Open',
    deadline: '2026-08-05T18:30:00.000Z',
    facilitator: facilitatorJunaid,
    submissions: [
      submission('demo-sub-1', traineeRefs[0], 'Completed', '92', 'Clean implementation, good write-up on convergence behavior.', '2026-07-20T10:00:00.000Z'),
      submission('demo-sub-2', traineeRefs[1], 'UnderReview', null, null, '2026-07-21T14:00:00.000Z'),
      submission('demo-sub-3', traineeRefs[2], 'NotStarted', null, null, null)
    ]
  },
  {
    id: 'demo-assignment-2',
    batchId: 'demo-batch-aiml',
    // Multi-batch example: Junaid teaches both AI/ML batches this evaluation report applies to.
    batches: batchRefs('demo-batch-aiml', 'demo-batch-aiml-mba'),
    title: 'Model Evaluation Report',
    description: 'Compare precision/recall/F1 across three classifiers on the churn dataset and recommend one for production.',
    status: 'Open',
    deadline: '2026-08-12T18:30:00.000Z',
    facilitator: facilitatorJunaid,
    submissions: [
      submission('demo-sub-4', traineeRefs[0], 'Completed', '88', 'Solid analysis; consider discussing class imbalance next time.', '2026-07-18T09:00:00.000Z'),
      submission('demo-sub-5', traineeRefs[1], 'Completed', '79', 'Meets requirements.', '2026-07-19T11:00:00.000Z'),
      submission('demo-sub-6', traineeRefs[2], 'Late', '65', 'Submitted after deadline; grading reflects the late policy.', '2026-07-22T23:00:00.000Z')
    ]
  },
  {
    id: 'demo-assignment-3',
    batchId: 'demo-batch-aiml',
    batches: batchRefs('demo-batch-aiml'),
    title: 'Capstone Proposal Draft',
    description: 'One-page proposal for your capstone project: problem statement, dataset, and evaluation plan.',
    status: 'Draft',
    deadline: '2026-09-01T18:30:00.000Z',
    facilitator: facilitatorJunaid,
    submissions: []
  },
  {
    id: 'demo-assignment-101',
    batchId: 'demo-batch-ba-btech',
    batches: batchRefs('demo-batch-ba-btech'),
    title: 'Requirements Analysis Report',
    description: 'Document the business requirements gathered from the mock stakeholder interviews.',
    status: 'Open',
    deadline: '2026-07-15T18:30:00.000Z',
    facilitator: facilitatorSrikar,
    submissions: [
      submission('demo-sub-101', t.johnDoe, 'Completed', '91', 'Thorough and well structured.', '2026-07-12T09:00:00.000Z'),
      submission('demo-sub-102', traineeRefs[0], 'UnderReview', null, null, '2026-07-14T09:00:00.000Z'),
      submission('demo-sub-103', t.bobWilliams, 'NotStarted', null, null, null),
      submission('demo-sub-104', t.aliceSmith, 'Completed', '88', 'Good use of stakeholder mapping.', '2026-07-13T09:00:00.000Z'),
      submission('demo-sub-105', t.vikramSingh, 'NotStarted', null, null, null)
    ]
  },
  {
    id: 'demo-assignment-102',
    batchId: 'demo-batch-ba-mba',
    // Multi-batch example: Srikar teaches both BA batches this stakeholder deck applies to.
    batches: batchRefs('demo-batch-ba-mba', 'demo-batch-ba-btech'),
    title: 'Stakeholder Presentation Deck',
    description: 'Prepare a slide deck summarizing findings for the mock stakeholder review.',
    status: 'Open',
    deadline: '2026-07-10T18:30:00.000Z',
    facilitator: facilitatorSrikar,
    submissions: [
      submission('demo-sub-106', t.sarahConnor, 'Completed', '95', 'Excellent storytelling and structure.', '2026-07-09T09:00:00.000Z'),
      submission('demo-sub-107', traineeRefs[1], 'Completed', '90', 'Clear and concise.', '2026-07-10T09:00:00.000Z'),
      submission('demo-sub-108', t.nehaKapoor, 'UnderReview', null, null, '2026-07-10T09:00:00.000Z'),
      submission('demo-sub-109', t.arjunNair, 'NotStarted', null, null, null),
      submission('demo-sub-110', t.meeraIyer, 'NotStarted', null, null, null)
    ]
  },
  {
    id: 'demo-assignment-103',
    batchId: 'demo-batch-de',
    batches: batchRefs('demo-batch-de'),
    title: 'ETL Pipeline Design',
    description: 'Design an ETL pipeline for the sample retail dataset.',
    status: 'Open',
    deadline: '2026-07-12T18:30:00.000Z',
    facilitator: facilitatorDinesh,
    submissions: [
      submission('demo-sub-111', traineeRefs[1], 'Completed', '94', 'Solid pipeline design, good error handling.', '2026-07-11T09:00:00.000Z'),
      submission('demo-sub-112', t.kunalMehta, 'UnderReview', null, null, '2026-07-12T09:00:00.000Z'),
      submission('demo-sub-113', t.snehaRao, 'UnderReview', null, null, '2026-07-12T09:00:00.000Z'),
      submission('demo-sub-114', t.adityaJoshi, 'NotStarted', null, null, null),
      submission('demo-sub-115', t.divyaMenon, 'Late', null, null, '2026-07-13T09:00:00.000Z')
    ]
  },
  {
    id: 'demo-assignment-104',
    batchId: 'demo-batch-de-mba',
    batches: batchRefs('demo-batch-de-mba'),
    title: 'Data Warehouse Schema Project',
    description: 'Model a star schema for the sample sales data warehouse.',
    status: 'Open',
    deadline: '2026-07-16T18:30:00.000Z',
    facilitator: facilitatorDinesh,
    submissions: [
      submission('demo-sub-116', t.karanMalhotra, 'NotStarted', null, null, null),
      submission('demo-sub-117', t.poojaReddy, 'NotStarted', null, null, null),
      submission('demo-sub-118', t.rohitSinha, 'UnderReview', null, null, '2026-07-15T09:00:00.000Z'),
      submission('demo-sub-119', t.ishaBansal, 'NotStarted', null, null, null),
      submission('demo-sub-120', t.varunChawla, 'NotStarted', null, null, null)
    ]
  },
  {
    id: 'demo-assignment-105',
    batchId: 'demo-batch-uiux-btech',
    batches: batchRefs('demo-batch-uiux-btech'),
    title: 'Wireframe & Prototype Review',
    description: 'Submit high-fidelity wireframes for the mock client project.',
    status: 'Open',
    deadline: '2026-07-13T18:30:00.000Z',
    facilitator: facilitatorKaashyap,
    submissions: [
      submission('demo-sub-121', t.vikramSingh, 'Completed', '93', 'Strong visual hierarchy.', '2026-07-12T09:00:00.000Z'),
      submission('demo-sub-122', t.aliceSmith, 'UnderReview', null, null, '2026-07-13T09:00:00.000Z'),
      submission('demo-sub-123', t.meeraIyer, 'NotStarted', null, null, null),
      submission('demo-sub-124', t.snehaRao, 'NotStarted', null, null, null),
      submission('demo-sub-125', t.adityaJoshi, 'Completed', '86', 'Good, but tighten up spacing consistency.', '2026-07-11T09:00:00.000Z')
    ]
  }
];

export const DEMO_SESSIONS: DemoSession[] = [
  {
    id: 'demo-session-1',
    batchId: 'demo-batch-aiml',
    title: 'Weekly Sync — Model Evaluation',
    scheduledAt: '2026-07-15T10:00:00.000Z',
    platform: 'GoogleMeet',
    meetingLink: 'https://meet.example.com/demo-session-1',
    status: 'Completed',
    facilitator: facilitatorJunaid
  },
  {
    id: 'demo-session-2',
    batchId: 'demo-batch-aiml',
    title: 'Capstone Kickoff',
    scheduledAt: '2026-07-20T15:00:00.000Z',
    platform: 'Zoom',
    meetingLink: 'https://zoom.example.com/demo-session-2',
    status: 'Upcoming',
    facilitator: facilitatorJunaid
  },
  {
    id: 'demo-session-101',
    batchId: 'demo-batch-ba-btech',
    title: 'BA Mock Assessment',
    scheduledAt: '2026-07-10T04:30:00.000Z',
    platform: 'GoogleMeet',
    meetingLink: 'https://meet.example.com/demo-session-101',
    status: 'Completed',
    facilitator: facilitatorSrikar
  },
  {
    id: 'demo-session-102',
    batchId: 'demo-batch-de',
    title: 'Data Pipeline Review',
    scheduledAt: '2026-07-11T08:30:00.000Z',
    platform: 'MicrosoftTeams',
    meetingLink: 'https://teams.example.com/demo-session-102',
    status: 'Completed',
    facilitator: facilitatorDinesh
  },
  {
    id: 'demo-session-103',
    batchId: 'demo-batch-aiml',
    title: 'ML Model Walkthrough',
    scheduledAt: '2026-07-09T05:30:00.000Z',
    platform: 'Zoom',
    meetingLink: 'https://zoom.example.com/demo-session-103',
    status: 'Completed',
    facilitator: facilitatorJunaid
  },
  {
    id: 'demo-session-104',
    batchId: 'demo-batch-uiux-btech',
    title: 'Design Critique Session',
    scheduledAt: '2026-07-03T09:30:00.000Z',
    platform: 'GoogleMeet',
    meetingLink: 'https://meet.example.com/demo-session-104',
    status: 'Completed',
    facilitator: facilitatorKaashyap
  },
  {
    id: 'demo-session-105',
    batchId: 'demo-batch-ba-mba',
    title: 'Weekly Sync Call',
    scheduledAt: '2026-10-08T08:30:00.000Z',
    platform: 'Zoom',
    meetingLink: 'https://zoom.example.com/demo-session-105',
    status: 'Upcoming',
    facilitator: facilitatorSrikar
  }
];

export const DEMO_RESOURCES: DemoResource[] = [
  {
    id: 'demo-resource-1',
    batchId: 'demo-batch-aiml',
    title: 'Gradient Descent Cheat Sheet',
    category: 'PDF Guides',
    version: 'v1.2',
    sizeBytes: '482304',
    uploadedBy: 'demo-facilitator',
    verified: true,
    downloadCount: 34,
    createdAt: '2026-07-02T09:00:00.000Z',
    updatedAt: '2026-07-02T09:00:00.000Z',
    uploader: facilitatorJunaid,
    batch: { id: 'demo-batch-aiml', name: 'AI/ML BTech 2026', code: 'aiml-btech-2026' }
  },
  {
    id: 'demo-resource-2',
    batchId: 'demo-batch-aiml',
    title: 'Week 3 Lecture Recording',
    category: 'Video Recordings',
    version: 'v1.0',
    sizeBytes: '95331532',
    uploadedBy: 'demo-facilitator',
    verified: false,
    downloadCount: 11,
    createdAt: '2026-07-10T09:00:00.000Z',
    updatedAt: '2026-07-10T09:00:00.000Z',
    uploader: facilitatorJunaid,
    batch: { id: 'demo-batch-aiml', name: 'AI/ML BTech 2026', code: 'aiml-btech-2026' }
  },
  {
    id: 'demo-resource-101',
    batchId: null,
    title: 'React Router Guide.pdf',
    category: 'PDF Guides',
    version: 'v1.0',
    sizeBytes: '1887437',
    uploadedBy: 'demo-facilitator',
    verified: true,
    downloadCount: 34,
    createdAt: '2026-07-02T09:00:00.000Z',
    updatedAt: '2026-07-02T09:00:00.000Z',
    uploader: facilitatorJunaid,
    batch: null
  },
  {
    id: 'demo-resource-102',
    batchId: null,
    title: 'Lecture: Node API.mp4',
    category: 'Video Recordings',
    version: 'v1.0',
    sizeBytes: '88296242',
    uploadedBy: 'demo-facilitator',
    verified: true,
    downloadCount: 51,
    createdAt: '2026-07-03T09:00:00.000Z',
    updatedAt: '2026-07-03T09:00:00.000Z',
    uploader: facilitatorJunaid,
    batch: null
  },
  {
    id: 'demo-resource-103',
    batchId: null,
    title: 'React Lifecycle Architecture.pdf',
    category: 'PDF Guides',
    version: 'v1.1',
    sizeBytes: '2517319',
    uploadedBy: 'demo-facilitator',
    verified: true,
    downloadCount: 27,
    createdAt: '2026-07-05T09:00:00.000Z',
    updatedAt: '2026-07-06T09:00:00.000Z',
    uploader: facilitatorJunaid,
    batch: null
  },
  {
    id: 'demo-resource-104',
    batchId: 'demo-batch-aiml',
    title: 'Session Recording: Hooks.mp4',
    category: 'Video Recordings',
    version: 'v1.0',
    sizeBytes: '117964800',
    uploadedBy: 'demo-facilitator',
    verified: true,
    downloadCount: 12,
    createdAt: '2026-10-01T09:00:00.000Z',
    updatedAt: '2026-10-01T09:00:00.000Z',
    uploader: facilitatorJunaid,
    batch: { id: 'demo-batch-aiml', name: 'AI/ML BTech 2026', code: 'aiml-btech-2026' }
  }
];

export const DEMO_FEEDBACK: DemoFeedback[] = [
  {
    id: 'demo-feedback-1',
    batchId: 'demo-batch-aiml',
    category: 'Trainer Feedback',
    rating: 5,
    comment: 'Really clear explanations and quick to help when stuck.',
    createdAt: '2026-07-05T00:00:00.000Z',
    trainee: traineeRefs[0],
    facilitator: facilitatorJunaid
  },
  {
    id: 'demo-feedback-2',
    batchId: 'demo-batch-aiml',
    category: 'Technical Skills',
    rating: 4,
    comment: 'Good progress on model debugging this week.',
    createdAt: '2026-07-12T00:00:00.000Z',
    trainee: traineeRefs[1],
    facilitator: facilitatorJunaid
  },
  {
    id: 'demo-feedback-101',
    batchId: 'demo-batch-ba-btech',
    category: 'BA',
    rating: 4.5,
    comment: null,
    createdAt: '2026-07-05T00:00:00.000Z',
    trainee: traineeRefs[0],
    facilitator: facilitatorSrikar
  },
  {
    id: 'demo-feedback-102',
    batchId: 'demo-batch-de',
    category: 'Data Engineering',
    rating: 4.8,
    comment: null,
    createdAt: '2026-07-04T00:00:00.000Z',
    trainee: traineeRefs[1],
    facilitator: facilitatorDinesh
  },
  {
    id: 'demo-feedback-103',
    batchId: 'demo-batch-aiml',
    category: 'AI ML',
    rating: 5,
    comment: null,
    createdAt: '2026-07-06T00:00:00.000Z',
    trainee: traineeRefs[2],
    facilitator: facilitatorJunaid
  },
  {
    id: 'demo-feedback-104',
    batchId: 'demo-batch-uiux-btech',
    category: 'UI/UX',
    rating: 4.6,
    comment: null,
    createdAt: '2026-07-03T00:00:00.000Z',
    trainee: t.vikramSingh,
    facilitator: facilitatorKaashyap
  },
  {
    id: 'demo-feedback-105',
    batchId: 'demo-batch-ba-mba',
    category: 'Communication',
    rating: 5,
    comment: 'Great presentation skills during the sprint review.',
    createdAt: '2026-10-01T00:00:00.000Z',
    trainee: t.sarahConnor,
    facilitator: facilitatorSrikar
  }
];
