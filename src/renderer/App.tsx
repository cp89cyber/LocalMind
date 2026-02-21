import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  EndedReason,
  LocalMindAPI,
  ScanResult,
  ThumbValue,
  Track
} from "../shared/types";
import { LibraryView } from "./components/LibraryView";
import { NowPlaying } from "./components/NowPlaying";
import {
  appendHistory,
  findTrackById,
  previousTrackId,
  toAudioUrl
} from "./state/playerStore";

function getPercentPlayed(audio: HTMLAudioElement): number {
  if (!audio.duration || Number.isNaN(audio.duration) || !Number.isFinite(audio.duration)) {
    return 0;
  }

  const ratio = (audio.currentTime / audio.duration) * 100;
  return Math.max(0, Math.min(100, ratio));
}

function summarizeScan(result: ScanResult): string {
  return `Scan done: ${result.added} added, ${result.updated} updated, ${result.missingMarked} missing, ${result.unsupported} unsupported`;
}

function getLocalMindApi(): LocalMindAPI {
  const localMind = (window as Window & { localMind?: LocalMindAPI }).localMind;
  if (!localMind) {
    throw new Error(
      "Desktop API bridge is unavailable. Open the Electron app window (not the browser tab) and restart `npm run dev`."
    );
  }
  return localMind;
}

