import { api } from '@/api/client';

import { APP_VERSION, updateRequiredBy, useAppUpdateStore } from '../app-update';

jest.mock('expo-secure-store', () => ({
  AFTER_FIRST_UNLOCK: 0,
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
  deleteItemAsync: jest.fn(async () => {}),
}));

const headers = (values: Record<string, string>) => new Headers(values);

describe('updateRequiredBy', () => {
  it('reads the oldest allowed version from a 426', () => {
    expect(updateRequiredBy({ status: 426, headers: headers({ 'X-Min-App-Version': '1.2.0' }) })).toEqual({
      minVersion: '1.2.0',
    });
    expect(updateRequiredBy({ status: 426, headers: headers({}) })).toEqual({ minVersion: null });
  });

  it('ignores every other answer', () => {
    for (const status of [200, 400, 401, 404, 500]) {
      expect(updateRequiredBy({ status, headers: headers({}) })).toBeUndefined();
    }
  });
});

describe('the API client', () => {
  const sent: Request[] = [];
  let answer: Response;

  beforeEach(() => {
    sent.length = 0;
    useAppUpdateStore.setState({ required: null, hidden: false });
    globalThis.fetch = jest.fn(async (request: Request) => {
      sent.push(request);
      return answer;
    }) as unknown as typeof fetch;
  });

  it("sends this build's version with every request", async () => {
    answer = new Response('{"status":"ok"}', { status: 200 });
    await api.GET('/api/v1/health');
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    expect(sent[0].headers.get('X-App-Version')).toBe(APP_VERSION);
    expect(useAppUpdateStore.getState().required).toBeNull();
  });

  it('shows the update page when the API says the version is too old', async () => {
    answer = new Response(
      JSON.stringify({ error: { code: 'APP_UPDATE_REQUIRED', message: 'Please update' } }),
      { status: 426, headers: { 'X-Min-App-Version': '9.0.0' } },
    );
    const { response } = await api.GET('/api/v1/health');
    expect(response.status).toBe(426);
    expect(useAppUpdateStore.getState()).toMatchObject({ required: { minVersion: '9.0.0' }, hidden: false });
  });

  it('can step past the page to finish a hike, until the API says it again', () => {
    useAppUpdateStore.getState().require('9.0.0');
    useAppUpdateStore.getState().hide();
    expect(useAppUpdateStore.getState().hidden).toBe(true);
    useAppUpdateStore.getState().require('9.0.0');
    expect(useAppUpdateStore.getState().hidden).toBe(false);
  });
});
