import { ModeHander } from "./modeHandler";
import { VectorMap } from "./vectorMap";

export class RectFillModeHandler extends ModeHander {

  constructor(parent: VectorMap) {
    super(parent, 'rect-fill');
  }

  override onMouseDown(e: JQuery.MouseDownEvent<any, any, any, any>): void {
    super.onMouseDown(e);
    if (this.pressed)
      this.parent.bb.rectStart(e);
  }

  override onMouseMove(e: JQuery.MouseMoveEvent<any, any, any, any>): void {
    if (this.pressed)
      this.parent.bb.rectMove(e);
  }

  override onMouseUp(e: JQuery.MouseUpEvent<any, any, any, any>): void {
    if (this.pressed) {
      this.parent.bb.rectFill(e);
      this.pressed = false;
    }
  }
};