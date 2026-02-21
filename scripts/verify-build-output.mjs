import fs from "node:fs/promises";
import path from "node:path";

const buildIndexPath = path.join(process.cwd(), "dist/renderer/index.html");

async function verifyBuildOutput() {
  let html;
  try {
    html = await fs.readFile(buildIndexPath, "utf8");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Could not read built renderer HTML at ${buildIndexPath}: ${message}`);
  }

  const hasAbsoluteScript = html.includes('src="/assets/');
  const hasAbsoluteStyle = html.includes('href="/assets/');
  const hasRelativeScript = html.includes('src="./assets/');
  const hasRelativeStyle = html.includes('href="./assets/');

  if (hasAbsoluteScript || hasAbsoluteStyle) {
    throw new Error(
      "Build output contains root-absolute asset URLs (/assets/...), which break Electron file:// loading."
    );
  }

  if (!hasRelativeScript || !hasRelativeStyle) {
    throw new Error(
      "Build output is missing expected relative asset URLs (./assets/...) in dist/renderer/index.html."
    );
  }

  console.log(`Build output verified: ${buildIndexPath}`);
}

verifyBuildOutput().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
