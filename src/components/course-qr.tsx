import { courseQrModel } from "@/lib/course-qr";

/** Small print QR. The parent link carries the course URL and the accessible name. */
export function CourseQr({ url }: { url: string }) {
  const { size, path } = courseQrModel(url);
  return (
    <svg
      className="pp-qr"
      data-url={url}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-hidden="true"
      focusable="false"
      shapeRendering="crispEdges"
    >
      <rect width={size} height={size} fill="#fff" />
      <path d={path} fill="#111" />
    </svg>
  );
}
