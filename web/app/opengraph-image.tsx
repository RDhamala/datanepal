import { ImageResponse } from "next/og";

/*
  Without this, every share of every page -- Slack, Twitter, WhatsApp -- fell
  back to a bare text card with no image, which is a real distribution cost
  for a platform that lives on being cited and shared. Devanagari is left out
  here specifically: `ImageResponse` renders through satori, which needs an
  explicit font buffer with the right glyphs, and guessing at one risked
  shipping tofu boxes instead of text. The bilingual wordmark itself already
  gets that treatment correctly on every real page.
*/

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const dynamic = "force-static";

export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "80px 96px",
        background: "#ffffff",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div
        style={{
          width: 64,
          height: 6,
          background: "#1c5aa6",
          marginBottom: 40,
        }}
      />
      <div
        style={{
          fontSize: 76,
          fontWeight: 700,
          color: "#0f0f0e",
          letterSpacing: -2,
        }}
      >
        DataNepal
      </div>
      <div style={{ fontSize: 32, color: "#4d4c49", marginTop: 20 }}>
        Nepal, in data.
      </div>
      <div style={{ fontSize: 24, color: "#77766e", marginTop: 28, maxWidth: 820 }}>
        Open, documented public data for Nepal — population, economy and geography, with
        every figure traceable to its publisher.
      </div>
    </div>,
    { ...size },
  );
}
