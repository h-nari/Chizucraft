import { Chizucraft } from './chizucraft';

declare global {
  interface Window {
    cc: Chizucraft;
  }
};

$(() => {
  window.cc = new Chizucraft();
  window.cc.bind();
});

