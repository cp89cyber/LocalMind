export const MEDIA_SCHEME = "localmind-media";
export const MEDIA_TRACK_HOST = "track";

export function buildTrackMediaUrl(trackId: string): string {
  return `${MEDIA_SCHEME}://${MEDIA_TRACK_HOST}/${encodeURIComponent(trackId)}`;
}

export function parseTrackIdFromMediaUrl(rawUrl: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }

  if (parsed.protocol !== `${MEDIA_SCHEME}:`) {
    return null;
  }

  if (parsed.hostname !== MEDIA_TRACK_HOST) {
    return null;
  }

  const segments = parsed.pathname.split("/").filter((segment) => segment.length > 0);
  if (segments.length !== 1) {
    return null;
  }

  const encodedTrackId = segments[0];
  if (!encodedTrackId) {
    return null;
  }

  try {
    const trackId = decodeURIComponent(encodedTrackId);
    return trackId.length > 0 ? trackId : null;
  } catch {
    return null;
  }
}
