import { describe, it, expect } from 'vitest';
import { connectorEndpoints, shapeEdgePoint } from '../../utils/diagram';

describe('diagram connector geometry', () => {
  const rect = { type: 'rectangle' as const, x: 0, y: 0, width: 120, height: 60 };

  it('ends on the edge of a rectangle', () => {
    expect(shapeEdgePoint(rect, 500, 30)).toEqual({ x: 120, y: 30 });
    expect(shapeEdgePoint(rect, 60, -400)).toEqual({ x: 60, y: 0 });
    // Diagonal towards a corner-ish direction hits the nearer side
    const p = shapeEdgePoint(rect, 160, 130);
    expect(p.y).toBeCloseTo(60);
    expect(p.x).toBeCloseTo(90);
  });

  it('ends on the outline of a circle and a diamond', () => {
    const circle = { type: 'circle' as const, x: 0, y: 0, width: 80, height: 80 };
    const c = shapeEdgePoint(circle, 40 + 300, 40 + 400);
    expect(Math.hypot(c.x - 40, c.y - 40)).toBeCloseTo(40);
    const diamond = { type: 'diamond' as const, x: 0, y: 0, width: 120, height: 100 };
    expect(shapeEdgePoint(diamond, 1000, 50)).toEqual({ x: 120, y: 50 });
    const d = shapeEdgePoint(diamond, 160, 150);
    expect(Math.abs(d.x - 60) / 60 + Math.abs(d.y - 50) / 50).toBeCloseTo(1);
  });

  it('returns the centre when the target is the centre', () => {
    expect(shapeEdgePoint(rect, 60, 30)).toEqual({ x: 60, y: 30 });
  });

  it('connects two shapes edge to edge', () => {
    const b = { ...rect, x: 300 };
    expect(connectorEndpoints(rect, b)).toEqual({ x1: 120, y1: 30, x2: 300, y2: 30 });
  });
});
