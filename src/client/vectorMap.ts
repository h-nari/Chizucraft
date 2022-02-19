import { assert_not_null } from "./asserts";
import { BlockBuffer } from "./blockBuffer";
import { Chizucraft, helpMenu, IMinecraftPoint } from "./chizucraft";
import { ColorSelector } from "./colorSelector";
import { CoordinateTransformation } from "./ct";
import { dlg_layer } from "./layer_dlg";
import { Menu } from "./menu";
import { ModeHander } from "./modeHandler";
import { PaintModeHandler } from "./paintMode";
import { PanModeHandler } from "./panMode";
import { RectFillModeHandler } from "./rectFillMode";
import { SelectModeHandler } from "./selectMode";
import { dlg_shapes } from "./shape_dlg";
import { SpoidModeHandler } from "./spoidMode";
import { TileBlockTranformation } from "./t2b";
import { button, div, icon, input, label, option, select, selected, tag } from "./tag";
import { TaskControl, TaskQueue } from "./taskQueue";
import { label_check, label_num } from "./template";
import { ProjectionParameter } from "./tileMaker";
import { ToolBar } from "./toolBar";
import { j_alert, round } from "./util";
import { VectorTile } from "./vectorTile";
import { blockLine, VectorTileRenderer } from "./vectorTileRenderer";


export type MapName = 'gsi_std' | 'gsi_vector' | 'gsi_photo' | 'openStreet';

export interface MapSource {
  name: MapName;
  dispName: string;
  template: string;
  zoomMin: number;
  zoomMax: number;
  tileMax: number;
  type: 'image' | 'vector';
};

const gsi_std_template = 'https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png';
const gsi_photo_template = 'https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg';
const gsi_vector_template = 'https://cyberjapandata.gsi.go.jp/xyz/experimental_bvmap/{z}/{x}/{y}.pbf';
const openStreet_template = 'http://tile.openstreetmap.org/{z}/{x}/{y}.png';
const gsi_photo_mapSource: MapSource
  = { name: 'gsi_photo', dispName: '航空写真', template: gsi_photo_template, zoomMin: 2, zoomMax: 18, tileMax: 4, type: 'image' };
const gsi_vector_mapSource: MapSource =
  { name: 'gsi_vector', dispName: '地理院ベクター', template: gsi_vector_template, zoomMin: 8, zoomMax: 17, tileMax: 1, type: 'vector' };

