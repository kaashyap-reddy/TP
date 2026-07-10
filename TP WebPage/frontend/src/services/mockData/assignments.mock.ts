import type { Assignment, Submission, SubmissionStatus } from '../../types/assignment';
import { INITIAL_BATCHES } from './batches.mock';

function seedSubmissions(batchId: string, pattern: Array<[SubmissionStatus, string, number | null, string]>): Submission[] {
  const members = INITIAL_BATCHES.find((b) => b.id === batchId)?.members ?? [];
  return members.map((traineeName, i) => {
    const [status, submittedOn, grade, feedback] = pattern[i] ?? ['Not Started', '-', null, ''];
    return { traineeName, status, submittedOn, grade, feedback };
  });
}

export const INITIAL_ASSIGNMENTS: Assignment[] = [
  {
    id: 'assign-1',
    title: 'Requirements Analysis Report',
    batchId: 'ba-btech',
    facilitator: 'Srikar Kulkarni',
    deadline: '15 Jul 2026',
    description: 'Document the business requirements gathered from the mock stakeholder interviews.',
    status: 'Open',
    submissions: seedSubmissions('ba-btech', [
      ['Completed', '12 Jul 2026', 91, 'Thorough and well structured.'],
      ['Under Review', '14 Jul 2026', null, ''],
      ['Not Started', '-', null, ''],
      ['Completed', '13 Jul 2026', 88, 'Good use of stakeholder mapping.'],
      ['Not Started', '-', null, '']
    ])
  },
  {
    id: 'assign-2',
    title: 'Stakeholder Presentation Deck',
    batchId: 'ba-mba',
    facilitator: 'Srikar Kulkarni',
    deadline: '10 Jul 2026',
    description: 'Prepare a slide deck summarizing findings for the mock stakeholder review.',
    status: 'Open',
    submissions: seedSubmissions('ba-mba', [
      ['Completed', '9 Jul 2026', 95, 'Excellent storytelling and structure.'],
      ['Completed', '10 Jul 2026', 90, 'Clear and concise.'],
      ['Under Review', '10 Jul 2026', null, ''],
      ['Not Started', '-', null, ''],
      ['Not Started', '-', null, '']
    ])
  },
  {
    id: 'assign-3',
    title: 'ETL Pipeline Design',
    batchId: 'de-btech',
    facilitator: 'Dinesh Paraman',
    deadline: '12 Jul 2026',
    description: 'Design an ETL pipeline for the sample retail dataset.',
    status: 'Open',
    submissions: seedSubmissions('de-btech', [
      ['Completed', '11 Jul 2026', 94, 'Solid pipeline design, good error handling.'],
      ['Under Review', '12 Jul 2026', null, ''],
      ['Under Review', '12 Jul 2026', null, ''],
      ['Not Started', '-', null, ''],
      ['Late', '13 Jul 2026', null, '']
    ])
  },
  {
    id: 'assign-4',
    title: 'Data Warehouse Schema Project',
    batchId: 'de-mba',
    facilitator: 'Dinesh Paraman',
    deadline: '16 Jul 2026',
    description: 'Model a star schema for the sample sales data warehouse.',
    status: 'Open',
    submissions: seedSubmissions('de-mba', [
      ['Not Started', '-', null, ''],
      ['Not Started', '-', null, ''],
      ['Under Review', '15 Jul 2026', null, ''],
      ['Not Started', '-', null, ''],
      ['Not Started', '-', null, '']
    ])
  },
  {
    id: 'assign-5',
    title: 'Machine Learning Model Baseline',
    batchId: 'aiml-btech',
    facilitator: 'Junaid Mohammed',
    deadline: '14 Jul 2026',
    description: 'Train and evaluate a baseline classification model.',
    status: 'Open',
    submissions: seedSubmissions('aiml-btech', [
      ['Completed', '13 Jul 2026', 90, 'Great baseline, consider cross-validation next.'],
      ['Completed', '14 Jul 2026', 92, 'Clean notebook and clear metrics.'],
      ['Under Review', '2 hours ago', null, ''],
      ['Not Started', '-', null, ''],
      ['Not Started', '-', null, '']
    ])
  },
  {
    id: 'assign-6',
    title: 'Wireframe & Prototype Review',
    batchId: 'uiux-btech',
    facilitator: 'Kaashyap Reddy',
    deadline: '13 Jul 2026',
    description: 'Submit high-fidelity wireframes for the mock client project.',
    status: 'Open',
    submissions: seedSubmissions('uiux-btech', [
      ['Completed', '12 Jul 2026', 93, 'Strong visual hierarchy.'],
      ['Under Review', '13 Jul 2026', null, ''],
      ['Not Started', '-', null, ''],
      ['Not Started', '-', null, ''],
      ['Completed', '11 Jul 2026', 86, 'Good, but tighten up spacing consistency.']
    ])
  },
  {
    id: 'assign-7',
    title: 'React API Integration',
    batchId: 'aiml-btech',
    facilitator: 'Junaid Mohammed',
    deadline: 'Oct 15, 2026',
    description: 'Integrate the mock REST API into the React front end built in class.',
    status: 'Open',
    submissions: seedSubmissions('aiml-btech', [
      ['Under Review', 'Today, 2:00 PM', null, "I struggled a bit with the useEffect cleanup, please review."],
      ['Completed', 'Yesterday', 92, ''],
      ['Not Started', '-', null, ''],
      ['Not Started', '-', null, ''],
      ['Not Started', '-', null, '']
    ])
  }
];
