import { ApiError } from '@/api/errors';

import { describeAuthError, validateSignIn, validateSignUp } from '../validation';

const validSignUp = {
  displayName: 'Maya Okafor',
  username: 'maya_o',
  email: 'maya@example.com',
  password: 'trail-mix-42',
};

describe('validateSignIn', () => {
  it('accepts a normal email and password', () => {
    expect(validateSignIn({ email: ' maya@example.com ', password: 'x' })).toEqual({});
  });

  it('flags a bad email and an empty password', () => {
    expect(validateSignIn({ email: 'maya', password: '' })).toEqual({
      email: 'Enter a valid email.',
      password: 'Enter your password.',
    });
  });
});

describe('validateSignUp', () => {
  it('accepts a valid form', () => {
    expect(validateSignUp(validSignUp)).toEqual({});
  });

  it.each([
    ['ma', 'Use 3 to 30 characters.'],
    ['maya o', 'Use only letters, numbers, and underscores.'],
    ['maya-o', 'Use only letters, numbers, and underscores.'],
  ])('rejects the username %p', (username, message) => {
    expect(validateSignUp({ ...validSignUp, username }).username).toBe(message);
  });

  it('needs a name and an 8+ character password', () => {
    expect(validateSignUp({ ...validSignUp, displayName: '  ', password: 'short' })).toEqual({
      displayName: 'Enter your name.',
      password: 'Use at least 8 characters.',
    });
  });
});

describe('describeAuthError', () => {
  it('returns nothing when there is no error', () => {
    expect(describeAuthError(null)).toEqual({ fields: {}, form: null });
  });

  it('puts "taken" conflicts under the matching field', () => {
    const error = new ApiError('This username is taken.', 409, 'USERNAME_TAKEN');
    expect(describeAuthError(error)).toEqual({
      fields: { username: 'This username is taken.' },
      form: null,
    });
  });

  it('uses per-field details from validation errors', () => {
    const error = new ApiError('Invalid request', 400, 'VALIDATION_FAILED', {
      password: 'Too small',
    });
    expect(describeAuthError(error).fields).toEqual({ password: 'Too small' });
  });

  it('shows other API errors at the top of the form', () => {
    const error = new ApiError('Wrong email or password.', 401, 'INVALID_CREDENTIALS');
    expect(describeAuthError(error)).toEqual({ fields: {}, form: 'Wrong email or password.' });
  });

  it('explains a missing connection', () => {
    const offline = new TypeError('Network request failed');
    expect(describeAuthError(offline).form).toMatch(/Check your connection/);
  });
});
