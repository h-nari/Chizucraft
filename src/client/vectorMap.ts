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

export interface MapSource {
  name: string;
  dispName: string;
  url: string;
  zoomMin: number;
  zoomMax: number;
  tileMax: number;
  type: 'image' | 'vector';
};

interface BlockPosition {
  bx: number;
  by: number;
};

const mapSorces: MapSource[] = [
  {
    name: 'gsi_std',
    dispName: '地理院',
    url: 'https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png',
    zoomMin: 2,
    zoomMax: 18,
    tileMax: 8,
    type: 'image'
  },
  {
    name: 'gsi_photo',
    dispName: '航空写真',
    url: 'https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg',
    zoomMin: 2,
    zoomMax: 18,
    tileMax: 4,
    type: 'image'
  },
  {
    name: 'openStreetMap',
    dispName: 'OpenStreetMap',
    url: 'http://tile.openstreetmap.org/{z}/{x}/{y}.png',
    zoomMin: 2,
    zoomMax: 18,
    tileMax: 4,
    type: 'image'
  },
  {
    name: 'gsi_vector',
    dispName: '地理院ベクター',
    url: 'https://cyberjapandata.gsi.go.jp/xyz/experimental_bvmap/{z}/{x}/{y}.pbg',
    zoomMin: 8,
    zoomMax: 17,
    tileMax: 1,
    type: 'vector'
  }
];

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
  private mx0 = 50;
  private mx1 = 0;
  private my0 = 20;
  private my1 = 0;
  public mapSource = mapSorces[0];
  public selected?: BlockPosition;

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
    var moved = false;
    $(this.canvas).on('mousedown', e => {
      pressed = true;
      moved = false;
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
        moved = true;
      }
      e.preventDefault();
    }).on('mouseup', e => {
      if (this.ct.pan(e.clientX - x0, e.clientY - y0)) {
        console.log('up:', e.clientX - x0, e.clientY - y0);
        this.draw();
      }
      pressed = false;
      e.preventDefault();
    }).on('click', e => {
      if (!moved) {
        let s = this.selected = {
          bx: this.ct.fromX(e.clientX - this.canvas.offsetLeft),
          by: this.ct.fromY(e.clientY - this.canvas.offsetTop)
        };
        this.draw();
      }
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
    let s = `zoom:${this.zoom},   Block size:${this.ct.ax} pixel`;
    if (this.selected) {
      let mx = this.selected.bx + this.cc.stat.minecraft_offset.x;
      let mz = this.selected.by + this.cc.stat.minecraft_offset.z;
      s += `  [${mx},${mz}]`;
    }
    this.status(s);
    this.taskQueue.clear();
    this.drawVectorMap(ctx);
  }

  status(html: string) {
    $('.vector-map .topbar .status').html(html);
  }


  zoom_update() {
    if (!this.param) return;
    let zoom_max = this.mapSource.zoomMax;
    let zoom_min = this.mapSource.zoomMin;
    let tile_max = this.mapSource.tileMax;
    if (this.zoom > zoom_max) this.zoom = zoom_max;
    if (this.zoom < zoom_min) this.zoom = zoom_min;
    // 画面を覆うのに必要なタイル数を計算
    let blockWidth = this.canvas.width / this.ct.ax;
    let pointWidth = blockWidth * this.param.blocksize / this.param.mPerPoint.x;
    let tileWidth = pointWidth * Math.pow(2, this.zoom - this.param.zoom) / 256;
    while (tileWidth > tile_max && this.zoom > zoom_min) {
      tileWidth /= 2;
      this.zoom--;
    }
    while (tileWidth < tile_max && this.zoom < zoom_max) {
      tileWidth *= 2;
      this.zoom++;
    }
    if (this.cc.stat.zoom != this.zoom) {
      this.cc.stat.zoom = this.zoom;
      this.cc.saveStat();
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
        if (this.mapSource.type == 'vector') {
          var ctrl = new TaskControl();
          this.taskQueue.add(() => {
            return this.drawVectorTile(ctx, tx, ty, tb, ctrl);  // this.zoom, tx, tyのベクタータイルを描画
          }, ctrl);
        } else {
          this.taskQueue.add(() => {
            return this.drawImageTile(ctx, tx, ty, tb);
          });
        }
      }
    }
    if (this.cc.stat.disp.grid)
      this.taskQueue.add(() => { return this.drawGrid(ctx); });
    this.taskQueue.add(() => { return this.drawXFrame(ctx); });
    this.taskQueue.add(() => { return this.drawYFrame(ctx); });
    this.taskQueue.add(() => { return this.drawSelected(ctx) });
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

  drawImageTile(ctx: CanvasRenderingContext2D, tx: number, ty: number, tb: TileBlockTranformation): Promise<void> {
    return new Promise((resolve, reject) => {
      let vals = { x: Math.floor(tx / 256), y: Math.floor(ty / 256), z: this.zoom };
      const template = this.mapSource.url;
      let url = template.replace(/\{(x|y|z|t)\}/g, (substring: string, ...arg: string[]) =>
        String(vals[arg[0] as 'x' | 'y' | 'z'] || `_${arg[0]}_undefined_`));
      let img = new Image();
      img.crossOrigin = "Anonymous";
      img.src = url;
      img.onload = (e) => {
        let x0 = this.ct.toX(tb.toBx(tx));
        let x1 = this.ct.toX(tb.toBx(tx + 256));
        let y0 = this.ct.toY(tb.toBy(ty));
        let y1 = this.ct.toY(tb.toBy(ty + 256));

        ctx.save();
        ctx.beginPath();
        let w = this.canvas.width - this.mx0 - this.mx1;
        let h = this.canvas.height - this.my0 - this.my1;
        ctx.rect(this.mx0, this.my0, w, h);
        ctx.clip();
        ctx.drawImage(img, x0, y0, x1 - x0, y1 - y0);
        ctx.restore();
        resolve();
      }
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

  async drawSelected(ctx: CanvasRenderingContext2D) {
    let s = this.selected;
    if (!s) return;
    let ct = this.ct;
    if (ct.ax < 1) return;
    ctx.save();
    ctx.beginPath();
    ctx.rect(ct.toX(s.bx), ct.toY(s.by), ct.ax, ct.ay);
    ctx.fillStyle = 'yellow';
    ctx.strokeStyle = 'red';
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.5;
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  makeMenu() {
    let dispMenu = new Menu({ name: '表示' });
    this.menus.push(dispMenu);
    dispMenu.add({
      name: 'グリッド表示',
      with_check: true,
      onBeforeExpand: menu => {
        menu.opt.checked = this.cc.stat.disp.grid;
      },
      action: (e, menu) => {
        this.cc.stat.disp.grid = menu.opt.checked = !menu.opt.checked;
        this.cc.saveStat();
        this.draw();
      }
    }).add({
      name: '地図タイプ',
      action: (e, menu) => {
        menu.clear();
        for (let ms of mapSorces) {
          menu.add({
            name: ms.dispName,
            with_check: true,
            checked: this.mapSource == ms,
            action: (e, menu) => {
              this.mapSource = ms;
              this.draw();
            }
          });
        }
        menu.expand(e);
      }
    });


    let helpMenu = new Menu({ name: 'ヘルプ' });
    this.menus.push(helpMenu);
    helpMenu.add({ name: 'この地図について' })
  }
}


