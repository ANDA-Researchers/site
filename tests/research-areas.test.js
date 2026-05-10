import { describe, it, expect } from 'vitest';
import { parseResearchAreas } from '../workspace/editors/team.js';

describe('parseResearchAreas', () => {
  it('returns an array of trimmed values', () => {
    expect(parseResearchAreas('LiDAR, Vision, ML')).toEqual(['LiDAR', 'Vision', 'ML']);
  });

  it('drops empty entries', () => {
    expect(parseResearchAreas('a,, b,')).toEqual(['a', 'b']);
  });

  it('returns [] for empty/null input', () => {
    expect(parseResearchAreas('')).toEqual([]);
    expect(parseResearchAreas(null)).toEqual([]);
    expect(parseResearchAreas(undefined)).toEqual([]);
  });

  it('handles single value with no comma', () => {
    expect(parseResearchAreas('Just one')).toEqual(['Just one']);
  });
});
