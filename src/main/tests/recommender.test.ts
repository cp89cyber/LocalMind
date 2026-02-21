import { describe, expect, it } from "vitest";
import { Recommender } from "../recommender";
import type { RecommendationTrack } from "../db";

function createLcg(seed = 12345): () => number {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function buildSource(tracks: RecommendationTrack[]) {
  return {
    getRecommendationTracks: () => tracks
  };
}

describe("Recommender", () => {
  it("excludes hard suppressed tracks", () => {
    const recommender = new Recommender(
      buildSource([
        {
          id: "suppressed",
          alpha: 100,
          beta: 1,
          hardSuppressed: true,
          isMissing: false
        },
        {
          id: "normal",
          alpha: 1,
          beta: 1,
          hardSuppressed: false,
          isMissing: false
        }
      ]),
      createLcg(7)
    );

    const decision = recommender.getNextRecommendation({
      currentTrackId: null,
      recentTrackIds: []
    });

    expect(decision?.trackId).toBe("normal");
  });

  it("falls back when recent-window exclusion removes all candidates", () => {
    const recommender = new Recommender(
      buildSource([
        {
          id: "track-a",
          alpha: 2,
          beta: 1,
          hardSuppressed: false,
          isMissing: false
        },
        {
          id: "track-b",
          alpha: 3,
          beta: 1,
          hardSuppressed: false,
          isMissing: false
        }
      ]),
      createLcg(11)
    );

    const decision = recommender.getNextRecommendation({
      currentTrackId: null,
      recentTrackIds: ["track-a", "track-b"]
    });

    expect(decision).not.toBeNull();
    expect(["track-a", "track-b"]).toContain(decision?.trackId);
  });

  it("still explores unrated tracks under Thompson sampling", () => {
    const recommender = new Recommender(
      buildSource([
        {
          id: "highly-liked",
          alpha: 20,
          beta: 2,
          hardSuppressed: false,
          isMissing: false
        },
        {
          id: "unrated",
          alpha: 1,
          beta: 1,
          hardSuppressed: false,
          isMissing: false
        }
      ]),
      createLcg(4242)
    );

    let unratedChosen = 0;
    const iterations = 500;
    for (let i = 0; i < iterations; i += 1) {
      const decision = recommender.getNextRecommendation({
        currentTrackId: null,
        recentTrackIds: []
      });

      if (decision?.trackId === "unrated") {
        unratedChosen += 1;
      }
    }

    expect(unratedChosen).toBeGreaterThan(0);
    expect(unratedChosen).toBeLessThan(iterations);
  });
});
