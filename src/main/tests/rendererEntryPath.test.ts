import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveRendererIndexPath } from "../rendererEntryPath";

describe("resolveRendererIndexPath", () => {
  const appPath = "/app/root";
  const mainDirname = "/app/root/dist-electron/electron";
  const cwd = "/workspace/localmind";

  const appPathCandidate = path.join(appPath, "dist/renderer/index.html");
  const mainDirCandidate = path.resolve(mainDirname, "../../dist/renderer/index.html");
  const cwdCandidate = path.join(cwd, "dist/renderer/index.html");

  it("returns appPath candidate when present", () => {
    const result = resolveRendererIndexPath({
      appPath,
      mainDirname,
      cwd,
      exists: (candidate) => candidate === appPathCandidate
    });

    expect(result).toBe(appPathCandidate);
  });

  it("falls back to mainDirname candidate when appPath candidate is missing", () => {
    const result = resolveRendererIndexPath({
      appPath,
      mainDirname,
      cwd,
      exists: (candidate) => candidate === mainDirCandidate
    });

    expect(result).toBe(mainDirCandidate);
  });

  it("falls back to cwd candidate when the first two are missing", () => {
    const result = resolveRendererIndexPath({
      appPath,
      mainDirname,
      cwd,
      exists: (candidate) => candidate === cwdCandidate
    });

    expect(result).toBe(cwdCandidate);
  });

  it("throws a descriptive error with checked paths when no candidate exists", () => {
    const checked: string[] = [];

    expect(() =>
      resolveRendererIndexPath({
        appPath,
        mainDirname,
        cwd,
        exists: (candidate) => {
          checked.push(candidate);
          return false;
        }
      })
    ).toThrow(
      `Renderer index file not found. Checked paths:\n- ${appPathCandidate}\n- ${mainDirCandidate}\n- ${cwdCandidate}`
    );

    expect(checked).toEqual([appPathCandidate, mainDirCandidate, cwdCandidate]);
  });
});
