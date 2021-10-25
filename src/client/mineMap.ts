import { div, tag } from "./tag";
import { CoordinateTransformation } from "./ct";
import { ProjectionParameter, TileMaker } from "./tileMaker";

export class MineMap {
  public canvas: HTMLCanvasElement;
  public ct = new CoordinateTransformation();
  public param: ProjectionParameter | undefined;
  public tileBuf: { [key: string]: { image?: ImageData } } = {};
  private x0: number = 0;
  private y0: number = 0;
  private pressed: boolean = false;
  private moved: boolean = false;
  private redrawing: boolean = false;

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
      if (this.moved) {
        this.moved = false;
      } else {
        let x = e.clientX - e.currentTarget.offsetLeft;
        let y = e.clientY - e.currentTarget.offsetTop;
        let tx = this.ct.tileX(x);
        let ty = this.ct.tileY(y);
        if (this.param) {
          let key = tx + ',' + ty;
          let tile = this.tileBuf[key];
          if (!tile) tile = this.tileBuf[key] = {};
          if (!tile.image) {
            let tm = new TileMaker(this.param);
            tile.image = await tm.getTile(tx, ty);
          }
          this.draw();
        }
      }
    }).on('mousedown', e => {
      this.pressed = true;
      this.x0 = e.clientX;
      this.y0 = e.clientY;
    }).on('mousemove', e => {
      if (this.pressed) {
        let x = e.clientX;
        let y = e.clientY;
        this.ct.pan(x - this.x0, y - this.y0);
        this.x0 = x;
        this.y0 = y;
        this.redraw();
        this.moved = true;
      }
    }).on('mouseup', e => {
      let x = e.clientX;
      let y = e.clientY;
      this.ct.pan(x - this.x0, y - this.y0);
      this.x0 = x;
      this.y0 = y;
      this.redraw();
      this.pressed = false;
    }).on('mousewheel', e => {
      let oe = e.originalEvent as WheelEvent;
      if (oe.deltaY > 0) this.zoom(0.5, e);
      else if (oe.deltaY < 0) this.zoom(2, e);
      e.preventDefault();
      e.stopPropagation();
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
    ctx.fillStyle = 'lightgray';
    ctx.fillRect(0, 0, c.width, c.height);
    if (this.ct.ax < 0.3) {
      ctx.fillStyle = 'blue';
      ctx.textAlign = 'center';
      ctx.fillText(`(scale: ${this.ct.ax})`, c.width / 2, c.height / 2);
    } else {
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
  }

  redraw() {
    if (!this.redrawing) {
      this.redrawing = true;
      setTimeout(() => {
        this.draw();
        this.redrawing = false;
      }, 0);
    }
  }

  async drawTile(ctx: CanvasRenderingContext2D, tx: number, ty: number) {
    let x = this.ct.toX(tx * 128);
    let y = this.ct.toY(ty * 128);
    let key = tx + ',' + ty;
    let buf = this.tileBuf[key];

    if (true && this.param) {
      if (!buf) this.tileBuf[key] = buf = {};
      if (!buf.image) {
        let tm = new TileMaker(this.param);
        buf.image = await tm.getTile(tx, ty);
      }
    }

    if (buf && buf.image) {
      let im = await createImageBitmap(buf.image);
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(this.ct.ax, this.ct.ay);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(im, 0, 0);
      ctx.restore();
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

  zoom(factor: number, e: JQuery.TriggeredEvent) {
    let x = (e.clientX || 0) - e.currentTarget.offsetLeft;
    let y = (e.clientY || 0) - e.currentTarget.offsetTop;
    this.ct.zoom(factor, x, y);
    this.draw();
  }

}