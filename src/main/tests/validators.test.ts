import { describe, expect, it } from "vitest";
import {
  assertEndedReason,
  assertFolderPath,
  assertPercentPlayed,
  assertRecommendationContext,
  assertThumbValue,
  assertTrackId
} from "../validators";

describe("IPC validators", () => {
  it("accepts valid inputs", () => {
    expect(assertFolderPath("/tmp/music")).toBe("/tmp/music");
    expect(assertTrackId("track-1")).toBe("track-1");
    expect(assertThumbValue(-1)).toBe(-1);
    expect(assertPercentPlayed(50.5)).toBe(50.5);
    expect(assertEndedReason("ended")).toBe("ended");
    expect(
      assertRecommendationContext({
        currentTrackId: "a",
        recentTrackIds: ["a", "b"],
        excludeTrackIds: ["c"]
      })
    ).toEqual({
      currentTrackId: "a",
      recentTrackIds: ["a", "b"],
      excludeTrackIds: ["c"]
    });
  });

  it("rejects invalid payloads", () => {
    expect(() => assertFolderPath("")).toThrow("Invalid folderPath");
    expect(() => assertTrackId(123)).toThrow("Invalid trackId");
    expect(() => assertThumbValue(5)).toThrow("Invalid thumb value");
    expect(() => assertPercentPlayed(120)).toThrow(
      "percentPlayed must be between 0 and 100"
    );
    expect(() => assertEndedReason("done")).toThrow("Invalid endedReason");
    expect(() =>
      assertRecommendationContext({
        currentTrackId: null,
        recentTrackIds: [1, "ok"],
        excludeTrackIds: []
      })
    ).toThrow("Invalid recentTrackId");
    expect(() =>
      assertRecommendationContext({
        currentTrackId: null,
        recentTrackIds: [],
        excludeTrackIds: [123]
      })
    ).toThrow("Invalid excludeTrackId");
  });
});
