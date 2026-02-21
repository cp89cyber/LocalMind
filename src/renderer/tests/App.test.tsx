// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  EndedReason,
  LocalMindAPI,
  RecommendationContext,
  RecommendationDecision,
  ScanResult,
  ThumbValue,
  Track
} from "../../shared/types";
import App from "../App";

const DEFAULT_SCAN_RESULT: ScanResult = {
  scannedFiles: 1,
  added: 1,
  updated: 0,
  missingMarked: 0,
  unsupported: 0,
  errors: []
};

type LocalMindMocks = {
  chooseLibraryFolder: ReturnType<typeof vi.fn<LocalMindAPI["chooseLibraryFolder"]>>;
  scanLibrary: ReturnType<typeof vi.fn<LocalMindAPI["scanLibrary"]>>;
  getLibraryTracks: ReturnType<typeof vi.fn<LocalMindAPI["getLibraryTracks"]>>;
  submitThumb: ReturnType<typeof vi.fn<LocalMindAPI["submitThumb"]>>;
  getNextRecommendation: ReturnType<typeof vi.fn<LocalMindAPI["getNextRecommendation"]>>;
  recordPlayStart: ReturnType<typeof vi.fn<LocalMindAPI["recordPlayStart"]>>;
  recordPlayEnd: ReturnType<typeof vi.fn<LocalMindAPI["recordPlayEnd"]>>;
};

function makeTrack(id = "track-1"): Track {
  return {
    id,
    filePath: `/music/${id}.mp3`,
    title: "Track",
    artist: "Artist",
    album: "Album",
    durationSec: 180,
    format: "mp3",
    thumb: 0,
    hardSuppressed: false,
    lastPlayedAt: null
  };
}

function mockMediaMethods(): {
  play: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  load: ReturnType<typeof vi.fn>;
} {
  const play = vi.fn(async () => undefined);
  const pause = vi.fn(() => undefined);
  const load = vi.fn(() => undefined);

  Object.defineProperty(HTMLMediaElement.prototype, "play", {
    configurable: true,
    writable: true,
    value: play
  });
  Object.defineProperty(HTMLMediaElement.prototype, "pause", {
    configurable: true,
    writable: true,
    value: pause
  });
  Object.defineProperty(HTMLMediaElement.prototype, "load", {
    configurable: true,
    writable: true,
    value: load
  });

  return { play, pause, load };
}

function getAudioElement(): HTMLAudioElement {
  const audio = document.querySelector("audio");
  if (!audio) {
    throw new Error("audio element not found");
  }
  return audio as HTMLAudioElement;
}

