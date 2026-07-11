import { ImageResponse } from "next/og";

// NOTE: deliberately no `export const runtime = "edge"` here. This route
// has no geolocation/low-latency requirement, and pinning it to edge
// disables static generation for it (confirmed in our own build output) —
// the default Node.js runtime lets Next render this once at build time
// and serve it as a static asset instead of invoking a function per request.
export const alt = "OperationOS.ai — the operating system for AI employees";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          padding: "80px",
          backgroundColor: "#08090c",
          backgroundImage:
            "radial-gradient(circle at 30% 20%, rgba(110,123,247,0.22), transparent 60%)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 40,
          }}
        >
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              border: "2px solid rgba(255,255,255,0.25)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: 3,
                backgroundColor: "#6e7bf7",
              }}
            />
          </div>
          <div style={{ display: "flex", fontSize: 26, color: "#f2f3f5" }}>
            OperationOS<span style={{ color: "#4c515a" }}>.ai</span>
          </div>
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 62,
            fontWeight: 600,
            color: "#f2f3f5",
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
            maxWidth: 920,
          }}
        >
          Your company, running on AI employees.
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 28,
            fontSize: 26,
            color: "#8b8f98",
            maxWidth: 780,
          }}
        >
          RecruitOS is the first employee online.
        </div>
      </div>
    ),
    { ...size }
  );
}
