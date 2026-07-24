// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AdminBatchDetailPage from '../pages/admin/AdminBatchDetailPage';
import { useBatchesStore } from '../store/batchesStore';
import { useAuthStore } from '../store/authStore';
import type { Batch } from '../types/batch';

// The component's own useEffect calls the real fetchBatches() on mount, which awaits
// listBatches() and overwrites store state with whatever it resolves to -- an unconfigured
// vi.fn() resolves to undefined, clobbering `batches` mid-render, so this must resolve to the
// same fixture as the `batch` const below. Inlined (not referencing `batch`) because vi.mock
// factories run before later module-scope consts are initialized.
vi.mock('../services/api/batchService', () => ({
  listBatches: vi.fn().mockResolvedValue([
    {
      id: 'batch-1',
      code: 'ba-btech-jul',
      name: 'BA BTech - July 2026',
      program: 'BA',
      track: 'BTech',
      trainingPlanId: 'plan-1',
      trainingPlanName: 'BA BTech',
      poc: 'Junaid Mohammed',
      pocId: 'facilitator-1',
      traineeCount: 5,
      startMonth: 'July 2026',
      startDate: '2026-07-01T00:00:00.000Z',
      endDate: '2026-09-01T00:00:00.000Z',
      avgScore: 89,
      completion: 62,
      attendanceRate: 93,
      submissionRate: 80,
      feedbackRating: 4.5,
      status: 'Active',
      members: []
    }
  ]),
  updateBatch: vi.fn(),
  listBatchTraineeStats: vi.fn().mockResolvedValue([])
}));
vi.mock('../services/api/assignmentService', () => ({ listAssignments: vi.fn().mockResolvedValue([]) }));
vi.mock('../services/api/sessionService', () => ({ listSessions: vi.fn().mockResolvedValue([]) }));
vi.mock('../services/api/resourceService', () => ({ listResources: vi.fn().mockResolvedValue([]) }));
vi.mock('../services/announcements.service', () => ({ listAnnouncements: vi.fn().mockResolvedValue([]) }));
vi.mock('../components/admin/FacilitatorTeamDrawer', () => ({
  default: ({ open }: { open: boolean }) => (open ? <div data-testid="facilitator-team-drawer" /> : null)
}));
vi.mock('../components/admin/SessionFormModal', () => ({ default: () => null }));
vi.mock('../components/NotificationBell', () => ({ default: () => <div data-testid="notification-bell" /> }));
vi.mock('../components/ProfileDropdown', () => ({ default: () => <div data-testid="profile-dropdown" /> }));

afterEach(() => cleanup());

const batch: Batch = {
  id: 'batch-1',
  code: 'ba-btech-jul',
  name: 'BA BTech - July 2026',
  program: 'BA',
  track: 'BTech',
  trainingPlanId: 'plan-1',
  trainingPlanName: 'BA BTech',
  poc: 'Junaid Mohammed',
  pocId: 'facilitator-1',
  traineeCount: 5,
  startMonth: 'July 2026',
  startDate: '2026-07-01T00:00:00.000Z',
  endDate: '2026-09-01T00:00:00.000Z',
  avgScore: 89,
  completion: 62,
  attendanceRate: 93,
  submissionRate: 80,
  feedbackRating: 4.5,
  status: 'Active',
  members: []
};

beforeEach(() => {
  useBatchesStore.setState({ batches: [batch] });
  useAuthStore.setState({ id: 'admin-1', role: 'admin', hydrated: true });
});

function renderPage(batchId: string) {
  return render(
    <MemoryRouter initialEntries={[`/admin/batches/${batchId}`]}>
      <Routes>
        <Route path="/admin/batches/:batchId" element={<AdminBatchDetailPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('AdminBatchDetailPage', () => {
  it("renders the batch's name, code, and status once loaded", async () => {
    renderPage('batch-1');
    expect(await screen.findByRole('heading', { name: 'BA BTech - July 2026', level: 1 })).toBeInTheDocument();
    expect(screen.getByText('ba-btech-jul')).toBeInTheDocument();
  });

  it('shows a not-found message for an unknown batch id', async () => {
    renderPage('does-not-exist');
    expect(await screen.findByText('Batch not found.')).toBeInTheDocument();
  });

  it('opens the Edit Batch Info modal pre-filled with the current values', async () => {
    const user = userEvent.setup();
    renderPage('batch-1');
    await screen.findByRole('heading', { name: 'BA BTech - July 2026', level: 1 });

    await user.click(screen.getByRole('button', { name: 'Edit Batch Info' }));

    expect(screen.getByLabelText('Name')).toHaveValue('BA BTech - July 2026');
    expect(screen.getByLabelText('Code')).toHaveValue('ba-btech-jul');
  });

  it('opens the facilitator team drawer when "Manage Facilitators" is clicked', async () => {
    const user = userEvent.setup();
    renderPage('batch-1');
    await screen.findByRole('heading', { name: 'BA BTech - July 2026', level: 1 });

    expect(screen.queryByTestId('facilitator-team-drawer')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Manage Facilitators' }));
    await waitFor(() => expect(screen.getByTestId('facilitator-team-drawer')).toBeInTheDocument());
  });
});