function setupLocalMind(
  overrides: Partial<LocalMindMocks> = {}
): LocalMindMocks {
  const mocks: LocalMindMocks = {
    chooseLibraryFolder: vi.fn(async () => null),
    scanLibrary: vi.fn(async (_folderPath: string) => DEFAULT_SCAN_RESULT),
    getLibraryTracks: vi.fn(async () => []),
    submitThumb: vi.fn(async (_trackId: string, _value: ThumbValue) => undefined),
    getNextRecommendation: vi.fn(
      async (_ctx: RecommendationContext): Promise<RecommendationDecision | null> => null
    ),
    recordPlayStart: vi.fn(async (_trackId: string) => undefined),
    recordPlayEnd: vi.fn(
      async (_trackId: string, _percentPlayed: number, _endedReason: EndedReason) =>
        undefined
    )
  };

  const merged = { ...mocks, ...overrides };
  const api: LocalMindAPI = {
    chooseLibraryFolder: merged.chooseLibraryFolder,
    scanLibrary: merged.scanLibrary,
    getLibraryTracks: merged.getLibraryTracks,
    submitThumb: merged.submitThumb,
    getNextRecommendation: merged.getNextRecommendation,
    recordPlayStart: merged.recordPlayStart,
    recordPlayEnd: merged.recordPlayEnd
  };

  Object.defineProperty(window, "localMind", {
    configurable: true,
    writable: true,
    value: api
  });

  return merged;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("App", () => {
  it("prompts for a folder on first run when library is empty", async () => {
    const chooseLibraryFolder = vi.fn(async () => null);
    setupLocalMind({
      chooseLibraryFolder,
      getLibraryTracks: vi.fn(async () => [])
    });
    mockMediaMethods();

    render(<App />);

    await waitFor(() => {
      expect(chooseLibraryFolder).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByText("No folder selected.")).toBeInTheDocument();
  });

  it("shows chooser errors and does not start scan", async () => {
    const scanLibrary = vi.fn(async (_folderPath: string) => DEFAULT_SCAN_RESULT);
    setupLocalMind({
      chooseLibraryFolder: vi.fn(async () => {
        throw new Error("dialog failed");
      }),
      scanLibrary,
      getLibraryTracks: vi.fn(async () => [makeTrack()])
    });
    mockMediaMethods();

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Choose Folder" }));

    await waitFor(() => {
      expect(
        screen.getByText("Failed to open folder chooser: dialog failed")
      ).toBeInTheDocument();
    });

    expect(scanLibrary).not.toHaveBeenCalled();
  });

  it("auto-scans immediately after selecting a folder", async () => {
    const scanResult: ScanResult = {
      scannedFiles: 3,
      added: 1,
      updated: 0,
      missingMarked: 0,
      unsupported: 0,
      errors: []
    };
    const scanLibrary = vi.fn(async (_folderPath: string) => scanResult);
    setupLocalMind({
      chooseLibraryFolder: vi.fn(async () => "/music"),
      scanLibrary,
      getLibraryTracks: vi.fn(async () => [makeTrack()])
    });
    mockMediaMethods();

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Choose Folder" }));

    await waitFor(() => {
      expect(scanLibrary).toHaveBeenCalledWith("/music");
    });
    await waitFor(() => {
      expect(
        screen.getByText("Scan done: 1 added, 0 updated, 0 missing, 0 unsupported")
      ).toBeInTheDocument();
    });
  });

  it("disables Choose Folder while chooser is in flight and re-enables after", async () => {
    let resolveChoose: (value: string | null) => void = () => undefined;
    const chooseLibraryFolder = vi.fn(
      () =>
        new Promise<string | null>((resolve) => {
          resolveChoose = resolve;
        })
    );

    setupLocalMind({
      chooseLibraryFolder,
      getLibraryTracks: vi.fn(async () => [makeTrack()])
    });
    mockMediaMethods();

    render(<App />);

    const chooseButton = screen.getByRole("button", { name: "Choose Folder" });
    fireEvent.click(chooseButton);

    await waitFor(() => {
      expect(chooseLibraryFolder).toHaveBeenCalledTimes(1);
      expect(chooseButton).toBeDisabled();
    });

    resolveChoose(null);

    await waitFor(() => {
      expect(chooseButton).toBeEnabled();
    });
  });

  it("adds failed tracks to session quarantine and excludes them from recommendation", async () => {
    const getNextRecommendation = vi.fn(
      async (_ctx: RecommendationContext): Promise<RecommendationDecision | null> => ({
        trackId: "track-b",
        sampledScore: 0.7,
        reason: "thompson_sampling"
      })
    );

    setupLocalMind({
      getLibraryTracks: vi.fn(async () => [makeTrack("track-a"), makeTrack("track-b")]),
      getNextRecommendation
    });
    mockMediaMethods();

    render(<App />);

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: "Track" })).toHaveLength(2);
    });

    const [firstTrackButton] = screen.getAllByRole("button", { name: "Track" });
    fireEvent.click(firstTrackButton);

    fireEvent.error(getAudioElement());

    await waitFor(() => {
      expect(getNextRecommendation).toHaveBeenCalled();
    });

    const call = getNextRecommendation.mock.calls.at(-1)?.[0] as RecommendationContext;
    expect(call.excludeTrackIds).toEqual(["track-a"]);
    expect(screen.getByText("Unplayable this session")).toBeInTheDocument();
  });

  it("stops autoplay with a stable message when no playable tracks remain", async () => {
    const getNextRecommendation = vi.fn(
      async (_ctx: RecommendationContext): Promise<RecommendationDecision | null> => null
    );

    setupLocalMind({
      getLibraryTracks: vi.fn(async () => [makeTrack("track-a")]),
      getNextRecommendation
    });
    mockMediaMethods();

    render(<App />);

    const trackButton = await screen.findByRole("button", { name: "Track" });
    fireEvent.click(trackButton);
    fireEvent.error(getAudioElement());

    await waitFor(() => {
      expect(
        screen.getByText(
          "No playable tracks available. Every remaining track failed in this session."
        )
      ).toBeInTheDocument();
    });

    const call = getNextRecommendation.mock.calls.at(-1)?.[0] as RecommendationContext;
    expect(call.excludeTrackIds).toEqual(["track-a"]);
  });

  it("clears a track's quarantine state when manually retried from the library", async () => {
    const getNextRecommendation = vi.fn(
      async (_ctx: RecommendationContext): Promise<RecommendationDecision | null> => null
    );
    const mediaMethods = mockMediaMethods();

    setupLocalMind({
      getLibraryTracks: vi.fn(async () => [makeTrack("track-a")]),
      getNextRecommendation
    });

    render(<App />);

    const trackButton = await screen.findByRole("button", { name: "Track" });
    fireEvent.click(trackButton);
    fireEvent.error(getAudioElement());

    await waitFor(() => {
      expect(screen.getByText("Unplayable this session")).toBeInTheDocument();
    });

    const playCallsBeforeRetry = mediaMethods.play.mock.calls.length;
    fireEvent.click(trackButton);

    await waitFor(() => {
      expect(mediaMethods.play.mock.calls.length).toBeGreaterThan(playCallsBeforeRetry);
      expect(screen.queryByText("Unplayable this session")).not.toBeInTheDocument();
    });
  });
});
