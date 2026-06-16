export const MUSIC_STORAGE_KEY = 'pomodoro.music.savedPlaylists';

export function parseNeteasePlaylistInput(input) {
  const value = input.trim();

  if (/^\d+$/.test(value)) {
    return value;
  }

  const idMatch = value.match(/[?&]id=(\d+)/);
  if (idMatch) {
    return idMatch[1];
  }

  return null;
}

export function buildNeteasePlaylistEmbedUrl(id) {
  return `https://music.163.com/outchain/player?type=0&id=${id}&auto=0&height=430`;
}

export function createSavedPlaylistRecord({ id, title, sourceUrl }) {
  return {
    id,
    title: title.trim() || `网易云歌单 ${id}`,
    sourceUrl,
    embedUrl: buildNeteasePlaylistEmbedUrl(id),
  };
}
