import * as vt from "../generated/vector_tile_pb";


export class VectorTile {
  public tile: vt.Tile;
  public layers: { [name: string]: VectorLayer };

  constructor(data: Uint8Array) {
    this.tile = vt.Tile.deserializeBinary(data);
    this.layers = {};
    for (let layer0 of this.tile.getLayersList()) {
      let layer = new VectorLayer(layer0);
      this.layers[layer.name] = layer;
    }
  }

  dump() {
    console.log('test');

    for (let layer of this.tile.getLayersList()) {
      console.log('ver:', layer.getVersion(), 'Layer name:', layer.getName(), 'Extent:', layer.getExtent());
      if (layer.getName() == 'road') {
        if (true) {
          for (let f of layer.getFeaturesList()) {
            console.log('  feature Id:', f.getId(), 'type:', f.getType());
            for (let tag of f.getTagsList())
              console.log('    tag:', tag)
            // for (let g of f.getGeometryList())
            //   console.log('    geometry:', g);
          }
        }
        for (let key of layer.getKeysList())
          console.log('  key:', key);
        for (let v of layer.getValuesList()) {
          console.log('  value:',
            v.hasStringValue() ? v.getStringValue() :
              v.hasFloatValue() ? v.getFloatValue() :
                v.hasDoubleValue() ? v.getDoubleValue() :
                  v.hasIntValue() ? v.getIntValue() :
                    v.hasUintValue() ? v.getUintValue() :
                      v.hasBoolValue() ? v.getBoolValue() :
                        '-');
        }
      }

    }
  }
}

export class VectorLayer {
  public name: string;
  public layer: vt.Tile.Layer;
  public features: VectorFeature[];
  public keys: Array<string>;
  values: vt.Tile.Value[];

  constructor(layer: vt.Tile.Layer) {
    this.layer = layer;
    this.name = layer.getName() || '%no-name%';
    this.features = [];
    for (let f of layer.getFeaturesList())
      this.features.push(new VectorFeature(this, f));
    this.keys = layer.getKeysList();
    this.values = layer.getValuesList();
  }

  value(idx: number) {
    let v = this.values[idx];
    let vv = v.hasStringValue() ? v.getStringValue() :
      v.hasFloatValue() ? v.getFloatValue() :
        v.hasDoubleValue() ? v.getDoubleValue() :
          v.hasIntValue() ? v.getIntValue() :
            v.hasUintValue() ? v.getUintValue() :
              v.hasBoolValue() ? v.getBoolValue() :
                undefined;
    return vv;
  }
}

export class VectorFeature {
  public layer: VectorLayer;
  public feature: vt.Tile.Feature;
  public attrs: { [key: string]: number | string | boolean | undefined } | undefined;

  constructor(layer: VectorLayer, f: vt.Tile.Feature) {
    this.layer = layer;
    this.feature = f;
  }

  getAttrs() {
    if (!this.attrs) {
      this.attrs = {};
      let list = this.feature.getTagsList();
      for (let i = 0; i < list.length; i += 2) {
        let key = this.layer.keys[list[i]];
        let value = this.layer.value(list[i]);
        this.attrs[key] = value;
      }
    }
    return this.attrs;
  }

  attr(name: string) {
    let attrs = this.getAttrs();
    return attrs[name];
  }

  attr_dump() {
    let attrs = this.getAttrs();
    for (let name in attrs) {
      console.log(name + '=' + attrs[name]);
    }
  }

  geo_dump() {
    this.geo_parse((cmd, x, y) => {
      console.log(`    ${cmd} ${x},${y}`);
    });
  }

  geo_parse(func: (cmd: 'begin' | 'lineto' | 'moveto' | 'closepath' | 'end', x: number, y: number) => void) {
    let list = this.feature.getGeometryList();
    let i = 0;
    let cx = 0;
    let cy = 0;
    func('begin', 0, 0);
    while (i < list.length) {
      let id = list[i] & 0x7;
      let count = list[i++] >> 3;
      if (id == 1 || id == 2) {  // movoto or lineto
        for (let c = 0; c < count; c++) {
          let dx = zigzag(list[i++]);
          let dy = zigzag(list[i++]);
          cx += dx;
          cy += dy;
          func(id == 2 ? 'lineto' : 'moveto', cx, cy);
        }
      } else if (id == 7) {
        for (let c = 0; c < count; c++)
          func('closepath', cx, cy);
      } else {
        throw new Error(`bad command id ${id} found`);
      }
    }
    func('end', 0, 0);
  }
}

function zigzag(n: number) {
  let value = ((n >> 1) ^ (-(n & 1)));
  // console.log(n + ' => ' + value);
  return value;
}