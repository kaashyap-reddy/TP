import type { BatchFeedbackForm, BatchFeedbackFormInput } from '../../types/batchFeedback';
import { api } from './apiClient';

export async function listBatchFeedbackForms(batchId: string): Promise<BatchFeedbackForm[]> {
  const res = await api.get<{ forms: BatchFeedbackForm[] }>(`/batches/${batchId}/feedback-forms`);
  return res.forms;
}

export async function attachBatchFeedbackForm(batchId: string, input: BatchFeedbackFormInput): Promise<BatchFeedbackForm> {
  const res = await api.post<{ form: BatchFeedbackForm }>(`/batches/${batchId}/feedback-forms`, input);
  return res.form;
}

export async function updateBatchFeedbackForm(
  batchId: string,
  formId: string,
  input: Partial<BatchFeedbackFormInput>
): Promise<BatchFeedbackForm> {
  const res = await api.patch<{ form: BatchFeedbackForm }>(`/batches/${batchId}/feedback-forms/${formId}`, input);
  return res.form;
}

export async function removeBatchFeedbackForm(batchId: string, formId: string): Promise<void> {
  await api.delete(`/batches/${batchId}/feedback-forms/${formId}`);
}

export async function submitBatchFeedback(batchId: string, formId: string): Promise<void> {
  await api.post(`/batches/${batchId}/feedback-forms/${formId}/submissions`);
}
