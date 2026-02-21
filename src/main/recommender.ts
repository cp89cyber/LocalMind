import type { RecommendationContext, RecommendationDecision } from "../shared/types";
import type { RecommendationTrack } from "./db";

const RECENT_WINDOW = 20;

export interface RecommendationSource {
  getRecommendationTracks(): RecommendationTrack[];
}

function sampleStandardNormal(rng: () => number): number {
  let u = 0;
  let v = 0;

  while (u === 0) {
    u = rng();
  }
  while (v === 0) {
    v = rng();
  }

  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function sampleGamma(shape: number, rng: () => number): number {
  if (shape <= 0) {
    return 0;
  }

  if (shape < 1) {
    const u = rng();
    return sampleGamma(shape + 1, rng) * Math.pow(u, 1 / shape);
  }

  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);

  while (true) {
    const x = sampleStandardNormal(rng);
    const v = Math.pow(1 + c * x, 3);
    if (v <= 0) {
      continue;
    }

    const u = rng();
    const xSquared = x * x;
    if (u < 1 - 0.0331 * xSquared * xSquared) {
      return d * v;
    }

    if (Math.log(u) < 0.5 * xSquared + d * (1 - v + Math.log(v))) {
      return d * v;
    }
  }
}

export function sampleBeta(
  alpha: number,
  beta: number,
  rng: () => number = Math.random
): number {
  const x = sampleGamma(alpha, rng);
  const y = sampleGamma(beta, rng);
  if (x === 0 && y === 0) {
    return 0.5;
  }
  return x / (x + y);
}

export class Recommender {
  constructor(
    private readonly source: RecommendationSource,
    private readonly rng: () => number = Math.random
  ) {}

  getNextRecommendation(
    ctx: RecommendationContext
  ): RecommendationDecision | null {
    const rawTracks = this.source.getRecommendationTracks();
    const eligible = rawTracks.filter(
      (track) => !track.isMissing && !track.hardSuppressed
    );

    if (eligible.length === 0) {
      return null;
    }

    const withoutCurrent = eligible.filter((track) => track.id !== ctx.currentTrackId);
    const currentFiltered = withoutCurrent.length > 0 ? withoutCurrent : eligible;
    const recentSet = new Set(ctx.recentTrackIds.slice(-RECENT_WINDOW));

    const withoutRecent = currentFiltered.filter((track) => !recentSet.has(track.id));
    const candidatePool = withoutRecent.length > 0 ? withoutRecent : currentFiltered;

    if (candidatePool.length === 0) {
      return null;
    }

    const firstCandidate = candidatePool[0];
    if (!firstCandidate) {
      return null;
    }

    let winner = firstCandidate;
    let winnerScore = sampleBeta(winner.alpha, winner.beta, this.rng);

    for (let i = 1; i < candidatePool.length; i += 1) {
      const candidate = candidatePool[i];
      if (!candidate) {
        continue;
      }
      const candidateScore = sampleBeta(candidate.alpha, candidate.beta, this.rng);
      if (candidateScore > winnerScore) {
        winner = candidate;
        winnerScore = candidateScore;
      }
    }

    return {
      trackId: winner.id,
      sampledScore: winnerScore,
      reason: "thompson_sampling"
    };
  }
}
