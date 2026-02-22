import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const fileUrl = searchParams.get("url");
    const filename = searchParams.get("filename") ?? "tiktok-video.mp4";

    if (!fileUrl) {
        return NextResponse.json({ error: "Missing url param" }, { status: 400 });
    }

    try {
        const response = await fetch(fileUrl, {
            headers: {
                "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                Referer: "https://www.tiktok.com/",
            },
        });

        if (!response.ok || !response.body) {
            return NextResponse.json(
                { error: "Gagal mengambil file dari sumber." },
                { status: 502 }
            );
        }

        // Force correct MIME type based on filename extension
        // (upstream server sometimes returns wrong content-type)
        let contentType = "application/octet-stream";
        if (filename.endsWith(".mp4")) {
            contentType = "video/mp4";
        } else if (filename.endsWith(".mp3")) {
            contentType = "audio/mpeg";
        }

        return new NextResponse(response.body, {
            status: 200,
            headers: {
                "Content-Type": contentType,
                "Content-Disposition": `attachment; filename="${filename}"`,
                "Cache-Control": "no-store",
            },
        });
    } catch (err) {
        console.error("[/api/proxy] error:", err);
        return NextResponse.json(
            { error: "Proxy error. Coba lagi." },
            { status: 500 }
        );
    }
}
