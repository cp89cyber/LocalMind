// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import App from "../App";

describe("App", () => {
  it("prompts for a folder on first run when library is empty", async () => {
    const chooseLibraryFolder = vi.fn(async () => null);

    Object.defineProperty(window, "localMind", {
      configurable: true,
      writable: true,
      value: {
        chooseLibraryFolder,
        scanLibrary: vi.fn(async () => ({
          scannedFiles: 0,
          added: 0,
          updated: 0,
          missingMarked: 0,
          unsupported: 0,
          errors: []
        })),
        getLibraryTracks: vi.fn(async () => []),
        submitThumb: vi.fn(async () => undefined),
        getNextRecommendation: vi.fn(async () => null),
        recordPlayStart: vi.fn(async () => undefined),
        recordPlayEnd: vi.fn(async () => undefined)
      }
    });

    const playMock = vi.fn(async () => undefined);
    const pauseMock = vi.fn(() => undefined);
    const loadMock = vi.fn(() => undefined);
    Object.defineProperty(HTMLMediaElement.prototype, "play", {
      configurable: true,
      writable: true,
      value: playMock
    });
    Object.defineProperty(HTMLMediaElement.prototype, "pause", {
      configurable: true,
      writable: true,
      value: pauseMock
    });
    Object.defineProperty(HTMLMediaElement.prototype, "load", {
      configurable: true,
      writable: true,
      value: loadMock
    });

    render(<App />);

    await waitFor(() => {
      expect(chooseLibraryFolder).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByText("No folder selected.")).toBeInTheDocument();
  });
});
