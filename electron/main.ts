import * as path from "node:path";
import { app, BrowserWindow, dialog, ipcMain } from "electron";
import { LocalMindDatabase } from "../src/main/db";
import { scanLibraryFolder } from "../src/main/libraryScanner";
import { Recommender } from "../src/main/recommender";
import {
  assertEndedReason,
  assertFolderPath,
  assertPercentPlayed,
  assertRecommendationContext,
  assertThumbValue,
  assertTrackId
} from "../src/main/validators";
import { IPC_CHANNELS } from "../src/shared/ipc";

let mainWindow: BrowserWindow | null = null;
let db: LocalMindDatabase | null = null;
let recommender: Recommender | null = null;

function getRendererIndexPath(): string {
  return path.join(process.cwd(), "dist/renderer/index.html");
}

function createMainWindow(): BrowserWindow {
  const preloadPath = path.join(__dirname, "preload.js");
  const win = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 900,
    minHeight: 620,
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    win.loadURL(devServerUrl);
  } else {
    win.loadFile(getRendererIndexPath());
  }

  return win;
}

function requireDb(): LocalMindDatabase {
  if (!db) {
    throw new Error("Database not initialized");
  }
  return db;
}

function requireRecommender(): Recommender {
  if (!recommender) {
    throw new Error("Recommender not initialized");
  }
  return recommender;
}

function registerIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.chooseLibraryFolder, async () => {
    const localDb = requireDb();
    const defaultPath = localDb.getLastLibraryFolder() ?? undefined;
    const result = await dialog.showOpenDialog({
      title: "Choose Music Folder",
      defaultPath,
      properties: ["openDirectory", "createDirectory"]
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0];
  });

  ipcMain.handle(IPC_CHANNELS.scanLibrary, async (_event, folderPathRaw) => {
    const localDb = requireDb();
    const folderPath = assertFolderPath(folderPathRaw);
    return scanLibraryFolder(localDb, folderPath);
  });

  ipcMain.handle(IPC_CHANNELS.getLibraryTracks, () => {
    const localDb = requireDb();
    return localDb.getLibraryTracks();
  });

  ipcMain.handle(IPC_CHANNELS.submitThumb, (_event, trackIdRaw, valueRaw) => {
    const localDb = requireDb();
    const trackId = assertTrackId(trackIdRaw);
    const thumb = assertThumbValue(valueRaw);
    localDb.submitThumb(trackId, thumb);
  });

  ipcMain.handle(IPC_CHANNELS.getNextRecommendation, (_event, contextRaw) => {
    const localRecommender = requireRecommender();
    const context = assertRecommendationContext(contextRaw);
    return localRecommender.getNextRecommendation(context);
  });

  ipcMain.handle(IPC_CHANNELS.recordPlayStart, (_event, trackIdRaw) => {
    const localDb = requireDb();
    const trackId = assertTrackId(trackIdRaw);
    localDb.recordPlayStart(trackId);
  });

  ipcMain.handle(
    IPC_CHANNELS.recordPlayEnd,
    (_event, trackIdRaw, percentPlayedRaw, endedReasonRaw) => {
      const localDb = requireDb();
      const trackId = assertTrackId(trackIdRaw);
      const percentPlayed = assertPercentPlayed(percentPlayedRaw);
      const endedReason = assertEndedReason(endedReasonRaw);
      localDb.recordPlayEnd(trackId, percentPlayed, endedReason);
    }
  );
}

async function bootstrap(): Promise<void> {
  const dbPath = path.join(app.getPath("userData"), "localmind.sqlite3");
  db = new LocalMindDatabase(dbPath);
  recommender = new Recommender(db);
  registerIpcHandlers();
  mainWindow = createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow();
    }
  });
}

app.whenReady().then(() => {
  bootstrap().catch((error) => {
    console.error("Failed to bootstrap app", error);
    app.quit();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  if (db) {
    db.close();
  }
});
