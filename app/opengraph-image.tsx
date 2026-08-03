import { ImageResponse } from "next/og";

export const alt = "OperationOS.org — The Operating System for AI Employees";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "48px",
          background: "#08090c",
          color: "#f5f5f5",
          fontFamily: "Inter, sans-serif",
        }}
      >
        {/* Top */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 20,
          }}
        >
          <img
            src="https://operationos.org/favicon.svg"
            width={64}
            height={64}
            alt="OperationOS"
          />

          <div
            style={{
              display: "flex",
              fontSize: 34,
              fontWeight: 500,
            }}
          >
            OperationOS.org
          </div>
        </div>

        {/* Center */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            gap: 28,
          }}
        >
          <div
            style={{
              fontSize: 78,
              fontWeight: 700,
              lineHeight: 1.1,
              maxWidth: 950,
            }}
          >
            Your company,
            <br />
            running on AI employees.
          </div>

          <div
            style={{
              fontSize: 38,
              color: "#9ca3af",
              maxWidth: 900,
              lineHeight: 1.4,
            }}
          >
            RecruitOS is the first AI employee.
            <br />
            It screens resumes, ranks candidates,
            <br />
            and helps companies hire faster.
          </div>
        </div>

        {/* Bottom */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 28,
            color: "#f5f5f5",
          }}
        >
          <div>OperationOS.org</div>
          <div>The Operating System for AI Employees</div>
        </div>
      </div>
    ),
    size
  );
}