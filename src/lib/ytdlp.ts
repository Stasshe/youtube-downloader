import { spawn, type SpawnOptions } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export const PROJECT_ROOT = process.cwd();
export const DOWNLOAD_DIR = path.join(PROJECT_ROOT, ".data", "ytdl");

export function ensureDownloadDir() {
  if (!fs.existsSync(DOWNLOAD_DIR)) {
    fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
  }
}

export function spawnYtDlp(args: string[], options?: SpawnOptions) {
  return spawn("uv", ["run", "yt-dlp", ...args], {
    cwd: PROJECT_ROOT,
    ...options,
  });
}
