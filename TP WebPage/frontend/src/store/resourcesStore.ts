import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Resource } from '../types/resource';
import * as resourcesService from '../services/resources.service';

export type { Resource } from '../types/resource';
export { RESOURCE_CATEGORIES } from '../constants/resources';

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
      resources: resourcesService.getResources(),
      addResource: (input) => {
        const resource = resourcesService.addResource(input);
        set((state) => ({ resources: [resource, ...state.resources] }));
        return resource;
      },
      verifyResource: (id) => set((state) => ({ resources: resourcesService.verifyResource(state.resources, id) })),
      incrementDownloadCount: (id) => set((state) => ({ resources: resourcesService.incrementDownloadCount(state.resources, id) })),
      deleteResource: (id) => set((state) => ({ resources: resourcesService.deleteResource(state.resources, id) }))
    }),
    { name: 'tp-resources' }
  )
);
