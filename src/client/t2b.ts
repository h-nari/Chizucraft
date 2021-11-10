// タイル座標 <=> ブロック座標変換

import { ProjectionParameter } from "./tileMaker";

export class TileBlockTranformation {
  public ax;
  public ay;
  public bx;
  public by;

  constructor(param: ProjectionParameter, tileZoom: number) {
    let zs = Math.pow(2, param.zoom - tileZoom);
    let sx = param.mPerPoint.x / param.blocksize;
    let sy = param.mPerPoint.y / param.blocksize;
    this.ax = zs * sx;
    this.bx = -param.oPoint.x * sx;
    this.ay = zs * sy;
    this.by = -param.oPoint.y * sy;
  }

  toBx(tx: number) { return this.ax * tx + this.bx; }
  toBy(ty: number) { return this.ay * ty + this.by; }
  toTx(x: number) { return (x - this.bx) / this.ax; }
  toTy(y: number) { return (y - this.by) / this.ay; }
}