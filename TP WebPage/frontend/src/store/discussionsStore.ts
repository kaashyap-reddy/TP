import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type DiscussionRole = 'trainee' | 'facilitator' | 'admin';

export interface DiscussionMessage {
  id: string;
  author: string;
  role: DiscussionRole;
  text: string;
  at: string;
}

export interface DiscussionThread {
  id: string;
  title: string;
  batchId: string;
  author: string;
  role: DiscussionRole;
  createdAt: string;
  messages: DiscussionMessage[];
}

let threadIdCounter = 100;
function nextThreadId() {
  threadIdCounter += 1;
  return `thread-${threadIdCounter}`;
}

let messageIdCounter = 100;
function nextMessageId() {
  messageIdCounter += 1;
  return `msg-${messageIdCounter}`;
}

const INITIAL_THREADS: DiscussionThread[] = [
  {
    id: 'thread-1',
    title: 'Help with React useEffect',
    batchId: 'aiml-btech',
    author: 'John Doe',
    role: 'trainee',
    createdAt: '2 hours ago',
    messages: [
      {
        id: 'msg-1',
        author: 'John Doe',
        role: 'trainee',
        text: "Hi everyone, I'm trying to fetch data on component mount but it keeps looping infinitely. I'm using useEffect without a dependency array.",
        at: '10:30 AM'
      },
      {
        id: 'msg-2',
        author: 'Junaid Mohammed',
        role: 'facilitator',
        text: '@John You need to provide an empty dependency array [] as the second argument to useEffect if you only want it to run once on mount!',
        at: '10:45 AM'
      }
    ]
  },
  {
    id: 'thread-2',
    title: 'General Q&A - Webpack',
    batchId: 'aiml-btech',
    author: 'Junaid Mohammed',
    role: 'facilitator',
    createdAt: 'Yesterday',
    messages: [
      {
        id: 'msg-3',
        author: 'Junaid Mohammed',
        role: 'facilitator',
        text: 'Here is a thread to discuss any webpack configuration issues for the final project.',
        at: 'Yesterday'
      }
    ]
  }
];

interface DiscussionsState {
  threads: DiscussionThread[];
  createThread: (input: { title: string; batchId: string; author: string; role: DiscussionRole; message: string }) => DiscussionThread;
  addMessage: (threadId: string, message: { author: string; role: DiscussionRole; text: string }) => void;
  deleteThread: (threadId: string) => void;
}

export const useDiscussionsStore = create<DiscussionsState>()(
  persist(
    (set) => ({
      threads: INITIAL_THREADS,
      createThread: (input) => {
        const thread: DiscussionThread = {
          id: nextThreadId(),
          title: input.title,
          batchId: input.batchId,
          author: input.author,
          role: input.role,
          createdAt: 'Just now',
          messages: input.message.trim()
            ? [{ id: nextMessageId(), author: input.author, role: input.role, text: input.message.trim(), at: 'Just now' }]
            : []
        };
        set((state) => ({ threads: [thread, ...state.threads] }));
        return thread;
      },
      addMessage: (threadId, message) =>
        set((state) => ({
          threads: state.threads.map((t) =>
            t.id === threadId
              ? { ...t, messages: [...t.messages, { id: nextMessageId(), ...message, at: 'Just now' }] }
              : t
          )
        })),
      deleteThread: (threadId) =>
        set((state) => ({ threads: state.threads.filter((t) => t.id !== threadId) }))
    }),
    { name: 'tp-discussions' }
  )
);
