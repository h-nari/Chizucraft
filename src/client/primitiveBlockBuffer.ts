import { assert_not_null } from "./asserts";
import { Rect, RectSave } from "./rect";
import { Position, Size } from "./types";

export interface PrimitiveBlockBufferSave {
  contents: (string | undefined)[][];
  rect: RectSave;
};

export class PrimitiveBlockBuffer {
  public contents: (string | undefined)[][];
  public rect: Rect;

  constructor(size: Size, position: Position = { x: 0, y: 0 }) {
    this.rect = new Rect(position.x, position.y, size.w, size.h);
    this.contents = [];
  }

  isEmpty() {
    for (let row of this.contents)
      for (let c of row)
        if (c !== undefined && c !== null) {
          return false;
        }
    return true;
  }

  save(): PrimitiveBlockBufferSave {
    let contents: (string | undefined)[][] = [];
    for (let row of this.contents)
      contents.push(row.findIndex(c => c !== undefined && c !== null) < 0 ? [] : row);
    return { contents, rect: this.rect.save() };
  }

  static fromSave(s: PrimitiveBlockBufferSave) {
    let pbb = new PrimitiveBlockBuffer({ w: s.rect.w, h: s.rect.h }, { x: s.rect.x, y: s.rect.y });
    pbb.contents = s.contents;
    return pbb;
  }

  paint(ax: number, ay: number, color: string | undefined): boolean {
    if (this.rect.includes(ax, ay)) {
      let x = ax - this.rect.x;
      let y = ay - this.rect.y;
      let row: (string | undefined)[];
      if (y < this.contents.length) {
        row = this.contents[y] as (string | undefined)[];
      } else {
        while (this.contents.length <= y)
          this.contents.push([]);
        row = [];
      }
      assert_not_null(row);
      while (row.length <= x)
        row.push(undefined);
      row[x] = color;
      return true;
    }
    return false;
  }

  eachPixel(f: (x: number, y: number, color: string) => void) {
    for (let y = 0; y < this.contents.length; y++) {
      let row = this.contents[y];
      if (row) {
        for (let x = 0; x < row.length; x++) {
          if (row[x])
            f(x, y, row[x] as string);
        }
      }
    }
  }

  getPixel(bx: number, by: number): string | undefined {
    let x = bx - this.rect.x;
    let y = by - this.rect.y;
    let row = this.contents[y];
    if (row) return row[x];
    return undefined;
  }

}