import * as path from "node:path";
import { pathToFileURL } from "node:url";
import { app, BrowserWindow, dialog, ipcMain, net, protocol } from "electron";
import { LocalMindDatabase } from "../src/main/db";
import { scanLibraryFolder } from "../src/main/libraryScanner";
import { Recommender } from "../src/main/recommender";
import { resolveRendererIndexPath } from "../src/main/rendererEntryPath";
import {
  assertEndedReason,
  assertFolderPath,
  assertPercentPlayed,
  assertRecommendationContext,
  assertThumbValue,
  assertTrackId
} from "../src/main/validators";
import { IPC_CHANNELS } from "../src/shared/ipc";
import {
  MEDIA_SCHEME,
  parseTrackIdFromMediaUrl
} from "../src/shared/media";

protocol.registerSchemesAsPrivileged([
  {
    scheme: MEDIA_SCHEME,
    privileges: {
      secure: true,
      standard: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true
    }
  }
]);

let mainWindow: BrowserWindow | null = null;
let db: LocalMindDatabase | null = null;
let recommender: Recommender | null = null;

function getRendererIndexPath(): string {
  return resolveRendererIndexPath({
    appPath: app.getAppPath(),
    mainDirname: __dirname,
    cwd: process.cwd()
  });
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

  win.webContents.on("preload-error", (_event, failedPreloadPath, error) => {
    console.error(`Preload script failed: ${failedPreloadPath}`, error);
  });

  win.webContents.on(
    "did-fail-load",
    (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      if (!isMainFrame) {
        return;
      }
      console.error(
        `Renderer load failed (code: ${errorCode}, url: ${validatedURL})`,
        errorDescription
      );
    }
  );

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    void win.loadURL(devServerUrl).catch((error) => {
      console.error(`Failed to load renderer URL: ${devServerUrl}`, error);
    });
  } else {
    const rendererIndexPath = getRendererIndexPath();
    void win.loadFile(rendererIndexPath).catch((error) => {
      console.error(`Failed to load renderer file: ${rendererIndexPath}`, error);
    });
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

function registerMediaProtocolHandler(): void {
  protocol.handle(MEDIA_SCHEME, async (request) => {
    const localDb = requireDb();
    const trackId = parseTrackIdFromMediaUrl(request.url);
    if (!trackId) {
      console.warn(`Invalid media request URL: ${request.url}`);
      return new Response("Not Found", { status: 404 });
    }

    const filePath = localDb.getTrackFilePath(trackId);
    if (!filePath) {
      console.warn(`Media track not found for id: ${trackId}`);
      return new Response("Not Found", { status: 404 });
    }

    const sourceUrl = pathToFileURL(filePath).href;
    try {
      return await net.fetch(sourceUrl, {
        method: request.method,
        headers: request.headers
      });
    } catch (error) {
      console.error(`Failed to fetch media for track ${trackId}`, error);
      return new Response("Internal Server Error", { status: 500 });
    }
  });
}

function registerIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.chooseLibraryFolder, async (event) => {
    const localDb = requireDb();
    const defaultPath = localDb.getLastLibraryFolder() ?? undefined;
    const owner = BrowserWindow.fromWebContents(event.sender) ?? mainWindow ?? undefined;

    try {
      const result = owner
        ? await dialog.showOpenDialog(owner, {
            title: "Choose Music Folder",
            defaultPath,
            properties: ["openDirectory", "createDirectory"]
          })
        : await dialog.showOpenDialog({
            title: "Choose Music Folder",
            defaultPath,
            properties: ["openDirectory", "createDirectory"]
          });

      if (result.canceled || result.filePaths.length === 0) {
        return null;
      }

      return result.filePaths[0];
    } catch (error) {
      console.error("Failed to open folder chooser dialog", error);
      throw new Error("Could not open the folder chooser. Please try again.");
    }
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
  registerMediaProtocolHandler();
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
