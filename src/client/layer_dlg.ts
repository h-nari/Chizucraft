import { cc_stat } from "./chizucraft";
import { div, input, selected } from "./tag";
import { VectorMap } from "./vectorMap";

class LayerDialog {
  private vm: VectorMap;
  private stat: cc_stat;

  constructor(vm: VectorMap) {
    this.vm = vm;
    this.stat = vm.cc.stat;
  }

  html() {
    let s = '';
    for (let [name, layer] of Object.entries(this.stat.layer)) {
      s += div({ class: 'layer', name },
        input({ class: 'chk-disp', type: 'checkbox', checked: selected(layer.bBlockDisp) }),
        div({ class: 'name' }, name),
        input({ class: 'color', type: 'color', value: layer.blockColor })
      );
    }
    return div({ class: 'layer-dlg' }, s);
  }

  bind() {
    $('.layer-dlg .layer .chk-disp').on('change', e => {
      let name = $(e.currentTarget).parent().attr('name') as string;
      this.stat.layer[name].bBlockDisp = !this.stat.layer[name].bBlockDisp;
      this.vm.cc.saveStat();
      this.vm.draw();
    });
    $('.layer-dlg .layer .color').on('change', e => {
      let name = $(e.currentTarget).parent().attr('name') as string;
      this.stat.layer[name].blockColor = $(e.currentTarget).val() as string;
      this.vm.cc.saveStat();
      this.vm.draw();
    });
  }

  open() {
    $.alert({
      title: 'レイヤー表示設定',
      type: 'blue',
      columnClass: 'small',
      content: this.html(),
      draggable: true,
      onOpen: () => { this.bind(); }
    });
  }
}


export function dlg_layer(vm: VectorMap) {
  let dlg = new LayerDialog(vm);
  dlg.open();
}