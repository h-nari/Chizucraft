import * as L from 'leaflet';
import { button, div, input, option, select, selected } from './tag';
import { checkbox, range, row } from './template';

let attribution = "<a href='https://maps.gsi.go.jp/development/ichiran.html' target='_blank'>地理院タイル</a>";

interface cc_stat {
  blocksize: number;    // minecraft block size[m]
  marker: {
    column: number;
    row: number;
    grid_size: number;
  };
};

export class Chizucraft {
  private url_template = 'https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png';
  private tile_attr = {
    attribution
  };
  public map: L.Map;
  public stat: cc_stat;
  public markers: L.Layer[] = [];

  constructor() {
    this.map = L.map('map');
    this.stat = {
      blocksize: 1,
      marker: { column: 1, row: 1, grid_size: 2048 }
    };
    console.log(attribution);
    console.log(this.tile_attr);
    L.tileLayer(this.url_template, this.tile_attr).addTo(this.map);
    L.control.scale().addTo(this.map);
    this.loadView();
    this.loadStat();
    this.map.on('moveend', e => { this.saveView(); })
    this.map.on('zoomend', e => { this.saveView(); })

    $('#controller').html(this.html());
  }

  html() {
    return div({ class: 'chizu-controller' },
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
        checkbox('表示', { class: 'chk-disp-marker' }),
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
        div('グリッドサイズ ', select({ class: 'grid-size' },
          ...range(7, 12).map(i => {
            let s = 2 ** i;
            return option(
              {
                value: s,
                selected: selected(this.stat.marker.grid_size == s)
              }, `${s} x ${s}ブロック`)
          })
        )),
        div(select(option('地図に固定'), option('画面に固定')))
      ),
      row('基準点',
        div('地図上の位置'),
        div('minecraftの座標'),
        button({ class: 'btn btn-sm btn-primary' }, '地図をクリックして指定')),
      row('ピクセル化',
        div('使用するzool level'),
        select(...range(this.map.getMaxZoom(), this.map.getMinZoom() - 1).map(z => option({ value: z }, z))))
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
  }

  drawMarker() {
    this.removeMarker();
    let map = this.map;
    let size = map.getSize();
    let bb = map.getPixelBounds();
    let o = map.getPixelOrigin();
    console.log(size);
    console.log(bb);
    console.log(o);
    let cPoint = bb.getCenter();
    // let cLatlng = map.layerPointToLatLng(cPoint);
    let zoom = map.getZoom();
    let cLatlng = map.unproject(cPoint, zoom);
    console.log(cPoint, cLatlng);
    let nLatLng = new L.LatLng(cLatlng.lat + 1, cLatlng.lng);
    let wLatLng = new L.LatLng(cLatlng.lat, cLatlng.lng - 1);
    let latpm = 1 / map.distance(cLatlng, nLatLng);
    let lngpm = 1 / map.distance(cLatlng, wLatLng);
    let m = this.stat.marker;
    let w = m.grid_size * m.column;
    let h = m.grid_size * m.column;
    let lat0 = cLatlng.lat + latpm * h / 2;
    let lat1 = cLatlng.lat - latpm * h / 2;
    let lng0 = cLatlng.lng - lngpm * w / 2;
    let lng1 = cLatlng.lng + lngpm * w / 2;

    let bounds = L.latLngBounds([lat0, lng0], [lat1, lng1]);
    let marker = L.rectangle(bounds, { color: "blue", weight: 1 });
    marker.addTo(map);
    this.markers.push(marker);
  }

  removeMarker() {
    for (let m of this.markers)
      this.map.removeLayer(m);
    this.markers = [];
  }
};