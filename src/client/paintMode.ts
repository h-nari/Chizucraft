import { ModeHander } from "./modeHandler";
import { VectorMap } from "./vectorMap";

const primitive_buffer_size = { w: 16, h: 16 };

export class PaintModeHandler extends ModeHander {
  constructor(parent: VectorMap) {
    super(parent, 'paint');
  }

  override onMouseDown(e: JQuery.MouseDownEvent<any, any, any, any>): void {
    super.onMouseDown(e);
    if (this.pressed)
      this.paint(e);
  }

  override onMouseMove(e: JQuery.MouseMoveEvent<any, any, any, any>): void {
    if (this.pressed) {
      this.paint(e);
    }
  }

  override onMouseUp(e: JQuery.MouseUpEvent<any, any, any, any>): void {
    if (this.pressed) {
      this.pressed = false;
      this.parent.save();
      console.log('up');
      // this.parent.draw();
    }
  }

  override onClick(e: JQuery.ClickEvent<any, any, any, any>): void {
    if (e.button == 0)
      this.paint(e);
  }

  paint(e: JQuery.ClickEvent | JQuery.MouseDownEvent | JQuery.MouseMoveEvent) {
    let parent = this.parent;
    let p = parent.blockPos(e);
    parent.bb.paint(p.bx, p.by);
    let ctx = parent.canvas.getContext('2d');
    if (ctx) {
      parent.bb.draw(ctx, parent.ct);
    }
  }
}