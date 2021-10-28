import { ProjectionParameter } from "./tileMaker";

const url_template = 'https://cyberjapandata.gsi.go.jp/xyz/dem5a_png/{z}/{x}/{y}.png';
// const url_template = 'https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png';

class HeightTile {
  tx: number;
  ty: number;
  param: ProjectionParameter;
  zoom: number;
  image: ImageData | undefined;

  constructor(tx: number, ty: number, zoom: number, param: ProjectionParameter) {
    this.tx = tx;
    this.ty = ty;
    this.zoom = zoom;
    this.param = param;
  }

  async getHeight(x: number, y: number) {
    x = Math.floor(x);
    y = Math.floor(y);
    // console.log(`tx:${this.tx} ty:${this.ty} x:${x} y:${y}`);
    if (!this.image)
      await this.loadData();

    if (this.image) {
      let off = (y * 256 + x) * 4;
      let d = this.image.data;
      let v = (d[off] << 16) | (d[off + 1] << 8) | d[off + 2];
      let h = NaN;
      if (v < 0x800000) h = Math.round(v * 0.01);
      else if (v > 0x800000) h = Math.round((v - 0x1000000) * 0.01)
      // console.log(`v=0x${v.toString(16)} h=${h}`);
      return h;
    }
    return NaN;
  }

  loadImage(): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      let img = new Image();
      img.crossOrigin = 'Anonymous';
      let url = getUrl(this.tx, this.ty, this.zoom);
      console.log('url:', url);
      img.src = url;
      img.onload = function (e) {
        resolve(img);
      }
    });
  }

  async loadData() {
    let img = await this.loadImage();
    let c = document.getElementById('work-canvas1') as HTMLCanvasElement | null;
    if (!c) throw new Error('work-canvas1 not found');
    let ctx = c.getContext('2d');
    if (!ctx) throw new Error('getContext failed');
    ctx.drawImage(img, 0, 0);
    this.image = ctx.getImageData(0, 0, 256, 256);
  }

}

export class HeightBuf {
  private param: ProjectionParameter;
  private hzoom = 15;
  private HTbuf: { [key: string]: HeightTile } = {};
  private zoom_factor: number;

  constructor(param: ProjectionParameter) {
    this.param = param;
    this.zoom_factor = Math.pow(2, this.hzoom - param.zoom);
    console.log('zoom_factor:', this.zoom_factor);
  }


  async getHeight(x: number, y: number) {
    let gx = (x / this.param.mPerPoint.x + this.param.oPoint.x) * this.zoom_factor;
    let gy = (y / this.param.mPerPoint.y + this.param.oPoint.y) * this.zoom_factor;
    let tx = Math.floor(gx / 256);
    let ty = Math.floor(gy / 256);
    let key = tx + ',' + ty;
    let ht = this.HTbuf[key];
    if (!ht)
      this.HTbuf[key] = ht = new HeightTile(tx, ty, this.hzoom, this.param);
    return await ht.getHeight(gx % 256, gy % 256);
  }
}

function getUrl(x: number, y: number, z: number) {
  let param = { x, y, z };
  return url_template.replace(/\{(x|y|z)\}/g, (substring: string, ...arg: string[]) =>
    String(param[arg[0] as 'x' | 'y' | 'z'] || `_${arg[0]}_undefined_`)
  )
}
