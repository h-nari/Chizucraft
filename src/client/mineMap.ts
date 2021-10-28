import { div, input, label, tag } from "./tag";
import { CoordinateTransformation } from "./ct";
import { ProjectionParameter, TileMaker } from "./tileMaker";
import { Menu } from "./menu";
import { Chizucraft } from "./chizucraft";
import "./jconfirm";

const grids = [
  [1, 'lightgray'],
  [4, '#ffc0c0'],
  [16, 'green'],
  [128, 'blue'],
  [128 * 16, 'black']
] as [number, string][]

interface TileInfo {
  image?: ImageData;
};

interface Area {
  x: number;
  y: number;
  w?: number;
  h?: number;
};

export class MineMap {
  public canvas: HTMLCanvasElement;
  public ct = new CoordinateTransformation();
  public param: ProjectionParameter | undefined;
  public tileBuf: { [key: string]: TileInfo } = {};
  private x0: number = 0;
  private y0: number = 0;
  private pressed: boolean = false;
  private moved: boolean = false;
  private redrawing: boolean = false;
  private mx0 = 50;
  private mx1 = 0;
  private my0 = 20;
  private my1 = 0;
  private disp_menu: Menu;
  private selected?: Area;
  public cc: Chizucraft;

  constructor(cc: Chizucraft, targetId: string) {
    this.cc = cc;
    this.disp_menu = new Menu({ name: 'メニュー' });
    this.disp_menu.add({
      name: 'マインクラフトの座標を指定',
      action: (e, menu) => {
        let sel = this.selected;
        if (sel) {
          let moff = this.cc.stat.minecraft_offset;
          $.confirm({
            title: 'マインクラフトの座標を指定',
            columnClass: 'medium',
            content: div({ class: 'minecraft-offset-dlg' },
              div('選択されたブロックのマインクラフトでの座標'),
              div({ class: 'mt-3 d-flex justify-content-center' },
                div({ class: 'labeled-input ml-auto' },
                  label('x:'), input({ class: 'x', type: 'number', value: moff.x + sel.x })),
                div({ class: 'labeled-input' },
                  label('y:'), input({ class: 'y', type: 'number', value: moff.y })),
                div({ class: 'labeled-input' },
                  label('z:'), input({ class: 'z', type: 'number', value: moff.z + sel.y }))),
            ),
            buttons: {
              ok: {
                text: '設定',
                action: () => {
                  let x = parseInt($('.minecraft-offset-dlg input.x').val() as string);
                  let y = parseInt($('.minecraft-offset-dlg input.y').val() as string);
                  let z = parseInt($('.minecraft-offset-dlg input.z').val() as string);
                  if (moff && sel) {
                    moff.x = x - sel.x;
                    moff.y = y;
                    moff.z = z - sel.y;
                    this.cc.saveStat();
                    this.draw();
                  }
                }
              },
              cancel: {}
            }
          });

        } else {
          $.alert('マインクラフトのブロックが選択されていません')
        }
      }
    }).add({
      name: 'bar'
    });


    $('#' + targetId).html(this.html());
    this.canvas = document.getElementById('mine-map-canvas') as HTMLCanvasElement;
    this.update_canvas_size();
    this.bind();
  }


  html() {
    return div({ class: 'mine-map' },
      div({ class: 'topbar d-flex' },
        'Topbar',
        div({ class: 'flex-fill mx-2 status' }, 'status'),
        this.disp_menu.html()),
      tag('canvas', { id: 'mine-map-canvas' }));
  }

