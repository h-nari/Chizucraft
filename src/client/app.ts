import { camelCase } from 'jquery';
import { Chizucraft } from './chizucraft';

declare global {
  interface Window {
    cc: Chizucraft;
  }
};

$(() => {
  $('.tab-bar a.nav-link').on('click', e => {
    let target = $(e.currentTarget).prop('target');
      window.cc.tab_set(target);
    e.preventDefault();
  });

  window.cc = new Chizucraft();
  window.cc.bind();
});
