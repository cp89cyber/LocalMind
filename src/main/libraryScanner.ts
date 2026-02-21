import * as fs from "node:fs/promises";
import * as path from "node:path";
import { parseFile } from "music-metadata";
import type { ScanResult } from "../shared/types";
import { LocalMindDatabase } from "./db";

const SUPPORTED_EXTENSIONS = new Set([
  ".mp3",
  ".m4a",
  ".aac",
  ".wav",
  ".ogg",
  ".flac"
]);

async function walkFiles(root: string): Promise<string[]> {
  const entries = await fs.readdir(root, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    if (entry.isSymbolicLink()) {
      continue;
    }

    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      const nested = await walkFiles(fullPath);
      files.push(...nested);
      continue;
    }

    if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

function normalizeDuration(duration: number | undefined): number | null {
  if (!duration || Number.isNaN(duration) || !Number.isFinite(duration)) {
    return null;
  }

  return Math.round(duration);
}

export async function scanLibraryFolder(
  db: LocalMindDatabase,
  folderPath: string
): Promise<ScanResult> {
  const sourceId = db.ensureLibrarySource(folderPath);
  db.setLastLibraryFolder(folderPath);
  db.markSourceTracksMissing(sourceId);

  const result: ScanResult = {
    scannedFiles: 0,
    added: 0,
    updated: 0,
    missingMarked: 0,
    unsupported: 0,
    errors: []
  };

  const allFiles = await walkFiles(folderPath);
  for (const filePath of allFiles) {
    result.scannedFiles += 1;
    const extension = path.extname(filePath).toLowerCase();
    if (!SUPPORTED_EXTENSIONS.has(extension)) {
      result.unsupported += 1;
      continue;
    }

    try {
      let title = path.basename(filePath, extension);
      let artist: string | null = null;
      let album: string | null = null;
      let durationSec: number | null = null;

      try {
        const metadata = await parseFile(filePath);
        title = metadata.common.title?.trim() || title;
        artist = metadata.common.artist?.trim() || null;
        album = metadata.common.album?.trim() || null;
        durationSec = normalizeDuration(metadata.format.duration);
      } catch {
        // Fallback metadata path intentionally uses filename when parsing fails.
      }

      const upsert = db.upsertTrack({
        sourceId,
        filePath,
        title,
        artist,
        album,
        durationSec,
        format: extension.slice(1)
      });

      if (upsert.added) {
        result.added += 1;
      }

      if (upsert.updated) {
        result.updated += 1;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.errors.push(`${filePath}: ${message}`);
    }
  }

  db.touchSourceScan(sourceId);
  result.missingMarked = db.countMissingTracksForSource(sourceId);
  return result;
}
