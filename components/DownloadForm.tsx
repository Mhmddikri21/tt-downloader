"use client";

import { useState } from "react";

interface VideoData {
    type: "video";
    title: string;
    author: string;
    thumbnail: string | null;
    videoUrl: string;
    audioUrl: string | null;
}

interface ImageData {
    type: "image";
    title: string;
    author: string;
    thumbnail: string | null;
    images: string[];
    audioUrl: string | null;
}

type ResultData = VideoData | ImageData;

const AFFILIATE_URL = "https://s.shopee.co.id/7VDKt9ja3N";

export default function DownloadForm() {
    const [url, setUrl] = useState("");
    const [loading, setLoading] = useState(false);
    const [downloadingType, setDownloadingType] = useState<"video" | "audio" | "images" | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<ResultData | null>(null);

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

    const sanitizeFilename = (text: string, maxLen = 80): string => {
        return text
            .replace(/[\u{1F600}-\u{1F9FF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F000}-\u{1FFFF}]/gu, "")
            .replace(/[\\/:*?"<>|#@]/g, "")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, maxLen)
            .trim() || "tiktok-video";
    };

    const getFreshMediaUrl = async (type: "video" | "audio" | "images", imageIndex?: number): Promise<string | null> => {
        if (!url.trim()) return null;

        const res = await fetch("/api/download", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: url.trim() }),
        });

        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.error ?? "Gagal memperbarui link download.");
        }

        setResult(data);

        if (type === "video" && data.type === "video") {
            return data.videoUrl;
        }

        if (type === "audio") {
            return data.audioUrl ?? null;
        }

        if (type === "images" && data.type === "image" && typeof imageIndex === "number") {
            return data.images[imageIndex] ?? null;
        }

        return null;
    };

    const fetchProxyFile = async (fileUrl: string, filename: string) => {
        const proxyUrl = `/api/proxy?url=${encodeURIComponent(fileUrl)}&filename=${encodeURIComponent(filename)}`;
        const response = await fetch(proxyUrl);

        if (response.ok) {
            return response.blob();
        }

        let message = "File tidak bisa diunduh saat ini. Coba beberapa saat lagi.";

        try {
            const data = await response.json();
            message = data.error ?? message;
        } catch {
            // ignore JSON parse errors and keep default message
        }

        throw new Error(message);
    };

    const redirectToAffiliate = () => {
        setTimeout(() => {
            window.location.href = AFFILIATE_URL;
        }, 1200);
    };

    const saveBlob = (blob: Blob, filename: string) => {
        const blobUrl = URL.createObjectURL(blob);

        const link = document.createElement("a");
        link.href = blobUrl;
        link.download = filename;
        link.style.display = "none";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        setTimeout(() => {
            URL.revokeObjectURL(blobUrl);
        }, 5000);
    };

    const directDownload = (fileUrl: string, filename: string) => {
        const link = document.createElement("a");
        link.href = fileUrl;
        link.download = filename;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.style.display = "none";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const proxyDownload = async (
        fileUrl: string,
        filename: string,
        type: "video" | "audio" | "images",
        imageIndex?: number
    ) => {
        setDownloadingType(type);
        setError(null);

        try {
            let blob: Blob;
            let downloadUrl = fileUrl;

            try {
                blob = await fetchProxyFile(downloadUrl, filename);
            } catch (firstError) {
                const freshUrl = await getFreshMediaUrl(type, imageIndex);

                if (!freshUrl) {
                    throw firstError;
                }

                downloadUrl = freshUrl;

                try {
                    blob = await fetchProxyFile(downloadUrl, filename);
                } catch {
                    directDownload(downloadUrl, filename);
                    redirectToAffiliate();
                    return;
                }
            }

            saveBlob(blob, filename);
            redirectToAffiliate();
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "File tidak bisa diunduh saat ini. Coba beberapa saat lagi."
            );
        } finally {
            setDownloadingType(null);
        }
    };

    const downloadImage = async (imageUrl: string, index: number) => {
        const title = result ? sanitizeFilename(result.title) : "tiktok-slide";
        await proxyDownload(imageUrl, `${title}-${index + 1}.jpg`, "images", index);
    };

    return (
        <div style={{ width: "100%", maxWidth: 640 }}>
            {/* Form Card */}
            <div className="form-card">
                <form onSubmit={handleSubmit}>
                    <div className="input-wrapper">
                        <div className="input-container">
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
                                    className="paste-btn"
                                >
                                    📋 Paste
                                </button>
                            )}
                        </div>
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
                                {result.type === "image" ? "🖼️" : "🎵"}
                            </div>
                        )}
                        <div className="result-thumb-overlay" />
                        <span className="result-badge">
                            {result.type === "image" ? `🖼️ ${(result as ImageData).images.length} Slides` : "✓ No Watermark"}
                        </span>
                    </div>

                    {/* Info */}
                    <div className="result-info">
                        <div className="result-author">@{result.author}</div>
                        <div className="result-title">{result.title}</div>
                    </div>

                    {/* Action buttons — Video */}
                    {result.type === "video" && (
                        <div className="result-actions">
                            <button
                                id="download-video-btn"
                                className="btn-action btn-action-primary"
                                disabled={downloadingType !== null}
                                onClick={() =>
                                    proxyDownload(
                                        (result as VideoData).videoUrl,
                                        `${sanitizeFilename(result.title)}.mp4`,
                                        "video"
                                    )
                                }
                            >
                                {downloadingType === "video" ? (
                                    <>
                                        <span className="spinner" />
                                        Mengunduh...
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
                                        Video (No WM)
                                    </>
                                )}
                            </button>

                            {result.audioUrl && (
                                <button
                                    id="download-audio-btn"
                                    className="btn-action btn-action-secondary"
                                    disabled={downloadingType !== null}
                                    onClick={() =>
                                        proxyDownload(
                                            result.audioUrl!,
                                            `${sanitizeFilename(result.title)}.mp3`,
                                            "audio"
                                        )
                                    }
                                >
                                    {downloadingType === "audio" ? (
                                        <>
                                            <span className="spinner" />
                                            Mengunduh...
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
                                                <path d="M9 18V5l12-2v13" />
                                                <circle cx="6" cy="18" r="3" />
                                                <circle cx="18" cy="16" r="3" />
                                            </svg>
                                            Audio (MP3)
                                        </>
                                    )}
                                </button>
                            )}
                        </div>
                    )}

                    {/* Action buttons — Image/Slideshow */}
                    {result.type === "image" && (
                        <>
                            {/* Image gallery */}
                            <div className="image-gallery">
                                {(result as ImageData).images.map((imgUrl, idx) => (
                                    <div className="image-gallery-item" key={idx}>
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={imgUrl} alt={`Slide ${idx + 1}`} />
                                        <button
                                            className="image-download-btn"
                                            disabled={downloadingType !== null}
                                            onClick={() => downloadImage(imgUrl, idx)}
                                            title={`Download slide ${idx + 1}`}
                                        >
                                            <svg
                                                width="14"
                                                height="14"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2.5"
                                                viewBox="0 0 24 24"
                                            >
                                                <path d="M12 5v14M5 12l7 7 7-7" />
                                            </svg>
                                        </button>
                                    </div>
                                ))}
                            </div>

                            <div className="result-actions">
                                {result.audioUrl && (
                                    <button
                                        id="download-audio-btn"
                                        className="btn-action btn-action-secondary"
                                        disabled={downloadingType !== null}
                                        onClick={() =>
                                            proxyDownload(
                                                result.audioUrl!,
                                                `${sanitizeFilename(result.title)}.mp3`,
                                                "audio"
                                            )
                                        }
                                    >
                                        {downloadingType === "audio" ? (
                                            <>
                                                <span className="spinner" />
                                                Mengunduh...
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
                                                    <path d="M9 18V5l12-2v13" />
                                                    <circle cx="6" cy="18" r="3" />
                                                    <circle cx="18" cy="16" r="3" />
                                                </svg>
                                                Audio (MP3)
                                            </>
                                        )}
                                    </button>
                                )}
                            </div>
                        </>
                    )}

                </div>
            )}
        </div>
    );
}
