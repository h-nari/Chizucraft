import { div, tag } from "./tag";
import { CoordinateTransformation } from "./ct";
import { ProjectionParameter, TileMaker } from "./tileMaker";

export class MineMap {
  public canvas: HTMLCanvasElement;
  public ct = new CoordinateTransformation();
  public param: ProjectionParameter | undefined;
  public tileBuf: { [key: string]: { image?: ImageData } } = {};

  constructor(targetId: string) {
    $('#' + targetId).html(this.html());
    this.canvas = document.getElementById('mine-map-canvas') as HTMLCanvasElement;
    this.update_canvas_size();
    this.bind();
  }


  html() {
    return div({ class: 'mine-map' },
      tag('canvas', { id: 'mine-map-canvas' }));
  }

  bind() {
    window.onresize = e => {
      this.update_canvas_size();
      this.clear_tile_buf();
    };
    $('#mine-map-canvas').on('click', async e => {
      let x = e.clientX - e.currentTarget.offsetLeft;
      let y = e.clientY - e.currentTarget.offsetTop;
      let tx = this.ct.tileX(x);
      let ty = this.ct.tileY(y);
      if (this.param) {
        let tm = new TileMaker(this.param);
        let key = tx + ',' + ty;
        let tile = this.tileBuf[key];
        if (!tile) tile = this.tileBuf[key] = {};
        if (!tile.image)
          tile.image = await tm.getTile(tx, ty);
        this.draw();
      }
    });
  }

  clear_tile_buf() {
    for (let k in this.tileBuf)
      this.tileBuf[k] = {};
  }

  setParam(param: ProjectionParameter) {
    this.param = param;
  }

  update_canvas_size() {
    let c = this.canvas;
    let { clientWidth: w, clientHeight: h } = c;
    // console.log(`resize ${w} x ${h}`);
    if (c.width == 0)
      this.ct.bx = w / 2;
    c.width = w;
    if (c.height == 0)
      this.ct.by = h / 2;
    c.height = h;
    this.draw();
  }

  draw() {
    let c = this.canvas;
    let ctx = c.getContext('2d');
    if (c.width == 0 || c.height == 0 || !ctx) return;
    let tx0 = Math.floor(this.ct.fromX(0) / 128);
    let tx1 = Math.floor(this.ct.fromX(c.width) / 128);
    let ty0 = Math.floor(this.ct.fromY(0) / 128);
    let ty1 = Math.floor(this.ct.fromY(c.height) / 128);
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        this.drawTile(ctx, tx, ty);
      }
    }
  }

  drawTile(ctx: CanvasRenderingContext2D, tx: number, ty: number) {
    let x = this.ct.toX(tx * 128);
    let y = this.ct.toY(ty * 128);
    let key = tx + ',' + ty;
    let buf = this.tileBuf[key];
    if (buf && buf.image) {
      ctx.putImageData(buf.image, x, y);
    } else {
      let w = this.ct.ax * 128;
      let h = this.ct.ay * 128;
      ctx.strokeStyle = ctx.fillStyle = 'blue';
      ctx.lineWidth = 1.0;
      ctx.strokeRect(x, y, w, h);
      ctx.textAlign = 'center';
      ctx.fillText(`(${tx},${ty})`, x + w / 2, y + h / 2);
    }
  }

}