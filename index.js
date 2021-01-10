'use strict';

let boundNodes = [];

let ariaDataRegExp = /^(aria|data)-/;
let svgNsRegExp = /\/svg$/;
let wsRegExp = / |\r|\n/;

function nullish(x) { return x === undefined || x === null }

// Possible class values:
// nullish, numbers;
// single-class strings (e.g. 'foo');
// multi-class strings (whitespace separated, e.g. 'foo  bar\n baz');
// (nested) arrays of any of the above.
// This function normalizes all possibilities to arrays of single-class strings.
// Note that booleans are always filtered out (so we can use short-circuit
// operators without accidentally adding classes like 'true' or 'false').
function normalizeClasses(x) {
  if (!Array.isArray(x)) { x = [x] }

  return flatMap(x, function(y) {
    return (y || typeof y === 'number') && String(y).split(wsRegExp);
  }).filter(Boolean);
}

// All functions accepting child node values use this function to convert
// strings and numbers to text nodes. Booleans are converted to null (for
// basically the same reason as described above in normalizeClasses).
function appendableNode(x) {
  if (x instanceof Node) { return x }
  if ((!x && typeof x !== 'number') || typeof x === 'boolean') { return null }

  return document.createTextNode(x);
}

// Some nodes have n.anchoredNodes. When removing n, it's important to also
// removed all anchored nodes. This function can be safely used to remove any
// node, even ones that don't have anchored nodes.
function removeWithAnchoredNodes(n) {
  let i;

  if (n.anchoredNodes) {
    for (i = 0; i < n.anchoredNodes.length; i++) {
      n.anchoredNodes[i].remove();
    }

    delete n.anchoredNodes;
  }

  n.remove();
}

// All bindings are represented as instances of this class.
function Binding(x) {
  // Incorporate all key-values in x when x is an object.
  // typeof array === 'object', but arrays are to be stored as this.get
  // (e.g. class: new Binding([fn1, fn2...])), that's why we need the extra
  // check.
  if (typeof x === 'object' && !Array.isArray(x)) {
    objAssign(this, x);
  } else {
    this.get = x;
  }
}

// Most prop bindings can be updated in a unified fashion:
Binding.prototype.update = function() {
  let el = this.target, newValue = this.get();

  // If the value hasn't changed, do nothing.
  if (newValue === this.lastValue) { return }

  // aria-*, data-*, and SVG element props need to be managed as attributes.
  if (ariaDataRegExp.test(this.key) || svgNsRegExp.test(el.namespaceURI)) {
    if (!nullish(newValue)) {
      el.setAttribute(this.key, newValue);
    } else {
      el.removeAttribute(this.key);
    }
  } else {
    // All else are regular DOM element properties.
    el[this.key] = newValue;
  }

  // Remember updated value.
  this.lastValue = newValue;
};

// Some prop bindings like class, style, and value need special handling.
// The bindToNode function (below) will automatically set these special update
// handlers to the appropriate Binding instances, overriding the default one
// (see above). These can also be overridden or extended if necessary by
// patching Binding.specialUpdateFnsByKey.
Binding.specialUpdateFnsByKey = {
  class: function classBindingUpdate() {
    // Supports (nested) array/non-array class value getters.
    let i, x, el = this.target, newValue = Array.isArray(this.get)
      ? flatMap(binding.get, function(x) { return x() })
      : this.get();

    newValue = normalizeClasses(newValue);

    this.lastValue = this.lastValue || [];

    // Remove classes in lastValue but not in newValue.
    for (i = 0; i < this.lastValue.length; i++) {
      x = this.lastValue[i];
      if (newValue.indexOf(x) === -1) { el.classList.remove(x) }
    }

    // Added classes in newValue but not in lastValue.
    for (i = 0; i < newValue.length; i++) {
      x = newValue[i];
      if (lastValue.indexOf(x) === -1) { el.classList.add(x) }
    }

    // Remember updated value.
    this.lastValue = newValue;
  },

  style: function styleBindingUpdate() {
    let newValue = this.get();

    // If the value hasn't changed, do nothing.
    if (newValue === this.lastValue) { return }

    // Nullish values are converted to empty strings, everything else is
    // assigned as-is (the browser itself converts them to strings).
    this.target.style[this.subkey] = !nullish(newValue) ? newValue : '';

    // Remember updated value.
    this.lastValue = newValue;
  },

  value: function valueBindingUpdate() {
    let newValue;

    // On first update, lazily creates event handlers for tracking input value
    // changes.
    if (!this.setHandler) {
      this.target.addEventListener('keyup', this.setHandler = function(ev) {
        let x = ev.target.value;
        this.lastValue = this.set ? this.set(x) : x;

        // Calling this.set inherently changes application state, so we may
        // need to update other bindings elsewhere that depend on it.
        this.set && update();
      });
    }

    if (this.get) {
      newValue = this.get();

      // Convert nullish and boolean values to empty strings. Cast everything
      // else to string.
      if (nullish(newValue) || typeof newValue === 'boolean') { newValue = '' }
      else { newValue = String(newValue) }

      // If the value hasn't changed, do nothing.
      if (newValue === this.lastValue) { return }

      // Update element and remember updated value.
      this.lastValue = this.target.value = newValue;
    }
  }
};

function createBinding(x) { return new Binding(x) }

