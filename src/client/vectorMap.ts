import { Chizucraft, helpMenu, IMinecraftPoint } from "./chizucraft";
import { CoordinateTransformation } from "./ct";
import { blockLine, VectorTileRenderer } from "./vectorTileRenderer";
import { Menu } from "./menu";
import { TileBlockTranformation } from "./t2b";
import { button, div, icon, input, label, option, select, selected, span, tag } from "./tag";
import { TaskControl, TaskQueue } from "./taskQueue";
import { ProjectionParameter } from "./tileMaker";
import { j_alert, round } from "./util";
import { VectorTile } from "./vectorTile";
import { label_check, label_num } from "./template";
import { dlg_shapes } from "./shape_dlg";
import { dlg_layer } from "./layer_dlg";


export type MapName = 'gsi_std' | 'gsi_vector' | 'gsi_photo' | 'openStreet';

export interface MapSource {
  name: MapName;
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
    name: 'openStreet',
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
  [128 * 16, 'orange']
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
  private gen = 0;

  constructor(cc: Chizucraft, targetId: string) {
    this.cc = cc;
    this.makeMenu();
    $('#' + targetId).html(this.html());
    this.canvas = document.getElementById('vector-map-canvas') as HTMLCanvasElement;
    this.bind();
    this.update_canvas_size();
  }

