export type ThumbValue = -1 | 0 | 1;

export interface Track {
  id: string;
  filePath: string;
  title: string;
  artist: string | null;
  album: string | null;
  durationSec: number | null;
  format: string | null;
  thumb: ThumbValue;
  hardSuppressed: boolean;
  lastPlayedAt: string | null;
}

export interface ScanResult {
  scannedFiles: number;
  added: number;
  updated: number;
  missingMarked: number;
  unsupported: number;
  errors: string[];
}

export interface RecommendationContext {
  currentTrackId: string | null;
  recentTrackIds: string[];
  excludeTrackIds: string[];
}

export interface RecommendationDecision {
  trackId: string;
  sampledScore: number;
  reason: "thompson_sampling";
}

export type EndedReason = "ended" | "skipped" | "error";

export interface LocalMindAPI {
  chooseLibraryFolder(): Promise<string | null>;
  scanLibrary(folderPath: string): Promise<ScanResult>;
  getLibraryTracks(): Promise<Track[]>;
  submitThumb(trackId: string, value: ThumbValue): Promise<void>;
  getNextRecommendation(
    ctx: RecommendationContext
  ): Promise<RecommendationDecision | null>;
  recordPlayStart(trackId: string): Promise<void>;
  recordPlayEnd(
    trackId: string,
    percentPlayed: number,
    endedReason: EndedReason
  ): Promise<void>;
}