const mapSorces: MapSource[] = [
  { name: 'gsi_std', dispName: '地理院', template: gsi_std_template, zoomMin: 2, zoomMax: 18, tileMax: 8, type: 'image' },
  gsi_photo_mapSource,
  { name: 'openStreet', dispName: 'OpenStreetMap', template: openStreet_template, zoomMin: 2, zoomMax: 18, tileMax: 4, type: 'image' },
  gsi_vector_mapSource,
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
  public bb: BlockBuffer;
  public zoom: number = 16;
  private menus: Menu[] = [];
  private taskQueue = new TaskQueue();
  private mx0 = 50;
  private mx1 = 0;
  private my0 = 20;
  private my1 = 0;
  public mapSource = mapSorces[0];
  private gen = 0;
  public bDispPhoto = true;
  public bDispBlock = true;
  public bDispVector = true;
  public tb: ToolBar;
  public modes: ModeHander[] = [];
  public currentMode: ModeHander | undefined;
  public cs: ColorSelector;
  public backgroundColor = '#e0e0e0';

  constructor(cc: Chizucraft, targetId: string) {
    this.cc = cc;
    this.bb = new BlockBuffer(this);
    this.cs = new ColorSelector(this.bb);
    this.makeMenu();
    this.modes.push(new SelectModeHandler(this));
    this.modes.push(new PanModeHandler(this));
    this.modes.push(new PaintModeHandler(this));
    this.modes.push(new RectFillModeHandler(this));
    this.modes.push(new SpoidModeHandler(this));
    this.modeSet('select');

    this.tb = new ToolBar();
    this.tb.add({ icon: 'arrow-up-left', title: '選択モード', action: () => { this.modeSet('select'); } });
    this.tb.add({ icon: 'arrows-move', title: 'パン・モード', action: () => { this.modeSet('pan'); } });
    this.tb.add({ icon: 'pencil', title: 'ペイントモード', action: () => { this.modeSet('paint') } });
    this.tb.add({ icon: 'pencil-square', title: '長方形塗り潰し', action: () => { this.modeSet('rect-fill') } });
    this.tb.add({ icon: 'eyedropper', title: 'スポイドツール', action: () => { this.modeSet('spoid'); } });
    this.tb.add({
      icon: 'grid-3x3-gap', title: 'ブロック画像表示', class: 'btn-disp-block',
      action: () => {
        this.bb.bDisp = !this.bb.bDisp;
        // this.setDispBlockState();
        // this.save();
        this.draw();
      }
    });
    this.tb.add({
      icon: 'vector-pen', title: 'ベクター画像',
      action: () => {
        this.bDispVector = !this.bDispVector;
        this.draw();
      }
    });
    this.tb.add({
      icon: 'grid-3x3', title: 'グリッド表示',
      action: () => {
        this.cc.stat.disp.grid = !this.cc.stat.disp.grid;
        this.draw();
      }
    });
    this.tb.add({
      icon: 'image', title: '背景画像表示',
      action: () => {
        this.bDispPhoto = !this.bDispPhoto;
        this.draw();
      }
    });

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
        div({ class: 'icon-box' }, button({
          class: 'btn btn-minecraft-jump-by-clipboard',
          title: 'クリップボードのマインクラフト座標へジャンプ'
        }, icon('box-arrow-in-down-left'))),
        ... this.menus.map(m => m.html())),
      div(
        this.tb.html(), this.cs.html()),
      tag('canvas', { id: 'vector-map-canvas' }));
  }

  bind() {
    this.menus.forEach(m => m.bind());
    this.tb.bind();
    this.cs.bind();
    window.onresize = e => {
      this.update_canvas_size();
    };
    $('.btn-minecraft-jump-by-clipboard').on('click', e => { this.minecraft_jump_by_clipboard(); })
    var x0 = 0;
    var y0 = 0;
    var pressed = false;
    var moved = 0;

    $(this.canvas).on('click', e => { this.currentMode?.onClick(e); });
    $(this.canvas).on('mousedown', e => { this.currentMode?.onMouseDown(e); });
    $(this.canvas).on('mousemove', e => { this.currentMode?.onMouseMove(e); });
    $(this.canvas).on('mouseup', e => {
      if (e.button == 0)
        this.currentMode?.onMouseUp(e);
      else if (e.button == 1) {
        this.bb.spoid(e);
        if (this.currentMode?.name != 'rect-fill') {
          this.modeSet('paint');
        }
        e.stopPropagation();
        e.preventDefault();
      }
    });
    $(this.canvas).on('wheel', e => {
      let oe = e.originalEvent as WheelEvent;
      if (oe.deltaY > 0) this.zoomView(0.5, e);
      else if (oe.deltaY < 0) this.zoomView(2, e);
      this.cc.saveView();
      e.preventDefault();
      e.stopPropagation();
    });
  }

  save() {
    this.cc.stat.blockBuffer = this.bb.save();
    this.cc.stat.backgroundColor = this.backgroundColor;
    this.cc.saveStat();
  }

  saveView() {
    this.cc.saveView();
  }

  modeSet(n: string) {
    let handler = this.modes.find(m => m.name == n);
    if (handler) {
      if (this.currentMode)
        this.currentMode.onUnselect();

      $('#vector-map-canvas').attr('mode', n);
      handler.onSelect();
      this.currentMode = handler;
    } else {
      $('#vector-map-canvas').removeAttr('mode');
      console.error(`mode ${n} not defined`);
    }
  }

  blockPos(e: JQuery.ClickEvent | JQuery.MouseDownEvent | JQuery.MouseMoveEvent | JQuery.MouseUpEvent): { bx: number; by: number; } {
    let sx = e.clientX - this.canvas.offsetLeft;
    let sy = e.clientY - this.canvas.offsetTop;
    let bx = this.ct.fromX(sx);
    let by = this.ct.fromY(sy);
    return { bx, by };
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

    // if (c.width == 0) this.ct.bx = w / 2;
    c.width = w;
    // if (c.height == 0) this.ct.by = h / 2;
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
      this.zoom = this.zoom_update(this.zoom, this.mapSource);
      if (this.cc.stat.zoom != this.zoom) {
        this.cc.stat.zoom = this.zoom;
        this.cc.saveStat();
      }

      if (this.mapSource.type == 'vector') {
        if (this.bDispPhoto) {
          let zoom = this.zoom_update(this.zoom, gsi_photo_mapSource);
          await this.drawMap(ctx, gen, false, gsi_photo_template, zoom);
        } else {
          ctx.fillStyle = this.backgroundColor;
          ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }
        if (this.bDispVector)
          await this.drawMap(ctx, gen, true, this.mapSource.template, this.zoom);
      } else {
        await this.drawMap(ctx, gen, false, this.mapSource.template, this.zoom);
      }

      this.bb.draw(ctx, this.ct);
      this.drawMisc(ctx);
      this.bb.drawSelectedRect(ctx, this.ct);
    }
  }

  status(html: string) {
    $('.vector-map .topbar .status').html(html);
  }


  zoom_update(zoom_init: number, mapSource: MapSource): number {
    let zoom = zoom_init;
    if (!this.param) throw new Error('no param');
    let zoom_max = mapSource.zoomMax;
    if (mapSource.name == 'gsi_vector')
      zoom_max = Math.min(mapSource.zoomMax, this.cc.stat.vector_zoom_max);
    let zoom_min = mapSource.zoomMin;
    let tile_max = mapSource.tileMax;
    if (zoom > zoom_max) zoom = zoom_max;
    if (zoom < zoom_min) zoom = zoom_min;
    // 画面を覆うのに必要なタイル数を計算
    let blockWidth = this.canvas.width / this.ct.ax;
    let pointWidth = blockWidth * this.param.blocksize / this.param.mPerPoint.x;
    let tileWidth = pointWidth * Math.pow(2, zoom - this.param.zoom) / 256;
    while (tileWidth > tile_max && zoom > zoom_min) {
      tileWidth /= 2;
      zoom--;
    }
    while (tileWidth < tile_max && zoom < zoom_max) {
      tileWidth *= 2;
      zoom++;
    }
    return zoom;
  }

  async drawMap(ctx: CanvasRenderingContext2D, gen: number, bVector: boolean, template: string, zoom: number) {
    if (!this.param) return;
    if (this.gen != gen) return;
    // 画面左上のタイル座標を求める
    let param = this.param;
    let tb = new TileBlockTranformation(param, zoom);
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
        if (bVector) {
          var ctrl = new TaskControl();
          this.taskQueue.add(() => {
            return this.drawVectorTile(ctx, tx, ty, tb, ctrl, template, zoom);  // zoom, tx, tyのベクタータイルを描画
          }, ctrl);
        } else {
          this.taskQueue.add(() => {
            return this.drawImageTile(ctx, tx, ty, tb, template, zoom);
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
      // this.taskQueue.add(() => { return this.drawMisc(ctx) }, new TaskControl());
    }
  }

  drawVectorTile(ctx: CanvasRenderingContext2D, tx: number, ty: number, tb: TileBlockTranformation, ctrl: TaskControl, template: string, zoom: number) {
    return new Promise<void>((resolve, reject) => {
      if (ctrl.stop) { resolve(); return; }
      let vals = { x: Math.floor(tx / 256), y: Math.floor(ty / 256), z: zoom, t: 'experimental_bvmap' };
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

  drawImageTile(ctx: CanvasRenderingContext2D, tx: number, ty: number, tb: TileBlockTranformation, template: string, zoom: number): Promise<void> {
    return new Promise((resolve, reject) => {
      let vals = { x: Math.floor(tx / 256), y: Math.floor(ty / 256), z: zoom };
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
    ctx.textBaseline = 'top';
    for (let g of grids) {
      ctx.strokeStyle = g[1];
      if (this.ct.ax * g[0] < 50) continue;
      for (let mz = Math.floor((ct.fromY(y0) + moff.z + 64) / g[0]) * g[0] - 64; ct.toY(mz - moff.z) < y1; mz += g[0]) {
        let y = ct.toY(mz - moff.z);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(this.mx0, y);
        ctx.stroke();
        ctx.fillText(`z:${mz}`, 2, y + 2);
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

    /*
    let s = this.selected;
    if (s) {
      let off = this.cc.stat.minecraft_offset;
      this.drawBlock(ctx, s.bx + off.x, s.by + off.z);
    }
    */
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

  setMap(mapName: MapName, bDispPhoto: boolean) {
    for (let ms of mapSorces) {
      if (ms.name == mapName) {
        this.mapSource = ms;
        this.bDispPhoto = bDispPhoto;
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
    this.cc.stat.mpoints.splice(20);
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
        // this.selected = undefined;
        this.draw();
        dlg.close();
      }
    });

  }

  addShape(vertex: IMinecraftPoint[], bClose: boolean = false, color: string = '#008000') {
    this.cc.stat.shapes.unshift({ bDisp: true, bClose, vertex, color });
    this.cc.saveStat();
  }

  /**
   * 指定されたマインクラフト座標(tx,tz)のブロックを選択し、中心に表示する
   * 
   * @param tx マインクラフトX座病
   * @param tz マインクラフトZ座病
   */
  minecraft_goto(tx: number, tz: number) {
    let bx = tx - this.cc.stat.minecraft_offset.x;
    let by = tz - this.cc.stat.minecraft_offset.z;
    this.bb.select(bx, by);

    this.ct.moveTo(bx, by, this.ct.ax, this.canvas.width / 2, this.canvas.height / 2);
    this.draw();
  }

  /**
   * クリップボードのマインクラフト座標へ移動
   */
  minecraft_jump_by_clipboard() {
    if (navigator.clipboard) {
      navigator.clipboard.readText().then(text => {
        // textの例: /execute in minecraft:overworld run tp @s -3548.68 68.00 1196.12 -234.14 90.00
        let m = text.match(/tp @s\s+(-?\d+\.\d+)\s+(-?\d+\.\d+)\s+(-?\d+\.\d+)\s+/);
        if (m) {
          let tx = Math.floor(parseFloat(m[1]));
          let tz = Math.floor(parseFloat(m[3]));
          this.minecraft_goto(tx, tz);
        } else {
          minecraft_clipboard_message();
        }
      })
    } else {
      console.log('no clipboard');
    }

  }

  makeMenu() {
    this.menus.push(new Menu({
      name: '移動',
      children: [{
        name: '基準点に移動',
        action: (e, menu) => {
          this.ct.moveTo(0, 0, this.ct.ax, this.canvas.width / 2, this.canvas.height / 2);
          this.bb.select(0, 0);
          this.draw();
        }
      }, {
        name: '選択されたブロックに移動',
        onBeforeExpand: menu => { menu.opt.disable = !this.bb.singleBlockSelected(); },
        action: (e, menu) => {
          if (this.bb.singleBlockSelected()) {
            assert_not_null(this.bb.selectedRect);
            this.ct.moveTo(this.bb.selectedRect.x, this.bb.selectedRect.y,
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
          if (this.bb.singleBlockSelected()) {
            assert_not_null(this.bb.selectedRect);
            x += this.bb.selectedRect.x;
            z += this.bb.selectedRect.y;
          }
          $.confirm({
            title: 'マインクラフトの座標に移動',
            type: 'green',
            columnClass: 'small',
            content: div({ class: 'minecraft-goto-dlg' },
              div('移動先の座標'),
              div(label_num('x', x), label_num('z', z),
                div({ class: 'coordinate-from-clipboard my-3' },
                  button({ class: 'btn btn-exec btn-sm btn-outline-dark' },
                    '座標をクリップボードから取得'),
                )
              )
            ),
            buttons: {
              '移動': () => {
                let tx = Number($('.minecraft-goto-dlg .x input').val());
                let tz = Number($('.minecraft-goto-dlg .z input').val());
                this.minecraft_goto(tx, tz);
              },
              'キャンセル': () => { }
            },
            onOpen: () => {
              console.log('onOpen');
              $('.minecraft-goto-dlg .btn-exec').on('click', () => {
                if (navigator.clipboard) {
                  navigator.clipboard.readText().then(text => {
                    // textの例: /execute in minecraft:overworld run tp @s -3548.68 68.00 1196.12 -234.14 90.00
                    let m = text.match(/tp @s\s+(-?\d+)\.\d+\s+(-?\d+)\.\d+\s+(-?\d+)\.\d+\s+/);
                    if (m) {
                      $('.minecraft-goto-dlg .x input').val(m[1]);
                      $('.minecraft-goto-dlg .z input').val(m[3]);
                    } else {
                      minecraft_clipboard_message();
                    }
                  })
                } else {
                  console.log('no clipboard');
                }
              });
            }
          });
        }
      }]
    }));
    this.menus.push(new Menu({
      name: '表示',
      children: [{
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
      }, {
        name: '背景色設定',
        action: (e, m) => {
          $.confirm({
            title: '単色背景色設定',
            content: div({ class: 'monochrome-background-dlg' },
              div({ class: 'd-inline-block ms-4' },
                div({ class: 'd-inline-block me-3 ' }, '背景色:'),
                input({ type: 'color', value: this.backgroundColor, class: 'align-middle' }))
            ),
            buttons: {
              OK: () => {
                this.backgroundColor = $('.monochrome-background-dlg input[type=color]').val() as string;
                this.save();
                this.draw();
              },
              Cancel: () => { }
            }
          });
        }
      }, {
        separator: true
      }, {
        name: 'マインクラフトの座標設定',
        action: (e, menu) => {
          if (!this.bb.singleBlockSelected()) {
            j_alert('ブロックが選択されていません');
          } else {
            assert_not_null(this.bb.selectedRect);
            let off = this.cc.stat.minecraft_offset;
            $.confirm({
              title: 'マインクラフトの座標設定',
              columnClass: 'medium',
              type: 'green',
              content: div({ class: 'minecraft-offset-dlg' },
                div('現在選択されたブロックの座標'),
                div(
                  label_num('x', this.bb.selectedRect.x + off.x),
                  label_num('y', off.y),
                  label_num('z', this.bb.selectedRect.y + off.z))
              ),
              buttons: {
                '設定': () => {
                  if (this.bb.singleBlockSelected()) {
                    assert_not_null(this.bb.selectedRect);
                    let x = Number($('.minecraft-offset-dlg .x input').val());
                    let y = Number($('.minecraft-offset-dlg .y input').val());
                    let z = Number($('.minecraft-offset-dlg .z input').val());
                    off.x = x - this.bb.selectedRect.x;
                    off.y = y;
                    off.z = z - this.bb.selectedRect.y;
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
        for (let ms of mapSorces) {
          menu.add({
            name: ms.dispName,
            with_check: true,
            checked: this.mapSource == ms && !this.bDispPhoto,
            action: (e, menu) => {
              this.mapSource = ms;
              this.bDispPhoto = false;
              this.cc.stat.disp.mapName = ms.name;
              this.cc.stat.disp.bDispPhoto = false;
              this.cc.saveStat();
              this.draw();
            }
          });
        }
        menu.add({
          name: '地理院ベクター + 航空写真',
          with_check: true,
          checked: this.mapSource == gsi_vector_mapSource && this.bDispPhoto,
          action: (e, menu) => {
            this.mapSource = gsi_vector_mapSource;
            this.bDispPhoto = true;
            this.cc.stat.disp.mapName = gsi_vector_mapSource.name;
            this.cc.stat.disp.bDispPhoto = true;
            this.cc.saveStat();
            this.draw();
          }
        });
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


function minecraft_clipboard_message() {
  $.alert({
    title: 'マインクラフトの座標をクリップボードから取得',
    type: 'blue',
    columnClass: 'large',
    content: div({ class: 'text-center' },
      div({ class: 'my-3 alert alert-warning' }, 'クリップボードに座標情報がありません'),
      div({ class: 'my-3' }, 'マインクラフトJava版では <b>F3 + C</b>  で座標情報をクリップボードにコピーできます'))
  })
}

