import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { ensureDownloadDir, getDownloadDir, spawnYtDlp } from "@/lib/ytdlp";
import type { NextRequest } from "next/server";

function buildArgs(
  format: string,
  outputTemplate: string,
  url: string,
  bitrate?: string,
  sampleRate?: string,
): string[] {
  const base = ["--no-playlist", "-o", outputTemplate, "--newline"];
  const sr = sampleRate ? ["--postprocessor-args", `ffmpeg:-ar ${sampleRate}`] : [];

  switch (format) {
    case "mp4-high":
      return [
        ...base,
        "-f",
        "bestvideo+bestaudio/best",
        "--merge-output-format",
        "mp4",
        ...sr,
        url,
      ];
    case "mp4-medium":
      return [
        ...base,
        "-f",
        "bestvideo[height<=720]+bestaudio/best[height<=720]",
        "--merge-output-format",
        "mp4",
        ...sr,
        url,
      ];
    case "mp4-low":
      return [
        ...base,
        "-f",
        "bestvideo[height<=480]+bestaudio/best[height<=480]",
        "--merge-output-format",
        "mp4",
        ...sr,
        url,
      ];
    case "m4a": {
      const q = bitrate ? ["--audio-quality", bitrate] : [];
      return [
        ...base,
        "-f",
        "bestaudio[ext=m4a]/bestaudio",
        "--extract-audio",
        "--audio-format",
        "m4a",
        ...q,
        ...sr,
        url,
      ];
    }
    case "mp3": {
      const q = ["--audio-quality", bitrate || "0"];
      return [...base, "-f", "bestaudio", "-x", "--audio-format", "mp3", ...q, ...sr, url];
    }
    case "wav":
      return [...base, "-f", "bestaudio", "-x", "--audio-format", "wav", ...sr, url];
    default:
      return [...base, "-f", "best", url];
  }
}

export async function POST(req: NextRequest) {
  const { url, format, bitrate, sampleRate } = await req.json();

  if (!url) {
    return Response.json({ error: "URL required" }, { status: 400 });
  }

  ensureDownloadDir();
  const downloadDir = getDownloadDir();

  const uuid = randomUUID();
  const outputTemplate = path.join(/*turbopackIgnore: true*/ downloadDir, `${uuid}.%(ext)s`);
  const args = buildArgs(format ?? "mp4-high", outputTemplate, url, bitrate, sampleRate);

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

      const proc = spawnYtDlp(args);

      if (proc.stdout) {
        proc.stdout.on("data", (chunk: Buffer) => {
          const text = chunk.toString().trim();
          if (text) send({ type: "log", text });
        });
      }

      if (proc.stderr) {
        proc.stderr.on("data", (chunk: Buffer) => {
          const text = chunk.toString().trim();
          if (text) send({ type: "log", text });
        });
      }

      proc.on("error", (err: NodeJS.ErrnoException) => {
        if (err.code === "ENOENT") {
          send({
            type: "error",
            message: "yt-dlp not installed. Run: uv sync",
          });
        } else {
          send({ type: "error", message: err.message });
        }
        controller.close();
      });

      proc.on("close", (code: number | null) => {
        if (code === 0) {
          const files = fs
            .readdirSync(/*turbopackIgnore: true*/ downloadDir)
            .filter((f) => f.startsWith(uuid));
          if (files.length > 0) {
            send({ type: "complete", filename: files[0] });
          } else {
            send({ type: "error", message: "Output file not found" });
          }
        } else {
          send({ type: "error", message: `yt-dlp exited with code ${code}` });
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
