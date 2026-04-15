import { describe, it, expect } from 'vitest';
const { filterImageFiles } = require('../scripts/update_gallery');

describe('filterImageFiles', () => {
  it('keeps only image files', () => {
    const files = ['photo.jpg', 'doc.pdf', 'pic.png', 'notes.txt', 'anim.gif', 'hero.webp', 'data.json'];
    const result = filterImageFiles(files);
    expect(result).toEqual(['photo.jpg', 'pic.png', 'anim.gif', 'hero.webp']);
  });

  it('handles case-insensitive extensions', () => {
    const files = ['PHOTO.JPG', 'Pic.Png', 'ANIM.GIF', 'hero.WEBP', 'scan.JPEG'];
    const result = filterImageFiles(files);
    expect(result).toEqual(['PHOTO.JPG', 'Pic.Png', 'ANIM.GIF', 'hero.WEBP', 'scan.JPEG']);
  });

  it('returns empty array when no images', () => {
    const files = ['readme.md', 'data.json', 'style.css'];
    const result = filterImageFiles(files);
    expect(result).toEqual([]);
  });

  it('returns empty array for empty input', () => {
    expect(filterImageFiles([])).toEqual([]);
  });
});
