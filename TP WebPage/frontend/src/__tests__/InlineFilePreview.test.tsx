// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import InlineFilePreview from '../components/InlineFilePreview';

const apiDownload = vi.fn();
vi.mock('../services/api/apiClient', () => ({ apiDownload: (...a: unknown[]) => apiDownload(...a) }));

beforeEach(() => {
  vi.clearAllMocks();
  URL.createObjectURL = vi.fn(() => 'blob:mock-url');
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => cleanup());

describe('InlineFilePreview', () => {
  it('renders nothing when there is no url', () => {
    const { container } = render(<InlineFilePreview url={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders an iframe for a PDF', async () => {
    apiDownload.mockResolvedValueOnce(new Blob(['%PDF'], { type: 'application/pdf' }));
    render(<InlineFilePreview url="/submissions/1/attachments/1" fileName="report.pdf" />);
    await waitFor(() => expect(screen.getByTitle('report.pdf')).toBeInTheDocument());
    expect(screen.getByTitle('report.pdf').tagName).toBe('IFRAME');
  });

  it('renders an img for an image type', async () => {
    apiDownload.mockResolvedValueOnce(new Blob(['x'], { type: 'image/png' }));
    render(<InlineFilePreview url="/submissions/1/attachments/1" fileName="photo.png" />);
    await waitFor(() => expect(screen.getByAltText('photo.png')).toBeInTheDocument());
  });

  it('falls back to a download link for a non-viewable type', async () => {
    apiDownload.mockResolvedValueOnce(new Blob(['x'], { type: 'application/zip' }));
    render(<InlineFilePreview url="/submissions/1/attachments/1" fileName="archive.zip" />);
    await waitFor(() => expect(screen.getByText(/Preview isn't available/)).toBeInTheDocument());
    expect(screen.getByRole('link', { name: /Download archive.zip/ })).toBeInTheDocument();
  });

  it('shows an error message when the fetch fails', async () => {
    apiDownload.mockRejectedValueOnce(new Error('Not authorized'));
    render(<InlineFilePreview url="/submissions/1/attachments/1" />);
    await waitFor(() => expect(screen.getByText('Not authorized')).toBeInTheDocument());
  });
});
