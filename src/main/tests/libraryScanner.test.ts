import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { LocalMindDatabase } from "../db";
import { scanLibraryFolder } from "../libraryScanner";

const testDirs: string[] = [];

async function createTempArea(): Promise<{
  root: string;
  musicDir: string;
  db: LocalMindDatabase;
}> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "localmind-scan-"));
  testDirs.push(root);
  const musicDir = path.join(root, "music");
  await fs.mkdir(musicDir, { recursive: true });
  const db = new LocalMindDatabase(path.join(root, "scan.sqlite3"));
  return { root, musicDir, db };
}

afterEach(async () => {
  await Promise.all(
    testDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true }))
  );
});

describe("scanLibraryFolder", () => {
  it("adds tracks, falls back to filename metadata, and marks deleted files missing", async () => {
    const { musicDir, db } = await createTempArea();
    const songPath = path.join(musicDir, "untagged-track.mp3");
    const notePath = path.join(musicDir, "notes.txt");
    await fs.writeFile(songPath, "");
    await fs.writeFile(notePath, "ignore");

    const firstScan = await scanLibraryFolder(db, musicDir);
    expect(firstScan.scannedFiles).toBe(2);
    expect(firstScan.unsupported).toBe(1);
    expect(firstScan.added).toBe(1);
    expect(firstScan.updated).toBe(0);
    expect(firstScan.missingMarked).toBe(0);

    let tracks = db.getLibraryTracks();
    expect(tracks).toHaveLength(1);
    expect(tracks[0]?.title).toBe("untagged-track");

    await fs.rm(songPath);

    const secondScan = await scanLibraryFolder(db, musicDir);
    expect(secondScan.missingMarked).toBe(1);
    tracks = db.getLibraryTracks();
    expect(tracks).toHaveLength(0);

    db.close();
  });
});
