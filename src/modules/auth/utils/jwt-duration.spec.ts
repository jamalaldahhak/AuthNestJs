import { parseJwtDuration } from './jwt-duration.js';

describe('parseJwtDuration', () => {
  it('accepts numeric seconds and unit-based durations', () => {
    expect(parseJwtDuration('900')).toBe(900);
    expect(parseJwtDuration('15m')).toBe(900);
    expect(parseJwtDuration('7d')).toBe(604800);
  });

  it('rejects invalid and unsafe durations', () => {
    expect(() => parseJwtDuration('0')).toThrow();
    expect(() => parseJwtDuration('15 minutes')).toThrow();
    expect(() => parseJwtDuration('999999999999999999999d')).toThrow();
  });
});
