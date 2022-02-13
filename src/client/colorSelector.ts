import { BlockBuffer } from "./blockBuffer";
import { div, icon, span } from "./tag";
import { S2S } from "./types";

export class ColorSelector {
  public bb: BlockBuffer;
  public id = 'colorSelector';
  public cl: ColorList;

  constructor(bb: BlockBuffer) {
    this.bb = bb;
    this.cl = new ColorList(this, bb.getColorList());
  }

  html() {
    return div({ id: this.id, class: 'd-inline-block ms-5', style: 'background-color: lightgray; border-radius: 5px;' },
      this.innerHtml());
  }

  innerHtml() {
    let c: string;
    let style = 'font-size: 1.5rem; padding: 2px 5px;display: inline-block;'
    let color = this.bb.getColor();
    if (color) {
      c = icon('square-fill')
      style += `color: ${color};`;
    } else {
      c = icon('eraser');
    }
    return div({ style }, c) + icon('caret-down-fill');
  }

  redraw() {
    $('#' + this.id).html(this.innerHtml());
    this.bind();
  }

  bind() {
    $(`#${this.id}`).on('click', e => {
      this.expand(e);
    });
  }

  expand(e: JQuery.ClickEvent) {
    let sub_id = this.id + '-sub';
    let offset = $(e.currentTarget).offset();
    let h = $(e.currentTarget).height() || 0;
    let x = offset?.left || 0;
    let y = (offset?.top || 0) + h + 5;
    let style1 = 'z-index:1000;position:absolute;left:0px;top:0px;height: 100%; width: 100%';
    let style2 = `top: ${y}px; left: ${x}px;display:inline-block;width:200px;position:absolute;padding:10px;background-color:#80808080;`;
    $('body').append(div({ class: 'colorSelector-back', style: style1 },
      div({ id: sub_id, style: style2 }, this.cl.html())));
    this.cl.bind();
    $('.colorSelector-back').on('click', () => {
      $('.colorSelector-back').remove();
    });
    let w0 = $('.colorSelector-back').width() || 0;
    let w = $('#' + sub_id).width() || 0;
    w0 -= 30;
    if (x + w > w0) {
      $('#' + sub_id).offset({ top: y, left: w0 - w });
    }
    e.preventDefault();
    e.stopPropagation();
  }
}

class ColorList {
  public parent: ColorSelector;
  public colorList: S2S;

  constructor(parent: ColorSelector, colorList: S2S) {
    this.parent = parent;
    this.colorList = colorList;
  }

  html() {
    return Object.entries(this.colorList).map(a => {
      let code = a[0];
      let color = a[1];
      let style = `color: ${color}; font-size: 2rem; margin: 5px;`
      return div({ class: 'd-inline-block btn-color', style, code }, icon('square-fill'))
    }).join('') + div({
      class: 'd-inline-blick btn-color',
      style: 'font-size: 2rem; margin: 5px'
    }, icon('eraser'));
  }

  bind() {
    $(`.btn-color`).on('click', e => {
      let code = $(e.currentTarget).attr('code');
      let parent = this.parent;
      parent.bb.current_color = code;
      parent.redraw();
      let vm = parent.bb.parent;
      vm.save();
      if (vm.currentMode?.name != 'rect-fill')
        vm.modeSet('paint');
    })
  }
}