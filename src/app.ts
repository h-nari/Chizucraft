import { Chizucraft } from './chizucraft';

declare global {
  interface Window {
    cc: Chizucraft;
  }
};

$(() => {
  window.cc = new Chizucraft();
});

console.log('はろー');