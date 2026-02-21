import { describe, expect, it } from "vitest";
import {
  MEDIA_SCHEME,
  MEDIA_TRACK_HOST,
  buildTrackMediaUrl,
  parseTrackIdFromMediaUrl
} from "./media";

describe("media URL helpers", () => {
  it("builds and parses track media URLs with special characters", () => {
    const rawTrackId = "track #1?/demo";
    const mediaUrl = buildTrackMediaUrl(rawTrackId);

    expect(mediaUrl).toBe(
      `${MEDIA_SCHEME}://${MEDIA_TRACK_HOST}/${encodeURIComponent(rawTrackId)}`
    );
    expect(parseTrackIdFromMediaUrl(mediaUrl)).toBe(rawTrackId);
  });

  it("returns null for malformed or unsupported URLs", () => {
    expect(parseTrackIdFromMediaUrl("not-a-url")).toBeNull();
    expect(parseTrackIdFromMediaUrl("file:///tmp/song.mp3")).toBeNull();
    expect(parseTrackIdFromMediaUrl(`${MEDIA_SCHEME}://wrong-host/track-1`)).toBeNull();
    expect(parseTrackIdFromMediaUrl(`${MEDIA_SCHEME}://${MEDIA_TRACK_HOST}/`)).toBeNull();
    expect(parseTrackIdFromMediaUrl(`${MEDIA_SCHEME}://${MEDIA_TRACK_HOST}/a/b`)).toBeNull();
  });
});
