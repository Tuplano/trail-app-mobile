import { canTransition, useRecorderStore } from './recorder-store';

const initialState = useRecorderStore.getState();

beforeEach(() => {
  useRecorderStore.setState(initialState, true);
});

describe('recorder store', () => {
  it('walks through a full hike', () => {
    const recorder = useRecorderStore.getState();
    recorder.start('hike-1');
    expect(useRecorderStore.getState()).toMatchObject({ status: 'recording', hikeId: 'hike-1' });

    recorder.pause();
    expect(useRecorderStore.getState().status).toBe('paused');

    recorder.resume();
    recorder.finish();
    expect(useRecorderStore.getState().status).toBe('finished');

    recorder.reset();
    expect(useRecorderStore.getState()).toMatchObject({ status: 'idle', hikeId: null });
  });

  it('rejects invalid transitions', () => {
    expect(() => useRecorderStore.getState().pause()).toThrow(/idle to paused/);
    expect(canTransition('finished', 'recording')).toBe(false);
  });
});
