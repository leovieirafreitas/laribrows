import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Ícone para quando a cliente salva o site na tela inicial do celular. */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#2a2039" }}>
        <svg width="140" height="140" viewBox="0 0 64 64">
          <path d="M14 38c6-9 12-13 18-13s12 4 18 13" fill="none" stroke="#d1b68b" strokeWidth="3.2" strokeLinecap="round" />
          <circle cx="32" cy="44" r="3" fill="#bba2dd" />
        </svg>
      </div>
    ),
    size,
  );
}
