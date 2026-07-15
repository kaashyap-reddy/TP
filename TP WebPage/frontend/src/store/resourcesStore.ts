import { create } from 'zustand';
import type { Resource } from '../types/resource';
import * as resourceService from '../services/api/resourceService';

export type { Resource } from '../types/resource';
export { RESOURCE_CATEGORIES } from '../constants/resources';

interface ResourcesState {
  resources: Resource[];
  isLoading: boolean;
  error: string | null;
  fetchResources: (filters?: { batchId?: string; category?: string; verified?: boolean }) => Promise<void>;
  addResource: (input: resourceService.CreateResourceInput) => Promise<Resource>;
  verifyResource: (id: string) => Promise<void>;
  downloadResource: (id: string) => Promise<void>;
  deleteResource: (id: string) => Promise<void>;
}

export const useResourcesStore = create<ResourcesState>()((set, get) => ({
  resources: [],
  isLoading: false,
  error: null,
  fetchResources: async (filters) => {
    set({ isLoading: true, error: null });
    try {
      const resources = await resourceService.listResources(filters);
      set({ resources, isLoading: false });
    } catch (err) {
      set({ isLoading: false, error: err instanceof Error ? err.message : 'Unable to load resources.' });
    }
  },
  addResource: async (input) => {
    const resource = await resourceService.createResource(input);
    set({ resources: [resource, ...get().resources] });
    return resource;
  },
  verifyResource: async (id) => {
    const updated = await resourceService.verifyResource(id);
    set({ resources: get().resources.map((r) => (r.id === id ? updated : r)) });
  },
  downloadResource: async (id) => {
    const resource = get().resources.find((r) => r.id === id);
    if (!resource) return;
    // A Training-Plan-sourced resource is a shared external link, not an uploaded file — open it
    // directly instead of routing through the blob-download endpoint (which would otherwise try
    // to fetch a cross-origin redirect target and hit CORS).
    if (resource.externalUrl) {
      window.open(resource.externalUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    await resourceService.downloadResource(id, resource.title);
    set({ resources: get().resources.map((r) => (r.id === id ? { ...r, downloadCount: r.downloadCount + 1 } : r)) });
  },
  deleteResource: async (id) => {
    await resourceService.deleteResource(id);
    set({ resources: get().resources.filter((r) => r.id !== id) });
  }
}));
