import { CoordinateTransformation } from "./ct";

export class Point {
  public x: number;
  public y: number;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  transform(ct: CoordinateTransformation) {
    return new Point(ct.toX(this.x), ct.toY(this.y));
  }

  chebyshev(x: number, y: number) {
    return Math.max(Math.abs(x - this.x), Math.abs(y - this.y));
  }
};

export function point(x: number, y: number) {
  return new Point(x, y);
};