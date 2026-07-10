import type { DiscussionRole, DiscussionThread } from '../types/discussion';
import { INITIAL_THREADS } from './mockData/discussions.mock';

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

// TODO: replace with a real API call (GET /api/discussions) once a backend exists.
export function getThreads(): DiscussionThread[] {
  return INITIAL_THREADS;
}

// TODO: replace with a real API call (POST /api/discussions) once a backend exists.
export function createThread(input: { title: string; batchId: string; author: string; role: DiscussionRole; message: string }): DiscussionThread {
  return {
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
}

// TODO: replace with a real API call (POST /api/discussions/:id/messages) once a backend exists.
export function addMessage(threads: DiscussionThread[], threadId: string, message: { author: string; role: DiscussionRole; text: string }): DiscussionThread[] {
  return threads.map((t) =>
    t.id === threadId ? { ...t, messages: [...t.messages, { id: nextMessageId(), ...message, at: 'Just now' }] } : t
  );
}

// TODO: replace with a real API call (DELETE /api/discussions/:id) once a backend exists.
export function deleteThread(threads: DiscussionThread[], threadId: string): DiscussionThread[] {
  return threads.filter((t) => t.id !== threadId);
}
