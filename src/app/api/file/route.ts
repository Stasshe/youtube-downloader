import fs from "node:fs";
import path from "node:path";
import type { NextRequest } from "next/server";

const DOWNLOAD_DIR = "/tmp/ytdl";

const MIME_TYPES: Record<string, string> = {
  mp4: "video/mp4",
  m4a: "audio/mp4",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  webm: "video/webm",
  mkv: "video/x-matroska",
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const filename = searchParams.get("name");

  if (!filename || filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
    return Response.json({ error: "Invalid filename" }, { status: 400 });
  }

  const filePath = path.join(DOWNLOAD_DIR, filename);

  if (!fs.existsSync(filePath)) {
    return Response.json({ error: "File not found" }, { status: 404 });
  }

  const stat = fs.statSync(filePath);
  const ext = path.extname(filename).slice(1).toLowerCase();
  const contentType = MIME_TYPES[ext] ?? "application/octet-stream";

  // Stream the file
  const fileStream = fs.createReadStream(filePath);
  const webStream = new ReadableStream({
    start(controller) {
      fileStream.on("data", (chunk: Buffer | string) => {
        controller.enqueue(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
      });
      fileStream.on("end", () => {
        controller.close();
        // Clean up after serving
        try {
          fs.unlinkSync(filePath);
        } catch {}
      });
      fileStream.on("error", (err) => {
        controller.error(err);
      });
    },
    cancel() {
      fileStream.destroy();
    },
  });

  return new Response(webStream, {
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(stat.size),
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}
