import { ApiError, NETWORK_ERROR_MESSAGE } from '@/api/errors';

import { deleteBlocker, describeDeleteError, notUploadedWarning } from '../delete-account-rules';

describe('describeDeleteError', () => {
  it('puts password problems under the password', () => {
    expect(describeDeleteError(new ApiError('Wrong', 401, 'INVALID_CREDENTIALS'))).toEqual({
      field: 'Wrong password.',
      form: null,
    });
    expect(describeDeleteError(new ApiError('Missing', 400, 'VALIDATION_FAILED'))).toEqual({
      field: 'Enter your password.',
      form: null,
    });
  });

  it('says to wait after too many tries, and when there is no connection', () => {
    expect(describeDeleteError(new ApiError('Slow down', 429, 'TOO_MANY_REQUESTS')).form).toMatch(
      /Wait a minute/,
    );
    expect(describeDeleteError(new TypeError('Network request failed')).form).toBe(NETWORK_ERROR_MESSAGE);
  });
});

describe('notUploadedWarning', () => {
  it('is quiet when the server has everything', () => {
    expect(notUploadedWarning({ hikes: 0, posts: 0 })).toBeNull();
  });

  it('names what only this phone has, and suggests GPX for hikes', () => {
    expect(notUploadedWarning({ hikes: 1, posts: 0 })).toBe(
      "1 hike isn't uploaded yet and will be deleted from this phone too. Export hikes as GPX first if you want to keep them.",
    );
    expect(notUploadedWarning({ hikes: 2, posts: 1 })).toBe(
      "2 hikes and 1 post aren't uploaded yet and will be deleted from this phone too. Export hikes as GPX first if you want to keep them.",
    );
    expect(notUploadedWarning({ hikes: 0, posts: 3 })).toBe(
      "3 posts aren't uploaded yet and will be deleted from this phone too.",
    );
  });
});

describe('deleteBlocker', () => {
  it('waits for a hike in progress to be finished, and for signal', () => {
    expect(deleteBlocker({ recorder: 'recording', online: true })).toMatch(/hike in progress/);
    expect(deleteBlocker({ recorder: 'paused', online: true })).toMatch(/hike in progress/);
    expect(deleteBlocker({ recorder: 'idle', online: false })).toMatch(/needs signal/);
    expect(deleteBlocker({ recorder: 'finished', online: true })).toBeNull();
  });
});