  bind() {
    this.disp_menu.bind();
    window.onresize = e => {
      this.update_canvas_size();
      this.clear_tile_buf();
    };
    $('#mine-map-canvas').on('click', async e => {
      if (this.moved) {
        this.moved = false;
      } else {
        this.select(e);
        this.draw();
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
    ctx.save();
    let region = new Path2D();
    let w = c.width - (this.mx0 + this.mx1);
    let h = c.height - (this.my0 + this.my1);
    region.rect(this.mx0, this.my0, w, h);
    ctx.clip(region);
    if (this.ct.ax < 0.3) {
      ctx.fillStyle = 'white';
      ctx.fillRect(this.mx0, this.my0, w, h);
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
    }
    this.drawGrid(ctx);
    this.drawSelection(ctx);
    ctx.restore();
    this.drawXFrame(ctx);
    this.drawYFrame(ctx);
  }

  drawSelection(ctx: CanvasRenderingContext2D) {
    let s = this.selected;
    if (s) {
      let c = this.ct;
      let w = s.w || 1;
      let h = s.w || 1;
      ctx.beginPath();
      ctx.rect(c.toX(s.x), c.toY(s.y), c.ax * w, c.ay * h);
      ctx.strokeStyle = 'red';
      ctx.lineWidth = 2.0;
      ctx.stroke();

      let moff = this.cc.stat.minecraft_offset;
      $('.topbar .status').text(`Minecraft(x: ${s.x + moff.x}, y: ${moff.y}, z: ${s.y + moff.z})`);
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

  drawGrid(ctx: CanvasRenderingContext2D) {
    let moff = this.cc.stat.minecraft_offset;
    let x0 = this.mx0;
    let x1 = this.canvas.width - this.mx1;
    let y0 = this.my0;
    let y1 = this.canvas.height - this.my1;
    for (let g of grids) {
      if (this.ct.ax * g[0] < 32) continue;
      ctx.strokeStyle = g[1];
      ctx.beginPath();
      for (let mx = Math.floor((this.ct.fromX(x0) + moff.x) / g[0]) * g[0]; this.ct.toX(mx - moff.x) < x1; mx += g[0]) {
        let x = this.ct.toX(mx - moff.x);
        ctx.moveTo(x, y0);
        ctx.lineTo(x, y1);
      }
      for (let mz = Math.floor((this.ct.fromY(y0) + moff.z) / g[0]) * g[0]; this.ct.toY(mz - moff.z) < y1; mz += g[0]) {
        let y = this.ct.toY(mz - moff.z);
        ctx.moveTo(x0, y);
        ctx.lineTo(x1, y);
      }
      ctx.stroke();
    }
  }

  drawXFrame(ctx: CanvasRenderingContext2D) {
    let c = this.canvas;
    let moff = this.cc.stat.minecraft_offset;
    let ct = this.ct;
    let x0 = this.mx0;
    let x1 = c.width - this.mx1;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, 0, x1 - x0, this.my0);
    ctx.clip();
    ctx.fillStyle = '#f8f8f8';
    ctx.fill();
    ctx.strokeStyle = 'black';
    ctx.stroke();
    ctx.fillStyle = 'black';
    ctx.textBaseline = 'alphabetic';
    for (let g of grids) {
      ctx.strokeStyle = g[1];
      if (this.ct.ax * g[0] < 50) continue;
      for (let mx = Math.floor((ct.fromX(x0) + moff.x) / g[0]) * g[0]; ct.toX(mx - moff.x) < x1; mx += g[0]) {
        let x = ct.toX(mx - moff.x);
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, this.my0);
        ctx.stroke();
        ctx.fillText(`x:${mx}`, x + 2, this.my0 - 2);
      }
    }
    ctx.restore();
  }

  drawYFrame(ctx: CanvasRenderingContext2D) {
    let c = this.canvas;
    let moff = this.cc.stat.minecraft_offset;
    let ct = this.ct;
    let y0 = this.my0;
    let y1 = c.height - this.my1;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, y0, this.mx0, y1 - y0);
    ctx.clip();
    ctx.fillStyle = '#f8f8f8';
    ctx.fill();
    ctx.strokeStyle = 'black';
    ctx.stroke();
    ctx.fillStyle = 'black';
    ctx.textBaseline = 'alphabetic';
    for (let g of grids) {
      ctx.strokeStyle = g[1];
      if (this.ct.ax * g[0] < 50) continue;
      for (let mz = Math.floor((ct.fromY(y0) + moff.z) / g[0]) * g[0]; ct.toY(mz - moff.z) < y1; mz += g[0]) {
        let y = ct.toY(mz - moff.z);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(this.mx0, y);
        ctx.stroke();
        ctx.fillText(`z:${mz}`, 2, y - 2);
      }
    }
    ctx.restore();
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
      if (this.ct.ax > 15)
        this.drawPixelTile(ctx, tx, ty, buf);
      else {
        let im = await createImageBitmap(buf.image);
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(this.ct.ax, this.ct.ay);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(im, 0, 0);
        ctx.restore();
      }
    } else {
      ctx.fillStyle = 'blue';
      ctx.textAlign = 'center';
      ctx.fillText(`(${tx},${ty})`, x + w / 2, y + h / 2);
    }
    if (false) {
      ctx.save();
      ctx.strokeStyle = 'blue';
      ctx.lineWidth = 1.0;
      ctx.globalAlpha = 0.5;
      ctx.strokeRect(x, y, w, h);
      ctx.restore();
    }
  }

  drawPixelTile(ctx: CanvasRenderingContext2D, tx: number, ty: number, ti: TileInfo) {
    let img = ti.image;
    if (!img) return;
    let y = this.ct.toY(ty * 128);
    let w = this.ct.ax;
    let h = this.ct.ay;
    let ymin = this.my0 - h;
    let ymax = this.canvas.height - this.my1;
    let xmin = this.my0 - w;
    let xmax = this.canvas.width - this.mx1;

    for (let iy = 0; iy < 128; iy++, y += h) {
      if (y > ymin && y < ymax) {
        let x = this.ct.toX(tx * 128);
        for (let ix = 0; ix < 128; ix++, x += w) {
          if (x > xmin && x < xmax) {
            let off = (iy * 128 + ix) * 4;
            let r = img.data[off];
            let g = img.data[off + 1];
            let b = img.data[off + 2];
            this.drawPixel(ctx, x, y, r, g, b);
          }
        }
      }
    }
  }


  drawPixel(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, g: number, b: number) {
    ctx.beginPath();
    ctx.rect(x, y, this.ct.ax, this.ct.ay);
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fill();
    // ctx.strokeStyle = 'lightgray';
    // ctx.stroke();
  }


  zoom(factor: number, e: JQuery.TriggeredEvent) {
    let x = (e.clientX || 0) - e.currentTarget.offsetLeft;
    let y = (e.clientY || 0) - e.currentTarget.offsetTop;
    this.ct.zoom(factor, x, y);
    this.draw();
  }


  select(e: JQuery.ClickEvent) {
    let sx = e.clientX - e.currentTarget.offsetLeft;
    let sy = e.clientY - e.currentTarget.offsetTop;
    let x = this.ct.fromX(sx);
    let y = this.ct.fromY(sy);
    this.selected = { x, y };
  }

}