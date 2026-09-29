export interface DiagramBox {
  type: 'rectangle' | 'circle' | 'diamond';
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Where the straight line from the centre of `box` towards (tx, ty) leaves the
 * shape's outline — so connector arrows end at the edge of a shape instead of
 * disappearing under it.
 */
export const shapeEdgePoint = (box: DiagramBox, tx: number, ty: number): { x: number; y: number } => {
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const dx = tx - cx;
  const dy = ty - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  const hw = box.width / 2;
  const hh = box.height / 2;
  let scale: number;
  if (box.type === 'circle') {
    scale = hw / Math.hypot(dx, dy);
  } else if (box.type === 'diamond') {
    scale = 1 / (Math.abs(dx) / hw + Math.abs(dy) / hh);
  } else {
    scale = Math.min(dx ? hw / Math.abs(dx) : Infinity, dy ? hh / Math.abs(dy) : Infinity);
  }
  return { x: cx + dx * scale, y: cy + dy * scale };
};

/** Start / end points of a connector between two shapes (edge to edge). */
export const connectorEndpoints = (from: DiagramBox, to: DiagramBox) => {
  const fc = { x: from.x + from.width / 2, y: from.y + from.height / 2 };
  const tc = { x: to.x + to.width / 2, y: to.y + to.height / 2 };
  const start = shapeEdgePoint(from, tc.x, tc.y);
  const end = shapeEdgePoint(to, fc.x, fc.y);
  return { x1: start.x, y1: start.y, x2: end.x, y2: end.y };
};
