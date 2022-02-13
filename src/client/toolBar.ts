import { button, div, icon } from "./tag";

export interface IToolOption {
  icon: string;
  action?: () => void;
  id?: string;
  title?: string;
  class?: string;
};

var tool_id = 0;

export class ToolBar {
  public tools: IToolOption[];

  constructor(tools: IToolOption[] = []) {
    this.tools = tools;
  }

  html() {
    let s = '';
    for (let t of this.tools) {
      t.id = `toolbar-btn-${tool_id++}`;
      let c = 'tool btn btn-warning';
      if (t.class)
        c += ' ' + t.class;
      s += button({ class: c, id: t.id, title: t.title || '' }, icon(t.icon));
    }
    return div({ class: 'tool-bar d-inline-block' }, s);
  }

  bind() {
    for (let t of this.tools) {
      if (t.id && t.action) {
        $('#' + t.id).on('click', e => {
          if (t.action)
            t.action();
        });
      }
    }
  }

  add(tool: IToolOption) {
    this.tools.push(tool);
    return this;
  }

};