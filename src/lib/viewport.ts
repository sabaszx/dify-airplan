/**
 * Viewport transform between world meters and screen pixels. The floor plan's
 * background image is placed using its own metersPerPixel; the viewport adds
 * user zoom/pan on top. All object coordinates remain in meters. See design.md §2.
 */
export interface Viewport {
  zoom: number; // screen pixels per world-pixel unit
  panX: number; // screen px
  panY: number; // screen px
}

export const IDENTITY_VIEWPORT: Viewport = { zoom: 1, panX: 0, panY: 0 };

/**
 * Convert world meters -> screen pixels.
 * worldPx = meters / metersPerPixel (image space), then apply zoom+pan.
 */
export function worldToScreen(
  xM: number,
  yM: number,
  metersPerPixel: number,
  vp: Viewport,
): { x: number; y: number } {
  const mpp = metersPerPixel || 0.02;
  const wx = xM / mpp;
  const wy = yM / mpp;
  return { x: wx * vp.zoom + vp.panX, y: wy * vp.zoom + vp.panY };
}

/** Convert screen pixels -> world meters. */
export function screenToWorld(
  sx: number,
  sy: number,
  metersPerPixel: number,
  vp: Viewport,
): { x: number; y: number } {
  const mpp = metersPerPixel || 0.02;
  const wx = (sx - vp.panX) / vp.zoom;
  const wy = (sy - vp.panY) / vp.zoom;
  return { x: wx * mpp, y: wy * mpp };
}

export function clampZoom(z: number): number {
  return Math.min(Math.max(z, 0.1), 8);
}
