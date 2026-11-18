import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

/**
 * Logos da marca (PNG), no visual do site.
 * Redonda: círculo ameixa, filete dourado, arco da sobrancelha e "Lari Brows".
 * - "completa": arco + Lari / Brows + "studio de sobrancelhas".
 * - "perfil": monograma LB grande (foto de perfil do Gmail/WhatsApp, legível bem pequena).
 */
export type RoundLogoVariant = "completa" | "perfil";

/** Logo em linha do topo dos e-mails: "Lari Brows" + "studio de sobrancelhas" + arco. Exibida em 300px de largura. */
export async function wordmarkLogoImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#ffffff",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", fontFamily: "Cormorant", fontSize: 132, lineHeight: 1, color: "#2a2039", letterSpacing: -2 }}>
          <span>Lari</span>
          <span style={{ fontFamily: "Cormorant Italic", fontStyle: "italic", color: "#8566b4", marginLeft: 26 }}>Brows</span>
        </div>
        <div style={{ display: "flex", marginTop: 18, fontFamily: "Cormorant", fontSize: 25, letterSpacing: 12, color: "#7b6a91" }}>
          STUDIO DE SOBRANCELHAS
        </div>
        <svg width="240" height="32" viewBox="0 0 120 16" fill="none" style={{ marginTop: 26 }}>
          <path d="M2 8h34" stroke="#b39568" strokeWidth="0.9" strokeLinecap="round" />
          <path d="M84 8h34" stroke="#b39568" strokeWidth="0.9" strokeLinecap="round" />
          <path d="M42 11c6-6 12-8 18-8s12 2 18 8" stroke="#b39568" strokeWidth="1.2" strokeLinecap="round" />
          <circle cx="60" cy="12.5" r="1.5" fill="#b39568" />
        </svg>
      </div>
    ),
    { width: 880, height: 330, fonts: await fonts(), headers: { "Cache-Control": "public, max-age=86400" } },
  );
}

async function fonts() {
  const [serif, serifItalic] = await Promise.all([
    readFile(join(process.cwd(), "src/assets/fonts/cormorant.ttf")),
    readFile(join(process.cwd(), "src/assets/fonts/cormorant-italic.ttf")),
  ]);
  return [
    { name: "Cormorant", data: serif, style: "normal" as const, weight: 400 as const },
    { name: "Cormorant Italic", data: serifItalic, style: "italic" as const, weight: 400 as const },
  ];
}

function Arch({ width }: { width: number }) {
  return (
    <svg width={width} height={width * 0.3} viewBox="0 0 120 36" fill="none">
      <path d="M14 30c14-17 30-25 46-25s32 8 46 25" stroke="#d1b68b" strokeWidth="3.2" strokeLinecap="round" />
      <circle cx="60" cy="31" r="3.6" fill="#bba2dd" />
    </svg>
  );
}

export async function roundLogoImage(variant: RoundLogoVariant, size = 1024, opts: { squareBackground?: boolean } = {}) {
  const u = size / 1024; // escala
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: opts.squareBackground ? "#2a2039" : "transparent",
        }}
      >
        <div
          style={{
            width: size,
            height: size,
            borderRadius: size,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "radial-gradient(circle at 50% 30%, #3a2d4d 0%, #2a2039 62%, #1c1527 100%)",
          }}
        >
          {/* filete dourado */}
          <div
            style={{
              position: "absolute",
              top: 46 * u,
              left: 46 * u,
              width: size - 92 * u,
              height: size - 92 * u,
              borderRadius: size,
              border: `${3 * u}px solid rgba(209,182,139,0.55)`,
            }}
          />
          {variant === "perfil" ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 40 * u }}>
              <Arch width={340 * u} />
              <div style={{ display: "flex", alignItems: "baseline", marginTop: -10 * u, fontSize: 470 * u, lineHeight: 1, letterSpacing: -10 * u }}>
                <span style={{ fontFamily: "Cormorant", color: "#faf7fd" }}>L</span>
                <span style={{ fontFamily: "Cormorant Italic", fontStyle: "italic", color: "#bba2dd", marginLeft: 22 * u }}>B</span>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 10 * u }}>
              <Arch width={260 * u} />
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 6 * u, lineHeight: 0.92 }}>
                <span style={{ fontFamily: "Cormorant", fontSize: 220 * u, color: "#faf7fd", letterSpacing: -4 * u }}>Lari</span>
                <span style={{ fontFamily: "Cormorant Italic", fontStyle: "italic", fontSize: 220 * u, color: "#bba2dd", letterSpacing: -4 * u }}>
                  Brows
                </span>
              </div>
              <div style={{ display: "flex", marginTop: 40 * u, fontFamily: "Cormorant", fontSize: 36 * u, letterSpacing: 9 * u, color: "#e4d2b2" }}>
                STUDIO DE SOBRANCELHAS
              </div>
            </div>
          )}
        </div>
      </div>
    ),
    {
      width: size,
      height: size,
      fonts: await fonts(),
      headers: { "Cache-Control": "public, max-age=86400" },
    },
  );
}
