import type { DiscussionThread } from '../../types/discussion';

export const INITIAL_THREADS: DiscussionThread[] = [
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
