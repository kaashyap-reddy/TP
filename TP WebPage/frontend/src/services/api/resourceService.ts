import type { Resource } from '../../types/resource';
import { api, apiDownload } from './apiClient';

interface ApiResource {
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
  uploader: { id: string; name: string; email: string };
  batch: { id: string; name: string; code: string } | null;
}

interface PaginatedResponse<T> {
  data: T[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatFileSize(sizeBytes: string): string {
  const bytes = Number(sizeBytes);
  if (!bytes) return '—';
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

function toFrontendResource(apiResource: ApiResource): Resource {
  return {
    id: apiResource.id,
    title: apiResource.title,
    category: apiResource.category,
    batchId: apiResource.batchId ?? 'All',
    uploadedBy: apiResource.uploader?.name ?? '',
    verified: apiResource.verified,
    uploadedAt: formatDate(apiResource.createdAt),
    lastUpdated: formatDate(apiResource.updatedAt),
    version: apiResource.version,
    downloadCount: apiResource.downloadCount,
    fileSize: formatFileSize(apiResource.sizeBytes)
  };
}

export async function listResources(filters?: { batchId?: string; category?: string; verified?: boolean }): Promise<Resource[]> {
  const res = await api.get<PaginatedResponse<ApiResource>>('/resources', { ...filters, pageSize: 200 });
  return res.data.map(toFrontendResource);
}

export interface CreateResourceInput {
  title: string;
  category: string;
  batchId: string | 'All';
  file: File;
  version?: string;
}

export async function createResource(input: CreateResourceInput): Promise<Resource> {
  const formData = new FormData();
  formData.append('title', input.title);
  formData.append('category', input.category);
  if (input.batchId !== 'All') formData.append('batchId', input.batchId);
  if (input.version) formData.append('version', input.version);
  formData.append('file', input.file);

  const created = await api.post<{ resource: ApiResource }>('/resources', formData);
  return toFrontendResource(created.resource);
}

export async function verifyResource(id: string): Promise<Resource> {
  const updated = await api.patch<{ resource: ApiResource }>(`/resources/${id}`, { verified: true });
  return toFrontendResource(updated.resource);
}

export async function deleteResource(id: string): Promise<void> {
  await api.delete(`/resources/${id}`);
}

/** Downloads the file (which increments the server-side count) and saves it via the browser. */
export async function downloadResource(id: string, fileName: string): Promise<void> {
  const blob = await apiDownload(`/resources/${id}/download`);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
