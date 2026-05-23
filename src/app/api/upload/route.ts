import { DOWNLOAD_DIR, ensureDownloadDir } from "@/lib/ytdlp";
import type { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export async function POST(req: NextRequest) {
  ensureDownloadDir();

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
