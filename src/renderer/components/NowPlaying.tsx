import type { ThumbValue, Track } from "../../shared/types";
import { formatDuration } from "../state/playerStore";

interface NowPlayingProps {
  track: Track | null;
  isPlaying: boolean;
  currentTimeSec: number;
  currentDurationSec: number;
  canGoPrevious: boolean;
  onPlayPause: () => void;
  onSeek: (seconds: number) => void;
  onNext: () => void;
  onPrevious: () => void;
  onThumb: (trackId: string, value: ThumbValue) => void;
}

export function NowPlaying({
  track,
  isPlaying,
  currentTimeSec,
  currentDurationSec,
  canGoPrevious,
  onPlayPause,
  onSeek,
  onNext,
  onPrevious,
  onThumb
}: NowPlayingProps): JSX.Element {
  if (!track) {
    return (
      <section className="now-playing">
        <h2>Now Playing</h2>
        <p>Nothing selected.</p>
      </section>
    );
  }

  const duration = currentDurationSec || track.durationSec || 0;
  const boundedCurrent = Math.max(0, Math.min(duration, currentTimeSec));

  return (
    <section className="now-playing">
      <h2>Now Playing</h2>
      <h3>{track.title}</h3>
      <p>
        {track.artist ?? "Unknown Artist"} {track.album ? `- ${track.album}` : ""}
      </p>

      <div className="timeline">
        <span>{formatDuration(boundedCurrent)}</span>
        <input
          type="range"
          min={0}
          max={Math.max(1, duration)}
          value={Math.min(duration, boundedCurrent)}
          onChange={(event) => onSeek(Number(event.target.value))}
        />
        <span>{formatDuration(duration)}</span>
      </div>

      <div className="player-actions">
        <button type="button" onClick={onPrevious} disabled={!canGoPrevious}>
          Prev
        </button>
        <button type="button" onClick={onPlayPause}>
          {isPlaying ? "Pause" : "Play"}
        </button>
        <button type="button" onClick={onNext}>
          Next
        </button>
      </div>

      <div className="thumb-controls">
        <button
          type="button"
          className={track.thumb === 1 ? "thumb active-up" : "thumb"}
          onClick={() => onThumb(track.id, track.thumb === 1 ? 0 : 1)}
        >
          Thumb Up
        </button>
        <button
          type="button"
          className={track.thumb === -1 ? "thumb active-down" : "thumb"}
          onClick={() => onThumb(track.id, track.thumb === -1 ? 0 : -1)}
        >
          Thumb Down
        </button>
      </div>
    </section>
  );
}
