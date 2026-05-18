import { NextRequest, NextResponse } from "next/server";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const TiktokDL = require("@tobyg74/tiktok-api-dl");

interface VideoResult {
    type: "video";
    title: string;
    author: string;
    thumbnail: string | null;
    videoUrl: string;
    audioUrl: string | null;
}

interface ImageResult {
    type: "image";
    title: string;
    author: string;
    thumbnail: string | null;
    images: string[];
    audioUrl: string | null;
}

type DownloadResult = VideoResult | ImageResult;

// ─── URL validation ────────────────────────────────────────────────────────

function parseTikTokUrl(rawUrl: string): URL | null {
    try {
        const parsed = new URL(rawUrl);
        const hostname = parsed.hostname.toLowerCase();
        const isTikTokHost =
            hostname === "tiktok.com" ||
            hostname.endsWith(".tiktok.com") ||
            hostname === "tiktokv.com" ||
            hostname.endsWith(".tiktokv.com");

        if (!["http:", "https:"].includes(parsed.protocol) || !isTikTokHost) {
            return null;
        }

        return parsed;
    } catch {
        return null;
    }
}

// ─── Strategy 1: @tobyg74/tiktok-api-dl (v1) ──────────────────────────────

async function downloadViaLibV1(url: string): Promise<DownloadResult | null> {
    try {
        const resp = await TiktokDL.Downloader(url, { version: "v1" });

        if (resp.status !== "success" || !resp.result) return null;

        const r = resp.result;

        // Image/slideshow type
        if (r.type === "image" && Array.isArray(r.images) && r.images.length > 0) {
            return {
                type: "image",
                title: r.desc || "Slideshow TikTok",
                author: r.author?.nickname || "Unknown",
                thumbnail: r.images[0] || null,
                images: r.images,
                audioUrl: r.music?.playUrl?.[0] || null,
            };
        }

        // Video type
        const videoUrl =
            r.video?.playAddr?.[0] ||
            r.video?.downloadAddr?.[0] ||
            null;

        if (!videoUrl) return null;

        return {
            type: "video",
            title: r.desc || "Video TikTok",
            author: r.author?.nickname || "Unknown",
            thumbnail: r.video?.cover?.[0] || r.video?.originCover?.[0] || null,
            videoUrl,
            audioUrl: r.music?.playUrl?.[0] || null,
        };
    } catch (e) {
        console.error("[lib-v1] error:", e);
        return null;
    }
}

// ─── Strategy 2: @tobyg74/tiktok-api-dl (v3 — MusicalDown) ────────────────

async function downloadViaLibV3(url: string): Promise<DownloadResult | null> {
    try {
        const resp = await TiktokDL.Downloader(url, { version: "v3" });

        if (resp.status !== "success" || !resp.result) return null;

        const r = resp.result;

        // Image/slideshow type
        if (r.type === "image" && Array.isArray(r.images) && r.images.length > 0) {
            return {
                type: "image",
                title: r.desc || "Slideshow TikTok",
                author: r.author?.nickname || "Unknown",
                thumbnail: r.images[0] || null,
                images: r.images,
                audioUrl: typeof r.music === "string" ? r.music : null,
            };
        }

        const videoUrl = r.videoHD || r.videoSD || null;

        if (!videoUrl) return null;

        return {
            type: "video",
            title: r.desc || "Video TikTok",
            author: r.author?.nickname || "Unknown",
            thumbnail: null,
            videoUrl,
            audioUrl: typeof r.music === "string" ? r.music : null,
        };
    } catch (e) {
        console.error("[lib-v3] error:", e);
        return null;
    }
}

// ─── Strategy 3: @tobyg74/tiktok-api-dl (v2 — SSSTik) ─────────────────────

async function downloadViaLibV2(url: string): Promise<DownloadResult | null> {
    try {
        const resp = await TiktokDL.Downloader(url, { version: "v2" });

        if (resp.status !== "success" || !resp.result) return null;

        const r = resp.result;

        // Image/slideshow type
        if (r.type === "image" && Array.isArray(r.images) && r.images.length > 0) {
            return {
                type: "image",
                title: r.desc || "Slideshow TikTok",
                author: r.author?.nickname || "Unknown",
                thumbnail: r.images[0] || null,
                images: r.images,
                audioUrl: r.music?.playUrl?.[0] || null,
            };
        }

        const videoUrl = r.video?.playAddr?.[0] || null;

        if (!videoUrl) return null;

        return {
            type: "video",
            title: r.desc || "Video TikTok",
            author: r.author?.nickname || "Unknown",
            thumbnail: null,
            videoUrl,
            audioUrl: r.music?.playUrl?.[0] || null,
        };
    } catch (e) {
        console.error("[lib-v2] error:", e);
        return null;
    }
}

