import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { NextRequest } from "next/server";

const DOWNLOAD_DIR = "/tmp/ytdl";

const ALLOWED_BITRATES = new Set(["64k", "128k", "192k", "256k", "320k"]);
const ALLOWED_EXT = new Set([".mp3", ".m4a", ".aac", ".flac", ".ogg", ".opus", ".wav"]);

function safeFilename(name: string): string | null {
  const base = path.basename(name);
  if (base !== name || !/^[a-zA-Z0-9\-_.]+$/.test(base)) return null;
  return base;
}

export async function POST(req: NextRequest) {
  const { filename, bitrate } = await req.json();

  const safe = safeFilename(filename);
  if (!safe) {
    return Response.json({ error: "Invalid filename" }, { status: 400 });
  }

  if (!ALLOWED_BITRATES.has(bitrate)) {
    return Response.json({ error: "Invalid bitrate" }, { status: 400 });
  }

  const inputPath = path.join(DOWNLOAD_DIR, safe);
  if (!fs.existsSync(inputPath)) {
    return Response.json({ error: "File not found" }, { status: 404 });
  }

  const inputExt = path.extname(safe).toLowerCase();
  const outputExt = ALLOWED_EXT.has(inputExt) && inputExt !== ".wav" ? inputExt : ".mp3";
  const outputFilename = `${randomUUID()}${outputExt}`;
  const outputPath = path.join(DOWNLOAD_DIR, outputFilename);

  const ffmpegArgs = ["-i", inputPath, "-b:a", bitrate, "-y", outputPath];

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const send = (data: Record<string, unknown>) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          // Controller already closed
        }
      };

      const proc = spawn("ffmpeg", ffmpegArgs);

      proc.stdout.on("data", (chunk: Buffer) => {
        const text = chunk.toString().trim();
        if (text) send({ type: "log", text });
      });

      proc.stderr.on("data", (chunk: Buffer) => {
        const text = chunk.toString().trim();
        if (text) send({ type: "log", text });
      });

      proc.on("error", (err: NodeJS.ErrnoException) => {
        if (err.code === "ENOENT") {
          send({ type: "error", message: "ffmpeg not installed. Run: apt install ffmpeg" });
        } else {
          send({ type: "error", message: err.message });
        }
        controller.close();
      });

      proc.on("close", (code: number | null) => {
        if (code === 0) {
          send({ type: "complete", filename: outputFilename });
        } else {
          send({ type: "error", message: `ffmpeg exited with code ${code}` });
        }
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
}
