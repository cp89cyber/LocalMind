import { randomUUID } from "node:crypto";
import type { EndedReason, ThumbValue, Track } from "../shared/types";

type SQLiteModule = typeof import("node:sqlite");
type DatabaseSync = import("node:sqlite").DatabaseSync;

const runtimeRequire = eval("require") as NodeRequire;
const { DatabaseSync: DatabaseSyncCtor } = runtimeRequire(
  "node:sqlite"
) as SQLiteModule;

const APP_STATE_LAST_FOLDER = "last_library_folder";
const APP_STATE_CURRENT_PLAY_EVENT_ID = "current_play_event_id";
const APP_STATE_CURRENT_PLAY_TRACK_ID = "current_play_track_id";

interface SourceRow {
  id: string;
}

interface TrackRow {
  id: string;
  source_id: string;
  title: string;
  artist: string | null;
  album: string | null;
  duration_sec: number | null;
  format: string | null;
  thumb: number;
  hard_suppressed: number;
  last_played_at: string | null;
  is_missing: number;
  alpha: number;
  beta: number;
}

interface PlayRow {
  id: string;
  track_id: string;
}

export interface TrackMetadataInput {
  sourceId: string;
  filePath: string;
  title: string;
  artist: string | null;
  album: string | null;
  durationSec: number | null;
  format: string | null;
}

export interface UpsertTrackResult {
  added: boolean;
  updated: boolean;
}

export interface RecommendationTrack {
  id: string;
  alpha: number;
  beta: number;
  hardSuppressed: boolean;
  isMissing: boolean;
}

function nowIso(): string {
  return new Date().toISOString();
}

export class LocalMindDatabase {
  private readonly db: DatabaseSync;

  constructor(dbPath: string) {
    this.db = new DatabaseSyncCtor(dbPath);
    this.db.exec("PRAGMA foreign_keys = ON;");
    this.db.exec("PRAGMA journal_mode = WAL;");
    this.initSchema();
  }

  close(): void {
    this.db.close();
  }

  initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS library_sources (
        id TEXT PRIMARY KEY,
        folder_path TEXT NOT NULL UNIQUE,
        added_at TEXT NOT NULL,
        last_scanned_at TEXT
      );

