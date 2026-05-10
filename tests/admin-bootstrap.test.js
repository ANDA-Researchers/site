import { describe, it, expect } from 'vitest';
import { isFetchResolutionError, BASE, SUPABASE_URL, FUNCTIONS_URL } from '../workspace/admin.js';

describe('admin.js module bootstrap', () => {
  it('imports without throwing under jsdom', () => {
    // The fact that this file loaded means the module's top-level code ran.
    expect(true).toBe(true);
  });

  it('resolves BASE from <meta name="base-url">', () => {
    expect(BASE).toBe('/site');
  });

  it('builds FUNCTIONS_URL from SUPABASE_URL', () => {
    expect(FUNCTIONS_URL).toBe(SUPABASE_URL + '/functions/v1');
  });
});

describe('isFetchResolutionError', () => {
  it('matches the well-known fetch failure messages', () => {
    expect(isFetchResolutionError(new TypeError('Failed to fetch'))).toBe(true);
    expect(isFetchResolutionError({ message: 'NetworkError when attempting to fetch resource' })).toBe(true);
    expect(isFetchResolutionError({ message: 'ERR_NAME_NOT_RESOLVED' })).toBe(true);
    expect(isFetchResolutionError({ message: 'Load failed' })).toBe(true);
  });

  it('does not match generic errors', () => {
    expect(isFetchResolutionError(new Error('401 Unauthorized'))).toBe(false);
    expect(isFetchResolutionError({ message: 'invalid token' })).toBe(false);
    expect(isFetchResolutionError(null)).toBe(false);
    expect(isFetchResolutionError(undefined)).toBe(false);
  });
});
