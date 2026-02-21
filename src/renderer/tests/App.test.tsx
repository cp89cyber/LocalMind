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

function mockMediaMethods(): void {
  Object.defineProperty(HTMLMediaElement.prototype, "play", {
    configurable: true,
    writable: true,
    value: vi.fn(async () => undefined)
  });
  Object.defineProperty(HTMLMediaElement.prototype, "pause", {
    configurable: true,
    writable: true,
    value: vi.fn(() => undefined)
  });
  Object.defineProperty(HTMLMediaElement.prototype, "load", {
    configurable: true,
    writable: true,
    value: vi.fn(() => undefined)
  });
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
});
