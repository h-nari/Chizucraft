import * as L from 'leaflet';
import { ProjectionParameter } from './tileMaker';
import { a, button, div, input, label, option, select, selected } from './tag';
import { range, row } from './template';
import { Menu } from './menu';
import { MapName, VectorMap } from './vectorMap';
import { deepAssign, jconfirm } from './util';

let attribution = "<a href='https://maps.gsi.go.jp/development/ichiran.html' target='_blank'>地理院タイル</a>";

interface cc_stat {
  blocksize: number;    // minecraft block size[m]
  origin?: [number, number];  // LatLng
  origin_disp: boolean;
  minecraft_offset: { x: number, y: number, z: number }; // 原点のminecraft上の座標 [x,y,z]
  zoom: number;
  marker: {
    disp: boolean;
    grid_size: number;
    latlng?: [number, number];
  };
  filename?: string;
  tab?: string;
  disp: {
    mapName: MapName;
    grid: boolean;
  }
  vector_zoom_max: number;
};

export class Chizucraft {
  private url_template = 'https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png';
  private tile_attr = {
    attribution
  };
  public map: L.Map;
  public stat: cc_stat;
  public markers: L.Layer[] = [];
  public origins: L.Layer[] = [];
  public cLatLng: L.LatLng; // 画面中心の座標
  public lockMarker = false;
  public vectorMap: VectorMap;
  public menus: Menu[] = [];
  public markerFixToScreen: boolean = false;

  constructor() {
    this.map = L.map('map');
    this.vectorMap = new VectorMap(this, 'pane-vector-map');
    this.stat = {
      origin_disp: false,
      blocksize: 1,
      zoom: 15,
      marker: { disp: false, grid_size: 2048 },
      minecraft_offset: { x: 0, y: 64, z: 0 },
      disp: { mapName: 'gsi_vector', grid: true },
      vector_zoom_max: 16
    };
    L.tileLayer(this.url_template, this.tile_attr).addTo(this.map);
    L.control.scale().addTo(this.map);
    this.loadView();
    this.loadStat();
    this.map.on('movestart', e => {
      this.cLatLng = this.map.getBounds().getCenter();
    })
    this.map.on('move', e => {
      this.moveMap();
    })
    this.map.on('moveend', e => {
      this.moveMap();
      this.saveStat();
    })
    this.map.on('zoomstart', e => {
      this.lockMarker = true;
    });
    this.map.on('zoomend', e => {
      this.lockMarker = false;
      this.cLatLng = this.map.getBounds().getCenter();
      this.dispCurrentMapState();
      this.saveView();
    })
    this.map.on('keydown', e => {
      let ke = e as L.LeafletKeyboardEvent;
      if (ke.originalEvent.key == 'Control') {
        this.markerFixToScreen = true;
      }
    });
    this.map.on('keyup', e => {
      let ke = e as L.LeafletKeyboardEvent;
      if (ke.originalEvent.key == 'Control') {
        let ke = e as L.LeafletKeyboardEvent;
        this.markerFixToScreen = false;
      }
    });

    this.makeMenu();


    this.cLatLng = this.map.getBounds().getCenter();
    $('#map-pane .topbar').html(this.html_topbar());
    // $('#controller').html(this.html());
    this.dispCurrentMapState();
    if (this.stat.marker.disp)
      this.drawMarker();
    if (this.stat.origin_disp)
      this.drawOrigin();
    this.saveStat();
  }

  html_topbar() {
    let s = div({ class: 'origin label-value' },
      label('基準点:'),
      div({ class: 'value' }, '未設定')
    );
    s += div({ class: 'zoom label-value' },
      label('Zoom'),
      div({ class: 'value' })
    )
    s += div({ class: 'd-inlineblock flex-fill' });
    this.menus.forEach(m => { s += m.html(); });
    return s;
  }

