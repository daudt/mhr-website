import { describe, it, expect } from 'vitest';
const { formatResultLine, safeUrl } = require('../lib/race-results');

describe('formatResultLine', () => {
  it('shows the email values when there is no official result', () => {
    expect(formatResultLine({ runner: 'Kummi Ka', placement: '2nd AG', division: null, time: '24:52' }))
      .toBe('Kummi Ka – 2nd AG – 24:52');
  });

  it('shows the official time and places with a link when verified', () => {
    const line = formatResultLine({
      runner: 'Lindsay K', placement: null, time: '3:00:09',
      official: { chip_time: '3:00:10', gun_time: '3:00:20', age_group: 'F35-39', age_group_place: '2',
        overall_place: '616', results_url: 'https://www.mychiptime.com/searchevent.php?id=17626' },
    });
    expect(line).toContain('Lindsay K – 3:00:10 · 2 F35-39 · 616 overall');
    expect(line).toContain('href="https://www.mychiptime.com/searchevent.php?id=17626"');
    expect(line).toContain('✓ official');
  });

  it('falls back to gun time and omits missing places', () => {
    expect(formatResultLine({ runner: 'Dale', official: { gun_time: '3:36:11' } })).toBe('Dale – 3:36:11');
  });

  it('escapes text and refuses non-http links', () => {
    const line = formatResultLine({
      runner: '<img src=x onerror=alert(1)>',
      official: { chip_time: '20:00', results_url: 'javascript:alert(1)' },
    });
    expect(line).not.toContain('<img');
    expect(line).not.toContain('href=');
  });
});

describe('safeUrl', () => {
  it('accepts http(s) only', () => {
    expect(safeUrl('https://example.com/a?b=1')).toBe('https://example.com/a?b=1');
    expect(safeUrl('javascript:alert(1)')).toBeNull();
    expect(safeUrl('not a url')).toBeNull();
  });
});
