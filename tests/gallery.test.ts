import { describe, it, expect } from 'vitest';
const { nextImageIndex, prevImageIndex, computeLoadMoreState } = require('../lib/gallery-utils');

describe('nextImageIndex', () => {
  it('advances to next image', () => {
    expect(nextImageIndex(0, 10)).toBe(1);
    expect(nextImageIndex(5, 10)).toBe(6);
  });

  it('wraps around at the end', () => {
    expect(nextImageIndex(9, 10)).toBe(0);
  });

  it('handles single image', () => {
    expect(nextImageIndex(0, 1)).toBe(0);
  });
});

describe('prevImageIndex', () => {
  it('goes to previous image', () => {
    expect(prevImageIndex(5, 10)).toBe(4);
    expect(prevImageIndex(1, 10)).toBe(0);
  });

  it('wraps around at the beginning', () => {
    expect(prevImageIndex(0, 10)).toBe(9);
  });

  it('handles single image', () => {
    expect(prevImageIndex(0, 1)).toBe(0);
  });
});

describe('computeLoadMoreState', () => {
  it('shows remaining count when more images available', () => {
    const state = computeLoadMoreState(20, 50);
    expect(state.visible).toBe(true);
    expect(state.text).toBe('Load More Photos (30 remaining)');
  });

  it('hides button when all images displayed', () => {
    const state = computeLoadMoreState(50, 50);
    expect(state.visible).toBe(false);
  });

  it('hides button when displayed exceeds total', () => {
    const state = computeLoadMoreState(60, 50);
    expect(state.visible).toBe(false);
  });

  it('shows correct count for last partial batch', () => {
    const state = computeLoadMoreState(40, 45);
    expect(state.visible).toBe(true);
    expect(state.text).toBe('Load More Photos (5 remaining)');
  });
});
