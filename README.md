# LocalMind

Desktop music player for local files with thumbs up/down recommendations.

## Features

- Electron desktop app with React + TypeScript UI.
- Recursive folder scan for local audio files.
- Metadata extraction (title/artist/album/duration) with filename fallback.
- Core playback controls: play/pause/seek/next/previous.
- Thumbs up/down feedback with Thompson-sampling recommendations.
- Local SQLite persistence for tracks, feedback, and play history.

## Supported formats

- `.mp3`
- `.m4a`
- `.aac`
- `.wav`
- `.ogg`
- `.flac`

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Test

```bash
npm test
```
