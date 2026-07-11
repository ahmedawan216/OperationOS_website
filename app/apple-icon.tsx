import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/**
 * iOS home-screen icon, generated from the same logo mark used in
 * `components/ui/logo.tsx`. Next's file convention wires up the
 * `<link rel="apple-touch-icon">` tag automatically — nothing to add to
 * `metadata.icons` for this one.
 */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#08090c",
        }}
      >
        <div
          style={{
            width: 96,
            height: 96,
            borderRadius: 26,
            border: "5px solid rgba(255,255,255,0.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 8,
              backgroundColor: "#6e7bf7",
            }}
          />
        </div>
      </div>
    ),
    { ...size }
  );
}