export default function App(): JSX.Element {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentTrackId, setCurrentTrackId] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTimeSec, setCurrentTimeSec] = useState(0);
  const [currentDurationSec, setCurrentDurationSec] = useState(0);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [folderPath, setFolderPath] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isChoosingFolder, setIsChoosingFolder] = useState(false);
  const [hasLoadedLibrary, setHasLoadedLibrary] = useState(false);
  const [didAutoPromptFolder, setDidAutoPromptFolder] = useState(false);

  const audioRef = useRef<HTMLAudioElement>(null);
  const currentTrackIdRef = useRef<string | null>(null);
  const historyRef = useRef<string[]>([]);
  const activeStartedTrackRef = useRef<string | null>(null);

  useEffect(() => {
    currentTrackIdRef.current = currentTrackId;
  }, [currentTrackId]);

  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  const currentTrack = useMemo(
    () => findTrackById(tracks, currentTrackId),
    [tracks, currentTrackId]
  );

  const refreshLibrary = useCallback(async () => {
    const nextTracks = await getLocalMindApi().getLibraryTracks();
    setTracks(nextTracks);
    setHasLoadedLibrary(true);

    setCurrentTrackId((prev) => {
      if (!prev) {
        return nextTracks[0]?.id ?? null;
      }

      const stillExists = nextTracks.some((track) => track.id === prev);
      if (stillExists) {
        return prev;
      }

      return nextTracks[0]?.id ?? null;
    });
  }, []);

  const endCurrentTrack = useCallback(async (reason: EndedReason) => {
    const audio = audioRef.current;
    const trackId = currentTrackIdRef.current;
    if (!audio || !trackId) {
      return;
    }

    try {
      await getLocalMindApi().recordPlayEnd(trackId, getPercentPlayed(audio), reason);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatusMessage(`Failed to record play end: ${message}`);
    } finally {
      activeStartedTrackRef.current = null;
    }
  }, []);

  const startTrack = useCallback(
    async (trackId: string, autoPlay: boolean) => {
      const audio = audioRef.current;
      if (!audio) {
        return;
      }

      if (trackId === currentTrackIdRef.current) {
        if (autoPlay) {
          void audio.play().catch((error) => {
            const message = error instanceof Error ? error.message : String(error);
            setStatusMessage(`Playback error: ${message}`);
          });
        }
        return;
      }

      if (currentTrackIdRef.current) {
        await endCurrentTrack("skipped");
      }

      setCurrentTrackId(trackId);
      setHistory((prev) => appendHistory(prev, trackId));
      setCurrentTimeSec(0);
      setCurrentDurationSec(0);
      setStatusMessage(null);
      setIsPlaying(autoPlay);
    },
    [endCurrentTrack]
  );

  const playRecommended = useCallback(async () => {
    const recommendation = await getLocalMindApi().getNextRecommendation({
      currentTrackId: currentTrackIdRef.current,
      recentTrackIds: historyRef.current
    });

    if (!recommendation) {
      setStatusMessage("No recommendable tracks available. All tracks may be suppressed.");
      setIsPlaying(false);
      return;
    }

    await startTrack(recommendation.trackId, true);
  }, [startTrack]);

  const handleChooseFolderAndScan = useCallback(async () => {
    setIsChoosingFolder(true);
    let selectedFolder: string | null = null;
    try {
      selectedFolder = await getLocalMindApi().chooseLibraryFolder();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatusMessage(`Failed to open folder chooser: ${message}`);
      return;
    } finally {
      setIsChoosingFolder(false);
    }

    if (!selectedFolder) {
      if (!hasLoadedLibrary || tracks.length === 0) {
        setStatusMessage("No folder selected.");
      }
      return;
    }

    setFolderPath(selectedFolder);
    setIsScanning(true);
    setStatusMessage("Scanning library...");
    try {
      const result = await getLocalMindApi().scanLibrary(selectedFolder);
      setScanResult(result);
      setStatusMessage(summarizeScan(result));
      await refreshLibrary();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatusMessage(`Scan failed: ${message}`);
    } finally {
      setIsScanning(false);
    }
  }, [hasLoadedLibrary, refreshLibrary, tracks.length]);

  const handleRescan = useCallback(async () => {
    if (!folderPath) {
      await handleChooseFolderAndScan();
      return;
    }

    setIsScanning(true);
    setStatusMessage("Scanning library...");
    try {
      const result = await getLocalMindApi().scanLibrary(folderPath);
      setScanResult(result);
      setStatusMessage(summarizeScan(result));
      await refreshLibrary();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatusMessage(`Scan failed: ${message}`);
    } finally {
      setIsScanning(false);
    }
  }, [folderPath, handleChooseFolderAndScan, refreshLibrary]);

  const handlePlayPause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrackIdRef.current) {
      return;
    }

    if (audio.paused) {
      void audio.play().catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        setStatusMessage(`Playback error: ${message}`);
      });
    } else {
      audio.pause();
    }
  }, []);

  const handleNext = useCallback(async () => {
    await endCurrentTrack("skipped");
    await playRecommended();
  }, [endCurrentTrack, playRecommended]);

  const handlePrevious = useCallback(async () => {
    const prevTrackId = previousTrackId(historyRef.current, currentTrackIdRef.current);
    if (!prevTrackId) {
      return;
    }

    await startTrack(prevTrackId, true);
  }, [startTrack]);

  const handleThumb = useCallback(
    async (trackId: string, value: ThumbValue) => {
      await getLocalMindApi().submitThumb(trackId, value);

      setTracks((prev) =>
        prev.map((track) => {
          if (track.id !== trackId) {
            return track;
          }
          return {
            ...track,
            thumb: value,
            hardSuppressed: value === -1
          };
        })
      );

      if (trackId === currentTrackIdRef.current && value === -1) {
        await endCurrentTrack("skipped");
        await playRecommended();
      }
    },
    [endCurrentTrack, playRecommended]
  );

  useEffect(() => {
    void refreshLibrary().catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      setStatusMessage(`Failed to load library: ${message}`);
      setHasLoadedLibrary(true);
    });
  }, [refreshLibrary]);

  useEffect(() => {
    if (!hasLoadedLibrary || didAutoPromptFolder || tracks.length > 0) {
      return;
    }

    setDidAutoPromptFolder(true);
    void handleChooseFolderAndScan();
  }, [didAutoPromptFolder, handleChooseFolderAndScan, hasLoadedLibrary, tracks.length]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    if (!currentTrack) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      setIsPlaying(false);
      return;
    }

    audio.src = toAudioUrl(currentTrack.filePath);
    audio.currentTime = 0;
    setCurrentTimeSec(0);
    setCurrentDurationSec(currentTrack.durationSec ?? 0);
    activeStartedTrackRef.current = null;
  }, [currentTrack]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrackId) {
      return;
    }

    if (isPlaying) {
      void audio.play().catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        setStatusMessage(`Playback error: ${message}`);
      });
      return;
    }

    audio.pause();
  }, [currentTrackId, isPlaying]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    const handleTimeUpdate = () => {
      setCurrentTimeSec(audio.currentTime || 0);
    };

    const handleLoadedMetadata = () => {
      setCurrentDurationSec(audio.duration || 0);
    };

    const handlePlay = () => {
      setIsPlaying(true);
      const trackId = currentTrackIdRef.current;
      if (!trackId) {
        return;
      }

      if (activeStartedTrackRef.current === trackId) {
        return;
      }

      activeStartedTrackRef.current = trackId;
      try {
        void getLocalMindApi()
          .recordPlayStart(trackId)
          .catch((error) => {
            const message = error instanceof Error ? error.message : String(error);
            setStatusMessage(`Failed to record play start: ${message}`);
          });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setStatusMessage(`Failed to record play start: ${message}`);
      }
    };

    const handlePause = () => {
      setIsPlaying(false);
    };

    const handleEnded = () => {
      void (async () => {
        await endCurrentTrack("ended");
        await playRecommended();
      })();
    };

    const handleError = () => {
      void (async () => {
        await endCurrentTrack("error");
        await playRecommended();
      })();
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("error", handleError);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("error", handleError);
    };
  }, [endCurrentTrack, playRecommended]);

  return (
    <div className="app-shell">
      <header>
        <h1>LocalMind</h1>
        <div className="toolbar">
          <button
            type="button"
            onClick={() => void handleChooseFolderAndScan()}
            disabled={isChoosingFolder || isScanning}
          >
            Choose Folder
          </button>
          <button
            type="button"
            onClick={() => void handleRescan()}
            disabled={isScanning || isChoosingFolder}
          >
            {isScanning ? "Scanning..." : "Rescan"}
          </button>
        </div>
        {folderPath ? <p className="folder-path">Folder: {folderPath}</p> : null}
        {statusMessage ? <p className="status">{statusMessage}</p> : null}
        {scanResult?.errors.length ? (
          <details className="scan-errors">
            <summary>{scanResult.errors.length} scan errors</summary>
            <ul>
              {scanResult.errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </details>
        ) : null}
      </header>

      <main>
        <NowPlaying
          track={currentTrack}
          isPlaying={isPlaying}
          currentTimeSec={currentTimeSec}
          currentDurationSec={currentDurationSec}
          canGoPrevious={Boolean(previousTrackId(history, currentTrackId))}
          onPlayPause={handlePlayPause}
          onSeek={(seconds) => {
            if (audioRef.current) {
              audioRef.current.currentTime = seconds;
              setCurrentTimeSec(seconds);
            }
          }}
          onNext={() => void handleNext()}
          onPrevious={() => void handlePrevious()}
          onThumb={(trackId, value) => void handleThumb(trackId, value)}
        />
        <LibraryView
          tracks={tracks}
          currentTrackId={currentTrackId}
          onPlayTrack={(trackId) => void startTrack(trackId, true)}
          onThumb={(trackId, value) => void handleThumb(trackId, value)}
        />
      </main>

      <audio ref={audioRef} preload="metadata" />
    </div>
  );
}
