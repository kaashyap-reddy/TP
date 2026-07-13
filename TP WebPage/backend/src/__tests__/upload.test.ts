import { describe, expect, it, vi } from 'vitest';
import { fileFilter } from '../middleware/upload';

function fakeFile(originalname: string): Express.Multer.File {
  return { originalname } as Express.Multer.File;
}

describe('upload fileFilter', () => {
  it('rejects executable extensions', () => {
    const cb = vi.fn();
    fileFilter({} as never, fakeFile('virus.exe'), cb);
    expect(cb).toHaveBeenCalledWith(expect.any(Error));
    expect(cb.mock.calls[0][1]).toBeUndefined();
  });

  it('rejects shell scripts', () => {
    const cb = vi.fn();
    fileFilter({} as never, fakeFile('setup.sh'), cb);
    expect(cb).toHaveBeenCalledWith(expect.any(Error));
  });

  it('is case-insensitive about the extension', () => {
    const cb = vi.fn();
    fileFilter({} as never, fakeFile('PAYLOAD.EXE'), cb);
    expect(cb).toHaveBeenCalledWith(expect.any(Error));
  });

  it('is not fooled by a double extension disguising the real one', () => {
    // path.extname only looks at the last segment — "resume.pdf.exe" is still a .exe on disk.
    const cb = vi.fn();
    fileFilter({} as never, fakeFile('resume.pdf.exe'), cb);
    expect(cb).toHaveBeenCalledWith(expect.any(Error));
  });

  it('accepts an ordinary document', () => {
    const cb = vi.fn();
    fileFilter({} as never, fakeFile('assignment.pdf'), cb);
    expect(cb).toHaveBeenCalledWith(null, true);
  });

  it('accepts a zip archive', () => {
    const cb = vi.fn();
    fileFilter({} as never, fakeFile('project.zip'), cb);
    expect(cb).toHaveBeenCalledWith(null, true);
  });
});
