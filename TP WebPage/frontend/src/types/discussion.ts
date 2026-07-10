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
