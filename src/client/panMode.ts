import { ModeHander } from "./modeHandler";
import { VectorMap } from "./vectorMap";

export class PanModeHandler extends ModeHander {
  constructor(parent: VectorMap) {
    super(parent, 'pan');
  }

  override onMouseDown(e: JQuery.MouseDownEvent<any, any, any, any>): void {
    super.onMouseDown(e);
  }

  override onMouseMove(e: JQuery.MouseMoveEvent<any, any, any, any>): void {
    if (this.pressed) {
      this.parent.ct.pan(e.clientX - this.x0, e.clientY - this.y0)
      this.parent.draw();
      this.x0 = e.clientX;
      this.y0 = e.clientY;
    }
  }

  override onMouseUp(e: JQuery.MouseUpEvent<any, any, any, any>): void {
    if (this.pressed) {
      this.parent.save();
      this.pressed = false;
    }
  }
}