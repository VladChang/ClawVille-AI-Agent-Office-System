export type Point = { x: number; y: number };
export type Polygon = Point[];

export function rect(x: number, y: number, width: number, height: number): Polygon {
  return [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height }
  ];
}

export function pointInPolygon(point: Point, polygon: Polygon): boolean {
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;

    const intersects =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / Math.max(Number.EPSILON, yj - yi) + xi;

    if (intersects) inside = !inside;
  }

  return inside;
}

export function pointInAnyPolygon(point: Point, polygons: Polygon[]): boolean {
  return polygons.some((polygon) => pointInPolygon(point, polygon));
}

export function distanceBetween(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function moveTowards(from: Point, to: Point, distance: number): Point {
  const total = distanceBetween(from, to);
  if (total <= distance || total === 0) return to;
  const ratio = distance / total;
  return {
    x: from.x + (to.x - from.x) * ratio,
    y: from.y + (to.y - from.y) * ratio
  };
}

export function polygonCentroid(polygon: Polygon): Point {
  const sum = polygon.reduce(
    (acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }),
    { x: 0, y: 0 }
  );

  return {
    x: sum.x / polygon.length,
    y: sum.y / polygon.length
  };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
