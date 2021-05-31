type Props = Record<string, any>
type Component = (props: Props) => Element

interface Element {
  el: string | Component | typeof Fragment
  props: Props
}

export function jsx(el: string | Component | typeof Fragment, props: Props): Element {
  return {el, props}
}

export enum SmartType {
  Null = 'null',
  Undefined = 'undefined',
  Number = 'number',
  Boolean = 'boolean',
  Date = 'date',
  Regexp = 'regexp',
  String = 'string',
  Array = 'array',
  Object = 'object',
  Function = 'function',
  Promise = 'promise',
}

export const smart_typeof = (obj: any): SmartType => {
  /**
   * Helper to get the type of objects, works even for primitives, see
   * https://stackoverflow.com/questions/30476150/javascript-deep-comparison-recursively-objects-and-properties
   */
  return Object.prototype.toString
    .call(obj)
    .replace(/\[object (.+)]/, '$1')
    .toLowerCase() as SmartType
}

async function render_element(child: any): Promise<string> {
  const child_type = smart_typeof(child)
  // console.log('render_children:', {child_type, child})
  if (child_type == SmartType.String) {
    return child
  } else if (child_type == SmartType.Object && 'el' in child && 'props' in child) {
    return await jsxs(child.el, child.props)
  } else if (child instanceof AsyncRef) {
    return await render_element(await child.get_result())
  } else if (child_type == SmartType.Array) {
    let result = ''
    for (const item of (child as any[])) {
      result += await render_element(item)
    }
    return result
  } else {
    return JSON.stringify(child)
  }
}

export async function jsxs(el: string | Component | typeof Fragment, props: Props): Promise<string> {
  // console.log('jsxs:', {el, props})
  if (typeof el == 'string') {
    let children = ''
    let attrs = ''
    for (const [key, raw_value] of Object.entries(props)) {
      const value = await render_element(raw_value)
      if (key == 'children') {
        children = value
      } else {
        // TODO other conversions
        const name = key == 'className' ? 'class' : key
        attrs += ` ${name}="${value}"`
      }
    }
    return `<${el}${attrs}>${children}</${el}>`
  } else if (el == Fragment) {
    return await render_element(props.children)
  } else {
    const f = el as any
    const result = f(props)
    if (smart_typeof(result) == SmartType.Promise) {
      return await result
    } else {
      return await render_element(result)
    }
  }
}

export class Fragment {}

class AsyncRef<T> {
  private readonly prom: Promise<T>
  private result?: T
  private got_result = false

  constructor(prom: Promise<T>) {
    this.prom = prom
  }

  async get_result(): Promise<T> {
    if (!this.got_result) {
      this.result = await this.prom
      this.got_result = true
    }
    return this.result as T
  }
}

export function async_ref<T>(prom: Promise<T>): T {
  const p: any = new AsyncRef(prom)
  return p as T
}
