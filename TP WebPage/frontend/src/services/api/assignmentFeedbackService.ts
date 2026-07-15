import type { AssignmentFeedbackForm, AssignmentFeedbackFormInput } from '../../types/assignmentFeedback';
import { api } from './apiClient';

export async function getAssignmentFeedbackForm(assignmentId: string): Promise<AssignmentFeedbackForm | null> {
  const res = await api.get<{ form: AssignmentFeedbackForm | null }>(`/assignments/${assignmentId}/feedback-form`);
  return res.form;
}

export async function attachAssignmentFeedbackForm(assignmentId: string, input: AssignmentFeedbackFormInput): Promise<AssignmentFeedbackForm> {
  const res = await api.post<{ form: AssignmentFeedbackForm }>(`/assignments/${assignmentId}/feedback-form`, input);
  return res.form;
}

export async function updateAssignmentFeedbackForm(
  assignmentId: string,
  input: Partial<AssignmentFeedbackFormInput>
): Promise<AssignmentFeedbackForm> {
  const res = await api.patch<{ form: AssignmentFeedbackForm }>(`/assignments/${assignmentId}/feedback-form`, input);
  return res.form;
}

export async function removeAssignmentFeedbackForm(assignmentId: string): Promise<void> {
  await api.delete(`/assignments/${assignmentId}/feedback-form`);
}

export async function submitAssignmentFeedback(assignmentId: string): Promise<void> {
  await api.post(`/assignments/${assignmentId}/feedback-form/submissions`);
}
