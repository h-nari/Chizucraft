import { VectorMap } from "./vectorMap";

export class ModeHander {
  public parent: VectorMap;
  public name: string;
  public x0 = 0;
  public y0 = 0;
  public pressed = false;
  public moved = 0;

  constructor(parent: VectorMap, name: string) {
    this.parent = parent;
    this.name = name;
  }

  /**
   * モード選択時の処理
   */
  onSelect() { }

  /**
   * モード終了時の処理
   */
  onUnselect() { }

  onMouseDown(e: JQuery.MouseDownEvent) {
    if (e.button == 0) {        // mouse left button
      this.pressed = true;
      this.x0 = e.clientX;
      this.y0 = e.clientY;
      this.moved = 0;
    }
  }

  onMouseMove(e: JQuery.MouseMoveEvent) {
    if (this.pressed) {
      this.moved = Math.max(this.moved, Math.abs(e.clientX - this.x0), Math.abs(e.clientY - this.y0));
    }
  }

  onMouseUp(e: JQuery.MouseUpEvent) {
    this.pressed = false;
  }

  onClick(e: JQuery.ClickEvent) {

  }

}