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
  // Flatten children arrays.
  children = children.flat(10);

  // If the element type is a function, delegate everything to its implementation.
  if (typeof type === 'function') {
    // Pass children as prop to components.
    props = { ...props || {}, children };

    // Instantiate and call render if type is a Component type.
    // Otherwise just call it as a regular function.
    return type.prototype instanceof Component
      ? new (type as any)(props).render()
      : (type as any)(props);
  }

  // Otherwise element type is a string representing a tag name, which we create.
  let el = document.createElement(type);

  // For each prop...
  for (let [k, v] of Object.entries(props || {})) {
    // Add on* props as event listeners.
    if (k.startsWith('on')) {
      let evName = k.replace(/^on:?/, '').toLowerCase();
      el.addEventListener(evName, v);

      continue;
    }

    // Wrap any other function props in Bindings.
    if (v instanceof Function) {
      v = binding(v);
    }

    // Store Bindings to element.
    if (v instanceof Binding) {
      let elBindings: any = (el as any).bindings = (el as any).bindings || {};

      elBindings[k] = v;
      continue;
    }

    // Special handling for class props.
    if (k === 'class') {
      // Special handling for arrays.
      if (Array.isArray(v)) {
        for (let x of v) {
          el.classList.add(...String(x).split(/ |\r|\n/).filter(Boolean));
        }

        continue;
      }

      // Otherwise it's a string or something convertible into string.
      el.className = v;

      continue;
    }

    // Special handling for style props.
    if (k === 'style') {
      // If prop value is an object, assign all key-value pairs to el.style.
      if (typeof v === 'object') {
        Object.assign(el.style, v);
        continue;
      }

      // Otherwise it's a string or something convertible into string.
      (el as any).style = v;

      continue;
    }

    // All other props.
    (el as any)[k] = v;
  }

  // Append children (if any).
  if (children.length) {
    el.append(...children as Node[]);
  }

  // Return newly created element.
  return el;
}

export default {
  Binding,
  binding,

  Component,

  el: createElement,
};
