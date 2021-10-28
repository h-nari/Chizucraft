import * as L from 'leaflet';

export interface ProjectionParameter {
  zoom: number;
  oPoint: L.Point;            // 原点のtile上での座標
  blocksize: number;          // マインクラフトの1ブロックを何mにするか [m/block]
  mPerPoint: { x: number, y: number }; // 1Pointあたりの距離
};

export class TileMaker {
  private url_template = 'https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png';
  public param: ProjectionParameter;

  constructor(param: ProjectionParameter) {
    this.param = param;
  }

  getTileImage(arg: { x: number, y: number, z: number }): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      let img = new Image();
      img.crossOrigin = "Anonymous";
      img.src = this.getUrl(arg);
      img.onload = function (e) {
        resolve(img);
      }
    });
  }

  async getTile(x: number, y: number) {
    let canvas1 = document.getElementById('work-canvas1') as HTMLCanvasElement | null;
    if (!canvas1) throw new Error('work-canvas1 not found');
    let ctx1 = canvas1.getContext('2d');
    if (!ctx1) throw new Error('getContext failed');
    let p = this.param;
    let ax = p.blocksize / p.mPerPoint.x;  // [Point/block]
    let ay = p.blocksize / p.mPerPoint.y;  // [Point/block]
    let x0 = Math.floor(p.oPoint.x + 128 * x * ax);
    let y0 = Math.floor(p.oPoint.y + 128 * y * ay);
    let x1 = Math.floor(p.oPoint.x + (128 * x + 127) * ax);
    let y1 = Math.floor(p.oPoint.y + (128 * y + 127) * ay);
    let tx0 = Math.floor(x0 / 256);
    let ty0 = Math.floor(y0 / 256);
    let tx1 = Math.floor(x1 / 256);
    let ty1 = Math.floor(y1 / 256);
    let scale = 1.0;
    while (scale * (x1 - x0) >= 128 * 2 && scale * (y1 - y0) > 128 * 2)
      scale /= 2;
    ctx1.fillStyle = 'lightgray';
    ctx1.fillRect(0, 0, canvas1.width, canvas1.height);
    let jobs: Promise<HTMLImageElement>[] = [];
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        jobs.push(this.getTileImage({ x: tx, y: ty, z: this.param.zoom }));
      }
    }
    let images = await Promise.all(jobs);

    if (ctx1) {
      ctx1.save();
      ctx1.scale(scale, scale);
      for (let ty = ty0; ty <= ty1; ty++) {
        for (let tx = tx0; tx <= tx1; tx++) {
          let img = images.shift();
          if (img)
            ctx1.drawImage(img, 256 * (tx - tx0), 256 * (ty - ty0));
        }
      }
      ctx1.restore();
    }
    let canvas2 = document.getElementById('work-canvas2') as HTMLCanvasElement | null;
    if (!canvas2) throw new Error('work-canvas2 not found');
    let ctx2 = canvas2.getContext('2d');
    if (!ctx2) throw new Error('getContext of work-canvas2 failed');
    if (canvas1) {
      let sx = (x0 - tx0 * 256) * scale;
      let sy = (y0 - ty0 * 256) * scale;
      let sw = Math.max((x1 - x0) * scale, 1);
      let sh = Math.max((y1 - y0) * scale, 1);
      ctx2.drawImage(canvas1, sx, sy, sw, sh, 0, 0, 128, 128);
      return ctx2.getImageData(0, 0, 128, 128);
    }
  }

  getUrl(param: { x: number, y: number, z: number }) {
    return this.url_template.replace(/\{(x|y|z)\}/g, (substring: string, ...arg: string[]) =>
      String(param[arg[0] as 'x' | 'y' | 'z'] || `_${arg[0]}_undefined_`)
    )
  }

}