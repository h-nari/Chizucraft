import * as L from 'leaflet';
import { a, button, div, input, label, option, select, selected } from './tag';
import { checkbox, range, row } from './template';

let attribution = "<a href='https://maps.gsi.go.jp/development/ichiran.html' target='_blank'>地理院タイル</a>";

interface cc_stat {
  blocksize: number;    // minecraft block size[m]
  origin?: [number, number];
  marker: {
    disp: boolean;
    column: number;
    row: number;
    grid_size: number;
  };
  filename?: string;
};

export class Chizucraft {
  private url_template = 'https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png';
  private tile_attr = {
    attribution
  };
  public map: L.Map;
  public stat: cc_stat;
  public markers: L.Layer[] = [];
  public cLatLng: L.LatLng; // 画面中心の座標
  public lockMarker = false;

  constructor() {
    this.map = L.map('map');
    this.stat = {
      blocksize: 1,
      marker: { disp: false, column: 1, row: 1, grid_size: 2048 },
    };
    console.log(attribution);
    console.log(this.tile_attr);
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
    this.cLatLng = this.map.getBounds().getCenter();
    $('#controller').html(this.html());
    this.dispCurrentMapState();
    if (this.stat.marker.disp)
      this.drawMarker();
  }

  html() {
    return div({ class: 'chizu-controller' },
      row('現在の地図',
        div({ class: 'label' }, '中心の座標', div({ class: 'center-latlng' })),
        div({ class: 'label' }, 'zoom ', div({ class: 'current-zoom' }))
      ),
      row('スケール',
        div(select({ class: 'block-size' },
          option({ value: 1 }, '1ブロック1m'),
          option({ value: 10 }, '1ブロック10m'),
          option({ value: 100 }, '1ブロック100m'),
          option({ value: 1000 }, '1ブロック1km'),
          option({ value: 0 }, '任意に設定'))),
        div({ class: 'rotation' },
          '回転 ',
          input({ type: 'number', value: 0 }))
      ),
      row('マーカー',
        div({ class: 'chk-disp-marker' },
          input({ type: 'checkbox', checked: selected(this.stat.marker.disp) }),
          label('表示')),
        div('マーカーサイズ 縦:',
          select({ class: 'marker-row' },
            option({ value: 1 }, '1'),
            option({ value: 2 }, '2'),
            option({ value: 3 }, '3'),
            option({ value: 4 }, '4'),
            option({ value: 5 }, '5'),
            option({ value: 0 }, '無限')
          )),
        div({ class: 'd-inline-block' }, '✖'),
        div('横:',
          select({ class: 'marker-column' },
            option({ value: 1 }, '1'),
            option({ value: 2 }, '2'),
            option({ value: 3 }, '3'),
            option({ value: 4 }, '4'),
            option({ value: 5 }, '5'),
            option({ value: 0 }, '無限')
          )),
        div('グリッドサイズ ',
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
        select(...range(this.map.getMaxZoom(), 8).map(z => option({ value: z }, z)))),
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
    if (stat_json)
      this.stat = JSON.parse(stat_json) as cc_stat;
  }

  bind() {
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

    // 基準点クリア
    $('.btn-clear-map-origin').on('click', e => {
      console.log('clear');
      this.stat.origin = undefined;
      this.removeMarker();
    });
    // 基準点に移動
    $('.btn-moveto-map-origin').on('click', e => {
      if (this.stat.origin) {
        this.lockMarker = true;
        this.map.panTo(this.stat.origin, { animate: false });
        this.cLatLng = this.map.getBounds().getCenter();
        this.lockMarker = false;
      }
    });
    // 地図をクリックして指定
    $('.btn-set-map-origin').on('click', e => {
      console.log('set origin');
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
        this.stat = JSON.parse(json) as cc_stat;
        this.stat.filename ||= file.name;
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

  drawMarker() {
    this.removeMarker();
    let map = this.map;
    let cLatlng: L.LatLng;
    if (!this.stat.origin) {
      let cPoint = map.getPixelBounds().getCenter();
      let zoom = map.getZoom();
      cLatlng = map.unproject(cPoint, zoom);
      this.stat.origin = [cLatlng.lat, cLatlng.lng];
      $('#controller .map-origin').text(this.stat.origin.toString());
      this.saveStat();
    } else {
      cLatlng = L.latLng(this.stat.origin);
    }

    let nLatLng = L.latLng(cLatlng.lat + 1, cLatlng.lng);
    let wLatLng = L.latLng(cLatlng.lat, cLatlng.lng - 1);
    let latpm = 1 / map.distance(cLatlng, nLatLng);
    let lngpm = 1 / map.distance(cLatlng, wLatLng);
    let m = this.stat.marker;
    let w = m.grid_size * m.column;
    let h = m.grid_size * m.column;
    let dLatlng = L.latLng(cLatlng.lat - latpm * h, cLatlng.lng + lngpm * w);
    let bounds = L.latLngBounds(cLatlng, dLatlng);
    let marker = L.rectangle(bounds, { color: "blue", weight: 1 });
    marker.addTo(map);
    this.markers.push(marker);
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
    let fixTo = $('#controller .marker-fix-to').val() as string;

    if (fixTo == 'screen' && this.stat.origin && !this.lockMarker) {
      this.stat.origin[0] += cLatLng.lat - this.cLatLng.lat;
      this.stat.origin[1] += cLatLng.lng - this.cLatLng.lng;
      this.cLatLng = cLatLng;
      this.drawMarker();
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
};