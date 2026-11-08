import { ImageResponse } from "next/og";

export const size = {
  width: 32,
  height: 32,
};
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 18,
          background: "#09090b",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#f4f4f5",
          borderRadius: 6,
          border: "1px solid #27272a",
          fontWeight: 600,
          fontFamily: "sans-serif",
        }}
      >
        M
      </div>
    ),
    {
      ...size,
    }
  );
}
