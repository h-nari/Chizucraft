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
  private mx0 = 50;
  private mx1 = 50;
  private my0 = 20;
  private my1 = 20;

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

  async draw() {
    let c = this.canvas;
    let ctx = c.getContext('2d');
    if (c.width == 0 || c.height == 0 || !ctx) return;
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, c.width, c.height);
    if (this.ct.ax < 0.3) {
      ctx.fillStyle = 'blue';
      ctx.textAlign = 'center';
      ctx.fillText(`(scale: ${this.ct.ax})`, c.width / 2, c.height / 2);
    } else {
      let tx0 = this.ct.s2tileX(0);
      let tx1 = this.ct.s2tileX(c.width - 1);
      let ty0 = this.ct.s2tileY(0);
      let ty1 = this.ct.s2tileY(c.height - 1);
      let jobs: Promise<void>[] = [];
      for (let ty = ty0; ty <= ty1; ty++) {
        for (let tx = tx0; tx <= tx1; tx++) {
          jobs.push(this.drawTile(ctx, tx, ty));
        }
      }
      await Promise.all(jobs);
      console.log(jobs.length + ' jobs done');
    }
    this.drawXFrame();
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

    let w = this.ct.ax * 128;
    let h = this.ct.ay * 128;
    if (buf && buf.image) {
      let im = await createImageBitmap(buf.image);
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(this.ct.ax, this.ct.ay);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(im, 0, 0);
      ctx.restore();
    } else {
      ctx.fillStyle = 'blue';
      ctx.textAlign = 'center';
      ctx.fillText(`(${tx},${ty})`, x + w / 2, y + h / 2);
    }
    ctx.save();
    ctx.strokeStyle = 'blue';
    ctx.lineWidth = 1.0;
    ctx.globalAlpha = 0.5;
    ctx.strokeRect(x, y, w, h);
    ctx.restore();
  }

  zoom(factor: number, e: JQuery.TriggeredEvent) {
    let x = (e.clientX || 0) - e.currentTarget.offsetLeft;
    let y = (e.clientY || 0) - e.currentTarget.offsetTop;
    this.ct.zoom(factor, x, y);
    this.draw();
  }

  drawXFrame() {
    let c = this.canvas;
    let ctx = c.getContext('2d');
    if (ctx) {
      ctx.rect(this.mx0, 0, c.width - (this.mx0 + this.mx1), this.my0);
      ctx.fillStyle = 'white';
      ctx.fill();
      ctx.strokeStyle = 'black';
      ctx.lineWidth = 1;
      ctx.stroke();

      let x1 = c.width - this.mx1;
      let tx0 = this.ct.s2tileX(this.mx0);
      let tx1 = this.ct.s2tileX(x1);

      if (16 * this.ct.ax > 20) {
        ctx.strokeStyle = 'green';
        for (let xx = tx0 * 128; xx < (tx1 + 1) * 128; xx += 16) {
          let x = this.ct.toX(xx);
          if (x > this.mx0 && x < x1) {
            ctx.beginPath();
            ctx.moveTo(x, this.my0 / 2);
            ctx.lineTo(x, this.my0);
            ctx.stroke();
          }
        }
      }

      ctx.strokeStyle = 'blue';
      for (let tx = tx0; tx <= tx1; tx++) {
        let x = this.ct.toX(tx * 128);
        if (x > this.mx0 && x < x1) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, this.my0);
          ctx.stroke();
        }
      }
    }
  }

}