"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Format = "mp4-high" | "mp4-medium" | "mp4-low" | "m4a" | "mp3" | "wav";
type Mode = "download" | "convert";

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

const DOWNLOAD_BITRATE_OPTIONS = [
  { id: "", label: "BEST" },
  { id: "128K", label: "128K" },
  { id: "192K", label: "192K" },
  { id: "256K", label: "256K" },
  { id: "320K", label: "320K" },
];

const CONVERT_BITRATE_OPTIONS = [
  { id: "64k", label: "64K" },
  { id: "128k", label: "128K" },
  { id: "192k", label: "192K" },
  { id: "256k", label: "256K" },
  { id: "320k", label: "320K" },
];

const SAMPLE_RATE_OPTIONS = [
  { id: "", label: "DEFAULT" },
  { id: "22050", label: "22.05K" },
  { id: "44100", label: "44.1K" },
  { id: "48000", label: "48K" },
  { id: "96000", label: "96K" },
];

const AUDIO_FORMATS: Format[] = ["mp3", "m4a"];

function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

const labelStyle = {
  display: "block",
  fontSize: "11px",
  color: "var(--muted)",
  letterSpacing: "0.12em",
  textTransform: "uppercase" as const,
  marginBottom: "10px",
};

function SelectorGrid({
  options,
  value,
  onChange,
  disabled,
  columns,
}: {
  options: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
  disabled: boolean;
  columns: number;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap: "1px",
        background: "var(--border)",
      }}
    >
      {options.map((opt) => {
        const selected = value === opt.id;
        return (
          <button
            type="button"
            key={opt.id}
            onClick={() => onChange(opt.id)}
            disabled={disabled}
            style={{
              background: selected ? "var(--surface2)" : "var(--surface)",
              border: "none",
              color: selected ? "var(--accent)" : "var(--muted2)",
              padding: "10px 8px",
              fontSize: "12px",
              fontFamily: "'DM Mono', monospace",
              cursor: disabled ? "not-allowed" : "pointer",
              textAlign: "left",
              transition: "color 0.1s, background 0.1s",
              letterSpacing: "0.02em",
              borderLeft: selected ? "2px solid var(--accent)" : "2px solid transparent",
            }}
            onMouseEnter={(e) => {
              if (!selected && !disabled) e.currentTarget.style.color = "var(--text)";
            }}
            onMouseLeave={(e) => {
              if (!selected) e.currentTarget.style.color = "var(--muted2)";
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function LogPanel({
  logs,
  loading,
  logRef,
}: {
  logs: LogEntry[];
  loading: boolean;
  logRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <section className="animate-slide-up">
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
        <span style={{ fontSize: "11px", color: "var(--muted)", letterSpacing: "0.12em", textTransform: "uppercase" }}>
          Output
        </span>
        <div style={{ flex: 1, height: "1px", background: "var(--border)" }} />
        {loading && (
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
        {loading && (
          <span style={{ color: "var(--accent)" }} className="animate-blink">
            _
          </span>
        )}
      </div>
    </section>
  );
}

function SaveButton({ filename }: { filename: string }) {
  return (
    <section style={{ marginTop: "12px" }} className="animate-slide-up">
      <a
        href={`/api/file?name=${encodeURIComponent(filename)}`}
        download={filename}
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
        SAVE — {filename}
      </a>
    </section>
  );
}

export default function Home() {
  const [mode, setMode] = useState<Mode>("download");

  // ── Download state ──
  const [url, setUrl] = useState("");
  const [format, setFormat] = useState<Format>("mp4-high");
  const [dlBitrate, setDlBitrate] = useState("");
  const [dlSampleRate, setDlSampleRate] = useState("");
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [infoLoading, setInfoLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [dlLogs, setDlLogs] = useState<LogEntry[]>([]);
  const [dlFilename, setDlFilename] = useState<string | null>(null);
  const [_dlError, setDlError] = useState(false);
  const dlLogRef = useRef<HTMLDivElement>(null);
  const dlLogCounter = useRef(0);
  const infoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Convert state ──
  const [convertFile, setConvertFile] = useState<File | null>(null);
  const [convertBitrate, setConvertBitrate] = useState("192k");
  const [cvSampleRate, setCvSampleRate] = useState("");
  const [converting, setConverting] = useState(false);
  const [cvLogs, setCvLogs] = useState<LogEntry[]>([]);
  const [cvFilename, setCvFilename] = useState<string | null>(null);
  const [_cvError, setCvError] = useState(false);
  const cvLogRef = useRef<HTMLDivElement>(null);
  const cvLogCounter = useRef(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: refs are stable
  useEffect(() => {
    if (dlLogRef.current) dlLogRef.current.scrollTop = dlLogRef.current.scrollHeight;
  }, [dlLogs]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: refs are stable
  useEffect(() => {
    if (cvLogRef.current) cvLogRef.current.scrollTop = cvLogRef.current.scrollHeight;
  }, [cvLogs]);

  const addDlLog = useCallback((text: string, kind: LogEntry["kind"] = "log") => {
    setDlLogs((prev) => [...prev, { id: dlLogCounter.current++, text, kind }]);
  }, []);

  const addCvLog = useCallback((text: string, kind: LogEntry["kind"] = "log") => {
    setCvLogs((prev) => [...prev, { id: cvLogCounter.current++, text, kind }]);
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
      if (res.ok) setVideoInfo(await res.json());
    } catch {
      // silently fail
    }
    setInfoLoading(false);
  }, []);

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setUrl(val);
    setVideoInfo(null);
    setDlFilename(null);
    setDlLogs([]);
    setDlError(false);

    if (infoTimer.current) clearTimeout(infoTimer.current);
    const isYt = val.includes("youtube.com/") || val.includes("youtu.be/");
    if (isYt && val.length > 15) {
      infoTimer.current = setTimeout(() => fetchInfo(val), 600);
    }
  };

  const handleFormatChange = (f: string) => {
    setFormat(f as Format);
    if (!AUDIO_FORMATS.includes(f as Format)) {
      setDlBitrate("");
      setDlSampleRate("");
    }
  };

  const handleDownload = async () => {
    if (!url.trim() || downloading) return;

    setDownloading(true);
    setDlLogs([]);
    setDlFilename(null);
    setDlError(false);

    try {
      const res = await fetch("/api/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), format, bitrate: dlBitrate || undefined, sampleRate: dlSampleRate || undefined }),
      });

      if (!res.body) {
        addDlLog("No response body", "error");
        setDlError(true);
        setDownloading(false);
        return;
      }

      await consumeSSE(res.body, addDlLog, setDlFilename, setDlError);
    } catch (err) {
      addDlLog(String(err), "error");
      setDlError(true);
    }

    setDownloading(false);
  };

  const handleConvert = async () => {
    if (!convertFile || converting) return;

    setConverting(true);
    setCvLogs([]);
    setCvFilename(null);
    setCvError(false);

    // Step 1: upload
    let uploadedFilename: string;
    try {
      const fd = new FormData();
      fd.append("file", convertFile);
      const uploadRes = await fetch("/api/upload", { method: "POST", body: fd });
      if (!uploadRes.ok) {
        addCvLog("Upload failed", "error");
        setCvError(true);
        setConverting(false);
        return;
      }
      ({ filename: uploadedFilename } = await uploadRes.json());
      addCvLog(`Uploaded: ${convertFile.name}`);
    } catch (err) {
      addCvLog(String(err), "error");
      setCvError(true);
      setConverting(false);
      return;
    }

    // Step 2: convert
    try {
      const res = await fetch("/api/convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: uploadedFilename, bitrate: convertBitrate, sampleRate: cvSampleRate || undefined }),
      });

      if (!res.body) {
        addCvLog("No response body", "error");
        setCvError(true);
        setConverting(false);
        return;
      }

      await consumeSSE(res.body, addCvLog, setCvFilename, setCvError);
    } catch (err) {
      addCvLog(String(err), "error");
      setCvError(true);
    }

    setConverting(false);
  };

  const isYouTubeUrl = url.includes("youtube.com/") || url.includes("youtu.be/");
  const showBitrate = AUDIO_FORMATS.includes(format);

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
        <header style={{ marginBottom: "40px" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: "12px", marginBottom: "4px" }}>
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
            <span style={{ fontSize: "12px", color: "var(--muted)", letterSpacing: "0.08em" }}>downloader</span>
          </div>
          <div style={{ width: "100%", height: "1px", background: "var(--border)" }} />
        </header>

        {/* Mode Tabs */}
        <nav style={{ display: "flex", gap: "0", marginBottom: "40px", borderBottom: "1px solid var(--border)" }}>
          {(["download", "convert"] as Mode[]).map((m) => {
            const active = mode === m;
            return (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                style={{
                  background: "transparent",
                  border: "none",
                  borderBottom: active ? "2px solid var(--accent)" : "2px solid transparent",
                  color: active ? "var(--accent)" : "var(--muted)",
                  padding: "8px 20px",
                  fontSize: "11px",
                  fontFamily: "'Syne Mono', monospace",
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  cursor: "pointer",
                  marginBottom: "-1px",
                  transition: "color 0.15s, border-color 0.15s",
                }}
              >
                {m === "download" ? "DOWNLOAD" : "CONVERT"}
              </button>
            );
          })}
        </nav>

        {/* ── DOWNLOAD TAB ── */}
        {mode === "download" && (
          <>
            {/* URL Input */}
            <section style={{ marginBottom: "32px" }}>
              <label htmlFor="url-input" style={labelStyle}>
                URL
              </label>
              <input
                id="url-input"
                type="text"
                value={url}
                onChange={handleUrlChange}
                onKeyDown={(e) => { if (e.key === "Enter") handleDownload(); }}
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
                  boxSizing: "border-box",
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent-dim)"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border2)"; }}
              />
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
                    <div style={{ width: "80px", height: "45px", background: "var(--surface2)", flexShrink: 0 }} />
                    <div>
                      <div style={{ width: "200px", height: "12px", background: "var(--surface2)", marginBottom: "6px" }} />
                      <div style={{ width: "100px", height: "10px", background: "var(--surface2)" }} />
                    </div>
                  </>
                ) : videoInfo ? (
                  <>
                    {videoInfo.thumbnail && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={videoInfo.thumbnail}
                        alt=""
                        style={{ width: "80px", height: "45px", objectFit: "cover", flexShrink: 0 }}
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
              <p style={labelStyle}>Format</p>
              <SelectorGrid
                options={FORMAT_OPTIONS}
                value={format}
                onChange={handleFormatChange}
                disabled={downloading}
                columns={3}
              />
            </section>

            {/* Bitrate + Sample Rate Selectors (audio only) */}
            {showBitrate && (
              <>
                <section style={{ marginBottom: "32px" }} className="animate-slide-up">
                  <p style={labelStyle}>Bitrate</p>
                  <SelectorGrid
                    options={DOWNLOAD_BITRATE_OPTIONS}
                    value={dlBitrate}
                    onChange={setDlBitrate}
                    disabled={downloading}
                    columns={5}
                  />
                </section>
                <section style={{ marginBottom: "32px" }}>
                  <p style={labelStyle}>Sample Rate</p>
                  <SelectorGrid
                    options={SAMPLE_RATE_OPTIONS}
                    value={dlSampleRate}
                    onChange={setDlSampleRate}
                    disabled={downloading}
                    columns={5}
                  />
                </section>
              </>
            )}

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
                onMouseEnter={(e) => { if (url.trim() && !downloading) e.currentTarget.style.background = "#e0a845"; }}
                onMouseLeave={(e) => { if (url.trim() && !downloading) e.currentTarget.style.background = "var(--accent)"; }}
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

            {dlLogs.length > 0 && <LogPanel logs={dlLogs} loading={downloading} logRef={dlLogRef} />}
            {dlFilename && <SaveButton filename={dlFilename} />}
          </>
        )}

        {/* ── CONVERT TAB ── */}
        {mode === "convert" && (
          <>
            {/* File Input */}
            <section style={{ marginBottom: "32px" }}>
              <label htmlFor="convert-file" style={labelStyle}>
                Audio File
              </label>
              <div
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border2)",
                  padding: "12px 16px",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                }}
              >
                <label
                  htmlFor="convert-file"
                  style={{
                    fontSize: "11px",
                    fontFamily: "'Syne Mono', monospace",
                    letterSpacing: "0.08em",
                    color: "var(--accent)",
                    cursor: converting ? "not-allowed" : "pointer",
                    border: "1px solid var(--accent)",
                    padding: "4px 10px",
                    whiteSpace: "nowrap",
                  }}
                >
                  BROWSE
                </label>
                <input
                  id="convert-file"
                  type="file"
                  accept="audio/*,.mp3,.m4a,.aac,.flac,.ogg,.opus,.wav"
                  disabled={converting}
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    setConvertFile(f);
                    setCvLogs([]);
                    setCvFilename(null);
                    setCvError(false);
                  }}
                  style={{ display: "none" }}
                />
                <span
                  style={{
                    fontSize: "13px",
                    fontFamily: "'DM Mono', monospace",
                    color: convertFile ? "var(--text)" : "var(--muted)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {convertFile ? convertFile.name : "no file selected"}
                </span>
              </div>
            </section>

            {/* Bitrate Selector */}
            <section style={{ marginBottom: "32px" }}>
              <p style={labelStyle}>Target Bitrate</p>
              <SelectorGrid
                options={CONVERT_BITRATE_OPTIONS}
                value={convertBitrate}
                onChange={setConvertBitrate}
                disabled={converting}
                columns={5}
              />
            </section>

            {/* Sample Rate Selector */}
            <section style={{ marginBottom: "32px" }}>
              <p style={labelStyle}>Sample Rate</p>
              <SelectorGrid
                options={SAMPLE_RATE_OPTIONS}
                value={cvSampleRate}
                onChange={setCvSampleRate}
                disabled={converting}
                columns={5}
              />
            </section>

            {/* Convert Button */}
            <section style={{ marginBottom: "32px" }}>
              <button
                type="button"
                onClick={handleConvert}
                disabled={!convertFile || converting}
                style={{
                  width: "100%",
                  padding: "14px",
                  background: !convertFile || converting ? "var(--surface2)" : "var(--accent)",
                  border: "none",
                  color: !convertFile || converting ? "var(--muted)" : "var(--bg)",
                  fontSize: "13px",
                  fontFamily: "'Syne Mono', monospace",
                  letterSpacing: "0.1em",
                  cursor: !convertFile || converting ? "not-allowed" : "pointer",
                  transition: "background 0.15s, color 0.15s",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "10px",
                }}
                onMouseEnter={(e) => { if (convertFile && !converting) e.currentTarget.style.background = "#e0a845"; }}
                onMouseLeave={(e) => { if (convertFile && !converting) e.currentTarget.style.background = "var(--accent)"; }}
              >
                {converting ? (
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
                    CONVERTING...
                  </>
                ) : (
                  "CONVERT"
                )}
              </button>
            </section>

            {cvLogs.length > 0 && <LogPanel logs={cvLogs} loading={converting} logRef={cvLogRef} />}
            {cvFilename && <SaveButton filename={cvFilename} />}
          </>
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
          <span>yt-dlp + ffmpeg required</span>
          <span style={{ fontFamily: "'DM Mono', monospace" }}>pip install yt-dlp</span>
        </footer>
      </div>
    </main>
  );
}

async function consumeSSE(
  body: ReadableStream<Uint8Array>,
  addLog: (text: string, kind?: LogEntry["kind"]) => void,
  setFilename: (name: string) => void,
  setError: (v: boolean) => void,
) {
  const reader = body.getReader();
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
          setFilename(data.filename);
        } else if (data.type === "error") {
          addLog(data.message, "error");
          setError(true);
        }
      } catch {
        // ignore parse error
      }
    }
  }
}
