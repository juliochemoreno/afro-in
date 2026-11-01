// Spotify artist ids are 22 base-62 characters (open.spotify.com/artist/<id>).
const SPOTIFY_ID = /^[A-Za-z0-9]{22}$/;

/** Official embed URL for an artist, or null when the id is not a valid Spotify id. */
export function spotifyEmbedUrl(artistId: string | undefined | null): string | null {
  if (!artistId || !SPOTIFY_ID.test(artistId)) return null;
  return `https://open.spotify.com/embed/artist/${artistId}?utm_source=generator&theme=0`;
}
