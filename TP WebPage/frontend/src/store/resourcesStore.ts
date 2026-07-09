import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const RESOURCE_CATEGORIES = ['PDF Guides', 'Presentations', 'Video Recordings', 'External Links', 'Templates'] as const;

export interface Resource {
  id: string;
  title: string;
  category: string;
  batchId: string | 'All';
  uploadedBy: string;
  verified: boolean;
  uploadedAt: string;
  lastUpdated: string;
  version: string;
  downloadCount: number;
  fileSize: string;
}

let idCounter = 100;
function nextResourceId() {
  idCounter += 1;
  return `resource-${idCounter}`;
}

const INITIAL_RESOURCES: Resource[] = [
  { id: 'resource-1', title: 'React Router Guide.pdf', category: 'PDF Guides', batchId: 'All', uploadedBy: 'Junaid Mohammed', verified: true, uploadedAt: 'Jul 2, 2026', lastUpdated: 'Jul 2, 2026', version: 'v1.0', downloadCount: 34, fileSize: '1.8 MB' },
  { id: 'resource-2', title: 'Lecture: Node API.mp4', category: 'Video Recordings', batchId: 'All', uploadedBy: 'Mark Doe', verified: true, uploadedAt: 'Jul 3, 2026', lastUpdated: 'Jul 3, 2026', version: 'v1.0', downloadCount: 51, fileSize: '84.2 MB' },
  { id: 'resource-3', title: 'React Lifecycle Architecture.pdf', category: 'PDF Guides', batchId: 'All', uploadedBy: 'Junaid Mohammed', verified: true, uploadedAt: 'Jul 5, 2026', lastUpdated: 'Jul 6, 2026', version: 'v1.1', downloadCount: 27, fileSize: '2.4 MB' },
  { id: 'resource-4', title: 'Session Recording: Hooks.mp4', category: 'Video Recordings', batchId: 'aiml-btech', uploadedBy: 'Junaid Mohammed', verified: true, uploadedAt: 'Oct 1, 2026', lastUpdated: 'Oct 1, 2026', version: 'v1.0', downloadCount: 12, fileSize: '112.5 MB' }
];

function estimateFileSize(category: string): string {
  if (category === 'Video Recordings') return `${(40 + Math.random() * 90).toFixed(1)} MB`;
  if (category === 'External Links') return '—';
  return `${(0.4 + Math.random() * 4).toFixed(1)} MB`;
}

interface ResourcesState {
  resources: Resource[];
  addResource: (input: Omit<Resource, 'id' | 'verified' | 'downloadCount' | 'lastUpdated' | 'version' | 'fileSize'> & { version?: string }) => Resource;
  verifyResource: (id: string) => void;
  incrementDownloadCount: (id: string) => void;
  deleteResource: (id: string) => void;
}

export const useResourcesStore = create<ResourcesState>()(
  persist(
    (set) => ({
  resources: INITIAL_RESOURCES,
  addResource: (input) => {
    const resource: Resource = {
      id: nextResourceId(),
      verified: false,
      downloadCount: 0,
      lastUpdated: input.uploadedAt,
      version: input.version ?? 'v1.0',
      fileSize: estimateFileSize(input.category),
      ...input
    };
    set((state) => ({ resources: [resource, ...state.resources] }));
    return resource;
  },
  verifyResource: (id) =>
    set((state) => ({
      resources: state.resources.map((r) => (r.id === id ? { ...r, verified: true } : r))
    })),
  incrementDownloadCount: (id) =>
    set((state) => ({
      resources: state.resources.map((r) => (r.id === id ? { ...r, downloadCount: r.downloadCount + 1 } : r))
    })),
  deleteResource: (id) =>
    set((state) => ({
      resources: state.resources.filter((r) => r.id !== id)
    }))
    }),
    { name: 'tp-resources' }
  )
);
