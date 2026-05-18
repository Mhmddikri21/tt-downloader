import { NextRequest, NextResponse } from "next/server";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { Readable } from "node:stream";

export const runtime = "nodejs";

function isPrivateIp(hostname: string): boolean {
    // IPv4 private ranges
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) {
        const [a, b] = hostname.split(".").map(Number);

        return (
            a === 10 ||
            a === 127 ||
            a === 0 ||
            (a === 169 && b === 254) ||
            (a === 172 && b >= 16 && b <= 31) ||
            (a === 192 && b === 168)
        );
    }

    const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, "");

    // IPv6 private/reserved ranges & localhost
    if (
        normalized === "localhost" ||
        normalized.endsWith(".localhost") ||
        normalized === "::1" ||
        normalized.startsWith("fc") ||  // fc00::/7 unique local
        normalized.startsWith("fd") ||  // fc00::/7 unique local
        normalized.startsWith("fe8") || // fe80::/10 link-local
        normalized.startsWith("fe9") ||
        normalized.startsWith("fea") ||
        normalized.startsWith("feb") ||
        normalized.startsWith("::ffff:") // IPv4-mapped IPv6
    ) {
        return true;
    }

    return false;
}

// Only allow TikTok CDN domains — prevents open proxy abuse
const ALLOWED_CDN_SUFFIXES = [
    "tiktokcdn.com",
    "tiktokcdn-us.com",
    "tiktokcdn-eu.com",
    "tiktokcdn-in.com",
    "tiktokv.com",
    "tiktokv.us",
    "tikwm.com",
    "tikcdn.io",
    "muscdn.com",
    "musicalcdn.com",
    "byteoversea.com",
    "ibytedtos.com",
    "byteimg.com",
    "bytedance.com",
    "bytegecko.com",
    "byted-static.com",
    "byteicdn.com",
    "bytetcdn.com",
    "musical.ly",
    "ipstatp.com",
    "pstatp.com",
    "ibyteimg.com",
    "sgsnssdk.com",
    "ssstik.io",
];

function isAllowedPublicHost(hostname: string): boolean {
    if (!hostname) return false;
    if (isPrivateIp(hostname)) return false;
    const h = hostname.toLowerCase();
    return ALLOWED_CDN_SUFFIXES.some(
        (suffix) => h === suffix || h.endsWith(`.${suffix}`)
    );
}

function sanitizeFilename(filename: string): string {
    const cleaned = filename
        .replace(/[\r\n"]/g, "")
        .replace(/[\\/:*?<>|]/g, "")
        .trim();

    return cleaned || "tiktok-video.mp4";
}

function isAbortError(err: unknown): boolean {
    return (
        err instanceof DOMException && err.name === "TimeoutError"
    ) || (
        err instanceof Error && err.name === "AbortError"
    );
}

function getProxyErrorMessage(err: unknown): string {
    if (err instanceof TypeError) {
        return "URL file tidak valid atau sumber media tidak bisa diakses.";
    }

    if (isAbortError(err)) {
        return "Sumber media terlalu lama merespons. Coba ulangi download.";
    }

    return "Proxy error. Coba lagi.";
}

function getRequestHeaders(): Record<string, string> {
    return {
        "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "*/*",
        Referer: "https://www.tiktok.com/",
    };
}

async function fetchWithNode(
    url: URL,
    headOnly: boolean,
    redirects = 0
): Promise<Response> {
    if (redirects > 5) {
        throw new Error("Too many redirects");
    }

    return new Promise((resolve, reject) => {
        const request = url.protocol === "http:" ? httpRequest : httpsRequest;
        const req = request(
            url,
            {
                method: headOnly ? "HEAD" : "GET",
                headers: getRequestHeaders(),
            },
            (res) => {
                const status = res.statusCode ?? 502;
                const location = res.headers.location;

                if (status >= 300 && status < 400 && location) {
                    res.resume();
                    fetchWithNode(new URL(location, url), headOnly, redirects + 1)
                        .then(resolve)
                        .catch(reject);
                    return;
                }

                const headers = new Headers();
                Object.entries(res.headers).forEach(([key, value]) => {
                    if (Array.isArray(value)) {
                        headers.set(key, value.join(", "));
                    } else if (typeof value === "string") {
                        headers.set(key, value);
                    }
                });

                const body = headOnly
                    ? null
                    : Readable.toWeb(res) as BodyInit;

                resolve(new Response(body, {
                    status,
                    statusText: res.statusMessage,
                    headers,
                }));
            }
        );

        req.setTimeout(25000, () => {
            req.destroy(new Error("Request timeout"));
        });
        req.on("error", reject);
        req.end();
    });
}

async function handleProxy(req: NextRequest, headOnly = false) {
    const { searchParams } = new URL(req.url);
    const fileUrl = searchParams.get("url");
    const filename = sanitizeFilename(
        searchParams.get("filename") ?? "tiktok-video.mp4"
    );

    if (!fileUrl) {
        return NextResponse.json({ error: "Missing url param" }, { status: 400 });
    }

    try {
        let parsedUrl: URL;

        try {
            parsedUrl = new URL(fileUrl);
        } catch {
            return NextResponse.json(
                { error: "URL file tidak valid. Coba proses link TikTok lagi." },
                { status: 400 }
            );
        }

        const hostname = parsedUrl.hostname.toLowerCase();

        if (!["http:", "https:"].includes(parsedUrl.protocol) || !isAllowedPublicHost(hostname)) {
            return NextResponse.json(
                { error: `Sumber file tidak diizinkan: ${hostname}` },
                { status: 400 }
            );
        }

        let response: Response;

        try {
            response = await fetch(parsedUrl, {
                method: headOnly ? "HEAD" : "GET",
                headers: getRequestHeaders(),
                redirect: "follow",
                cache: "no-store",
                signal: AbortSignal.timeout(20000),
            });
        } catch (err) {
            console.error("[/api/proxy] fetch failed, trying node stream:", err);
            response = await fetchWithNode(parsedUrl, headOnly);
        }

        if (!response.ok || (!headOnly && !response.body)) {
            console.error("[/api/proxy] upstream failed:", {
                status: response.status,
                statusText: response.statusText,
                host: hostname,
            });

            return NextResponse.json(
                { error: "Gagal mengambil file dari sumber. Coba proses link TikTok lagi." },
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

        const upstreamType = response.headers.get("content-type")?.toLowerCase() ?? "";
        if (upstreamType.startsWith("text/html")) {
            return NextResponse.json(
                { error: "Sumber file mengembalikan halaman, bukan media." },
                { status: 502 }
            );
        }

        const headers = new Headers({
            "Content-Type": contentType,
            "Content-Disposition": `attachment; filename="${filename}"`,
            "Cache-Control": "no-store",
        });

        const contentLength = response.headers.get("content-length");
        if (contentLength) {
            headers.set("Content-Length", contentLength);
        }

        return new NextResponse(headOnly ? null : response.body, {
            status: 200,
            headers,
        });
    } catch (err) {
        console.error("[/api/proxy] error:", err);
        return NextResponse.json(
            { error: getProxyErrorMessage(err) },
            { status: 500 }
        );
    }
}

export async function GET(req: NextRequest) {
    return handleProxy(req);
}

export async function HEAD(req: NextRequest) {
    return handleProxy(req, true);
}
