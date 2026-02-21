import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { LocalMindDatabase } from "../db";

const testDirs: string[] = [];

async function createTempDb(): Promise<{ db: LocalMindDatabase; dir: string }> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "localmind-db-"));
  testDirs.push(dir);
  const db = new LocalMindDatabase(path.join(dir, "test.sqlite3"));
  return { db, dir };
}

afterEach(async () => {
  await Promise.all(
    testDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true }))
  );
});

describe("LocalMindDatabase", () => {
  it("applies thumb feedback math and suppression defaults", async () => {
    const { db } = await createTempDb();
    const sourceId = db.ensureLibrarySource("/music");
    const filePath = `/music/${randomUUID()}.mp3`;
    const insert = db.upsertTrack({
      sourceId,
      filePath,
      title: "Example",
      artist: "Artist",
      album: null,
      durationSec: 180,
      format: "mp3"
    });
    expect(insert.added).toBe(true);

    const trackId = db.getLibraryTracks()[0]?.id;
    expect(trackId).toBeTruthy();
    if (!trackId) {
      db.close();
      throw new Error("trackId missing");
    }

    expect(db.getTrackFilePath(trackId)).toBe(filePath);
    expect(db.getTrackFilePath("missing-track-id")).toBeNull();

    db.submitThumb(trackId, 1);
    let track = db.getLibraryTracks()[0];
    let stats = db.getRecommendationTracks().find((entry) => entry.id === trackId);
    expect(track?.thumb).toBe(1);
    expect(track?.hardSuppressed).toBe(false);
    expect(stats?.alpha).toBe(2);
    expect(stats?.beta).toBe(1);

    db.submitThumb(trackId, -1);
    track = db.getLibraryTracks()[0];
    stats = db.getRecommendationTracks().find((entry) => entry.id === trackId);
    expect(track?.thumb).toBe(-1);
    expect(track?.hardSuppressed).toBe(true);
    expect(stats?.alpha).toBe(2);
    expect(stats?.beta).toBe(4);

    db.submitThumb(trackId, 0);
    track = db.getLibraryTracks()[0];
    stats = db.getRecommendationTracks().find((entry) => entry.id === trackId);
    expect(track?.thumb).toBe(0);
    expect(track?.hardSuppressed).toBe(false);
    expect(stats?.alpha).toBe(2);
    expect(stats?.beta).toBe(4);

    db.close();
  });
});
