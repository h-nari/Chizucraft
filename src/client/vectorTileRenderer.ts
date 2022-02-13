import { cc_stat } from "./chizucraft";
import { CoordinateTransformation } from "./ct";
import { TileBlockTranformation } from "./t2b";
import { TaskControl } from "./taskQueue";
import { VectorFeature, VectorLayer, VectorTile } from "./vectorTile";

type DrawFunc = (feature: VectorFeature) => void;

export class VectorTileRenderer {
  ctx: CanvasRenderingContext2D;
  ct: CoordinateTransformation;
  tb: TileBlockTranformation;
  tx: number;
  ty: number;
  vm: VectorTile;
  currentLayer: VectorLayer | undefined;
  currentDrawFunc: DrawFunc | undefined;
  drawFuncs: DrawFunc[] = [];
  layers: VectorLayer[] = [];
  features: VectorFeature[] = [];
  fResolve: ((value: unknown) => void) | undefined;
  fReject: ((reason?: any) => void) | undefined;
  ctrl: TaskControl | undefined;
  toX: (x: number) => number = x => x;
  toY: (y: number) => number = y => y;
  x0 = 0;
  y0 = 0;
  x1 = 0;
  y1 = 0;
  stat: cc_stat;

  constructor(ctx: CanvasRenderingContext2D, ct: CoordinateTransformation, tb: TileBlockTranformation,
    tx: number, ty: number, vm: VectorTile, stat: cc_stat) {
    this.ctx = ctx;
    this.ct = ct;
    this.tb = tb;
    this.tx = tx;
    this.ty = ty;
    this.vm = vm;
    this.currentLayer = undefined;
    this.stat = stat;
  }

  setArea(x0: number, y0: number, x1: number, y1: number) {
    this.x0 = x0;
    this.y0 = y0;
    this.x1 = x1;
    this.y1 = y1;
  }

