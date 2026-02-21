import type {
  EndedReason,
  RecommendationContext,
  ThumbValue
} from "../shared/types";

const ENDED_REASONS: ReadonlySet<string> = new Set(["ended", "skipped", "error"]);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function assertString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Invalid ${field}`);
  }
  return value;
}

export function assertFolderPath(value: unknown): string {
  return assertString(value, "folderPath");
}

export function assertTrackId(value: unknown): string {
  return assertString(value, "trackId");
}

export function assertThumbValue(value: unknown): ThumbValue {
  if (value === -1 || value === 0 || value === 1) {
    return value;
  }
  throw new Error("Invalid thumb value");
}

export function assertRecommendationContext(
  value: unknown
): RecommendationContext {
  if (!isObject(value)) {
    throw new Error("Invalid recommendation context");
  }

  const currentTrackRaw = value.currentTrackId;
  const currentTrackId =
    currentTrackRaw === null ? null : assertTrackId(currentTrackRaw);

  const recentTrackIdsRaw = value.recentTrackIds;
  if (!Array.isArray(recentTrackIdsRaw)) {
    throw new Error("Invalid recentTrackIds");
  }

  const recentTrackIds = recentTrackIdsRaw.map((entry) =>
    assertString(entry, "recentTrackId")
  );

  const excludeTrackIdsRaw = value.excludeTrackIds;
  if (!Array.isArray(excludeTrackIdsRaw)) {
    throw new Error("Invalid excludeTrackIds");
  }

  const excludeTrackIds = excludeTrackIdsRaw.map((entry) =>
    assertString(entry, "excludeTrackId")
  );

  return {
    currentTrackId,
    recentTrackIds,
    excludeTrackIds
  };
}

export function assertPercentPlayed(value: unknown): number {
  if (typeof value !== "number" || Number.isNaN(value) || !Number.isFinite(value)) {
    throw new Error("Invalid percentPlayed");
  }

  if (value < 0 || value > 100) {
    throw new Error("percentPlayed must be between 0 and 100");
  }

  return value;
}

export function assertEndedReason(value: unknown): EndedReason {
  if (typeof value !== "string" || !ENDED_REASONS.has(value)) {
    throw new Error("Invalid endedReason");
  }

  return value as EndedReason;
}
