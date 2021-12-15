import { div, button, icon, span } from './tag';
import { nullstr } from './util';

var sn = 0;

type MenuAction = (e: JQuery.ClickEvent, menu: Menu) => void;

export interface MenuOption {
  icon?: string;
  icon_class?: string;
  name?: string;
  right_icon?: string;
  right_icon_class?: string;
  explain?: string;
  action?: MenuAction;
  link?: string;
  link_open?: string;
  arg?: any;
  with_check?: boolean;
  checked?: boolean;
  badge?: string;
  separator?: boolean;
  class?: string;
  children?: MenuOption[];
  onBeforeExpand?: (menu: Menu) => void;
  disable?: boolean;
};

export class Menu {
  public id: string;
  public opt: MenuOption;
  public subMenu: Menu[] = [];

  constructor(opt: MenuOption = {}) {
    this.id = 'menu-' + sn++;
    this.opt = opt;
    if (opt.children) {
      for (let child_opt of opt.children) {
        let c = new Menu(child_opt);
        this.add(c);
      }
    }
  }

  innerHtml(): string {
    let opt = this.opt;
    let c = '';

    if (opt.icon) c += icon(opt.icon, 'icon ' + nullstr(opt.icon_class));
    if (opt.name) c += div({ class: 'name' }, opt.name);
    if (opt.right_icon) c += icon(opt.right_icon, 'right-icon ' + nullstr(opt.right_icon_class));
    if (opt.badge) c += span({ class: 'badge badge-danger' }, opt.badge);
    if (opt.with_check) c += span({ class: 'with-check' }, opt.checked ? icon('check') : '');
    return c;
  }

  html(): string {
    if (this.opt.separator)
      return div({ class: 'menu separator' });
    else {
      let c = 'menu btn';
      if (this.opt.class) c += ' ' + this.opt.class;
      if (this.opt.disable) c += ' disable';
      return button({ class: c, id: this.id, 'title-i18n': this.opt.explain }, this.innerHtml());
    }
  }

  bind() {
    $(`#${this.id}`).on('click', e => {
      // $('.menu-back').remove();
      $('.tooltip').remove();
      if (this.opt.link) {
        document.location.href = this.opt.link;
      } else if (this.opt.link_open) {
        window.open(this.opt.link_open, "_blank");
      } else if (this.opt.action) {
        if (!this.opt.disable)
          this.opt.action(e, this);
      } else if (this.subMenu.length > 0) {
        this.expand(e);
      }
    });
  }

  redisplay() {
    $('#' + this.id).html(this.innerHtml())
  }

  expand(e: JQuery.ClickEvent) {
    if (this.subMenu.length > 0) {
      this.subMenu.forEach((m) => {
        if (m.opt.onBeforeExpand)
          m.opt.onBeforeExpand(m);
      });
      let s = this.subMenu.map(m => m.html()).join('');
      let sub_id = this.id + '-sub';
      let offset = $(e.currentTarget).offset();
      let h = $(e.currentTarget).height() || 0;
      let x = offset?.left || 0;
      let y = (offset?.top || 0) + h + 5;
      let style = `top: ${y}px; left: ${x}px;`;
      $('body').append(div({ class: 'menu-back', style: 'z-index:1000' },
        div({ id: sub_id, style, class: 'menu-stack' }, s)));
      this.subMenu.forEach(m => { m.bind(); });
      $('.menu-back').on('click', () => {
        $('.menu-back').remove();
      });
      let w0 = $('.menu-back').width() || 0;
      let w = $('#' + sub_id).width() || 0;
      w0 -= 30;
      if (x + w > w0) {
        $('#' + sub_id).offset({ top: y, left: w0 - w });
      }
    }
    e.preventDefault();
    e.stopPropagation();
  }



  add(m: Menu | MenuOption) {
    if (m instanceof Menu)
      this.subMenu.push(m);
    else
      this.subMenu.push(new Menu(m));
    return this;
  }

  addSeparator() {
    return this.add(new Menu({ separator: true }));
  }

  clear() {
    this.subMenu = [];
    return this;
  }

  check_all() {
    let c0 = 0;
    let menus = this.subMenu;
    for (let m of menus) {
      if (m.opt.with_check) {
        if (!m.opt.checked) c0++;
      }
    }
    for (let m of menus) {
      if (m.opt.with_check) {
        m.opt.checked = c0 > 0;
        m.redisplay();
      }
    }
  }
}

