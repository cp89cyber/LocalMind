import type { ThumbValue, Track } from "../../shared/types";
import { formatDuration } from "../state/playerStore";

interface LibraryViewProps {
  tracks: Track[];
  currentTrackId: string | null;
  onPlayTrack: (trackId: string) => void;
  onThumb: (trackId: string, value: ThumbValue) => void;
}

function thumbButtonLabel(value: ThumbValue): string {
  if (value === 1) {
    return "Liked";
  }

  if (value === -1) {
    return "Suppressed";
  }

  return "Unrated";
}

export function LibraryView({
  tracks,
  currentTrackId,
  onPlayTrack,
  onThumb
}: LibraryViewProps): JSX.Element {
  if (tracks.length === 0) {
    return (
      <div className="empty-state">
        <p>No tracks in library yet. Pick a folder and run a scan.</p>
      </div>
    );
  }

  return (
    <div className="library-table">
      <div className="library-header row">
        <span>Track</span>
        <span>Artist</span>
        <span>Album</span>
        <span>Duration</span>
        <span>Thumb</span>
      </div>
      {tracks.map((track) => {
        const isCurrent = track.id === currentTrackId;
        return (
          <div
            key={track.id}
            className={`row track-row${isCurrent ? " current" : ""}`}
          >
            <span>
              <button
                type="button"
                className="track-select"
                onClick={() => onPlayTrack(track.id)}
              >
                {track.title}
              </button>
            </span>
            <span>{track.artist ?? "Unknown"}</span>
            <span>{track.album ?? "-"}</span>
            <span>{formatDuration(track.durationSec)}</span>
            <span className="thumb-cell">
              <button
                type="button"
                className={track.thumb === 1 ? "thumb active-up" : "thumb"}
                onClick={() => onThumb(track.id, track.thumb === 1 ? 0 : 1)}
                title="Thumbs up"
              >
                Up
              </button>
              <button
                type="button"
                className={track.thumb === -1 ? "thumb active-down" : "thumb"}
                onClick={() => onThumb(track.id, track.thumb === -1 ? 0 : -1)}
                title="Thumbs down"
              >
                Down
              </button>
              <span className="thumb-label">{thumbButtonLabel(track.thumb)}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