      CREATE TABLE IF NOT EXISTS tracks (
        id TEXT PRIMARY KEY,
        source_id TEXT NOT NULL,
        file_path TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        artist TEXT,
        album TEXT,
        duration_sec REAL,
        format TEXT,
        thumb INTEGER NOT NULL DEFAULT 0,
        hard_suppressed INTEGER NOT NULL DEFAULT 0,
        alpha REAL NOT NULL DEFAULT 1,
        beta REAL NOT NULL DEFAULT 1,
        last_played_at TEXT,
        is_missing INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(source_id) REFERENCES library_sources(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS play_events (
        id TEXT PRIMARY KEY,
        track_id TEXT NOT NULL,
        started_at TEXT NOT NULL,
        ended_at TEXT,
        percent_played REAL,
        ended_reason TEXT,
        FOREIGN KEY(track_id) REFERENCES tracks(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS app_state (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_tracks_source_missing
      ON tracks (source_id, is_missing);

      CREATE INDEX IF NOT EXISTS idx_tracks_recommendable
      ON tracks (is_missing, hard_suppressed);
    `);
  }

  ensureLibrarySource(folderPath: string): string {
    const existing = this.db
      .prepare("SELECT id FROM library_sources WHERE folder_path = ?")
      .get(folderPath) as SourceRow | undefined;

    if (existing) {
      return existing.id;
    }

    const sourceId = randomUUID();
    const now = nowIso();
    this.db
      .prepare(
        "INSERT INTO library_sources (id, folder_path, added_at, last_scanned_at) VALUES (?, ?, ?, ?)"
      )
      .run(sourceId, folderPath, now, now);
    return sourceId;
  }

  setLastLibraryFolder(folderPath: string): void {
    this.setAppState(APP_STATE_LAST_FOLDER, folderPath);
  }

  getLastLibraryFolder(): string | null {
    return this.getAppState(APP_STATE_LAST_FOLDER);
  }

  markSourceTracksMissing(sourceId: string): void {
    this.db
      .prepare("UPDATE tracks SET is_missing = 1 WHERE source_id = ?")
      .run(sourceId);
  }

  touchSourceScan(sourceId: string): void {
    this.db
      .prepare("UPDATE library_sources SET last_scanned_at = ? WHERE id = ?")
      .run(nowIso(), sourceId);
  }

  countMissingTracksForSource(sourceId: string): number {
    const row = this.db
      .prepare(
        "SELECT COUNT(*) AS count FROM tracks WHERE source_id = ? AND is_missing = 1"
      )
      .get(sourceId) as { count: number };
    return row.count;
  }

  upsertTrack(input: TrackMetadataInput): UpsertTrackResult {
    const now = nowIso();
    const existing = this.db
      .prepare(
        "SELECT id, source_id, title, artist, album, duration_sec, format, is_missing FROM tracks WHERE file_path = ?"
      )
      .get(input.filePath) as
      | (Pick<
          TrackRow,
          | "id"
          | "source_id"
          | "title"
          | "artist"
          | "album"
          | "duration_sec"
          | "format"
          | "is_missing"
        > & { is_missing: number })
      | undefined;

    if (!existing) {
      this.db
        .prepare(
          `
          INSERT INTO tracks (
            id, source_id, file_path, title, artist, album, duration_sec, format, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `
        )
        .run(
          randomUUID(),
          input.sourceId,
          input.filePath,
          input.title,
          input.artist,
          input.album,
          input.durationSec,
          input.format,
          now
        );
      return { added: true, updated: false };
    }

    const metadataChanged =
      existing.title !== input.title ||
      existing.artist !== input.artist ||
      existing.album !== input.album ||
      existing.duration_sec !== input.durationSec ||
      existing.format !== input.format ||
      existing.source_id !== input.sourceId ||
      existing.is_missing === 1;

    this.db
      .prepare(
        `
        UPDATE tracks
        SET source_id = ?,
            title = ?,
            artist = ?,
            album = ?,
            duration_sec = ?,
            format = ?,
            is_missing = 0,
            updated_at = ?
        WHERE id = ?
        `
      )
      .run(
        input.sourceId,
        input.title,
        input.artist,
        input.album,
        input.durationSec,
        input.format,
        now,
        existing.id
      );

    return { added: false, updated: metadataChanged };
  }

  getLibraryTracks(): Track[] {
    const rows = this.db
      .prepare(
        `
        SELECT
          id,
          file_path,
          title,
          artist,
          album,
          duration_sec,
          format,
          thumb,
          hard_suppressed,
          last_played_at
        FROM tracks
        WHERE is_missing = 0
        ORDER BY
          COALESCE(artist, ''),
          title
        `
      )
      .all() as Array<{
      id: string;
      file_path: string;
      title: string;
      artist: string | null;
      album: string | null;
      duration_sec: number | null;
      format: string | null;
      thumb: number;
      hard_suppressed: number;
      last_played_at: string | null;
    }>;

    return rows.map((row) => ({
      id: row.id,
      filePath: row.file_path,
      title: row.title,
      artist: row.artist,
      album: row.album,
      durationSec: row.duration_sec,
      format: row.format,
      thumb: this.normalizeThumb(row.thumb),
      hardSuppressed: row.hard_suppressed === 1,
      lastPlayedAt: row.last_played_at
    }));
  }

  getTrackFilePath(trackId: string): string | null {
    const row = this.db
      .prepare(
        `
        SELECT file_path
        FROM tracks
        WHERE id = ? AND is_missing = 0
        `
      )
      .get(trackId) as { file_path: string } | undefined;

    return row?.file_path ?? null;
  }

  getRecommendationTracks(): RecommendationTrack[] {
    const rows = this.db
      .prepare(
        `
        SELECT id, alpha, beta, hard_suppressed, is_missing
        FROM tracks
        WHERE is_missing = 0
        `
      )
      .all() as Array<{
      id: string;
      alpha: number;
      beta: number;
      hard_suppressed: number;
      is_missing: number;
    }>;

    return rows.map((row) => ({
      id: row.id,
      alpha: row.alpha,
      beta: row.beta,
      hardSuppressed: row.hard_suppressed === 1,
      isMissing: row.is_missing === 1
    }));
  }

  submitThumb(trackId: string, value: ThumbValue): void {
    if (value === 1) {
      this.db
        .prepare(
          `
          UPDATE tracks
          SET thumb = 1,
              hard_suppressed = 0,
              alpha = alpha + 1
          WHERE id = ?
          `
        )
        .run(trackId);
      return;
    }

    if (value === -1) {
      this.db
        .prepare(
          `
          UPDATE tracks
          SET thumb = -1,
              hard_suppressed = 1,
              beta = beta + 3
          WHERE id = ?
          `
        )
        .run(trackId);
      return;
    }

    this.db
      .prepare(
        `
        UPDATE tracks
        SET thumb = 0,
            hard_suppressed = 0
        WHERE id = ?
        `
      )
      .run(trackId);
  }

  recordPlayStart(trackId: string): void {
    const eventId = randomUUID();
    const now = nowIso();

    this.db
      .prepare("UPDATE tracks SET last_played_at = ? WHERE id = ?")
      .run(now, trackId);

    this.db
      .prepare(
        `
        INSERT INTO play_events (id, track_id, started_at)
        VALUES (?, ?, ?)
        `
      )
      .run(eventId, trackId, now);

    this.setAppState(APP_STATE_CURRENT_PLAY_EVENT_ID, eventId);
    this.setAppState(APP_STATE_CURRENT_PLAY_TRACK_ID, trackId);
  }

  recordPlayEnd(
    trackId: string,
    percentPlayed: number,
    endedReason: EndedReason
  ): void {
    const pendingEventId = this.getAppState(APP_STATE_CURRENT_PLAY_EVENT_ID);
    const pendingTrackId = this.getAppState(APP_STATE_CURRENT_PLAY_TRACK_ID);
    const now = nowIso();

    if (pendingEventId && pendingTrackId === trackId) {
      const existing = this.db
        .prepare(
          "SELECT id, track_id FROM play_events WHERE id = ? AND ended_at IS NULL"
        )
        .get(pendingEventId) as PlayRow | undefined;

      if (existing) {
        this.db
          .prepare(
            `
            UPDATE play_events
            SET ended_at = ?, percent_played = ?, ended_reason = ?
            WHERE id = ?
            `
          )
          .run(now, percentPlayed, endedReason, pendingEventId);
        this.clearCurrentPlayState();
        return;
      }
    }

    this.db
      .prepare(
        `
        INSERT INTO play_events (id, track_id, started_at, ended_at, percent_played, ended_reason)
        VALUES (?, ?, ?, ?, ?, ?)
        `
      )
      .run(randomUUID(), trackId, now, now, percentPlayed, endedReason);
    this.clearCurrentPlayState();
  }

  private clearCurrentPlayState(): void {
    this.db
      .prepare("DELETE FROM app_state WHERE key IN (?, ?)")
      .run(APP_STATE_CURRENT_PLAY_EVENT_ID, APP_STATE_CURRENT_PLAY_TRACK_ID);
  }

  private setAppState(key: string, value: string): void {
    this.db
      .prepare(
        `
        INSERT INTO app_state (key, value)
        VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
        `
      )
      .run(key, value);
  }

  private getAppState(key: string): string | null {
    const row = this.db
      .prepare("SELECT value FROM app_state WHERE key = ?")
      .get(key) as { value: string } | undefined;
    return row?.value ?? null;
  }

  private normalizeThumb(value: number): ThumbValue {
    if (value === 1 || value === -1 || value === 0) {
      return value;
    }
    return 0;
  }
}
