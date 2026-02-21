import type { Track } from "../../shared/types";
import { buildTrackMediaUrl } from "../../shared/media";

export const RECENT_TRACK_LIMIT = 20;

export interface PlayerState {
  tracks: Track[];
  currentTrackId: string | null;
  isPlaying: boolean;
  currentTimeSec: number;
  currentDurationSec: number;
  history: string[];
  statusMessage: string | null;
}

export function findTrackById(
  tracks: Track[],
  trackId: string | null
): Track | null {
  if (!trackId) {
    return null;
  }

  return tracks.find((track) => track.id === trackId) ?? null;
}

export function appendHistory(history: string[], trackId: string): string[] {
  const next = [...history, trackId];
  return next.slice(-RECENT_TRACK_LIMIT);
}

export function previousTrackId(
  history: string[],
  currentTrackId: string | null
): string | null {
  if (!currentTrackId) {
    return null;
  }

  const currentIndex = history.lastIndexOf(currentTrackId);
  if (currentIndex <= 0) {
    return null;
  }

  return history[currentIndex - 1] ?? null;
}

export function toAudioUrl(trackId: string): string {
  return buildTrackMediaUrl(trackId);
}

export function formatDuration(totalSeconds: number | null): string {
  if (totalSeconds === null || Number.isNaN(totalSeconds)) {
    return "--:--";
  }

  const seconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${remainder.toString().padStart(2, "0")}`;
}