  html() {
    return div({ class: 'chizu-controller' },
      row('ファイル',
        div(
          div('ファイル名'),
          div({ class: 'filename' }, this.stat.filename || '%noname%')),
        input({ type: 'file', id: 'input-file-load0', style: 'display:none' }),
        button({ class: 'btn btn-sm btn-primary btn-file-load' }, 'Load'),
        a({ class: 'btn btn-sm btn-primary btn-file-save' }, 'Save')
      ),
    );
  }


  saveView() {
    let center = this.map.getCenter();
    let zoom = this.map.getZoom();
    let ct = this.vectorMap.ct.save();
    localStorage.setItem('chizucraft_view', JSON.stringify({ center, zoom, ct }));
  }

  loadView() {
    let view_json = localStorage.getItem('chizucraft_view');
    if (view_json) {
      let v = JSON.parse(view_json);
      this.map.setView(v.center, v.zoom);
      if (v.ct)
        this.vectorMap.ct.load(v.ct);
    } else {
      this.map.setView([38.16911, 138.88], 5);
    }
  }

  saveStat() {
    localStorage.setItem('chizucraft_stat', JSON.stringify(this.stat));
  }

  loadStat() {
    let stat_json = localStorage.getItem('chizucraft_stat');
    if (stat_json) {
      let stat = JSON.parse(stat_json);
      deepAssign(this.stat, stat);
      this.setVectorParam();
      if (this.stat.origin)
        this.vectorMap.setMap(this.stat.disp.mapName);
      if (this.stat.tab)
        this.tab_set(this.stat.tab);
    }
    this.setTitle();
  }

  private setVectorParam() {
    if (this.stat.origin) {
      let oLatLng = L.latLng(this.stat.origin);
      let param: ProjectionParameter = {
        zoom: this.stat.zoom,
        oPoint: this.map.project(oLatLng, this.stat.zoom),
        blocksize: this.stat.blocksize,
        mPerPoint: this.getMPerPoint()
      };
      this.vectorMap.setParam(param);
    } else {
      this.vectorMap.setParam(undefined);
    }
  }

  tab_set(target: string) {
    $('.tab-bar a.nav-link').removeClass('active');
    $('.tab-bar div.tab').removeClass('hidden');
    $('.tab-bar div.tab').addClass('hidden');
    $(`.tab-bar a.nav-link[target=${target}]`).addClass('active');
    $('#' + target).removeClass('hidden');
    if (target == 'pane-vector-map')
      this.vectorMap.update_canvas_size();
    if (this.stat.tab != target) {
      this.stat.tab = target;
      this.saveStat();
    }
  }

  bind() {
    this.menus.forEach(m => m.bind());
    // load
    $('#input-file-load').on('change', async e => {
      let elem = e.target as HTMLInputElement;
      if (elem.files && elem.files.length > 0) {
        let file = elem.files[0];
        let json = await file.text();
        let stat = JSON.parse(json) as cc_stat;
        deepAssign(this.stat, stat);
        this.stat.filename = file.name;
        this.saveStat();
        this.dispCurrentMapState();
        this.setVectorParam();
        stat = this.stat;
        if (stat.origin)
          this.map.panTo(L.latLng(stat.origin));
        if (stat.marker.disp)
          this.drawMarker();
        else
          this.removeMarker();
        if (stat.origin_disp)
          this.drawOrigin();
        else
          this.removeOrigins();
        this.setTitle();
      }
    });

  }

  setTitle() {
    document.title = 'Chizucraft';
    if (this.stat.filename)
      document.title += '/' + this.stat.filename;
  }


  drawOrigin() {
    this.removeOrigins();
    if (this.stat.origin) {
      let marker = L.marker(this.stat.origin, {
        title: 'origin'
      });
      this.origins.push(marker);
      this.map.addLayer(marker);
    }
  }

  removeOrigins() {
    for (let layer of this.origins)
      this.map.removeLayer(layer);
    this.origins = [];
  }

