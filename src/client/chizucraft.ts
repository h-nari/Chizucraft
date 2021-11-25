import * as L from 'leaflet';
import { ProjectionParameter } from './tileMaker';
import { a, button, div, input, label, option, select, selected } from './tag';
import { range, row } from './template';
import { Menu } from './menu';
import { MapName, VectorMap } from './vectorMap';
import { deepAssign } from './util';

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
      disp: { mapName: 'gsi_vector', grid: true }
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
      console.log('key:', ke.originalEvent.key);
      if (ke.originalEvent.key == 'Control') {
        this.markerFixToScreen = true;
      }
    });
    this.map.on('keyup', e => {
      let ke = e as L.LeafletKeyboardEvent;
      console.log('key:', ke.originalEvent.key);
      if (ke.originalEvent.key == 'Control') {
        let ke = e as L.LeafletKeyboardEvent;
        this.markerFixToScreen = false;
      }
    });

    this.makeMenu();


    this.cLatLng = this.map.getBounds().getCenter();
    $('#map-pane .topbar').html(this.html_topbar());
    $('#controller').html(this.html());
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
      row('現在の地図',
        div({ class: 'label' }, '中心の座標', div({ class: 'center-latlng' })),
        div({ class: 'label' }, 'zoom ', div({ class: 'current-zoom' }))
      ),
      row('スケール',
        div(select({ class: 'block-size' },
          ...[1, 10, 100, 1000, 0].map(v => option({
            value: v, selected: selected(v == this.stat.blocksize)
          }, v ? `1ブロック${v}m` : '任意に設定'))
        )),
        div({ class: 'rotation' },
          '回転 ',
          input({ type: 'number', value: 0 }))
      ),
      row('マーカー',
        div({ class: 'chk-disp-marker' },
          input({ type: 'checkbox', checked: selected(this.stat.marker.disp) }),
          label('表示')),
        div('マーカーサイズ ',
          select({ class: 'grid-size' },
            ...range(7, 12).map(i => {
              let s = 2 ** i;
              return option(
                {
                  value: s,
                  selected: selected(this.stat.marker.grid_size == s)
                }, `${s} x ${s}ブロック`)
            })
          )),
        div(
          select({ class: 'marker-fix-to' },
            option({ value: 'map' }, '地図に固定'),
            option({ value: 'screen' }, '画面に固定')))
      ),
      row('地図の基準点',
        div({ class: 'map-origin' },
          this.stat.origin ? this.stat.origin.toString() : ''),
        button({ class: 'btn btn-sm btn-primary btn-clear-map-origin' }, 'クリア'),
        button({ class: 'btn btn-sm btn-primary btn-moveto-map-origin' }, '基準点に移動'),
        button({ class: 'btn btn-sm btn-primary btn-set-map-origin' }, '地図をクリックして指定')),
      row('ピクセル化',
        div('使用するzool level'),
        select({ class: 'mmap-zoom' }, ...range(this.map.getMaxZoom(), 4).map(z => option({ value: z, selected: selected(this.stat.zoom == z) }, z)))),
      row('ファイル',
        div(
          div('ファイル名'),
          div({ class: 'filename' }, this.stat.filename || '%noname%')),
        input({ type: 'file', id: 'input-file-load', style: 'display:none' }),
        button({ class: 'btn btn-sm btn-primary btn-file-load' }, 'Load'),
        a({ class: 'btn btn-sm btn-primary btn-file-save' }, 'Save')
      ),
    );
  }


  saveView() {
    let center = this.map.getCenter();
    let zoom = this.map.getZoom();
    localStorage.setItem('chizucraft_view', JSON.stringify({ center, zoom }));
  }

  loadView() {
    let view_json = localStorage.getItem('chizucraft_view');
    if (view_json) {
      let v = JSON.parse(view_json);
      this.map.setView(v.center, v.zoom);
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
      if (this.stat.origin) {
        let oLatLng = L.latLng(this.stat.origin);
        let param: ProjectionParameter = {
          zoom: this.stat.zoom,
          oPoint: this.map.project(oLatLng, this.stat.zoom),
          blocksize: stat.blocksize,
          mPerPoint: this.getMPerPoint()
        };
        this.vectorMap.setParam(param);
        this.vectorMap.setMap(this.stat.disp.mapName);
      }
      if (this.stat.tab)
        this.tab_set(this.stat.tab);
    }
  }

  tab_set(target: string) {
    console.log('tab_set:', target);
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
    $('#controller .block-size').on('change', e => {
      let bs = parseInt($(e.currentTarget).val() as string);
      this.stat.blocksize = bs == 0 ? 1 : bs;
      this.saveStat();
    });
    $('#controller .chk-disp-marker input').on('change', e => {
      let v = $(e.currentTarget).prop('checked');
      if (v)
        this.drawMarker();
      else
        this.removeMarker();
      this.stat.marker.disp = v;
      this.saveStat();
    });
    $('#controller .grid-size').on('change', e => {
      let size = $(e.currentTarget).val() as number;
      console.log('grid-size:', size);
      this.stat.marker.grid_size = size;
      if (this.markers.length > 0)
        this.drawMarker();
      this.saveStat();
    });
    $('#controller .mmap-zoom').on('change', e => {
      this.stat.zoom = Number($(e.currentTarget).val());
      this.saveStat();
    })

    // 基準点に移動
    $('.btn-moveto-map-origin').on('click', e => {
      if (this.stat.origin) {
        this.lockMarker = true;
        this.map.panTo(this.stat.origin, { animate: false });
        this.cLatLng = this.map.getBounds().getCenter();
        this.lockMarker = false;
      }
    });
    // load
    $('.btn-file-load').on('click', e => {
      this.fileLoad();
    });
    $('#input-file-load').on('change', async e => {
      let elem = e.target as HTMLInputElement;
      if (elem.files && elem.files.length > 0) {
        let file = elem.files[0];
        let json = await file.text();
        let stat = JSON.parse(json) as cc_stat;
        deepAssign(this.stat, stat);
        this.stat.filename ||= file.name;
        this.saveStat();
        $('#controller').html(this.html());
        this.bind();
        this.dispCurrentMapState();
        if (this.stat.marker.disp)
          this.drawMarker();
      }
    });

    // save
    $('.btn-file-save').on('click', e => {
      this.fileSave(e.currentTarget as HTMLAnchorElement);
    });

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
    if (!this.stat.marker.latlng) {
      let cPoint = map.getPixelBounds().getCenter();
      let zoom = map.getZoom();
      cLatlng = map.unproject(cPoint, zoom);
      this.stat.marker.latlng = [cLatlng.lat, cLatlng.lng];
      this.saveStat();
    } else {
      cLatlng = L.latLng(this.stat.marker.latlng);
    }

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

  removeMarker() {
    for (let m of this.markers)
      this.map.removeLayer(m);
    this.markers = [];
  }

  dispCurrentMapState() {
    let map = this.map;
    $('.center-latlng').text(this.cLatLng.toString());
    $('.current-zoom').text(map.getZoom());
    $('.map-origin').text(this.stat.origin ? this.stat.origin.toString() : '');

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
    console.log('fileLoad');
    let fileElem = document.getElementById('input-file-load');
    if (fileElem)
      fileElem.click();
  }

  fileSave(target: HTMLAnchorElement) {
    console.log('download');
    let content = JSON.stringify(this.stat, null, 2);
    let blob = new Blob([content], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    target.download = this.stat.filename || '';
    target.href = url;
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
      console.log('x:', x, 'y:', y);
      return { x, y };
    } else {
      return { x: 1, y: 1 };
    }
  }

  private makeMenu() {
    let originMenu = new Menu({
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
        },
        {
          name: '基準点をクリア',
          action: (e, menu) => {
            this.stat.origin = undefined;
            this.removeOrigins();
            this.saveStat();
          }
        },
        {
          name: '基準点をマーカーの位置に設定'
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
    })
    this.menus.push(originMenu);
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