import { spawn } from "node:child_process";
import type { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const { url } = await req.json();

  if (!url) {
    return Response.json({ error: "URL required" }, { status: 400 });
  }

  return new Promise<Response>((resolve) => {
    const proc = spawn("yt-dlp", ["--dump-json", "--no-playlist", "--no-warnings", url]);

    let output = "";
    let errorOutput = "";

    proc.stdout.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });

    proc.stderr.on("data", (chunk: Buffer) => {
      errorOutput += chunk.toString();
    });

    proc.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "ENOENT") {
        resolve(
          Response.json(
            { error: "yt-dlp not found. Install: pip install yt-dlp" },
            { status: 500 },
          ),
        );
      } else {
        resolve(Response.json({ error: err.message }, { status: 500 }));
      }
    });

    proc.on("close", (code: number | null) => {
      if (code !== 0) {
        resolve(
          Response.json({ error: errorOutput || "Failed to fetch video info" }, { status: 500 }),
        );
        return;
      }
      try {
        const info = JSON.parse(output);
        resolve(
          Response.json({
            title: info.title,
            thumbnail: info.thumbnail,
            duration: info.duration,
            uploader: info.uploader,
            view_count: info.view_count,
          }),
        );
      } catch {
        resolve(Response.json({ error: "Failed to parse info" }, { status: 500 }));
      }
    });
  });
}
