import { beforeEach, describe, expect, it, vi } from 'vitest';

const userProfileFindUnique = vi.fn();
const userProfileUpsert = vi.fn();
const userFindFirst = vi.fn();
const save = vi.fn();
const remove = vi.fn();
const imageSize = vi.fn();

vi.mock('../prisma/client', () => ({
  prisma: {
    userProfile: {
      findUnique: (...args: unknown[]) => userProfileFindUnique(...args),
      upsert: (...args: unknown[]) => userProfileUpsert(...args)
    },
    user: {
      findFirst: (...args: unknown[]) => userFindFirst(...args)
    }
  }
}));

vi.mock('../services/storage', () => ({
  getStorageProvider: () => ({ save, remove })
}));

vi.mock('image-size', () => ({
  imageSize: (...args: unknown[]) => imageSize(...args)
}));

function fakeFile(overrides: Partial<Express.Multer.File> = {}): Express.Multer.File {
  return { buffer: Buffer.from('fake'), mimetype: 'image/jpeg', size: 1000, originalname: 'photo.jpg', ...overrides } as Express.Multer.File;
}

const baseUser = {
  id: 'user-1',
  name: 'Alex Morgan',
  email: 'alex@company.com',
  isActive: true,
  lastLoginAt: null,
  createdAt: new Date(),
  role: { name: 'admin' },
  profile: { phone: null, location: null, company: null, department: null, idNumber: null, avatarStorageKey: 'avatars/new.jpg', avatarUpdatedAt: new Date() }
};

describe('users avatar service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    imageSize.mockReturnValue({ width: 512, height: 512 });
    save.mockResolvedValue('avatars/new.jpg');
    userProfileFindUnique.mockResolvedValue(null);
    userProfileUpsert.mockResolvedValue(undefined);
    userFindFirst.mockResolvedValue(baseUser);
  });

  it('rejects a non-JPG/PNG mime type without touching storage', async () => {
    const { uploadAvatar } = await import('../services/users.service');
    const err = await uploadAvatar('user-1', fakeFile({ mimetype: 'image/webp' })).catch((e) => e);
    expect(err.statusCode).toBe(400);
    expect(save).not.toHaveBeenCalled();
  });

  it('rejects an oversized image without touching storage', async () => {
    imageSize.mockReturnValue({ width: 5000, height: 5000 });
    const { uploadAvatar } = await import('../services/users.service');
    const err = await uploadAvatar('user-1', fakeFile()).catch((e) => e);
    expect(err.statusCode).toBe(400);
    expect(save).not.toHaveBeenCalled();
  });

  it('saves a valid avatar and upserts the profile', async () => {
    const { uploadAvatar } = await import('../services/users.service');
    await uploadAvatar('user-1', fakeFile());
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ mimetype: 'image/jpeg' }), 'avatars');
    expect(userProfileUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1' },
        update: expect.objectContaining({ avatarStorageKey: 'avatars/new.jpg', avatarMimeType: 'image/jpeg' })
      })
    );
  });

  it('removes the previous stored file when replacing an existing avatar', async () => {
    userProfileFindUnique.mockResolvedValue({ avatarStorageKey: 'avatars/old.jpg' });
    const { uploadAvatar } = await import('../services/users.service');
    await uploadAvatar('user-1', fakeFile());
    expect(remove).toHaveBeenCalledWith('avatars/old.jpg');
  });

  it('removeAvatar clears the profile fields and deletes the stored file', async () => {
    userProfileFindUnique.mockResolvedValue({ avatarStorageKey: 'avatars/old.jpg' });
    const { removeAvatar } = await import('../services/users.service');
    await removeAvatar('user-1');
    expect(remove).toHaveBeenCalledWith('avatars/old.jpg');
    expect(userProfileUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: { avatarStorageKey: null, avatarMimeType: null, avatarSizeBytes: null, avatarUpdatedAt: null } })
    );
  });

  it('removeAvatar is a no-op against storage when there is nothing to remove', async () => {
    userProfileFindUnique.mockResolvedValue(null);
    const { removeAvatar } = await import('../services/users.service');
    await removeAvatar('user-1');
    expect(remove).not.toHaveBeenCalled();
  });

  it('getAvatarForStreaming 404s when the user has no avatar', async () => {
    userProfileFindUnique.mockResolvedValue({ avatarStorageKey: null });
    const { getAvatarForStreaming } = await import('../services/users.service');
    const err = await getAvatarForStreaming('user-1').catch((e) => e);
    expect(err.statusCode).toBe(404);
  });

  it('getAvatarForStreaming returns the storage key and mime type when present', async () => {
    userProfileFindUnique.mockResolvedValue({ avatarStorageKey: 'avatars/new.jpg', avatarMimeType: 'image/png' });
    const { getAvatarForStreaming } = await import('../services/users.service');
    const result = await getAvatarForStreaming('user-1');
    expect(result).toEqual({ storageKey: 'avatars/new.jpg', mimeType: 'image/png' });
  });
});
