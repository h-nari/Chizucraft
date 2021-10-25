import { camelCase } from 'jquery';
import { Chizucraft } from './chizucraft';

declare global {
  interface Window {
    cc: Chizucraft;
  }
};

$(() => {
  $('.tab-bar a.nav-link').on('click', e => {
    $('.tab-bar a.nav-link').removeClass('active');
    $('.tab-bar div.tab').removeClass('hidden');
    $('.tab-bar div.tab').addClass('hidden');
    $(e.currentTarget).addClass('active');
    let target = $(e.currentTarget).prop('target');
    if (target) {
      $('#' + target).removeClass('hidden');
    }
    if(target == 'pane-minecraft-map'){
      window.cc.mineMap.update_canvas_size();
    }
    e.preventDefault();
  });

  window.cc = new Chizucraft();
  window.cc.bind();
});
