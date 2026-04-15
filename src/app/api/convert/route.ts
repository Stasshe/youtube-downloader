import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { NextRequest } from "next/server";

const DOWNLOAD_DIR = "/tmp/ytdl";

const ALLOWED_BITRATES = new Set(["64k", "128k", "192k", "256k", "320k"]);
const ALLOWED_SAMPLE_RATES = new Set(["22050", "44100", "48000", "96000"]);
const ALLOWED_FORMATS = new Set(["mp3", "m4a", "aac", "flac", "ogg", "opus", "wav"]);

function safeFilename(name: string): string | null {
  const base = path.basename(name);
  if (base !== name || !/^[a-zA-Z0-9\-_.]+$/.test(base)) return null;
  return base;
}

export async function POST(req: NextRequest) {
  const { filename, bitrate, sampleRate, outputFormat } = await req.json();

  const safe = safeFilename(filename);
  if (!safe) {
    return Response.json({ error: "Invalid filename" }, { status: 400 });
  }

  const resolvedFormat: string = (() => {
    if (outputFormat && ALLOWED_FORMATS.has(outputFormat)) return outputFormat;
    const inputExt = path.extname(safe).toLowerCase().slice(1);
    return ALLOWED_FORMATS.has(inputExt) ? inputExt : "mp3";
  })();

  const isWav = resolvedFormat === "wav";

  if (!isWav && !ALLOWED_BITRATES.has(bitrate)) {
    return Response.json({ error: "Invalid bitrate" }, { status: 400 });
  }

  if (sampleRate && !ALLOWED_SAMPLE_RATES.has(sampleRate)) {
    return Response.json({ error: "Invalid sample rate" }, { status: 400 });
  }

  const inputPath = path.join(DOWNLOAD_DIR, safe);
  if (!fs.existsSync(inputPath)) {
    return Response.json({ error: "File not found" }, { status: 404 });
  }

  const outputFilename = `${randomUUID()}.${resolvedFormat}`;
  const outputPath = path.join(DOWNLOAD_DIR, outputFilename);

  const arArgs = sampleRate ? ["-ar", sampleRate] : [];
  // WAV = PCM lossless: force pcm_s16le for proper header, skip bitrate
  const codecArgs = isWav ? ["-c:a", "pcm_s16le"] : ["-b:a", bitrate];
  const ffmpegArgs = ["-i", inputPath, ...codecArgs, ...arArgs, "-y", outputPath];

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
