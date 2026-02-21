import * as fs from "node:fs";
import * as path from "node:path";

type ExistsFn = (candidate: string) => boolean;

export interface ResolveRendererIndexPathOptions {
  appPath: string;
  mainDirname: string;
  cwd: string;
  exists?: ExistsFn;
}

export function resolveRendererIndexPath({
  appPath,
  mainDirname,
  cwd,
  exists = fs.existsSync
}: ResolveRendererIndexPathOptions): string {
  const candidates = [
    path.join(appPath, "dist/renderer/index.html"),
    path.resolve(mainDirname, "../../dist/renderer/index.html"),
    path.join(cwd, "dist/renderer/index.html")
  ];

  for (const candidate of candidates) {
    if (exists(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    `Renderer index file not found. Checked paths:\n${candidates
      .map((candidate) => `- ${candidate}`)
      .join("\n")}`
  );
}
