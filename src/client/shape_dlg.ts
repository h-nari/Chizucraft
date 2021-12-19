import { cc_stat } from "./chizucraft";
import { Menu } from "./menu";
import { button, div, icon, input, selected } from "./tag";
import { VectorMap } from "./vectorMap";

class ShapeDialog {
  private vm: VectorMap;
  private stat: cc_stat;
  private menu: Menu;

  constructor(vm: VectorMap) {
    this.vm = vm;
    this.menu = this.makeMenu();
    this.stat = vm.cc.stat;
  }

  html() {
    let s = '';
    if (this.stat.shapes.length == 0) {
      s = '図形は登録されていません';
    } else {
      s = div({ class: 'd-flex' }, div({ class: 'fill' }), this.menu.html());
      for (let i = 0; i < this.stat.shapes.length; i++) {
        let shape = this.stat.shapes[i];
        let name: string;
        if (shape.vertex.length < 2)
          name = 'broken';
        else if (shape.vertex.length == 2)
          name = '直線';
        else if (shape.bClose)
          name = 'ポリゴン';
        else
          name = '折れ線';

        s += div({ class: 'shape', idx: i },
          input({ class: 'chk-disp', type: 'checkbox', checked: selected(shape.bDisp) }),
          div({ class: 'name d-inline-block' }, name + '-' + i),
          div({ class: 'fill' }),
          button({ class: 'btn-delete', title: '削除' }, icon('trash')),
          button({ class: 'btn-jump-start', title: '開始点に移動' }, icon('box-arrow-in-down-left')),
          button({ class: 'btn-jump-end', title: '終了点に移動' }, icon('box-arrow-in-down-right')),
          input({ class: 'input-color', type: 'color', value: shape.color || '#008000' }),
        );
      }
    }
    return div({ class: 'shape-dlg' }, s);
  }

  bind() {
    this.menu.bind();

    $('.shape-dlg .shape .chk-disp').on('change', e => {
      let idx = Number($(e.currentTarget).parent().attr('idx'));
      this.stat.shapes[idx].bDisp = !this.stat.shapes[idx].bDisp;
      this.vm.cc.saveStat();
      this.vm.draw();
    });

    $('.shape-dlg .shape .btn-delete').on('click', e => {
      let p = $(e.currentTarget).parent();
      let idx = Number(p.attr('idx'));
      this.stat.shapes.splice(idx, 1);
      this.vm.cc.saveStat();
      this.vm.draw();
      let n = p.next();
      while (n.length > 0) {
        n.attr('idx', idx++);
        n = n.next();
      }
      p.remove();
    });

    $('.shape-dlg .shape .btn-jump-start').on('click', e => {
      let idx = Number($(e.currentTarget).parent().attr('idx'));
      this.jump_to(idx, 'start');
    });

    $('.shape-dlg .shape .btn-jump-end').on('click', e => {
      let idx = Number($(e.currentTarget).parent().attr('idx'));
      this.jump_to(idx, 'end');
    });

    $('.shape-dlg .shape .input-color').on('change', e => {
      let idx = Number($(e.currentTarget).parent().attr('idx'));
      let s = this.stat.shapes[idx];
      s.color = $(e.currentTarget).val() as string;
      this.vm.cc.saveStat();
      this.vm.draw();
    });
  }

  jump_to(idx: number, to: 'start' | 'end') {
    let s = this.stat.shapes[idx];
    let mp = s.vertex[to == 'start' ? 0 : s.vertex.length - 1];
    let off = this.stat.minecraft_offset;
    let c = this.vm.canvas;
    s.bDisp = true;
    let ct = this.vm.ct;
    ct.moveTo(mp.x - off.x, mp.z - off.z, ct.ax, c.width / 2, c.height / 6);
    this.vm.draw();
    this.vm.cc.saveView();
  }


  makeMenu() {
    let m = new Menu({ name: 'Menu', z_index: 999999999 });
    m.add({
      name: '全て表示する',
      action: (e, menu) => {
        for (let s of this.stat.shapes)
          s.bDisp = true;
        $('.shape-dlg .shape .chk-disp').prop('checked', true);
        this.vm.draw();
      }
    });
    m.add({
      name: '全て非表示にする',
      action: (e, menu) => {
        for (let s of this.stat.shapes)
          s.bDisp = false;
        $('.shape-dlg .shape .chk-disp').prop('checked', false);
        this.vm.draw();
      }
    });
    m.addSeparator();
    m.add({
      name: '全て削除する',
      action: (e, menu) => {
        this.stat.shapes = [];
        this.vm.cc.saveStat();
        this.vm.draw();
        $('.shape-dlg .shape').remove();
      }
    })
    return m;
  }

  open() {
    $.alert({
      title: '図形リスト',
      content: this.html(),
      type: 'green',
      columnClass: 'medium',
      draggable: true,
      onOpen: () => {
        this.bind();
      }
    })
  }
}

export function dlg_shapes(vm: VectorMap) {
  let dlg = new ShapeDialog(vm);
  dlg.open();
}