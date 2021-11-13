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
  canvasWidth = 0;
  canvasHeight = 0;

  constructor(ctx: CanvasRenderingContext2D, ct: CoordinateTransformation, tb: TileBlockTranformation,
    tx: number, ty: number, vm: VectorTile) {
    this.ctx = ctx;
    this.ct = ct;
    this.tb = tb;
    this.tx = tx;
    this.ty = ty;
    this.vm = vm;
    this.currentLayer = undefined;
  }

  setCanvasSize(width: number, height: number) {
    this.canvasWidth = width;
    this.canvasHeight = height;
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
      ctx.fillStyle = 'white';
      ctx.beginPath();
      ctx.rect(x0, y0, x1 - x0, y1 - y0);
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'black';
      ctx.fillStyle = 'lightgray';
      this.fResolve = resolve;
      this.fReject = reject;
      this.drawFuncs = [
        (feature) => { this.drawFeatureWithBlocks(feature) },
        (feature) => { this.drawFeatureWithVectors(feature) }
      ];
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
    for (let i = 0; i < 500; i++) {
      if (this.currentDrawFunc && this.features.length > 0) {
        this.currentDrawFunc(this.features.shift() as VectorFeature);
      } else if (this.currentDrawFunc && this.layers.length > 0) {
        this.currentLayer = this.layers.shift() as VectorLayer;
        this.features = this.currentLayer.features.concat();
      } else if (this.drawFuncs.length > 0) {
        this.currentDrawFunc = this.drawFuncs.shift() as DrawFunc;
        this.layers = Object.values(this.vm.layers);
        this.features = [];
      } else {
        return this.resolve('done');
      }
    }
    setTimeout(() => { this.check(); }, 0);
  }

  drawFeatureWithBlocks(feature: VectorFeature) {
    if (this.ct.ax >= 4) {
      let name = this.currentLayer?.name;
      let colors: { [name: string]: string } = { road: 'gray', building: 'red', river: 'blue' };
      if ((name && name in colors && feature.feature.getType() != 3)) {
        this.ctx.save();
        this.ctx.fillStyle = colors[name];
        var bx0: number, by0: number;
        feature.geo_parse((cmd, x, y) => {
          let bx = this.tb.toBx(x * 256 / 4096 + this.tx);
          let by = this.tb.toBy(y * 256 / 4096 + this.ty);
          if (cmd == 'lineto')
            this.blockLine(bx0, by0, bx, by);
          bx0 = bx;
          by0 = by;
        });
        this.ctx.restore();
      }
    }
  }

  drawFeatureWithVectors(feature: VectorFeature) {
    let ctx = this.ctx;
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
  }

  blockLine(bx0: number, by0: number, bx1: number, by1: number) {
    let x0 = this.ct.toX(bx0);
    let x1 = this.ct.toX(bx1);
    if (x0 < 0 && x1 < 0) return;
    if (x0 > this.canvasWidth && x1 > this.canvasWidth) return;
    let y0 = this.ct.toY(by0);
    let y1 = this.ct.toY(by1);
    if (y0 < 0 && y1 < 0) return;
    if (y0 > this.canvasHeight && y1 > this.canvasHeight) return;

    this.ctx.save();
    // this.ctx.globalAlpha = 0.5;
    let dx = Math.abs(bx1 - bx0);
    let dy = Math.abs(by1 - by0);
    this.drawBlock(bx0, by0);
    if (dx > dy) {
      if (bx0 > bx1) {
        [bx0, bx1] = [bx1, bx0];
        [by0, by1] = [by1, by0];
      }
      for (let bx = Math.ceil(bx0) + 0.5; bx < bx1; bx++) {
        let by = by0 + (by1 - by0) * (bx - bx0) / (bx1 - bx0);
        this.drawBlock(bx, by);
      }
    } else {
      if (by0 > by1) {
        [bx0, bx1] = [bx1, bx0];
        [by0, by1] = [by1, by0];
      }
      for (let by = Math.ceil(by0) + 0.5; by < by1; by++) {
        let bx = bx0 + (bx1 - bx0) * (by - by0) / (by1 - by0);
        this.drawBlock(bx, by);
      }
    }
    this.drawBlock(bx1, by1);
    this.ctx.restore();
  }


  drawBlock(bx: number, by: number) {
    let x = this.ct.toX(Math.floor(bx));
    let y = this.ct.toY(Math.floor(by));
    this.ctx.fillRect(x, y, this.ct.ax, this.ct.ay);
  }
}


