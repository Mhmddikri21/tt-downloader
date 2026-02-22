import type { Metadata } from "next";
import DownloadForm from "@/components/DownloadForm";

export const metadata: Metadata = {
  title: "TT Downloader — Download TikTok Tanpa Watermark",
  description:
    "Download video TikTok tanpa watermark secara gratis dan cepat. Paste link, klik download, selesai.",
};

const features = [
  "Tanpa Watermark",
  "Download Audio MP3",
  "Gratis & Cepat",
  "Tanpa Login",
  "HD Quality",
];

export default function Home() {
  return (
    <>
      {/* Animated background orbs */}
      <div className="bg-orb bg-orb-1" />
      <div className="bg-orb bg-orb-2" />
      <div className="bg-orb bg-orb-3" />

      <main className="page-wrapper">
        {/* Hero */}
        <div className="hero">
          <div className="logo-badge">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="currentColor"
              style={{ flexShrink: 0 }}
            >
              <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.34 6.34 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.76a4.85 4.85 0 01-1.01-.07z" />
            </svg>
            TT Downloader
          </div>
          <h1>
            Download TikTok{" "}
            <span className="gradient-text">Tanpa Watermark</span>
          </h1>
          <p>
            Paste link video TikTok, klik tombol download, dan dapatkan video
            berkualitas tinggi tanpa watermark — gratis.
          </p>
        </div>

        {/* Feature pills */}
        <div className="features">
          {features.map((f) => (
            <div className="feature-pill" key={f}>
              <span className="dot" />
              {f}
            </div>
          ))}
        </div>

        {/* Download form + result */}
        <DownloadForm />

        {/* Footer */}
        <footer>
          <p>
            Dibuat dengan <span>♥</span> menggunakan Next.js
          </p>
          <p style={{ marginTop: 4 }}>
            Gunakan untuk keperluan pribadi. Hormati hak cipta kreator.
          </p>
        </footer>
      </main>
    </>
  );
}
