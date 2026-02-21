import { contextBridge, ipcRenderer } from "electron";
import { IPC_CHANNELS } from "../src/shared/ipc";
import type { LocalMindAPI } from "../src/shared/types";

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

contextBridge.exposeInMainWorld("localMind", api);
