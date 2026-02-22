import { Downloader } from "@tobyg74/tiktok-api-dl";
import { NextRequest, NextResponse } from "next/server";

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
            /tiktok\.com\/@?[\w.]+\/video\/\d+/i.test(url) ||
            /vm\.tiktok\.com\/\w+/i.test(url) ||
            /vt\.tiktok\.com\/\w+/i.test(url);

        if (!isTikTok) {
            return NextResponse.json(
                { error: "URL tidak valid. Pastikan itu link TikTok yang benar." },
                { status: 400 }
            );
        }

        const result = await Downloader(url, {
            version: "v1",
        });

        if (result.status !== "success" || !result.result) {
            return NextResponse.json(
                { error: "Gagal mengambil video. Coba lagi atau gunakan link lain." },
                { status: 500 }
            );
        }

        const data = result.result;

        // Extract video without watermark
        // The library returns nowatermark or video arrays depending on version
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const d = data as any;
        const videoUrl =
            d.video?.nowatermark?.[0] ||
            d.video?.[0] ||
            d.video2?.[0] ||
            null;

        const audioUrl = d.music ?? d.music_info?.play_url?.uri ?? null;
        const thumbnail =
            d.cover?.[0] ?? d.origin_cover?.[0] ?? d.dynamic_cover?.[0] ?? null;
        const title = d.title ?? d.desc ?? "Video TikTok";
        const author =
            d.author?.nickname ?? d.author?.unique_id ?? "Unknown";

        if (!videoUrl) {
            return NextResponse.json(
                { error: "Link video tanpa watermark tidak tersedia untuk video ini." },
                { status: 404 }
            );
        }

        return NextResponse.json({
            title,
            author,
            thumbnail,
            videoUrl,
            audioUrl,
        });
    } catch (err) {
        console.error("[/api/download] error:", err);
        return NextResponse.json(
            { error: "Terjadi kesalahan server. Coba beberapa saat lagi." },
            { status: 500 }
        );
    }
}
