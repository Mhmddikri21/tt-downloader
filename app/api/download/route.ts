import { NextRequest, NextResponse } from "next/server";

interface TikWMData {
    id: string;
    title: string;
    cover: string;
    origin_cover: string;
    play: string;
    hdplay: string;
    wmplay: string;
    music: string;
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

async function downloadViaTikWM(url: string): Promise<{
    title: string;
    author: string;
    thumbnail: string | null;
    videoUrl: string;
    audioUrl: string | null;
} | null> {
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

        const videoUrl = fixUrl(d.hdplay) || fixUrl(d.play);
        if (!videoUrl) return null;

        return {
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

async function downloadViaOembed(url: string): Promise<{
    title: string;
    author: string;
    thumbnail: string | null;
} | null> {
    try {
        const res = await fetch(
            `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`
        );
        if (!res.ok) return null;
        const json = await res.json();
        return {
            title: json.title || "Video TikTok",
            author: json.author_name || json.author_unique_id || "Unknown",
            thumbnail: json.thumbnail_url || null,
        };
    } catch {
        return null;
    }
}

async function downloadViaTikTokAPI(url: string): Promise<{
    title: string;
    author: string;
    thumbnail: string | null;
    videoUrl: string;
    audioUrl: string | null;
} | null> {
    try {
        // Try to get the video page and extract __UNIVERSAL_DATA_FOR_REHYDRATION__
        const pageRes = await fetch(url, {
            headers: {
                "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.9",
            },
            redirect: "follow",
        });

        if (!pageRes.ok) return null;

        const html = await pageRes.text();

        // Extract JSON from script tag
        const scriptMatch = html.match(
            /<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([^<]+)<\/script>/
        );

        if (!scriptMatch?.[1]) return null;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data: any = JSON.parse(scriptMatch[1]);
        const itemStruct =
            data?.["__DEFAULT_SCOPE__"]?.["webapp.video-detail"]?.itemInfo?.itemStruct;

        if (!itemStruct) return null;

        const videoUrl = itemStruct.video?.playAddr || itemStruct.video?.downloadAddr;
        if (!videoUrl) return null;

        return {
            title: itemStruct.desc || "Video TikTok",
            author: itemStruct.author?.nickname || itemStruct.author?.uniqueId || "Unknown",
            thumbnail: itemStruct.video?.cover || itemStruct.video?.originCover || null,
            videoUrl,
            audioUrl: itemStruct.music?.playUrl || null,
        };
    } catch (e) {
        console.error("[tiktok-direct] error:", e);
        return null;
    }
}

export async function POST(req: NextRequest) {
    try {
        const { url } = await req.json();

        if (!url || typeof url !== "string") {
            return NextResponse.json(
                { error: "URL tidak boleh kosong." },
                { status: 400 }
            );
        }

        const isTikTok =
            /tiktok\.com/i.test(url) ||
            /vm\.tiktok\.com/i.test(url) ||
            /vt\.tiktok\.com/i.test(url);

        if (!isTikTok) {
            return NextResponse.json(
                { error: "URL tidak valid. Pastikan itu link TikTok yang benar." },
                { status: 400 }
            );
        }

        // Strategy 1: tikwm.com API (most reliable)
        console.log("[/api/download] Trying tikwm.com...");
        const tikwmResult = await downloadViaTikWM(url);
        if (tikwmResult) {
            return NextResponse.json(tikwmResult);
        }

        // Strategy 2: Direct TikTok page scraping
        console.log("[/api/download] tikwm failed, trying direct scraping...");
        const directResult = await downloadViaTikTokAPI(url);
        if (directResult) {
            return NextResponse.json(directResult);
        }

        // Strategy 3: At least get metadata via oembed
        console.log("[/api/download] All download methods failed, checking oembed...");
        const oembedResult = await downloadViaOembed(url);
        if (oembedResult) {
            // We have metadata but no download URL — video is valid but can't download
            return NextResponse.json(
                {
                    error:
                        "Video ditemukan tetapi tidak bisa didownload saat ini. Server TikTok mungkin sedang membatasi akses. Coba lagi nanti.",
                },
                { status: 503 }
            );
        }

        // Nothing worked — URL is likely invalid
        return NextResponse.json(
            {
                error:
                    "Video tidak ditemukan. Pastikan URL yang dimasukkan benar dan video masih tersedia.",
            },
            { status: 404 }
        );
    } catch (err) {
        console.error("[/api/download] error:", err);
        return NextResponse.json(
            { error: "Terjadi kesalahan server. Coba beberapa saat lagi." },
            { status: 500 }
        );
    }
}
