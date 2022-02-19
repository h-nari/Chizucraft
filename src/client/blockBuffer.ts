import { CoordinateTransformation } from "./ct";
import { Point } from "./point";
import { PrimitiveBlockBuffer, PrimitiveBlockBufferSave } from "./primitiveBlockBuffer";
import { Rect } from "./rect";
import { S2S, Size } from "./types";
import { VectorMap } from "./vectorMap";
import { round } from "./util";
import { assert_not_null } from "./asserts";

const primitiveBlockSize: Size = { w: 16, h: 16 };
const colors: S2S = {
  'W': 'white',
  'R': 'red',
  'G': 'green',
  'Y': 'yellow',
  'B': 'black',
  'y': '#808040',
  's': '#faf1b8',     // SandBlock
  'S': '#808080',     // Stone 
  'N': '#744443',     // ネザーラック
};

export interface BlockBufferSave {
  current_color: string | undefined;
  pbb_list: PrimitiveBlockBufferSave[];
};

export class BlockBuffer {
  public parent: VectorMap;
  public bDisp = true;
  public selectedRect: Rect | undefined;
  public pbb_list: PrimitiveBlockBuffer[] = [];
  public current_color: string | undefined = 'R';

  constructor(parent: VectorMap) {
    this.parent = parent;
  }

  save(): BlockBufferSave {
    let pbb_list: PrimitiveBlockBufferSave[] = [];
    for (let pbb of this.pbb_list)
      if (!pbb.isEmpty())
        pbb_list.push(pbb.save());
    return { current_color: this.current_color, pbb_list }
  }

  load(s: BlockBufferSave) {
    this.current_color = s.current_color;
    this.parent.cs.redraw();
    this.pbb_list = s.pbb_list.map(s => PrimitiveBlockBuffer.fromSave(s));
  }

  draw(ctx: CanvasRenderingContext2D, ct: CoordinateTransformation) {
    if (this.bDisp) {
      this.pbb_list.forEach(pbb => pbb.eachPixel((x, y, c) => {
        let r = new Rect(pbb.rect.x + x, pbb.rect.y + y, 1, 1);
        ctx.beginPath();
        r.transform(ct).path(ctx);
        let color = colors[c as keyof typeof colors];
        assert_not_null(color);
        ctx.fillStyle = color;
        ctx.fill();
      }))
    }
  }

  drawSelectedRect(ctx: CanvasRenderingContext2D, ct: CoordinateTransformation) {
    if (this.selectedRect) {
      let r = this.selectedRect.transform(ct);
      ctx.save();
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'white';
      ctx.globalCompositeOperation = 'difference';
      ctx.strokeRect(r.x, r.y, r.w, r.h);
      ctx.restore();
    }
  }

  select(x: number, y: number) {
    this.selectedRect = new Rect(x, y, 1, 1);
  }

  singleBlockSelected(): boolean {
    return this.selectedRect !== undefined && this.selectedRect.w == 1 && this.selectedRect.h == 1;
  }

  paint(bx: number, by: number) {
    let pbb: PrimitiveBlockBuffer | undefined;
    for (pbb of this.pbb_list)
      if (pbb.paint(bx, by, this.current_color))
        return;
    pbb = new PrimitiveBlockBuffer(primitiveBlockSize);
    pbb.rect.x = round(bx, primitiveBlockSize.w);
    pbb.rect.y = round(by, primitiveBlockSize.h);
    pbb.paint(bx, by, this.current_color);
    this.pbb_list.push(pbb);
  }

  spoid(e: JQuery.ClickEvent | JQuery.MouseUpEvent) {
    let { bx, by } = this.parent.blockPos(e);
    for (let pbb of this.pbb_list) {
      if (pbb.rect.includes(bx, by)) {
        let c = pbb.getPixel(bx, by);
        console.log('spoid:', c);
        this.current_color = c;
        this.parent.cs.redraw();
        return;
      }
    }
    this.current_color = undefined;
    this.parent.cs.redraw();
  }

  rectStart(e: JQuery.MouseDownEvent) {
    let { bx, by } = this.parent.blockPos(e);
    this.selectedRect = new Rect(bx, by);
    this.parent.draw();
  }

  rectMove(e: JQuery.MouseMoveEvent) {
    if (this.selectedRect) {
      let { bx, by } = this.parent.blockPos(e);
      this.selectedRect = this.selectedRect.or(new Point(bx, by))
      this.parent.draw();
    }
  }

  setPixcel(bx: number, by: number, color: string | undefined) {
    throw new Error("Method not implemented.");
  }

  rectFill(e: JQuery.MouseUpEvent) {
    let r = this.selectedRect;
    if (r) {
      for (let y = r.y; y < r.y1(); y++)
        for (let x = r.x; x < r.x1(); x++)
          this.paint(x, y);
      this.selectedRect = undefined;
      this.parent.save();
      this.parent.draw();
    }
  }

  getColor() {
    if (this.current_color)
      return colors[this.current_color as keyof typeof colors];
    else
      return false;
  }

  getColorList(): S2S {
    return colors;
  }

}