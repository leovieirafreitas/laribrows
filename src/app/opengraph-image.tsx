import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

/** Cartão que aparece quando o link do site é compartilhado (WhatsApp, Instagram, etc.). */
export const alt = "Lari Brows · Studio de sobrancelhas";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage() {
  const [photo, serif, serifItalic] = await Promise.all([
    readFile(join(process.cwd(), "src/assets/larissa.jpg")),
    readFile(join(process.cwd(), "src/assets/fonts/cormorant.ttf")),
    readFile(join(process.cwd(), "src/assets/fonts/cormorant-italic.ttf")),
  ]);
  const photoSrc = `data:image/jpeg;base64,${photo.toString("base64")}`;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#faf7fd" }}>
        {/* Foto */}
        <div style={{ width: 500, height: "100%", display: "flex", position: "relative" }}>
          <img src={photoSrc} alt="" width={500} height={630} style={{ width: 500, height: 630, objectFit: "cover", objectPosition: "55% 30%" }} />
        </div>
        {/* Texto */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "0 80px",
            background: "linear-gradient(135deg, #faf7fd 0%, #f4eefa 55%, #e9dff5 100%)",
          }}
        >
          <div style={{ fontSize: 20, letterSpacing: 8, color: "#6c5194", fontFamily: "Cormorant" }}>STUDIO DE SOBRANCELHAS</div>
          <div style={{ display: "flex", alignItems: "baseline", marginTop: 18, fontSize: 112, color: "#2a2039", fontFamily: "Cormorant", lineHeight: 1 }}>
            Lari&nbsp;<span style={{ fontFamily: "CormorantItalic", color: "#8566b4" }}>Brows</span>
          </div>
          <div style={{ width: 120, height: 2, background: "#d1b68b", marginTop: 34 }} />
          <div style={{ marginTop: 30, fontSize: 38, color: "#4a3a60", fontFamily: "CormorantItalic" }}>O olhar que revela a sua essência.</div>
          <div style={{ marginTop: 40, fontSize: 24, color: "#5a4672", fontFamily: "Cormorant", letterSpacing: 2 }}>Agende online · PIX ou cartão</div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Cormorant", data: serif, style: "normal", weight: 400 },
        { name: "CormorantItalic", data: serifItalic, style: "normal", weight: 400 },
      ],
    },
  );
}
