import type { SessionFeedbackForm, SessionFeedbackFormInput } from '../../types/sessionFeedback';
import { api } from './apiClient';

export async function getSessionFeedbackForm(sessionId: string): Promise<SessionFeedbackForm | null> {
  const res = await api.get<{ form: SessionFeedbackForm | null }>(`/sessions/${sessionId}/feedback-form`);
  return res.form;
}

export async function attachSessionFeedbackForm(sessionId: string, input: SessionFeedbackFormInput): Promise<SessionFeedbackForm> {
  const res = await api.post<{ form: SessionFeedbackForm }>(`/sessions/${sessionId}/feedback-form`, input);
  return res.form;
}

export async function updateSessionFeedbackForm(
  sessionId: string,
  input: Partial<SessionFeedbackFormInput>
): Promise<SessionFeedbackForm> {
  const res = await api.patch<{ form: SessionFeedbackForm }>(`/sessions/${sessionId}/feedback-form`, input);
  return res.form;
}

export async function removeSessionFeedbackForm(sessionId: string): Promise<void> {
  await api.delete(`/sessions/${sessionId}/feedback-form`);
}

export async function submitSessionFeedback(sessionId: string): Promise<void> {
  await api.post(`/sessions/${sessionId}/feedback-form/submissions`);
}