  draw(ctrl: TaskControl) {
    this.ctrl = ctrl;
    return new Promise((resolve, reject) => {
      this.toX = (x: number) => { return this.ct.toX(this.tb.toBx(x * 256 / 4096 + this.tx)); };
      this.toY = (y: number) => { return this.ct.toY(this.tb.toBy(y * 256 / 4096 + this.ty)); };
      let x0 = this.toX(0);
      let x1 = this.toX(4096);
      let y0 = this.toY(0);
      let y1 = this.toY(4096);
      let ctx = this.ctx;
      if (false) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(this.x0, this.y0, this.x1 - this.x0, this.y1 - this.y0);
        ctx.clip();
        ctx.fillStyle = 'gray';
        ctx.beginPath();
        ctx.rect(x0, y0, x1 - x0, y1 - y0);
        ctx.fill();
        ctx.restore();
      }
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'black';
      ctx.fillStyle = 'lightgray';
      this.fResolve = resolve;
      this.fReject = reject;
      this.drawFuncs = [];
      if (this.ct.ax >= 4)
        this.drawFuncs.push((feature) => { this.drawFeatureWithBlocks(feature) });
      this.drawFuncs.push((feature) => { this.drawFeatureWithVectors(feature) });

      this.check();
    });
  }
  resolve(mes: string) {
    if (this.fResolve) {
      this.fResolve(mes);
      return mes;
    }
    return '';
  }

  check() {
    if (this.ctrl?.stop)
      return this.resolve('stop');
    let tStart = performance.now();
    while (performance.now() - tStart < 100) {
      if (this.currentDrawFunc && this.features.length > 0) {
        this.currentDrawFunc(this.features.shift() as VectorFeature);
      } else if (this.currentDrawFunc && this.layers.length > 0) {
        this.currentLayer = this.layers.shift() as VectorLayer;
        this.features = this.currentLayer.features.concat();
      } else if (this.drawFuncs.length > 0) {
        this.currentDrawFunc = this.drawFuncs.shift() as DrawFunc;
        // const weight: { [key: string]: number } = { 'building': 10, 'road': 20 };
        let layer = this.stat.layer;
        this.layers = Object.values(this.vm.layers).sort((a, b) => (layer[a.name]?.ord || 0) - (layer[b.name]?.ord || 0));
        this.features = [];
      } else {
        return this.resolve('done');
      }
    }
    setTimeout(() => { this.check(); }, 0);
  }

  drawFeatureWithBlocks(feature: VectorFeature) {
    if (this.currentLayer?.name == 'road' && feature.attr('rnkWidth')) return;
    if (this.ct.ax >= 4) {
      let name = this.currentLayer?.name;
      let layer = this.stat.layer;
      if ((name && name in layer && layer[name].bBlockDisp && feature.feature.getType() != 3)) {
        this.ctx.save();
        this.ctx.fillStyle = layer[name].blockColor;
        var bx0: number, by0: number;
        feature.geo_parse((cmd, x, y) => {
          let bx = this.tb.toBx(x * 256 / 4096 + this.tx);
          let by = this.tb.toBy(y * 256 / 4096 + this.ty);
          if (cmd == 'lineto') {
            this.ctx.save();
            this.ctx.beginPath();
            this.ctx.rect(this.x0, this.y0, this.x1 - this.x0, this.y1 - this.y0);
            this.ctx.clip();
            blockLine(this.ctx, this.ct, bx0, by0, bx, by);
            this.ctx.restore();
          }
          bx0 = bx;
          by0 = by;
        });
        this.ctx.restore();
      }
    }
  }

  drawFeatureWithVectors(feature: VectorFeature) {
    let ctx = this.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.rect(this.x0, this.y0, this.x1 - this.x0, this.y1 - this.y0);
    ctx.clip();


    feature.geo_parse((cmd, x, y) => {
      if (cmd == 'begin')
        ctx.beginPath();
      else if (cmd == 'moveto')
        ctx.moveTo(this.toX(x), this.toY(y));
      else if (cmd == 'lineto')
        ctx.lineTo(this.toX(x), this.toY(y));
      else if (cmd == 'closepath')
        ctx.closePath();
      else if (cmd == 'end') {
        if (feature.feature.getType() == 3) {
          ctx.save();
          ctx.globalAlpha = 0.2;
          ctx.fill();
          ctx.restore();
        }
        else
          ctx.stroke();
      }
    });
    ctx.restore();
  }
}

export function blockLine(ctx: CanvasRenderingContext2D, ct: CoordinateTransformation, bx0: number, by0: number, bx1: number, by1: number) {
  let x0 = ct.toX(bx0);
  let x1 = ct.toX(bx1);
  let y0 = ct.toY(by0);
  let y1 = ct.toY(by1);

  let dx = Math.abs(bx1 - bx0);
  let dy = Math.abs(by1 - by0);

  drawBlock(ctx, ct, bx0, by0);
  if (dx > dy) {
    if (bx0 > bx1) {
      [bx0, bx1] = [bx1, bx0];
      [by0, by1] = [by1, by0];
    }
    for (let bx = Math.ceil(bx0) + 0.5; bx < bx1; bx++) {
      let by = by0 + (by1 - by0) * (bx - bx0) / (bx1 - bx0);
      drawBlock(ctx, ct, bx, by);
    }
  } else {
    if (by0 > by1) {
      [bx0, bx1] = [bx1, bx0];
      [by0, by1] = [by1, by0];
    }
    for (let by = Math.ceil(by0) + 0.5; by < by1; by++) {
      let bx = bx0 + (bx1 - bx0) * (by - by0) / (by1 - by0);
      drawBlock(ctx, ct, bx, by);
    }
  }
  drawBlock(ctx, ct, bx1, by1);
}


function drawBlock(ctx: CanvasRenderingContext2D, ct: CoordinateTransformation, bx: number, by: number) {
  let x = ct.toX(Math.floor(bx));
  let y = ct.toY(Math.floor(by));
  ctx.fillRect(x, y, ct.ax, ct.ay);
}


