import { div, input, label, selected, StrObj } from "./tag";

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
  else if (start > end) {
    for (let i = start; i > end; i--)
      r.push(i);
  }
  return r;
}

export function label_num(label_str: string, num: number | undefined = undefined) {
  return div({ class: 'label-num ' + label_str },
    label(label_str), input({ type: 'number', value: num || '' }));
}

export function label_check(class_str: string, label_str: string, checked: boolean) {
  return div({ class: 'label-check d-inline-block flex-fill mx-2 ' + class_str },
    input({ type: 'checkbox', checked: selected(checked) }),
    label(label_str)
  );
}