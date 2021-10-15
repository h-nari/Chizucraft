import { div, input, label, StrObj } from "./tag";

export function checkbox(text: string, opt: StrObj) {
  return div({ class: 'd-inline-block checkbox' }, opt,
    input({ type: 'checkbox' }),
    label(text)
  );
}

export function row(title: string, ...args: string[]) {
  return div({ class: 'c-row' }, div({ class: 'title' }, title), ...args);
}

export function range(start: number, end: number): number[] {
  let r = [];
  if (start < end)
    for (let i = start; i < end; i++)
      r.push(i);
  else if (start < end) {
    for (let i = start; i > end; i--)
      r.push(i);
  }
  return r;
}