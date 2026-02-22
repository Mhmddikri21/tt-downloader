"use client";

import { useState } from "react";

interface VideoResult {
    title: string;
    author: string;
    thumbnail: string | null;
    videoUrl: string;
    audioUrl: string | null;
}

export default function DownloadForm() {
    const [url, setUrl] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<VideoResult | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!url.trim()) return;

        setLoading(true);
        setError(null);
        setResult(null);

        try {
            const res = await fetch("/api/download", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url: url.trim() }),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error ?? "Terjadi kesalahan.");
                return;
            }

            setResult(data);
        } catch {
            setError("Koneksi gagal. Periksa internet Anda dan coba lagi.");
        } finally {
            setLoading(false);
        }
    };

    const handlePaste = async () => {
        try {
            const text = await navigator.clipboard.readText();
            setUrl(text);
        } catch {
            // silently fail if clipboard not available
        }
    };

    const proxyDownload = (fileUrl: string, filename: string) => {
        const link = document.createElement("a");
        link.href = `/api/proxy?url=${encodeURIComponent(fileUrl)}&filename=${encodeURIComponent(filename)}`;
        link.download = filename;
        link.click();
    };

    return (
        <div style={{ width: "100%", maxWidth: 640 }}>
            {/* Form Card */}
            <div className="form-card">
                <form onSubmit={handleSubmit}>
                    <div className="input-wrapper">
                        <input
                            id="tiktok-url-input"
                            className="url-input"
                            type="url"
                            placeholder="Paste link TikTok di sini..."
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            autoComplete="off"
                            spellCheck={false}
                        />
                        {!url && (
                            <button
                                type="button"
                                onClick={handlePaste}
                                style={{
                                    position: "absolute",
                                    right: 150,
                                    top: "50%",
                                    transform: "translateY(-50%)",
                                    background: "transparent",
                                    border: "none",
                                    color: "var(--text-secondary)",
                                    cursor: "pointer",
                                    fontSize: "0.8rem",
                                    padding: "4px 8px",
                                    borderRadius: 6,
                                    transition: "color 0.2s",
                                    whiteSpace: "nowrap",
                                }}
                                onMouseEnter={(e) =>
                                    ((e.target as HTMLElement).style.color = "var(--text-primary)")
                                }
                                onMouseLeave={(e) =>
                                ((e.target as HTMLElement).style.color =
                                    "var(--text-secondary)")
                                }
                            >
                                📋 Paste
                            </button>
                        )}
                        <button
                            id="download-btn"
                            className="btn-download"
                            type="submit"
                            disabled={loading || !url.trim()}
                        >
                            {loading ? (
                                <>
                                    <span className="spinner" />
                                    Proses...
                                </>
                            ) : (
                                <>
                                    <svg
                                        width="16"
                                        height="16"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2.5"
                                        viewBox="0 0 24 24"
                                    >
                                        <path d="M12 5v14M5 12l7 7 7-7" />
                                    </svg>
                                    Download
                                </>
                            )}
                        </button>
                    </div>

                    {error && (
                        <div className="error-msg" role="alert">
                            <svg
                                width="16"
                                height="16"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                viewBox="0 0 24 24"
                                style={{ flexShrink: 0 }}
                            >
                                <circle cx="12" cy="12" r="10" />
                                <line x1="12" y1="8" x2="12" y2="12" />
                                <line x1="12" y1="16" x2="12.01" y2="16" />
                            </svg>
                            {error}
                        </div>
                    )}
                </form>
            </div>

            {/* Result Card */}
            {result && (
                <div className="result-card">
                    {/* Thumbnail */}
                    <div className="result-thumb-wrapper">
                        {result.thumbnail ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={result.thumbnail} alt={result.title} />
                        ) : (
                            <div
                                style={{
                                    width: "100%",
                                    height: "100%",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontSize: "3rem",
                                }}
                            >
                                🎵
                            </div>
                        )}
                        <div className="result-thumb-overlay" />
                        <span className="result-badge">✓ No Watermark</span>
                    </div>

                    {/* Info */}
                    <div className="result-info">
                        <div className="result-author">@{result.author}</div>
                        <div className="result-title">{result.title}</div>
                    </div>

                    {/* Action buttons */}
                    <div className="result-actions">
                        <button
                            id="download-video-btn"
                            className="btn-action btn-action-primary"
                            onClick={() =>
                                proxyDownload(
                                    result.videoUrl,
                                    `tiktok-${result.author}-nowm.mp4`
                                )
                            }
                        >
                            <svg
                                width="16"
                                height="16"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                viewBox="0 0 24 24"
                            >
                                <path d="M12 5v14M5 12l7 7 7-7" />
                            </svg>
                            Video (No WM)
                        </button>

                        {result.audioUrl && (
                            <button
                                id="download-audio-btn"
                                className="btn-action btn-action-secondary"
                                onClick={() =>
                                    proxyDownload(result.audioUrl!, `tiktok-${result.author}.mp3`)
                                }
                            >
                                <svg
                                    width="16"
                                    height="16"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2.5"
                                    viewBox="0 0 24 24"
                                >
                                    <path d="M9 18V5l12-2v13" />
                                    <circle cx="6" cy="18" r="3" />
                                    <circle cx="18" cy="16" r="3" />
                                </svg>
                                Audio (MP3)
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
