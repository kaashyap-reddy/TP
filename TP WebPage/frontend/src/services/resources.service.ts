import type { Resource } from '../types/resource';
import { INITIAL_RESOURCES } from './mockData/resources.mock';

let idCounter = 100;
function nextResourceId() {
  idCounter += 1;
  return `resource-${idCounter}`;
}

function estimateFileSize(category: string): string {
  if (category === 'Video Recordings') return `${(40 + Math.random() * 90).toFixed(1)} MB`;
  if (category === 'External Links') return '—';
  return `${(0.4 + Math.random() * 4).toFixed(1)} MB`;
}

// TODO: replace with a real API call (GET /api/resources) once a backend exists.
export function getResources(): Resource[] {
  return INITIAL_RESOURCES;
}

// TODO: replace with a real API call (POST /api/resources) once a backend exists.
export function addResource(input: Omit<Resource, 'id' | 'verified' | 'downloadCount' | 'lastUpdated' | 'version' | 'fileSize'> & { version?: string }): Resource {
  return {
    id: nextResourceId(),
    verified: false,
    downloadCount: 0,
    lastUpdated: input.uploadedAt,
    version: input.version ?? 'v1.0',
    fileSize: estimateFileSize(input.category),
    ...input
  };
}

// TODO: replace with a real API call (PATCH /api/resources/:id/verify) once a backend exists.
export function verifyResource(resources: Resource[], id: string): Resource[] {
  return resources.map((r) => (r.id === id ? { ...r, verified: true } : r));
}

// TODO: replace with a real API call (POST /api/resources/:id/download) once a backend exists.
export function incrementDownloadCount(resources: Resource[], id: string): Resource[] {
  return resources.map((r) => (r.id === id ? { ...r, downloadCount: r.downloadCount + 1 } : r));
}

// TODO: replace with a real API call (DELETE /api/resources/:id) once a backend exists.
export function deleteResource(resources: Resource[], id: string): Resource[] {
  return resources.filter((r) => r.id !== id);
}
