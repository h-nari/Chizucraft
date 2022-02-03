export function assert_not_null<T>(val: T): asserts val is NonNullable<T> {
  if (val === undefined || val === null)
    throw new Error("not null assertion error");
}

export function assert_number(a: any): asserts a is number {
  if (typeof a !== 'number')
    throw new Error("number assertion error");
}

export function assert_boolean(val: any): asserts val is boolean {
  if (typeof val != 'boolean')
    throw new Error('boolean assertion error');
}

export function assert_string(val: any): asserts val is string {
  if (typeof val != 'string')
    throw new Error('string assertion error');
}

/*
export function assert_minecraft_xdir(val: any): asserts val is MinecraftXDir {
  if (val != 'x+' && val != 'x-' && val != 'z+' && val != 'z-')
    throw new Error('minecraft_xdir assertion error, val=' + val);
}
*/

