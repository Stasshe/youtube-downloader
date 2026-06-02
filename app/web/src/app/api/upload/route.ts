import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { ensureDownloadDir, getDownloadDir } from "@/lib/ytdlp";
import type { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  ensureDownloadDir();
  const downloadDir = getDownloadDir();

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return Response.json({ error: "No file provided" }, { status: 400 });
  }

  const ext = path.extname(file.name).toLowerCase() || ".mp3";
  const uuid = randomUUID();
  const filename = `${uuid}${ext}`;
  const filepath = path.join(/*turbopackIgnore: true*/ downloadDir, filename);

  const buffer = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(/*turbopackIgnore: true*/ filepath, buffer);

  return Response.json({ filename, originalName: file.name });
}
