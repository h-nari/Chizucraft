// package: vector_tile
// file: vector_tile.proto

import * as jspb from "google-protobuf";

export class Tile extends jspb.Message {
  clearLayersList(): void;
  getLayersList(): Array<Tile.Layer>;
  setLayersList(value: Array<Tile.Layer>): void;
  addLayers(value?: Tile.Layer, index?: number): Tile.Layer;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): Tile.AsObject;
  static toObject(includeInstance: boolean, msg: Tile): Tile.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: Tile, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): Tile;
  static deserializeBinaryFromReader(message: Tile, reader: jspb.BinaryReader): Tile;
}

export namespace Tile {
  export type AsObject = {
    layersList: Array<Tile.Layer.AsObject>,
  }

  export class Value extends jspb.Message {
    hasStringValue(): boolean;
    clearStringValue(): void;
    getStringValue(): string | undefined;
    setStringValue(value: string): void;

    hasFloatValue(): boolean;
    clearFloatValue(): void;
    getFloatValue(): number | undefined;
    setFloatValue(value: number): void;

    hasDoubleValue(): boolean;
    clearDoubleValue(): void;
    getDoubleValue(): number | undefined;
    setDoubleValue(value: number): void;

    hasIntValue(): boolean;
    clearIntValue(): void;
    getIntValue(): number | undefined;
    setIntValue(value: number): void;

    hasUintValue(): boolean;
    clearUintValue(): void;
    getUintValue(): number | undefined;
    setUintValue(value: number): void;

    hasSintValue(): boolean;
    clearSintValue(): void;
    getSintValue(): number | undefined;
    setSintValue(value: number): void;

    hasBoolValue(): boolean;
    clearBoolValue(): void;
    getBoolValue(): boolean | undefined;
    setBoolValue(value: boolean): void;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): Value.AsObject;
    static toObject(includeInstance: boolean, msg: Value): Value.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: Value, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): Value;
    static deserializeBinaryFromReader(message: Value, reader: jspb.BinaryReader): Value;
  }

  export namespace Value {
    export type AsObject = {
      stringValue?: string,
      floatValue?: number,
      doubleValue?: number,
      intValue?: number,
      uintValue?: number,
      sintValue?: number,
      boolValue?: boolean,
    }
  }

  export class Feature extends jspb.Message {
    hasId(): boolean;
    clearId(): void;
    getId(): number | undefined;
    setId(value: number): void;

    clearTagsList(): void;
    getTagsList(): Array<number>;
    setTagsList(value: Array<number>): void;
    addTags(value: number, index?: number): number;

    hasType(): boolean;
    clearType(): void;
    getType(): Tile.GeomTypeMap[keyof Tile.GeomTypeMap] | undefined;
    setType(value: Tile.GeomTypeMap[keyof Tile.GeomTypeMap]): void;

    clearGeometryList(): void;
    getGeometryList(): Array<number>;
    setGeometryList(value: Array<number>): void;
    addGeometry(value: number, index?: number): number;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): Feature.AsObject;
    static toObject(includeInstance: boolean, msg: Feature): Feature.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: Feature, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): Feature;
    static deserializeBinaryFromReader(message: Feature, reader: jspb.BinaryReader): Feature;
  }

  export namespace Feature {
    export type AsObject = {
      id?: number,
      tagsList: Array<number>,
      type?: Tile.GeomTypeMap[keyof Tile.GeomTypeMap],
      geometryList: Array<number>,
    }
  }

  export class Layer extends jspb.Message {
    hasVersion(): boolean;
    clearVersion(): void;
    getVersion(): number | undefined;
    setVersion(value: number): void;

    hasName(): boolean;
    clearName(): void;
    getName(): string | undefined;
    setName(value: string): void;

    clearFeaturesList(): void;
    getFeaturesList(): Array<Tile.Feature>;
    setFeaturesList(value: Array<Tile.Feature>): void;
    addFeatures(value?: Tile.Feature, index?: number): Tile.Feature;

    clearKeysList(): void;
    getKeysList(): Array<string>;
    setKeysList(value: Array<string>): void;
    addKeys(value: string, index?: number): string;

    clearValuesList(): void;
    getValuesList(): Array<Tile.Value>;
    setValuesList(value: Array<Tile.Value>): void;
    addValues(value?: Tile.Value, index?: number): Tile.Value;

    hasExtent(): boolean;
    clearExtent(): void;
    getExtent(): number | undefined;
    setExtent(value: number): void;

    serializeBinary(): Uint8Array;
    toObject(includeInstance?: boolean): Layer.AsObject;
    static toObject(includeInstance: boolean, msg: Layer): Layer.AsObject;
    static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
    static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
    static serializeBinaryToWriter(message: Layer, writer: jspb.BinaryWriter): void;
    static deserializeBinary(bytes: Uint8Array): Layer;
    static deserializeBinaryFromReader(message: Layer, reader: jspb.BinaryReader): Layer;
  }

  export namespace Layer {
    export type AsObject = {
      version?: number,
      name?: string,
      featuresList: Array<Tile.Feature.AsObject>,
      keysList: Array<string>,
      valuesList: Array<Tile.Value.AsObject>,
      extent?: number,
    }
  }

  export interface GeomTypeMap {
    UNKNOWN: 0;
    POINT: 1;
    LINESTRING: 2;
    POLYGON: 3;
  }

  export const GeomType: GeomTypeMap;
}

