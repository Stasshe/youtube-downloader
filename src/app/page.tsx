"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Format = "mp4-high" | "mp4-medium" | "mp4-low" | "m4a" | "mp3" | "wav";

interface VideoInfo {
  title: string;
  thumbnail: string;
  duration: number;
  uploader: string;
}

interface LogEntry {
  id: number;
  text: string;
  kind: "log" | "error" | "complete";
}

const FORMAT_OPTIONS: { id: Format; label: string; ext: string }[] = [
  { id: "mp4-high", label: "MP4 / 最高画質", ext: "mp4" },
  { id: "mp4-medium", label: "MP4 / 720p", ext: "mp4" },
  { id: "mp4-low", label: "MP4 / 480p以下", ext: "mp4" },
  { id: "m4a", label: "M4A", ext: "m4a" },
  { id: "mp3", label: "MP3", ext: "mp3" },
  { id: "wav", label: "WAV", ext: "wav" },
];

function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function Home() {
  const [url, setUrl] = useState("");
  const [format, setFormat] = useState<Format>("mp4-high");
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [infoLoading, setInfoLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [downloadFilename, setDownloadFilename] = useState<string | null>(null);
  const [_hasError, setHasError] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const logCounter = useRef(0);
  const infoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: logRef is a stable ref
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs]);

  const addLog = useCallback((text: string, kind: LogEntry["kind"] = "log") => {
    setLogs((prev) => [...prev, { id: logCounter.current++, text, kind }]);
  }, []);

  const fetchInfo = useCallback(async (inputUrl: string) => {
    setInfoLoading(true);
    setVideoInfo(null);
    try {
      const res = await fetch("/api/info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: inputUrl }),
      });
      if (res.ok) {
        const data = await res.json();
        setVideoInfo(data);
      }
    } catch {
      // silently fail
    }
    setInfoLoading(false);
  }, []);

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setUrl(val);
    setVideoInfo(null);
    setDownloadFilename(null);
    setLogs([]);
    setHasError(false);

    if (infoTimer.current) clearTimeout(infoTimer.current);

    const isYt = val.includes("youtube.com/") || val.includes("youtu.be/");
    if (isYt && val.length > 15) {
      infoTimer.current = setTimeout(() => fetchInfo(val), 600);
    }
  };

  const handleDownload = async () => {
    if (!url.trim() || downloading) return;

    setDownloading(true);
    setLogs([]);
    setDownloadFilename(null);
    setHasError(false);

    try {
      const res = await fetch("/api/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), format }),
      });

      if (!res.body) {
        addLog("No response body", "error");
        setHasError(true);
        setDownloading(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === "log") {
              addLog(data.text);
            } else if (data.type === "complete") {
              addLog(`✓ ${data.filename}`, "complete");
              setDownloadFilename(data.filename);
            } else if (data.type === "error") {
              addLog(data.message, "error");
              setHasError(true);
            }
          } catch {
            // ignore parse error
          }
        }
      }
    } catch (err) {
      addLog(String(err), "error");
      setHasError(true);
    }

    setDownloading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleDownload();
  };

  const isYouTubeUrl = url.includes("youtube.com/") || url.includes("youtu.be/");

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-start",
        padding: "48px 24px 80px",
      }}
    >
      <div style={{ width: "100%", maxWidth: "680px" }}>
        {/* Header */}
        <header style={{ marginBottom: "48px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: "12px",
              marginBottom: "4px",
            }}
          >
            <h1
              style={{
                fontFamily: "'Syne Mono', monospace",
                fontSize: "28px",
                fontWeight: 400,
                color: "var(--accent)",
                letterSpacing: "0.02em",
              }}
            >
              yt-dlp
            </h1>
            <span
              style={{
                fontSize: "12px",
                color: "var(--muted)",
                letterSpacing: "0.08em",
              }}
            >
              downloader
            </span>
          </div>
          <div
            style={{
              width: "100%",
              height: "1px",
              background: "var(--border)",
            }}
          />
        </header>

        {/* URL Input */}
        <section style={{ marginBottom: "32px" }}>
          <label
            htmlFor="url-input"
            style={{
              display: "block",
              fontSize: "11px",
              color: "var(--muted)",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              marginBottom: "8px",
            }}
          >
            URL
          </label>
          <div style={{ position: "relative" }}>
            <input
              id="url-input"
              type="text"
              value={url}
              onChange={handleUrlChange}
              onKeyDown={handleKeyDown}
              placeholder="https://www.youtube.com/watch?v=..."
              disabled={downloading}
              style={{
                width: "100%",
                background: "var(--surface)",
                border: "1px solid var(--border2)",
                color: "var(--text)",
                padding: "12px 16px",
                fontSize: "13px",
                fontFamily: "'DM Mono', monospace",
                outline: "none",
                transition: "border-color 0.15s",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "var(--accent-dim)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "var(--border2)";
              }}
            />
          </div>
        </section>

        {/* Video Info Preview */}
        {(infoLoading || videoInfo) && isYouTubeUrl && (
          <section
            style={{
              marginBottom: "32px",
              padding: "14px 16px",
              background: "var(--surface)",
              border: "1px solid var(--border)",
              display: "flex",
              gap: "14px",
              alignItems: "center",
            }}
            className="animate-slide-up"
          >
            {infoLoading && !videoInfo ? (
              <>
                <div
                  style={{
                    width: "80px",
                    height: "45px",
                    background: "var(--surface2)",
                    flexShrink: 0,
                  }}
                />
                <div>
                  <div
                    style={{
                      width: "200px",
                      height: "12px",
                      background: "var(--surface2)",
                      marginBottom: "6px",
                    }}
                  />
                  <div
                    style={{
                      width: "100px",
                      height: "10px",
                      background: "var(--surface2)",
                    }}
                  />
                </div>
              </>
            ) : videoInfo ? (
              <>
                {videoInfo.thumbnail && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={videoInfo.thumbnail}
                    alt=""
                    style={{
                      width: "80px",
                      height: "45px",
                      objectFit: "cover",
                      flexShrink: 0,
                    }}
                  />
                )}
                <div style={{ overflow: "hidden" }}>
                  <div
                    style={{
                      fontSize: "13px",
                      color: "var(--text)",
                      marginBottom: "4px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {videoInfo.title}
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--muted)" }}>
                    {videoInfo.uploader}
                    {videoInfo.duration ? ` · ${formatDuration(videoInfo.duration)}` : ""}
                  </div>
                </div>
              </>
            ) : null}
          </section>
        )}

        {/* Format Selector */}
        <section style={{ marginBottom: "32px" }}>
          <p
            style={{
              display: "block",
              fontSize: "11px",
              color: "var(--muted)",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              marginBottom: "10px",
            }}
          >
            Format
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "1px",
              background: "var(--border)",
            }}
          >
            {FORMAT_OPTIONS.map((opt) => {
              const selected = format === opt.id;
              return (
                <button
                  type="button"
                  key={opt.id}
                  onClick={() => setFormat(opt.id)}
                  disabled={downloading}
                  style={{
                    background: selected ? "var(--surface2)" : "var(--surface)",
                    border: "none",
                    color: selected ? "var(--accent)" : "var(--muted2)",
                    padding: "10px 8px",
                    fontSize: "12px",
                    fontFamily: "'DM Mono', monospace",
                    cursor: downloading ? "not-allowed" : "pointer",
                    textAlign: "left",
                    transition: "color 0.1s, background 0.1s",
                    letterSpacing: "0.02em",
                    borderLeft: selected ? "2px solid var(--accent)" : "2px solid transparent",
                  }}
                  onMouseEnter={(e) => {
                    if (!selected && !downloading) {
                      e.currentTarget.style.color = "var(--text)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!selected) {
                      e.currentTarget.style.color = "var(--muted2)";
                    }
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </section>

        {/* Download Button */}
        <section style={{ marginBottom: "32px" }}>
          <button
            type="button"
            onClick={handleDownload}
            disabled={!url.trim() || downloading}
            style={{
              width: "100%",
              padding: "14px",
              background: !url.trim() || downloading ? "var(--surface2)" : "var(--accent)",
              border: "none",
              color: !url.trim() || downloading ? "var(--muted)" : "var(--bg)",
              fontSize: "13px",
              fontFamily: "'Syne Mono', monospace",
              letterSpacing: "0.1em",
              cursor: !url.trim() || downloading ? "not-allowed" : "pointer",
              transition: "background 0.15s, color 0.15s",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "10px",
            }}
            onMouseEnter={(e) => {
              if (url.trim() && !downloading) {
                e.currentTarget.style.background = "#e0a845";
              }
            }}
            onMouseLeave={(e) => {
              if (url.trim() && !downloading) {
                e.currentTarget.style.background = "var(--accent)";
              }
            }}
          >
            {downloading ? (
              <>
                <svg
                  aria-hidden="true"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="animate-spin-slow"
                >
                  <path d="M21 12a9 9 0 11-6.219-8.56" />
                </svg>
                DOWNLOADING...
              </>
            ) : (
              "DOWNLOAD"
            )}
          </button>
        </section>

        {/* Log Output */}
        {logs.length > 0 && (
          <section className="animate-slide-up">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "8px",
              }}
            >
              <span
                style={{
                  fontSize: "11px",
                  color: "var(--muted)",
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                }}
              >
                Output
              </span>
              <div
                style={{
                  flex: 1,
                  height: "1px",
                  background: "var(--border)",
                }}
              />
              {downloading && (
                <span
                  style={{
                    width: "6px",
                    height: "6px",
                    borderRadius: "50%",
                    background: "var(--accent)",
                    display: "inline-block",
                  }}
                  className="animate-blink"
                />
              )}
            </div>
            <div
              ref={logRef}
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                padding: "14px 16px",
                height: "240px",
                overflowY: "auto",
                fontSize: "11px",
                lineHeight: "1.7",
                fontFamily: "'DM Mono', monospace",
              }}
            >
              {logs.map((entry) => (
                <div
                  key={entry.id}
                  style={{
                    color:
                      entry.kind === "error"
                        ? "var(--error)"
                        : entry.kind === "complete"
                          ? "var(--success)"
                          : "var(--muted2)",
                    wordBreak: "break-all",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {entry.text}
                </div>
              ))}
              {downloading && (
                <span
                  style={{
                    color: "var(--accent)",
                  }}
                  className="animate-blink"
                >
                  _
                </span>
              )}
            </div>
          </section>
        )}

        {/* Save Button */}
        {downloadFilename && (
          <section style={{ marginTop: "12px" }} className="animate-slide-up">
            <a
              href={`/api/file?name=${encodeURIComponent(downloadFilename)}`}
              download={downloadFilename}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "10px",
                padding: "12px",
                background: "transparent",
                border: "1px solid var(--success)",
                color: "var(--success)",
                fontSize: "13px",
                fontFamily: "'Syne Mono', monospace",
                letterSpacing: "0.1em",
                textDecoration: "none",
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(90,140,90,0.1)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
            >
              <svg
                aria-hidden="true"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              SAVE — {downloadFilename}
            </a>
          </section>
        )}

        {/* Footer */}
        <footer
          style={{
            marginTop: "80px",
            fontSize: "11px",
            color: "var(--muted)",
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <span>yt-dlp required</span>
          <span style={{ fontFamily: "'DM Mono', monospace" }}>pip install yt-dlp</span>
        </footer>
      </div>
    </main>
  );
}