  drawMarker() {
    this.removeMarker();
    let map = this.map;
    let cLatlng: L.LatLng;
    if (this.stat.marker.latlng) {
      cLatlng = L.latLng(this.stat.marker.latlng);

      let marker_opt = { color: 'blue', weight: 1 };
      let nLatLng1 = L.latLng(cLatlng.lat + 1, cLatlng.lng);
      let wLatLng1 = L.latLng(cLatlng.lat, cLatlng.lng - 1);
      let latpm = 1 / map.distance(cLatlng, nLatLng1);
      let lngpm = 1 / map.distance(cLatlng, wLatLng1);
      let m = this.stat.marker;
      let w = m.grid_size / 2;
      let h = m.grid_size / 2;
      let nwLatlng = L.latLng(cLatlng.lat + latpm * h, cLatlng.lng - lngpm * w);
      let seLatlng = L.latLng(cLatlng.lat - latpm * h, cLatlng.lng + lngpm * w);
      let bounds = L.latLngBounds(nwLatlng, seLatlng);
      let marker = L.rectangle(bounds, marker_opt);
      this.markers.push(marker.addTo(map));
      this.markers.push(L.polyline([
        [cLatlng.lat + latpm * h, cLatlng.lng],
        [cLatlng.lat - latpm * h, cLatlng.lng]],
        marker_opt).addTo(map));
      this.markers.push(L.polyline([
        [cLatlng.lat, cLatlng.lng - lngpm * w],
        [cLatlng.lat, cLatlng.lng + lngpm * w]],
        marker_opt).addTo(map));
    }
  }

  removeMarker() {
    for (let m of this.markers)
      this.map.removeLayer(m);
    this.markers = [];
  }

  dispCurrentMapState() {
    let map = this.map;
    $('.zoom .value').text(map.getZoom());
    $('.origin .value').text(this.stat.origin ? this.stat.origin.toString() : '');

  }

  moveMap() {
    let cLatLng = this.map.getBounds().getCenter();
    if (this.markerFixToScreen && this.stat.marker.latlng) {
      this.stat.marker.latlng[0] += cLatLng.lat - this.cLatLng.lat;
      this.stat.marker.latlng[1] += cLatLng.lng - this.cLatLng.lng;
      this.cLatLng = cLatLng;
      this.drawMarker();
    } else {
      this.cLatLng = cLatLng;
    }

    this.dispCurrentMapState();
    this.saveView();
  }

  fileLoad() {
    let fileElem = document.getElementById('input-file-load');
    if (fileElem)
      fileElem.click();
  }

