import { Chizucraft } from "./chizucraft";
import { CoordinateTransformation } from "./ct";
import { VectorTileRenderer } from "./vectorTileRenderer";
import { Menu } from "./menu";
import { TileBlockTranformation } from "./t2b";
import { div, tag } from "./tag";
import { TaskControl, TaskQueue } from "./taskQueue";
import { ProjectionParameter } from "./tileMaker";
import { round } from "./util";
import { VectorTile } from "./vectorTile";

const grids = [
  [1, 'lightgray'],
  [4, '#ffc0c0'],
  [16, 'green'],
  [128, 'blue'],
  [128 * 16, 'black']
] as [number, string][]

export class VectorMap {
  public canvas: HTMLCanvasElement;
  public ct = new CoordinateTransformation();
  public param: ProjectionParameter | undefined;
  public cc: Chizucraft;
  public zoom: number = 16;
  private menus: Menu[] = [];
  private taskQueue = new TaskQueue();
  private drawType: 'line' | 'block' = 'line';
  private mx0 = 50;
  private mx1 = 0;
  private my0 = 20;
  private my1 = 0;

  constructor(cc: Chizucraft, targetId: string) {
    this.cc = cc;
    this.makeMenu();
    $('#' + targetId).html(this.html());
    this.canvas = document.getElementById('vector-map-canvas') as HTMLCanvasElement;
    this.bind();
    this.update_canvas_size();
  }

  setParam(param: ProjectionParameter) {
    this.param = param;
    this.zoom = param.zoom;
  }

  html(): string {
    return div({ class: 'vector-map' },
      div({ class: 'topbar' },
        div({ class: 'flex-fill mx-2 status' }),
        ... this.menus.map(m => m.html())),
      tag('canvas', { id: 'vector-map-canvas' }));
  }

  bind() {
    this.menus.forEach(m => m.bind());
    window.onresize = e => {
      this.update_canvas_size();
    };
    var x0 = 0;
    var y0 = 0;
    var pressed = false;
    $(this.canvas).on('mousedown', e => {
      pressed = true;
      x0 = e.clientX;
      y0 = e.clientY;
      e.preventDefault();
    }).on('mousemove', e => {
      if (pressed) {
        let x = e.clientX;
        let y = e.clientY;
        if (this.ct.pan(x - x0, y - y0))
          this.draw();
        x0 = x;
        y0 = y;
      }
      e.preventDefault();
    }).on('mouseup', e => {
      if (this.ct.pan(e.clientX - x0, e.clientY - y0)) {
        console.log('up:', e.clientX - x0, e.clientY - y0);
        this.draw();
      }
      pressed = false;
      e.preventDefault();
    }).on('mousewheel', e => {
      let oe = e.originalEvent as WheelEvent;
      if (oe.deltaY > 0) this.zoomView(0.5, e);
      else if (oe.deltaY < 0) this.zoomView(2, e);
      e.preventDefault();
      e.stopPropagation();
    })
  }

  zoomView(factor: number, e: JQuery.TriggeredEvent) {
    let x = (e.clientX || 0) - e.currentTarget.offsetLeft;
    let y = (e.clientY || 0) - e.currentTarget.offsetTop;
    this.ct.zoom(factor, x, y);
    this.draw();
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
    if (!ctx) return;
    if (!this.param) {
      ctx.fillStyle = 'lightgray';
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.fillStyle = 'red';
      ctx.font = '48px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('基準点が指定されていません', c.width / 2, c.height / 2);
      return;
    }
    this.zoom_update();
    this.status(`zoom:${this.zoom},   Block size:${this.ct.ax} pixel`);
    this.taskQueue.clear();
    this.drawVectorMap(ctx);
  }

  status(html: string) {
    $('.vector-map .topbar .status').html(html);
  }


  zoom_update() {
    if (!this.param) return;
    if (this.zoom > 17) this.zoom = 17;
    // 画面を覆うのに必要なタイル数を計算
    let blockWidth = this.canvas.width / this.ct.ax;
    let pointWidth = blockWidth * this.param.blocksize / this.param.mPerPoint.x;
    let tileWidth = pointWidth * Math.pow(2, this.zoom - this.param.zoom) / 256;
    while (tileWidth > 2 && this.zoom > 8) {
      tileWidth /= 2;
      this.zoom--;
    }
    while (tileWidth < 1 && this.zoom < 17) {
      tileWidth *= 2;
      this.zoom++;
    }
  }

