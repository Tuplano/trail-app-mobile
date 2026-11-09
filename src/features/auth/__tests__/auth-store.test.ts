import { useAuthStore } from '../auth-store';
import type { Session, User } from '../session-storage';

// An in-memory stand-in for the phone's keychain/keystore.
const mockKeychain = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  AFTER_FIRST_UNLOCK: 0,
  getItemAsync: jest.fn(async (key: string) => mockKeychain.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => {
    mockKeychain.set(key, value);
  }),
  deleteItemAsync: jest.fn(async (key: string) => {
    mockKeychain.delete(key);
  }),
}));

const user: User = {
  id: '0190a3c4-0000-7000-8000-000000000001',
  email: 'maya@example.com',
  username: 'maya',
  displayName: 'Maya Okafor',
  avatarUrl: null,
  createdAt: '2026-11-01T00:00:00.000Z',
};

const session: Session = {
  accessToken: 'access-1',
  accessTokenExpiresAt: '2026-11-08T00:15:00.000Z',
  refreshToken: 'refresh-1',
  refreshTokenExpiresAt: '2026-12-08T00:00:00.000Z',
};

const initialState = useAuthStore.getState();

/** Simulates closing and reopening the app: memory is wiped, the keychain is not. */
async function restartApp() {
  useAuthStore.setState(initialState, true);
  await useAuthStore.getState().hydrate();
}

beforeEach(() => {
  mockKeychain.clear();
  useAuthStore.setState(initialState, true);
});

describe('auth store', () => {
  it('starts signed out when nothing is saved', async () => {
    await restartApp();
    expect(useAuthStore.getState()).toMatchObject({ status: 'signedOut', session: null });
  });

  it('stays signed in after the app restarts', async () => {
    await useAuthStore.getState().signIn({ ...session, user });
    await restartApp();

    expect(useAuthStore.getState()).toMatchObject({ status: 'signedIn', session, user });
  });

  it('saves new tokens so the next launch uses them', async () => {
    await useAuthStore.getState().signIn({ ...session, user });
    await useAuthStore.getState().setTokens({ ...session, accessToken: 'access-2' });
    await restartApp();

    expect(useAuthStore.getState().session?.accessToken).toBe('access-2');
  });

  it('forgets everything on clear', async () => {
    await useAuthStore.getState().signIn({ ...session, user });
    await useAuthStore.getState().clear();
    await restartApp();

    expect(useAuthStore.getState().status).toBe('signedOut');
    expect(mockKeychain.size).toBe(0);
  });

  it('treats a corrupted saved value as signed out', async () => {
    mockKeychain.set('auth.session', '{not json');
    mockKeychain.set('auth.user', JSON.stringify(user));
    await restartApp();

    expect(useAuthStore.getState().status).toBe('signedOut');
  });
});
