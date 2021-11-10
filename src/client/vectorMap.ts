import { Chizucraft } from "./chizucraft";
import { CoordinateTransformation } from "./ct";
import { Menu } from "./menu";
import { TileBlockTranformation } from "./t2b";
import { div, tag } from "./tag";
import { TaskControl, TaskQueue } from "./taskQueue";
import { ProjectionParameter } from "./tileMaker";
import { round } from "./util";
import { VectorTile } from "./vectorTile";

export class VectorMap {
  public canvas: HTMLCanvasElement;
  public ct = new CoordinateTransformation();
  public param: ProjectionParameter | undefined;
  public cc: Chizucraft;
  public zoom: number = 16;
  private menus: Menu[] = [];
  private taskQueue = new TaskQueue();

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
    }).on('mousemove', e => {
      if (pressed) {
        let x = e.clientX;
        let y = e.clientY;
        if (this.ct.pan(x - x0, y - y0))
          this.draw();
        x0 = x;
        y0 = y;
      }
    }).on('mouseup', e => {
      if (this.ct.pan(e.clientX - x0, e.clientY - y0)) {
        console.log('up:', e.clientX - x0, e.clientY - y0);
        this.draw();
      }
      pressed = false;
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
    this.taskQueue.clear();
    this.drawVectorMap(ctx);
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
          return this.drawVectorTile(ctx, x, y, tx, ty, tb, ctrl);  // 座標(x,y)に　this.zoom, tx, tyのベクタータイルを描画
        }, ctrl);
      }
    }
  }

  drawVectorTile(ctx: CanvasRenderingContext2D, x: number, y: number, tx: number, ty: number, tb: TileBlockTranformation, ctrl: TaskControl) {
    return new Promise<void>((resolve, reject) => {
      if (ctrl.stop) { resolve(); return; }
      let vals = { x: Math.floor(tx / 256), y: Math.floor(ty / 256), z: this.zoom, t: 'experimental_bvmap' };
      const template = 'https://cyberjapandata.gsi.go.jp/xyz/{t}/{z}/{x}/{y}.pbf';
      let url = template.replace(/\{(x|y|z|t)\}/g, (substring: string, ...arg: string[]) =>
        String(vals[arg[0] as 'x' | 'y' | 'z' | 't'] || `_${arg[0]}_undefined_`));
      let toX = (x: number) => { return this.ct.toX(tb.toBx(x * 256 / 4096 + tx)) };
      let toY = (y: number) => { return this.ct.toY(tb.toBy(y * 256 / 4096 + ty)) };
      let xhr = new XMLHttpRequest();
      let ct = this.ct;
      xhr.open('GET', url, true);
      xhr.responseType = 'arraybuffer';
      xhr.onload = function (e) {
        if (ctrl.stop) { resolve(); return; }
        let arrayBuffer = this.response;
        if (!arrayBuffer) return;
        let data = new Uint8Array(arrayBuffer);
        let vm = new VectorTile(data);
        ctx.fillStyle = 'white';
        let w = ct.ax * tb.ax * 256;
        let h = ct.ay * tb.ay * 256;

        ctx.beginPath();
        ctx.rect(x, y, w, h);
        ctx.fill();
        ctx.lineWidth = 2;

        ctx.lineWidth = 1;
        ctx.strokeStyle = 'black';
        ctx.fillStyle = 'lightgray';
        for (let name in vm.layers) {
          let layer = vm.layers[name];
          setTimeout(() => {
            if (ctrl.stop) {
              console.log('stop');
              return;
            }
            for (let f of layer.features) {
              f.geo_parse((cmd, x, y) => {
                if (cmd == 'begin') ctx.beginPath();
                else if (cmd == 'moveto') ctx.moveTo(toX(x), toY(y));
                else if (cmd == 'lineto') ctx.lineTo(toX(x), toY(y));
                else if (cmd == 'closepath') ctx.closePath();
                else if (cmd == 'end') {
                  if (f.feature.getType() == 3) {
                    ctx.save();
                    ctx.globalAlpha = 0.2;
                    ctx.fill();
                    ctx.restore();
                  } else
                    ctx.stroke();
                }
              });
            }
          }, 0);
        }
        resolve();
      }
      xhr.ontimeout = () => { reject("timeout"); };
      xhr.onabort = () => { reject("abort"); };
      xhr.send();
    });
  }

  makeMenu() {
    let helpMenu = new Menu({ name: 'Help' });
    this.menus.push(helpMenu);
    helpMenu.add({ name: 'この地図について' })
  }
}