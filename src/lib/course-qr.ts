// QR symbol for one course on the pathway print ticket. Synchronous (no
// canvas) so the sheet is complete on first paint, including window.print.
import { create } from "qrcode";

/** Quiet zone, in modules. The print frame adds a little more white. */
const MARGIN = 1;

export type CourseQrModel = {
  /** Modules per side, including the quiet zone. */
  size: number;
  /** Dark modules as one SVG path, in module coordinates. */
  path: string;
};

const modelCache = new Map<string, CourseQrModel>();

/**
 * QR for a course's full URL. Error correction M. The matrix is the `qrcode`
 * symbol for that exact string — nothing is shortened or wrapped.
 * Cached per URL: the pathway view re-renders on progress edits, and the
 * symbol never changes for a given link.
 */
export function courseQrModel(url: string): CourseQrModel {
  const cached = modelCache.get(url);
  if (cached) return cached;
  const qr = create(url, { errorCorrectionLevel: "M" });
  const n = qr.modules.size;
  const { data } = qr.modules;
  const parts: string[] = [];
  for (let row = 0; row < n; row += 1) {
    for (let col = 0; col < n; col += 1) {
      if (data[row * n + col]) {
        const x = col + MARGIN;
        const y = row + MARGIN;
        parts.push(`M${x} ${y}h1v1H${x}z`);
      }
    }
  }
  const model = { size: n + MARGIN * 2, path: parts.join("") };
  modelCache.set(url, model);
  return model;
}
