import { describe, expect, it } from 'vitest';
import {
  MUSIC_STORAGE_KEY,
  buildNeteasePlaylistEmbedUrl,
  createSavedPlaylistRecord,
  parseNeteasePlaylistInput,
} from './music';

describe('music helpers', () => {
  it('parses a direct playlist id', () => {
    expect(parseNeteasePlaylistInput('3778678')).toBe('3778678');
  });

  it('parses a playlist URL with hash query', () => {
    expect(parseNeteasePlaylistInput('https://music.163.com/#/playlist?id=3778678')).toBe('3778678');
  });

  it('returns null for unsupported input', () => {
    expect(parseNeteasePlaylistInput('https://example.com/nope')).toBeNull();
  });

  it('builds the official outchain player URL', () => {
    expect(buildNeteasePlaylistEmbedUrl('3778678')).toBe(
      'https://music.163.com/outchain/player?type=0&id=3778678&auto=0&height=430',
    );
  });

  it('creates a saved playlist record with fallback title', () => {
    expect(createSavedPlaylistRecord({ id: '3778678', title: '', sourceUrl: '3778678' })).toEqual({
      id: '3778678',
      title: '网易云歌单 3778678',
      sourceUrl: '3778678',
      embedUrl: 'https://music.163.com/outchain/player?type=0&id=3778678&auto=0&height=430',
    });
  });

  it('exports a stable localStorage key', () => {
    expect(MUSIC_STORAGE_KEY).toBe('pomodoro.music.savedPlaylists');
  });
});
