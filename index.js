'use strict';

function Binding(x) {
  if (typeof x === 'object' && !Array.isArray(x)) {
    objAssign(this, x);
  } else {
    this.get = x;
  }
}

function createBinding(x) { return new Binding(x) }

function bindToNode(n, key, binding) {
  objAssign(binding, { target: n, key: key });
  (n.bindings = n.bindings || []).push(binding);
}

function createElement(type) {
  let el, evName, i, k, k2, v, v2;

  let rest = [].slice.call(arguments, 1);

  let props = [undefined, null].indexOf(rest[0]) !== -1 ||
    (rest[0] && rest[0].constructor === Object) ? rest.shift() : {};

  // Flatten children arrays.
  let children = flat(rest, 10);

  // If the element type is a function, delegate everything to its implementation.
  if (typeof type === 'function') {
    // Pass children as prop to components.
    props = objAssign({}, props);
    props.children = children;

    // Instantiate and call render if type prototype has a render method.
    if (type.prototype && type.prototype.render) {
      return new type(props).render();
    }

    // Otherwise just call it as a regular function.
    return type(props);
  }

  // Otherwise element type is a string representing a tag name, which we create.
  el = type.indexOf('svg:') !== 0
    ? document.createElement(type)
    : document.createElementNS('http://www.w3.org/2000/svg', el.split(':')[1]);

  // For each prop...
  for (k in props) {
    if (!props.hasOwnProperty(k)) { continue }
    v = props[k];

    // Add on* props as event listeners.
    if (k.indexOf('on') === 0) {
      evName = k.replace(/^on:?/, '').toLowerCase();
      el.addEventListener(evName, v);

      continue;
    }

    // Wrap any other function props in Bindings.
    if (v instanceof Function) { v = new Binding(v) }

    // Store Bindings on element.
    if (v instanceof Binding) {
      bindToNode(el, k, v);
      continue;
    }

    // Special handling for class props.
    if (k === 'class') {
      // Special handling for arrays.
      if (Array.isArray(v)) {
        for (i = 0; i < v.length; i++) {
          v2 = v[i];

          // Wrap class getter functions in Bindings.
          if (typeof v2 === 'function') { v2 = new Binding(v2) }

          // Store Bindings on element.
          if (v2 instanceof Binding) {
            bindToNode(el, k, v2);
            continue;
          }

          // Ignore falsy values.
          if (!v2) { continue }

          // Convert remaining values to strings and statically add them to the
          // element.
          el.classList.add.apply(
            el.classList,
            String(v2).split(/ |\r|\n/).filter(Boolean)
          );
        }

        continue;
      }

      // Ignore falsy values.
      if (!v) { continue }

      // Otherwise it's a string or something convertible into string.
      el.className = v;

      continue;
    }

    // Special handling for style props.
    if (k === 'style') {
      // If prop value is an object, assign all key-value pairs to el.style.
      if (typeof v === 'object') {
        for (k2 in v) {
          if (!v.hasOwnProperty(k2)) { continue }

          v2 = v[k2];

          // Wrap class getter functions in Bindings.
          if (v2 instanceof Function) { v2 = new Binding(v2) }

          // Store Bindings on element.
          if (v2 instanceof Binding) {
            bindToNode(el, 'style.' + k2, v2);
            continue;
          }

          // Otherwise it's a string or something convertible into string.
          el.style[k2] = v2;
        }

        continue;
      }

      // Otherwise it's a string or something convertible into string.
      el.style = v;

      continue;
    }

    // All other props.
    el[k] = v;
  }

  // Append children (if any).
  for (i = 0; i < children.length; i++) {
    v = children[i];
    v = typeof v === 'string' ? document.createTextNode(v) : v;
    el.appendChild(v);
  }

  // Return newly created element.
  return el;
}

function createComment(text) {
  return document.createComment(text ? ' ' + text + ' ' : ' ');
}

function createAnchor(text, bindingProps) {
  let c = createComment(text);
  c.bindings = [new Binding(bindingProps)];
  return c;
}

function createIfAnchor(predFn, thenNode, elseNode) {
  return createAnchor('if anchor', {
    get: predFn,
    thenNode: thenNode,
    elseNode: elseNode
  });
}

function createMapAnchor(getFn, mapFn) {
  return createAnchor('map anchor', { get: getFn, map: mapFn });
}

function createTextNode(getFn) {
  let n = document.createTextNode('');
  n.bindings = [new Binding(getFn)];
  return n;
}

let boundNodes = [];

//let update = (n: Node): void => {};

// TODO: Workaround for IE11's broken TreeWalker.
function forEachNodeWithBindings(ns, cb) {
  let i, n, n2, walker;

  for (i = 0; i < ns.length; i++) {
    n = ns[i];

    n.bindings && cb(n);

    walker = document.createTreeWalker(
      n, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_COMMENT,
    );

    while (walker.nextNode()) {
      n2 = walker.currentNode;
      n2.bindings && cb(n2);
    }
  }
}

function processMutations(muts, observer, di) {
  di = di || {};
  di.boundNodes = di.boundNodes || boundNodes;
  di.update = di.update || update;

  let i, j, mut, n;

  let body = document.body;

  let addedNodes = [];
  let removedNodes = [];

  for (i = 0; i < muts.length; i++) {
    addedNodes.push.apply(addedNodes, muts[i].addedNodes);
  }

  // Some muts[?].removedNodes are actually _moved_ nodes (i.e. they are also
  // present in muts[?].addedNodes). We're only interested in actual removed
  // nodes here, that's why merging these two loops could be tricky, maybe
  // impossible. I'll give it a try at some point, but for now this works fine.
  for (i = 0; i < muts.length; i++) {
    mut = muts[i];

    for (j = 0; j < mut.removedNodes.length; j++) {
      n = mut.removedNodes[j];
      if (addedNodes.indexOf(n) === -1) { removedNodes.push(n) }
    }
  }

  forEachNodeWithBindings(removedNodes, function(n) {
    i = di.boundNodes.indexOf(n);
    if (i !== -1) { di.boundNodes.splice(i, 1) }
  });

  forEachNodeWithBindings(addedNodes, function(n) {
    if (di.boundNodes.indexOf(n) === -1) {
      di.boundNodes.push(n);
      di.update(n);
    }
  });
}

function resolve(x) { return typeof x === 'function' ? x() : x }

objAssign(exports, {
  Binding: Binding,
  binding: createBinding,

  el: createElement,
  comment: createComment,

  if: createIfAnchor,
  map: createMapAnchor,
  text: createTextNode,

  processMutations: processMutations,
  boundNodes: boundNodes,

  resolve: resolve
});

// IE11 helpers:
function objAssign(a, b) {
  let k;

  for (k in b) {
    if (!b.hasOwnProperty(k)) { continue }
    a[k] = b[k];
  }

  return a;
}

function flat(xs, d) {
  if (d === undefined) { d = 1 }

  return xs.reduce(function(acc, x) {
    return acc.concat(Array.isArray(x) ? (d > 0 ? flat(x, d - 1) : x) : x);
  }, []);
}

function flatMap(xs, fn) { return flat(xs.map(fn)) }
