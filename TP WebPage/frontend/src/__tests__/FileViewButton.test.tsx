// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import FileViewButton from '../components/FileViewButton';

const apiDownload = vi.fn();
vi.mock('../services/api/apiClient', () => ({ apiDownload: (...a: unknown[]) => apiDownload(...a) }));

const clickSpy = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  URL.createObjectURL = vi.fn(() => 'blob:mock-url');
  URL.revokeObjectURL = vi.fn();
  // jsdom doesn't implement anchor.click()'s download behavior -- stub it so the
  // non-viewable-type test can assert a download was triggered without jsdom throwing.
  HTMLAnchorElement.prototype.click = clickSpy;
});

afterEach(() => cleanup());

describe('FileViewButton', () => {
  it('renders a disabled button when there is no file', () => {
    render(<FileViewButton url={null} />);
    expect(screen.getByRole('button', { name: 'No file uploaded' })).toBeDisabled();
  });

  it('opens an in-app preview modal for a viewable type instead of a new tab', async () => {
    const user = userEvent.setup();
    apiDownload.mockResolvedValueOnce(new Blob(['%PDF'], { type: 'application/pdf' }));
    render(<FileViewButton url="/assignments/1/attachment" fileName="brief.pdf" label="View Assignment File" />);

    await user.click(screen.getByRole('button', { name: 'View Assignment File' }));

    await waitFor(() => expect(screen.getByRole('dialog', { name: 'brief.pdf' })).toBeInTheDocument());
    expect(screen.getByTitle('brief.pdf').tagName).toBe('IFRAME');
    expect(screen.getByRole('link', { name: /Download brief.pdf/ })).toBeInTheDocument();
  });

  it('closes the preview modal without leaving it stuck open', async () => {
    const user = userEvent.setup();
    apiDownload.mockResolvedValueOnce(new Blob(['x'], { type: 'image/png' }));
    render(<FileViewButton url="/assignments/1/attachment" fileName="photo.png" />);

    await user.click(screen.getByRole('button', { name: 'View File' }));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('triggers a direct download for a non-viewable type, with no modal', async () => {
    const user = userEvent.setup();
    apiDownload.mockResolvedValueOnce(new Blob(['x'], { type: 'application/zip' }));
    render(<FileViewButton url="/assignments/1/attachment" fileName="archive.zip" />);

    await user.click(screen.getByRole('button', { name: 'View File' }));

    await waitFor(() => expect(clickSpy).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
