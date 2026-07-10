import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { DiscussionRole, DiscussionMessage, DiscussionThread } from '../types/discussion';
import * as discussionsService from '../services/discussions.service';

export type { DiscussionRole, DiscussionMessage, DiscussionThread } from '../types/discussion';

interface DiscussionsState {
  threads: DiscussionThread[];
  createThread: (input: { title: string; batchId: string; author: string; role: DiscussionRole; message: string }) => DiscussionThread;
  addMessage: (threadId: string, message: { author: string; role: DiscussionRole; text: string }) => void;
  deleteThread: (threadId: string) => void;
}

export const useDiscussionsStore = create<DiscussionsState>()(
  persist(
    (set) => ({
      threads: discussionsService.getThreads(),
      createThread: (input) => {
        const thread = discussionsService.createThread(input);
        set((state) => ({ threads: [thread, ...state.threads] }));
        return thread;
      },
      addMessage: (threadId, message) =>
        set((state) => ({ threads: discussionsService.addMessage(state.threads, threadId, message) })),
      deleteThread: (threadId) =>
        set((state) => ({ threads: discussionsService.deleteThread(state.threads, threadId) }))
    }),
    { name: 'tp-discussions' }
  )
);
