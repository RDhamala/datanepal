import { ImageResponse } from "next/og";

/*
  Generated rather than drawn, so the tab icon uses the same brand colour
  token as everything else instead of a separately-exported PNG that would
  drift from it. A plain browser tab with the generic globe icon was the
  first thing visible on every single page, before any of the rest of the
  brand had a chance to say otherwise.
*/

export const size = { width: 32, height: 32 };
export const contentType = "image/png";
export const dynamic = "force-static";

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#1c5aa6",
        color: "#ffffff",
        fontSize: 21,
        fontWeight: 700,
        fontFamily: "system-ui, sans-serif",
        letterSpacing: -1,
      }}
    >
      D
    </div>,
    { ...size },
  );
}