  fileSave() {
    let target = document.getElementById('anchor-file-save') as HTMLAnchorElement;
    let content = JSON.stringify(this.stat, null, 2);
    let blob = new Blob([content], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    target.download = this.stat.filename || '';
    target.href = url;
    target.click();
    setTimeout(() => { URL.revokeObjectURL(url); }, 1E3);
  }


  // 現在の原点のポイントあたりの距離[m]をx,y方向毎に返す
  getMPerPoint() {
    let o = this.stat.origin;
    if (o) {
      let zoom = this.stat.zoom;
      let oLatLng = L.latLng(o);
      let nLatLng = L.latLng([o[0] + 1, o[1]]);
      let eLatLng = L.latLng([o[0], o[1] + 1]);
      let oPoint = this.map.project(oLatLng, zoom);
      let nPoint = this.map.project(nLatLng, zoom);
      let ePoint = this.map.project(eLatLng, zoom);
      let dx = this.map.distance(oLatLng, eLatLng);
      let dy = this.map.distance(oLatLng, nLatLng);
      let x = dx / (ePoint.x - oPoint.x);
      let y = dy / (oPoint.y - nPoint.y);
      return { x, y };
    } else {
      return { x: 1, y: 1 };
    }
  }

  private makeMenu() {
    this.menus.push(new Menu({
      name: 'ファイル',
      children: [{
        name: '設定をロード',
        action: (e, menu) => {
          this.fileLoad();
        }
      }, {
        name: '設定をセーブ',
        action: (e, menu) => { this.fileSave(); }
      }]
    }));


    this.menus.push(new Menu({
      name: '基準点',
      children: [
        {
          name: '基準点を表示',
          with_check: true,
          onBeforeExpand: menu => {
            menu.opt.checked = this.stat.origin_disp;
          },
          action: (e, menu) => {
            let v = this.stat.origin_disp = !this.stat.origin_disp;
            if (v) this.drawOrigin();
            else this.removeOrigins();
            this.saveStat();
          }
        }, {
          name: '基準点に移動',
          action: (e, menu) => {
            if (this.stat.origin) {
              this.map.panTo(L.latLng(this.stat.origin));
            } else {
              $.alert('基準点が設定されていません');
            }
          }
        }, {
          name: '基準点をクリア',
          action: (e, menu) => {
            $.confirm({
              title: '基準点のクリア',
              columnClass: 'medium',
              content: div(
                div('基準点をクリアすると影響が大きいです。'),
                div('本当にクリアしますか？')),
              buttons: {
                ok: {
                  text: 'クリアする',
                  action: () => {
                    this.stat.origin = undefined;
                    this.removeOrigins();
                    this.saveStat();
                    this.setVectorParam();
                  }
                },
                cancel: {
                  text: 'キャンセル'
                }
              }
            });
          }
        },
        {
          name: '基準点をマーカーの位置に設定',
          action: async (e, menu) => {
            let m = this.stat.marker;
            if (m.latlng) {
              if (this.stat.origin && !jconfirm('既に基準点は設定されていますが、本当に変更しますか？')) return;
              this.stat.origin = m.latlng;
              this.stat.origin_disp = true;
              this.drawOrigin();
              this.setVectorParam();
            } else {
              $.alert('マーカーが設定されていません');
            }
          }
        },
        { separator: true },
        {
          name: 'マーカー表示',
          with_check: true,
          onBeforeExpand: menu => {
            menu.opt.checked = this.stat.marker.disp;
          },
          action: (e, menu) => {
            let v = this.stat.marker.disp = !this.stat.marker.disp;
            if (v) this.drawMarker();
            else this.removeMarker();
            this.saveStat();
          }
        },
        {
          name: 'マーカーの位置に移動',
          action: (e, menu) => {
            if (this.stat.marker.latlng) {
              this.map.panTo(L.latLng(this.stat.marker.latlng));
            } else {
              $.alert('マーカーが設定されていません');
            }
          }
        }, {
          name: 'マーカーをクリア',
          action: (e, menu) => {
            this.stat.marker.latlng = undefined;
            this.removeMarker();
            this.saveStat();
          }
        }, {
          name: '画面中央にマーカーを配置',
          action: (e, menu) => {
            let c = this.map.getCenter();
            this.stat.marker.latlng = [c.lat, c.lng];
            this.drawMarker();
            this.saveStat();
          }
        },
        {
          name: 'マーカーを画面に固定',
          with_check: true,
          onBeforeExpand: menu => {
            menu.opt.checked = this.markerFixToScreen;
          },
          action: (e, menu) => {
            this.markerFixToScreen = !this.markerFixToScreen;
          }
        },
        {
          name: 'マーカーのサイズ',
          action: (e, menu) => {
            menu.clear();
            for (let s of [128, 256, 512, 1024, 2048]) {
              menu.add({
                name: `${s} x ${s}ブロック`,
                with_check: true,
                checked: s == this.stat.marker.grid_size,
                action: (e, menu) => {
                  this.stat.marker.grid_size = s;
                  if (this.markers.length > 0)
                    this.drawMarker();
                  this.saveStat();
                }
              });
            }
            menu.expand(e);
          }
        }
      ]
    }));
    this.menus.push(helpMenu());
  }
};

export function helpMenu() {
  let menu = new Menu({
    name: 'ヘルプ',
    children: [
      {
        name: 'このプログラムについて'
      },
      {
        name: '使い方'
      }
    ]
  });
  return menu;
}