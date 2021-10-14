import * as L from 'leaflet';
import { a } from './tag';

let attribution = "<a href='https://maps.gsi.go.jp/development/ichiran.html' target='_blank'>地理院タイル</a>";

export class Chizucraft {
  private url_template = 'https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png';
  private tile_attr = {
    attribution
  };
  public map: L.Map;

  constructor() {
    this.map = L.map('map');
    console.log(attribution);
    console.log(this.tile_attr);
    L.tileLayer(this.url_template, this.tile_attr).addTo(this.map);
    L.control.scale().addTo(this.map);
    this.loadView();
    this.map.on('moveend', e => { this.saveView(); })
    this.map.on('zoomend', e => { this.saveView(); })
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
};