import photoUrl from '../../../src/ts/helpers/photo_url';
import { describe, it, expect } from 'vitest';

describe('photoUrl', () => {
  it('generates thumbnail URL by default', () => {
    const url = photoUrl('dscn5570.jpg');
    expect(url).toBe('https://bird-gallery.xaviershay.com/thumbnails/dscn5570.jpg');
  });

  it('generates thumbnail URL when thumbnail option is true', () => {
    const url = photoUrl('dscn5570.jpg', { thumbnail: true });
    expect(url).toBe('https://bird-gallery.xaviershay.com/thumbnails/dscn5570.jpg');
  });

  it('generates full photo URL when thumbnail option is false', () => {
    const url = photoUrl('dscn5570.jpg', { thumbnail: false });
    expect(url).toBe('https://bird-gallery.xaviershay.com/photos/dscn5570.jpg');
  });

  it('handles different file names', () => {
    expect(photoUrl('bird123.jpg')).toBe('https://bird-gallery.xaviershay.com/thumbnails/bird123.jpg');
    expect(photoUrl('test-photo.png')).toBe('https://bird-gallery.xaviershay.com/thumbnails/test-photo.png');
  });

  it('handles different file names for full photos', () => {
    expect(photoUrl('bird123.jpg', { thumbnail: false })).toBe('https://bird-gallery.xaviershay.com/photos/bird123.jpg');
    expect(photoUrl('test-photo.png', { thumbnail: false })).toBe('https://bird-gallery.xaviershay.com/photos/test-photo.png');
  });

  it('handles file names with special characters', () => {
    const url = photoUrl('photo_with-special.chars.jpg');
    expect(url).toBe('https://bird-gallery.xaviershay.com/thumbnails/photo_with-special.chars.jpg');
  });
});
