import { contextBridge, ipcRenderer } from "electron";
import type { LocalMindAPI } from "../src/shared/types";

const IPC_CHANNELS = {
  chooseLibraryFolder: "localmind:chooseLibraryFolder",
  scanLibrary: "localmind:scanLibrary",
  getLibraryTracks: "localmind:getLibraryTracks",
  submitThumb: "localmind:submitThumb",
  getNextRecommendation: "localmind:getNextRecommendation",
  recordPlayStart: "localmind:recordPlayStart",
  recordPlayEnd: "localmind:recordPlayEnd"
} as const;

const api: LocalMindAPI = {
  chooseLibraryFolder() {
    return ipcRenderer.invoke(IPC_CHANNELS.chooseLibraryFolder);
  },
  scanLibrary(folderPath) {
    return ipcRenderer.invoke(IPC_CHANNELS.scanLibrary, folderPath);
  },
  getLibraryTracks() {
    return ipcRenderer.invoke(IPC_CHANNELS.getLibraryTracks);
  },
  submitThumb(trackId, value) {
    return ipcRenderer.invoke(IPC_CHANNELS.submitThumb, trackId, value);
  },
  getNextRecommendation(ctx) {
    return ipcRenderer.invoke(IPC_CHANNELS.getNextRecommendation, ctx);
  },
  recordPlayStart(trackId) {
    return ipcRenderer.invoke(IPC_CHANNELS.recordPlayStart, trackId);
  },
  recordPlayEnd(trackId, percentPlayed, endedReason) {
    return ipcRenderer.invoke(
      IPC_CHANNELS.recordPlayEnd,
      trackId,
      percentPlayed,
      endedReason
    );
  }
};

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld("localMind", api);
} else {
  (globalThis as { localMind?: LocalMindAPI }).localMind = api;
}
