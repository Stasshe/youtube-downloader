import { spawn, type SpawnOptions } from "node:child_process";
import fs from "node:fs";

const PROJECT_ROOT_ENV = "YTDL_PROJECT_ROOT";
const DOWNLOAD_DIR_ENV = "YTDL_DOWNLOAD_DIR";

function getProjectRoot() {
  return process.env[PROJECT_ROOT_ENV] ?? ".";
}

export function getDownloadDir() {
  return process.env[DOWNLOAD_DIR_ENV] ?? ".data/ytdl";
}

export function ensureDownloadDir() {
  const downloadDir = getDownloadDir();
  if (!fs.existsSync(/*turbopackIgnore: true*/ downloadDir)) {
    fs.mkdirSync(/*turbopackIgnore: true*/ downloadDir, { recursive: true });
  }
}

export function spawnYtDlp(args: string[], options?: SpawnOptions) {
  return spawn("uv", ["run", "yt-dlp", ...args], {
    cwd: getProjectRoot(),
    ...options,
  });
}