// ─── Strategy 4 (last resort): tikwm.com ───────────────────────────────────

interface TikWMData {
    id: string;
    title: string;
    cover: string;
    origin_cover: string;
    play: string;
    hdplay: string;
    wmplay: string;
    music: string;
    images?: string[];
    music_info?: {
        title: string;
        author: string;
        play: string;
    };
    author: {
        id: string;
        unique_id: string;
        nickname: string;
        avatar: string;
    };
}

async function downloadViaTikWM(url: string): Promise<DownloadResult | null> {
    try {
        const res = await fetch("https://www.tikwm.com/api/", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
                "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            },
            body: JSON.stringify({ url, hd: 1 }),
            signal: AbortSignal.timeout(10000),
        });

        if (!res.ok) return null;

        const json = await res.json();
        if (json.code !== 0 || !json.data) return null;

        const d: TikWMData = json.data;

        // tikwm sometimes returns relative URLs that need domain prefix
        const fixUrl = (u: string | undefined | null): string | null => {
            if (!u) return null;
            if (u.startsWith("/")) return `https://www.tikwm.com${u}`;
            return u;
        };

        // Image/slideshow type — tikwm uses "images" array
        if (Array.isArray(d.images) && d.images.length > 0) {
            const imageUrls = d.images
                .map((img: string) => fixUrl(img))
                .filter((u): u is string => u !== null);

            if (imageUrls.length > 0) {
                return {
                    type: "image",
                    title: d.title || "Slideshow TikTok",
                    author: d.author?.nickname || d.author?.unique_id || "Unknown",
                    thumbnail: imageUrls[0],
                    images: imageUrls,
                    audioUrl: fixUrl(d.music) || fixUrl(d.music_info?.play) || null,
                };
            }
        }

        const videoUrl = fixUrl(d.hdplay) || fixUrl(d.play);
        if (!videoUrl) return null;

        return {
            type: "video",
            title: d.title || "Video TikTok",
            author: d.author?.nickname || d.author?.unique_id || "Unknown",
            thumbnail: fixUrl(d.origin_cover) || fixUrl(d.cover) || null,
            videoUrl,
            audioUrl: fixUrl(d.music) || fixUrl(d.music_info?.play) || null,
        };
    } catch (e) {
        console.error("[tikwm] error:", e);
        return null;
    }
}

// ─── POST handler ──────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
    try {
        const { url } = await req.json();

        if (!url || typeof url !== "string") {
            return NextResponse.json(
                { error: "URL tidak boleh kosong." },
                { status: 400 }
            );
        }

        const parsedUrl = parseTikTokUrl(url.trim());
        if (!parsedUrl) {
            return NextResponse.json(
                { error: "URL tidak valid. Pastikan itu link TikTok yang benar." },
                { status: 400 }
            );
        }

        const normalizedUrl = parsedUrl.toString();

        // Strategy 1: tiktok-api-dl v1 (TikTok API)
        console.log("[/api/download] Trying tiktok-api-dl v1...");
        const v1Result = await downloadViaLibV1(normalizedUrl);
        if (v1Result) {
            console.log("[/api/download] ✓ v1 succeeded");
            return NextResponse.json(v1Result);
        }

        // Strategy 2: tiktok-api-dl v3 (MusicalDown)
        console.log("[/api/download] v1 failed, trying v3 (MusicalDown)...");
        const v3Result = await downloadViaLibV3(normalizedUrl);
        if (v3Result) {
            console.log("[/api/download] ✓ v3 succeeded");
            return NextResponse.json(v3Result);
        }

        // Strategy 3: tiktok-api-dl v2 (SSSTik)
        console.log("[/api/download] v3 failed, trying v2 (SSSTik)...");
        const v2Result = await downloadViaLibV2(normalizedUrl);
        if (v2Result) {
            console.log("[/api/download] ✓ v2 succeeded");
            return NextResponse.json(v2Result);
        }

        // Strategy 4: tikwm.com (last resort)
        console.log("[/api/download] All lib versions failed, trying tikwm...");
        const tikwmResult = await downloadViaTikWM(normalizedUrl);
        if (tikwmResult) {
            console.log("[/api/download] ✓ tikwm succeeded");
            return NextResponse.json(tikwmResult);
        }

        // Nothing worked
        console.log("[/api/download] All strategies failed");
        return NextResponse.json(
            {
                error:
                    "Video tidak bisa didownload saat ini. Pastikan URL benar dan coba lagi nanti.",
            },
            { status: 503 }
        );
    } catch (err) {
        console.error("[/api/download] error:", err);
        return NextResponse.json(
            { error: "Terjadi kesalahan server. Coba beberapa saat lagi." },
            { status: 500 }
        );
    }
}
