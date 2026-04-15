import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { NextRequest } from "next/server";

const DOWNLOAD_DIR = "/tmp/ytdl";

function ensureDir() {
  if (!fs.existsSync(DOWNLOAD_DIR)) {
    fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
  }
}

export async function POST(req: NextRequest) {
  ensureDir();

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return Response.json({ error: "No file provided" }, { status: 400 });
  }

  const ext = path.extname(file.name).toLowerCase() || ".mp3";
  const uuid = randomUUID();
  const filename = `${uuid}${ext}`;
  const filepath = path.join(DOWNLOAD_DIR, filename);

  const buffer = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(filepath, buffer);

  return Response.json({ filename, originalName: file.name });
}
