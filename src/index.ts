type BindingGetter = () => any;
type BindingSetter = (x: any) => void;

type BindingGetterSetter = {
  get?: BindingGetter,
  set?: BindingSetter,
};

type BindingCtorVal = BindingGetter | BindingGetter[] | BindingGetterSetter;

class Binding {
  get: BindingGetter | BindingGetter[] | null;
  set: BindingSetter | null;

  constructor(x: BindingCtorVal) {
    if (typeof x === 'object' && !Array.isArray(x)) {
      Object.assign(this, x as BindingGetterSetter);
    } else {
      this.get = x;
    }
  }
}

let binding = (x: BindingCtorVal) => new Binding(x);

class Component {
  render() {
    throw new Error(`${this.constructor.name} does not implement render`);
  }
}

type ComponentFn = (props: Object | null) => HTMLElement | null;
type ElementType = string | { new(props: Object | null): Component } | ComponentFn;

type ChildNodes = (Node | ChildNodes)[];

function createElement(
  type: ElementType,
  props?: Object | null,
  ...children: ChildNodes
): HTMLElement {
  if (typeof type === 'function') {
    props = { ...props || {}, children };

    return type.prototype instanceof Component
      ? new (type as any)(props).render()
      : (type as any)(props);
  }

  let el = document.createElement(type);

  for (let [k, v] of Object.entries(props || {})) {
    let isEventListener = k.startsWith('on');

    if (isEventListener) {
      let evName = k.replace(/^on:?/, '').toLowerCase();
      el.addEventListener(evName, v);

      continue;
    }

    if (k === 'style') {
      if (typeof v !== 'object') {
        (el as any).style = v;
        continue;
      }

      for (let [k2, v2] of Object.entries(v)) {
        (el.style as any)[k2] = v2;
      }

      continue;
    }

    if (k === 'class') {
      if (Array.isArray(v)) {
        for (let x of v) {
          el.classList.add(...String(x).split(/ |\r|\n/).filter(Boolean));
        }

        continue;
      }

      k = 'className';
    }

    (el as any)[k] = v;
  }

  if (children.length) {
    el.innerHTML = '';
    el.append(...children.flat(10) as Node[]);
  }

  return el;
}

export default {
  Binding,
  binding,

  Component,

  el: createElement,
};
