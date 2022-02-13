import { ModeHander } from "./modeHandler";
import { VectorMap } from "./vectorMap";

export class SpoidModeHandler extends ModeHander {

  constructor(parent: VectorMap) {
    super(parent, 'spoid');
  }

  override onClick(e: JQuery.ClickEvent<any, any, any, any>): void {
    this.parent.bb.spoid(e);
  }
}