// Initializes common binding props (target, key, subkey, update) and adds
// bindings to DOM nodes.
function bindToNode(n, key, subkey, binding) {
  let bindingUpdateFn = Binding.specialUpdateFnsByKey[key];

  objAssign(binding, { target: n, key: key, subkey: subkey });
  if (bindingUpdateFn) { binding.update = bindingUpdateFn }

  (n.bindings = n.bindings || []).push(binding);
}

function createElement(type) {
  let el, evName, i, k, k2, v, v2;

  let rest = [].slice.call(arguments, 1);

  let props = nullish(rest[0]) ||
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
      bindToNode(el, k, null, v);
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
            bindToNode(el, k, null, v2);
            continue;
          }

          // Ignore falsy values.
          if (!v2) { continue }

          // Convert remaining values to strings and statically add them to the
          // element.
          el.classList.add.apply(el.classList, normalizeClasses(v2));
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
      // Special handling for objects.
      if (typeof v === 'object') {
        for (k2 in v) {
          if (!v.hasOwnProperty(k2)) { continue }

          v2 = v[k2];

          // Wrap style getter functions in Bindings.
          if (v2 instanceof Function) { v2 = new Binding(v2) }

          // Store Bindings on element.
          if (v2 instanceof Binding) {
            bindToNode(el, 'style', k2, v2);
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
    v = appendableNode(children[i]);
    v && el.appendChild(v);
  }

  // Return newly created element.
  return el;
}

function createComment(text) {
  return document.createComment(!nullish(text) ? ' ' + text + ' ' : ' ');
}

function createBoundComment(text, bindingProps) {
  let c = createComment(text);
  c.bindings = [new Binding(bindingProps)];
  return c;
}

function createIfAnchor(predFn, thenNode, elseNode) {
  return createBoundComment('if anchor', {
    get: predFn,
    thenNode: thenNode,
    elseNode: elseNode,
    update: ifAnchorBindingUpdate
  });
}

function ifAnchorBindingUpdate() {
  let i, n, parentEl;
  let nAnchor = this.target, newValue = Boolean(this.get()), nNew, nCursor;

  if (newValue !== this.lastValue || this.lastValue === undefined) {
    parentEl = nAnchor.parentElement;

    for (i = 0; i < (nAnchor.anchoredNodes || []).length; i++) {
      removeWithAnchoredNodes(nAnchor.anchoredNodes[i]);
    }

    nAnchor.anchoredNodes = [];

    if (!parentEl) { return }

    nNew = newValue ? this.thenNode : this.elseNode;

    if (nNew) {
      nCursor = nAnchor;
      nNew = Array.isArray(nNew) ? nNew : [nNew];

      for (i = 0; i < nNew.length; i++) {
        n = appendableNode(nNew[i]);
        if (!n) { continue }

        parentEl.insertBefore(n, nCursor.nextSibling);
        nAnchor.anchoredNodes.push(n);

        nCursor = n;
      }
    }
  }

  this.lastValue = newValue;
}

function createMapAnchor(getFn, mapFn) {
  return createBoundComment('map anchor', {
    get: getFn,
    map: mapFn,
    update: mapAnchorBindingUpdate
  });
}

function mapAnchorBindingUpdate() {
}

function createTextNode(getFn) {
  let n = document.createTextNode('');
  n.bindings = [new Binding({ get: getFn, update: textNodeUpdate })];
  return n;
}

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

  let newNodes = [];
  let orphanedNodes = [];

  // Collect newNodes.
  for (i = 0; i < muts.length; i++) {
    mut = muts[i];

    for (j = 0; j < mut.addedNodes.length; j++) {
      n = mut.addedNodes[j];
      if (di.boundNodes.indexOf(n) === -1) { newNodes.push(n) }
    }
  }

  // Collect orphanedNodes.
  for (i = 0; i < muts.length; i++) {
    mut = muts[i];

    for (j = 0; j < mut.removedNodes.length; j++) {
      n = mut.removedNodes[j];
      if (newNodes.indexOf(n) === -1) { orphanedNodes.push(n) }
    }
  }

  // Recursively remove boundNodes collected in the orphanedNodes array.
  forEachNodeWithBindings(orphanedNodes, function(n) {
    i = di.boundNodes.indexOf(n);
    if (i !== -1) { di.boundNodes.splice(i, 1) }
  });

  // Recursively add boundNodes collected in the newNodes array.
  forEachNodeWithBindings(newNodes, function(n) {
    if (di.boundNodes.indexOf(n) === -1) {
      di.boundNodes.push(n);
      di.update(n);
    }
  });
}

function resolve(x) { return typeof x === 'function' ? x() : x }

function update(n, di) {
  di = di || {};
  di.boundNodes = di.boundNodes || [];
  di.console = di.console || console;

  let i, b;

  // When a node is supplied, update all its bindings, catch and log errors.
  if (n) {
    for (i = 0; i < n.bindings.length; i++) {
      b = n.bindings[i];
      try { b.update() }
      catch (e) { di.console.error(e, 'in', n, b) }
    }

    return;
  }

  // Otherwise we apply update (this function) on all boundNodes.
  for (i = 0; i < di.boundNodes.length; i++) { update(di.boundNodes[i], di) }
}

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

  resolve: resolve,
  update: update
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