  drawVectorMap(ctx: CanvasRenderingContext2D) {
    if (!this.param) return;
    // 画面左上のタイル座標を求める
    let param = this.param;
    let tb = new TileBlockTranformation(param, this.zoom);
    let bx0 = this.ct.fromX(0);
    let by0 = this.ct.fromY(0);
    let tx0 = round(tb.toTx(bx0), 256);
    let ty0 = round(tb.toTy(by0), 256);

    for (let ty = ty0; ; ty += 256) {
      let by = tb.toBy(ty);
      let y = this.ct.toY(by);
      if (y >= this.canvas.height) break;
      for (let tx = tx0; ; tx += 256) {
        let x = this.ct.toX(tb.toBx(tx));
        if (x >= this.canvas.width) break;
        var ctrl = new TaskControl();
        this.taskQueue.add(() => {
          return this.drawVectorTile(ctx, tx, ty, tb, ctrl);  // this.zoom, tx, tyのベクタータイルを描画
        }, ctrl);
      }
    }
    this.taskQueue.add(() => { return this.drawGrid(ctx); });
    this.taskQueue.add(() => { return this.drawXFrame(ctx); });
    this.taskQueue.add(() => { return this.drawYFrame(ctx); });
  }


  setClip(ctx: CanvasRenderingContext2D) {
    let w = this.canvas.width - this.mx0 - this.mx1;
    let h = this.canvas.height - this.my0 - this.my1;
    ctx.beginPath();
    ctx.rect(this.mx0, this.my0, w, h);
    ctx.clip();
  }

  drawVectorTile(ctx: CanvasRenderingContext2D, tx: number, ty: number, tb: TileBlockTranformation, ctrl: TaskControl) {
    return new Promise<void>((resolve, reject) => {
      if (ctrl.stop) { resolve(); return; }
      let vals = { x: Math.floor(tx / 256), y: Math.floor(ty / 256), z: this.zoom, t: 'experimental_bvmap' };
      const template = 'https://cyberjapandata.gsi.go.jp/xyz/{t}/{z}/{x}/{y}.pbf';
      let url = template.replace(/\{(x|y|z|t)\}/g, (substring: string, ...arg: string[]) =>
        String(vals[arg[0] as 'x' | 'y' | 'z' | 't'] || `_${arg[0]}_undefined_`));
      let xhr = new XMLHttpRequest();
      let ct = this.ct;
      let that = this;
      xhr.open('GET', url, true);
      xhr.responseType = 'arraybuffer';
      xhr.onload = function (e) {
        if (ctrl.stop) { resolve(); return; }
        let arrayBuffer = this.response;
        if (!arrayBuffer) return;
        let data = new Uint8Array(arrayBuffer);
        let vm = new VectorTile(data);
        let renderer = new VectorTileRenderer(ctx, ct, tb, tx, ty, vm);
        renderer.setArea(that.mx0, that.my0, that.canvas.width - that.mx1, that.canvas.height - that.my1);
        renderer.draw(ctrl).then(() => { resolve(); });
      }
      xhr.ontimeout = () => { reject("timeout"); };
      xhr.onabort = () => { reject("abort"); };
      xhr.send();
    });
  }

  async drawGrid(ctx: CanvasRenderingContext2D) {
    let moff = this.cc.stat.minecraft_offset;
    let x0 = this.mx0;
    let x1 = this.canvas.width - this.mx1;
    let y0 = this.my0;
    let y1 = this.canvas.height - this.my1;

    for (let g of grids) {
      if (this.ct.ax * g[0] < 32) continue;
      ctx.strokeStyle = g[1];
      ctx.beginPath();
      for (let mx = Math.floor((this.ct.fromX(x0) + moff.x + 64) / g[0]) * g[0] - 64; this.ct.toX(mx - moff.x) < x1; mx += g[0]) {
        let x = this.ct.toX(mx - moff.x);
        ctx.moveTo(x, y0);
        ctx.lineTo(x, y1);
      }
      for (let mz = Math.floor((this.ct.fromY(y0) + moff.z + 64) / g[0]) * g[0] - 64; this.ct.toY(mz - moff.z) < y1; mz += g[0]) {
        let y = this.ct.toY(mz - moff.z);
        ctx.moveTo(x0, y);
        ctx.lineTo(x1, y);
      }
      ctx.stroke();
    }
  }

  async drawXFrame(ctx: CanvasRenderingContext2D) {
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
      for (let mx = Math.floor((ct.fromX(x0) + moff.x + 64) / g[0]) * g[0] - 64; ct.toX(mx - moff.x) < x1; mx += g[0]) {
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

  async drawYFrame(ctx: CanvasRenderingContext2D) {
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
      for (let mz = Math.floor((ct.fromY(y0) + moff.z + 64) / g[0]) * g[0] - 64; ct.toY(mz - moff.z) < y1; mz += g[0]) {
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


  makeMenu() {
    let dispMenu = new Menu({ name: '表示' });
    this.menus.push(dispMenu);
    dispMenu.add({
      name: 'ブロック表示',
      with_check: this.drawType == 'block',
      checked: true,
      action: (e, menu) => {
        menu.opt.checked = !menu.opt.checked;
        this.drawType = menu.opt.checked ? 'block' : 'line';
        this.draw();
      }
    });


    let helpMenu = new Menu({ name: 'ヘルプ' });
    this.menus.push(helpMenu);
    helpMenu.add({ name: 'この地図について' })
  }
}


