import { a, div, input, label, tag } from "./tag";



export function escape_html(str: string | null | undefined): string {
  if (!str)
    return '';
  else
    return str.replace(/[&'`"<>]/g, function (match) {
      return {
        '&': '&amp;',
        "'": '&#X27;',
        '`': '&#x60;',
        '"': '&quot;',
        '<': '&lt;',
        '>': '&gt;'
      }[match] || '?' + match + '?';
    });
}

export function size_str(size: number): string {
  const kilo = 1024;
  const mega = kilo * kilo;
  const giga = mega * kilo;

  let str: string;
  if (size > giga)
    str = (size / giga).toFixed(2) + ' Gbyte';
  else if (size > 100 * mega)
    str = (size / mega).toFixed(0) + ' Mbyte'
  else if (size > 10 * mega)
    str = (size / mega).toFixed(1) + ' Mbyte'
  else if (size > 1 * mega)
    str = (size / mega).toFixed(2) + ' Mbyte'
  else if (size > 100 * kilo)
    str = (size / kilo).toFixed(0) + ' Kbyte'
  else if (size > 10 * kilo)
    str = (size / kilo).toFixed(1) + ' Kbyte'
  else if (size > 1 * kilo)
    str = (size / kilo).toFixed(2) + ' Kbyte'
  else
    str = size + ' bytes';
  return str;
}

export function nullstr(s: string | undefined | null): string {
  if (s) return s;
  else return '';
}

export function url_link(content: string): string {
  const url_re = new RegExp('https?://([-a-zA-Z0-9._+\-,*#%\?/=~:@!]|(&amp;))+', 'g');
  let c2 = content.replace(url_re, (str) => {
    let url = str.replace('&amp;', '&');
    return a({ href: url, target: '_blank' }, decodeURI(url));
  });
  return c2;
}

export function split_yymm(yymm: string) {
  let m = yymm.match(/(\d\d)(\d\d)/);
  if (m) {
    let year = parseInt(m[1]) + 2000;
    let month = parseInt(m[2]);
    return { year, month };
  } else
    throw new Error('Bad format yymm:' + yymm);
}