  setParam(param: ProjectionParameter | undefined) {
    this.param = param;
    if (param)
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
      if (this.ct.pan(e.clientX - x0, e.clientY - y0))
        this.draw();
      this.cc.saveView();
      pressed = false;
      e.preventDefault();
    }).on('click', e => {
      if (!moved) {
        let s = this.selected = {
          bx: this.ct.fromX(e.clientX - this.canvas.offsetLeft),
          by: this.ct.fromY(e.clientY - this.canvas.offsetTop)
        };
        this.addMpoint(this.ct.fromX(e.clientX - this.canvas.offsetLeft),
          this.ct.fromY(e.clientY - this.canvas.offsetTop))
        this.draw();
      }
    }).on('wheel', e => {
      let oe = e.originalEvent as WheelEvent;
      if (oe.deltaY > 0) this.zoomView(0.5, e);
      else if (oe.deltaY < 0) this.zoomView(2, e);
      this.cc.saveView();
      e.preventDefault();
      e.stopPropagation();
    });
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
    let gen = ++this.gen;
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
    await this.taskQueue.clear();
    if (gen == this.gen) {
      this.zoom_update();
      let s = `zoom:${this.zoom},   Block size:${this.ct.ax} pixel`;
      if (this.selected) {
        let mx = this.selected.bx + this.cc.stat.minecraft_offset.x;
        let mz = this.selected.by + this.cc.stat.minecraft_offset.z;
        s += `  [${mx},${mz}]`;
      }
      this.status(s);
      this.drawVectorMap(ctx, gen);
    }
  }

  status(html: string) {
    $('.vector-map .topbar .status').html(html);
  }


  zoom_update() {
    if (!this.param) return;
    let zoom_max = this.mapSource.zoomMax;
    if (this.mapSource.name == 'gsi_vector')
      zoom_max = Math.min(this.mapSource.zoomMax, this.cc.stat.vector_zoom_max);
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

  async drawVectorMap(ctx: CanvasRenderingContext2D, gen: number) {
    if (!this.param) return;
    if (this.gen != gen) return;
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
    await this.taskQueue.waitAllTaskDone();
    if (gen == this.gen) {
      if (this.cc.stat.disp.grid)
        this.taskQueue.add(() => { return this.drawGrid(ctx); }, new TaskControl());
      this.taskQueue.add(() => { return this.drawXFrame(ctx); }, new TaskControl());
      this.taskQueue.add(() => { return this.drawYFrame(ctx); }, new TaskControl());
      this.taskQueue.add(() => { return this.drawMisc(ctx) }, new TaskControl());
    }
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
        let renderer = new VectorTileRenderer(ctx, ct, tb, tx, ty, vm, that.cc.stat);
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

  async drawMisc(ctx: CanvasRenderingContext2D) {
    let off = this.cc.stat.minecraft_offset;
    ctx.save();
    ctx.beginPath();
    ctx.rect(this.mx0, this.my0, this.canvas.width - this.mx0 - this.mx1, this.canvas.height - this.my0 - this.my1);
    ctx.clip();
    for (let s of this.cc.stat.shapes) {
      console.log('s:', s);
      if (s.bDisp) {
        ctx.fillStyle = s.color || '#008000';
        let bx0 = Math.floor(s.vertex[0].x) - off.x + 0.5;
        let by0 = Math.floor(s.vertex[0].z) - off.z + 0.5;
        for (let i = 1; i < s.vertex.length; i++) {
          let bx = Math.floor(s.vertex[i].x) - off.x + 0.5;
          let by = Math.floor(s.vertex[i].z) - off.z + 0.5;
          blockLine(ctx, this.ct, bx0, by0, bx, by);
          bx0 = bx;
          by0 = by;
        }
        if (s.bClose) {
          let bx = Math.floor(s.vertex[0].x) - off.x + 0.5;
          let by = Math.floor(s.vertex[0].z) - off.z + 0.5;
          blockLine(ctx, this.ct, bx0, by0, bx, by);
        }
      }
    }

    for (let m of this.cc.stat.mpoints) {
      if (m.bDisp)
        this.drawBlock(ctx, m.x, m.z, m.color);
    }

    let s = this.selected;
    if (s) {
      let off = this.cc.stat.minecraft_offset;
      this.drawBlock(ctx, s.bx + off.x, s.by + off.z);
    }
    ctx.restore();
  }

  drawBlock(ctx: CanvasRenderingContext2D, mx: number, mz: number, color: string | undefined = undefined) {
    let ct = this.ct;
    if (ct.ax < 1) return;
    let off = this.cc.stat.minecraft_offset;
    ctx.save();
    ctx.beginPath();
    ctx.rect(ct.toX(mx - off.x), ct.toY(mz - off.z), ct.ax, ct.ay);
    ctx.fillStyle = color || 'yellow';
    ctx.strokeStyle = 'red';
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.5;
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  setMap(mapName: MapName) {
    for (let ms of mapSorces) {
      if (ms.name == mapName) {
        this.mapSource = ms;
        this.draw();
        return;
      }
    }
    throw new Error(`mapName:${mapName} not defined`);
  }

  openGoogleMap() {
    if (!this.param) return;
    let sx = this.canvas.width / 2;
    let sy = this.canvas.height / 2;
    let bx = this.ct.fromX(sx);
    let by = this.ct.fromY(sy);
    let tb = new TileBlockTranformation(this.param, this.zoom);
    let tx = tb.toTx(bx);
    let ty = tb.toTy(by);
    let latlng = this.cc.map.unproject([tx, ty], this.zoom);
    console.log('latlng:', latlng);
    let url = 'https://www.google.com/maps/@?api=1&map_action=map&';
    url += `center=${latlng.lat},${latlng.lng}&zoom=${this.zoom}`;
    window.open(url, '_blank');
  };

  dlg_max_zoom() {
    let max = this.cc.stat.vector_zoom_max;
    $.confirm({
      title: 'ベクトルマップの最大Zoom設定',
      type: 'green',
      columnClass: 'medium',
      content: div({ class: 'dlg-max-zoom center' },
        label({ class: 'mx-2' }, '最大Zoomレベル:'),
        select(
          option({ selected: selected(max == 16) }, 16),
          option({ selected: selected(max == 17) }, 17)
        )
      ),
      buttons: {
        '設定': () => {
          let max = Number($('.dlg-max-zoom select').val());
          this.cc.stat.vector_zoom_max = max;
          this.cc.saveStat();
          this.draw();
        },
        'キャンセル': () => { }
      }
    });
  };

  openUrlGenDlg() {
    $.alert({
      title: '共有用URL作成',
      content: div({ class: 'url-gen-dlg' },
        div({ class: 'd-flex' },
          label('共有用URL'),
          input({ type: 'text', class: 'flex-fill mx-1' }),
          button({ class: 'btn-copy' }, 'Copy')),
        div({ class: 'mt-2 d-flex' },
          label_check('include-origin', '基準点を含める', true),
          label_check('include-minecraft-offset', 'マインクラフト座標オフセットを含める', true),
        )
      ),
      columnClass: 'x-large',
      type: 'blue',
      onOpen: () => {
        $('.url-gen-dlg .label-check input[type=checkbox]').on('change', () => {
          let url = this.makeSharingURL();
          $('.url-gen-dlg input[type=text]').val(url);
          $('.url-gen-dlg .include-minecraft-offset input').prop('disabled', !$('.url-gen-dlg .include-origin input').prop('checked'))
        });
        $('.url-gen-dlg .btn-copy').on('click', () => {
          $('.url-gen-dlg input[type=text]').trigger('select');
          document.execCommand('copy');
          $('.url-gen-dlg input[type=text]').trigger('unselect');
          let sel = document.getSelection();
          if (sel) sel.removeAllRanges();
        })
        $('.url-gen-dlg input[type=text]').val(this.makeSharingURL());
      }
    });
  }

  makeSharingURL(): string {
    let url0 = new URL(document.URL);
    url0.search = '';
    let base = url0.toString();
    let query: string[] = [];
    let stat = this.cc.stat;
    console.log('url0:', url0);
    if ($('.url-gen-dlg .include-origin input').prop('checked') && stat.origin) {
      query.push('origin=' + stat.origin.join(','))
      let m = stat.minecraft_offset;
      if ($('.url-gen-dlg .include-minecraft-offset input').prop('checked') && m) {
        query.push('minecraft_offset=' + `${m.x},${m.y},${m.z}`);
      }
    }
    let url = base;
    if (query.length > 0)
      url += '?' + query.join('&');
    return url;
  }

  addMpoint(x: number, z: number) {
    this.cc.stat.mpoints.unshift({
      bDisp: false,
      x: x + this.cc.stat.minecraft_offset.x,
      z: z + this.cc.stat.minecraft_offset.z
    });
    this.cc.saveStat();
  }

  dlg_mpoints() {
    let mpoints = this.cc.stat.mpoints;
    let s = '';
    var menu = new Menu({ name: 'Menu', z_index: 9999999999 });
    let html = () => {
      let s = div({ class: 'top' },
        div({ class: 'fill' }),
        menu.html());
      if (mpoints.length == 0) {
        s = '選択点リストはありません';
      } else {
        for (let i = 0; i < mpoints.length; i++) {
          let p = mpoints[i];
          s += div({ class: 'mpoint', idx: i },
            input({ class: 'chk-disp', type: 'checkbox', checked: selected(p.bDisp) }),
            div(`座標 [ ${p.x} , ${p.z} ]`),
            div({ class: 'fill' }),
            button({ class: 'btn-delete', title: '削除' }, icon('trash')),
            button({ class: 'btn-jump', title: '座標に移動' }, icon('box-arrow-in-down-left')),
            input({ class: 'input-color', type: 'color', value: p.color || '#ffff00' }),
          );
        }
      }
      return div({ class: 'mpoint-list' }, s);
    }
    let dlg = $.alert({
      title: '選択点リスト',
      content: html(),
      columnClass: 'medium',
      draggable: true,
      onOpen: () => {
        menu.bind();
        $('.mpoint .chk-disp').on('change', e => {
          let idx = Number($(e.currentTarget).parent().attr('idx'));
          this.cc.stat.mpoints[idx].bDisp = !this.cc.stat.mpoints[idx].bDisp;
          this.draw();
        });
        $('.mpoint .btn-delete').on('click', e => {
          let p = $(e.currentTarget).parent();
          let idx = Number(p.attr('idx'));
          this.cc.stat.mpoints.splice(idx, 1);
          this.cc.saveStat();
          this.draw();
          let n = p.next('.mpoint');
          while (n.length > 0) {
            n.attr('idx', idx++);
            n = n.next('.mpoint');
          }
          p.remove();
        });
        $('.mpoint .btn-jump').on('click', e => {
          let idx = Number($(e.currentTarget).parent().attr('idx'));
          let mp = this.cc.stat.mpoints[idx];
          let off = this.cc.stat.minecraft_offset;
          let c = this.canvas;
          mp.bDisp = true;
          this.ct.moveTo(mp.x - off.x, mp.z - off.z, this.ct.ax, c.width / 2, c.height / 6);
          this.cc.saveView();
          this.draw();
        });
        $('.mpoint .input-color').on('change', e => {
          let idx = Number($(e.currentTarget).parent().attr('idx'));
          this.cc.stat.mpoints[idx].color = $(e.currentTarget).val() as string;
          this.cc.saveStat();
          this.draw();
        });
      }
    });

    let len = mpoints.length;

    menu.add({
      name: '全ての点を表示',
      disable: len < 1,
      action: (e, menu) => {
        for (let p of mpoints)
          p.bDisp = true;
        $('.mpoint input[type=checkbox]').prop('checked', true);
        this.draw();
      }
    });
    menu.add({
      name: '全ての点を非表示',
      disable: len < 1,
      action: (e, menu) => {
        for (let p of mpoints)
          p.bDisp = false;
        $('.mpoint input[type=checkbox]').prop('checked', false);
        this.draw();
      }
    });
    menu.addSeparator();
    menu.add({
      name: '先頭の2点で直線を生成',
      disable: len < 2,
      action: (e, menu) => {
        this.addShape([mpoints[0], mpoints[1]], false);
        this.draw();
      }
    });
    menu.add({
      name: '全ての点で折れ線を生成',
      disable: len < 3,
      action: (e, menu) => {
        this.addShape(mpoints);
        this.draw();
      }
    });
    menu.add({
      name: '全ての点でポリゴンを生成',
      disable: len < 3,
      action: (e, menu) => {
        this.addShape(mpoints, true);
        this.draw();
      }
    });
    menu.addSeparator();
    menu.add({
      name: 'リストをクリア',
      disable: mpoints.length < 1,
      action: (e, menu) => {
        this.cc.stat.mpoints = [];
        this.cc.saveStat();
        this.selected = undefined;
        this.draw();
        dlg.close();
      }
    });

  }

  addShape(vertex: IMinecraftPoint[], bClose: boolean = false, color: string = '#008000') {
    this.cc.stat.shapes.unshift({ bDisp: true, bClose, vertex, color });
    this.cc.saveStat();
  }

  makeMenu() {
    this.menus.push(new Menu({
      name: '移動',
      children: [{
        name: '基準点に移動',
        action: (e, menu) => {
          this.ct.moveTo(0, 0, this.ct.ax, this.canvas.width / 2, this.canvas.height / 2);
          this.selected = { bx: 0, by: 0 };
          this.draw();
        }
      }, {
        name: '選択されたブロックに移動',
        onBeforeExpand: menu => { menu.opt.disable = this.selected === undefined; },
        action: (e, menu) => {
          if (this.selected) {
            this.ct.moveTo(this.selected.bx, this.selected.by,
              this.ct.ax, this.canvas.width / 2, this.canvas.height / 2);
            this.draw();
          } else {
            j_alert('ブロックが選択されていません');
          }
        }
      }, {
        name: 'マインクラフトの座標に移動',
        action: (e, menu) => {
          let { x, z } = this.cc.stat.minecraft_offset;
          if (this.selected) {
            x += this.selected.bx;
            z += this.selected.by;
          }
          $.confirm({
            title: 'マインクラフトの座標に移動',
            type: 'green',
            content: div({ class: 'minecraft-goto-dlg' },
              div('移動先の座標'),
              div(label_num('x', x), label_num('z', z))
            ),
            buttons: {
              '移動': () => {
                let tx = Number($('.minecraft-goto-dlg .x input').val());
                let tz = Number($('.minecraft-goto-dlg .z input').val());
                this.selected = {
                  bx: tx - this.cc.stat.minecraft_offset.x,
                  by: tz - this.cc.stat.minecraft_offset.z
                };
                this.ct.moveTo(this.selected.bx, this.selected.by,
                  this.ct.ax, this.canvas.width / 2, this.canvas.height / 2);
                this.draw();
              },
              'キャンセル': () => { }
            }
          });
        }
      }]
    }));
    this.menus.push(new Menu({
      name: '表示',
      children: [{
        name: 'マインクラフトの座標設定',
        action: (e, menu) => {
          let sel = this.selected;
          if (!sel) {
            j_alert('ブロックが選択されていません');
          } else {
            let off = this.cc.stat.minecraft_offset;
            $.confirm({
              title: 'マインクラフトの座標設定',
              columnClass: 'medium',
              type: 'green',
              content: div({ class: 'minecraft-offset-dlg' },
                div('現在選択されたブロックの座標'),
                div(
                  label_num('x', sel.bx + off.x),
                  label_num('y', off.y),
                  label_num('z', sel.by + off.z))
              ),
              buttons: {
                '設定': () => {
                  if (sel) {
                    let x = Number($('.minecraft-offset-dlg .x input').val());
                    let y = Number($('.minecraft-offset-dlg .y input').val());
                    let z = Number($('.minecraft-offset-dlg .z input').val());
                    off.x = x - sel.bx;
                    off.y = y;
                    off.z = z - sel.by;
                    this.cc.saveStat();
                    this.draw();
                  }
                },
                'キャンセル': () => { }
              }
            });
          }
        }
      }, {
        name: 'ベクターマップの最大zoom設定',
        action: (e, menu) => { this.dlg_max_zoom(); }
      }, {
        separator: true
      }, {
        name: '選択点リスト表示',
        action: (e, menu) => { this.dlg_mpoints(); }
      }, {
        name: '図形リスト表示',
        action: (e, menu) => { dlg_shapes(this); }
      }, {
        separator: true
      }, {
        name: '表示レイヤー設定',
        action: (e, menu) => { dlg_layer(this); }
      }]
    }));

    this.menus.push(new Menu({
      name: '地図',
      action: (e, menu) => {
        menu.clear();
        menu.add({
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
        });
        menu.addSeparator();

        for (let ms of mapSorces) {
          menu.add({
            name: ms.dispName,
            with_check: true,
            checked: this.mapSource == ms,
            action: (e, menu) => {
              this.mapSource = ms;
              this.cc.stat.disp.mapName = ms.name;
              this.cc.saveStat();
              this.draw();
            }
          });
        }
        menu.addSeparator();
        menu.add({
          name: 'GoogleMapを開く',
          action: (e, menu) => { this.openGoogleMap(); }
        });
        menu.add({
          name: 'Platuauview を開く',
          link_open: 'https://plateauview.jp/'
        });
        menu.addSeparator();
        menu.add({
          name: '共有用URLの生成',
          action: (e, menu) => { this.openUrlGenDlg(); }

        });
        menu.expand(e);
      }
    }));
    this.menus.push(helpMenu());
  }

}


