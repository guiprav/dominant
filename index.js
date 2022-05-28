'use strict';

var boundNodes = [];
var ieNodes = navigator.userAgent.indexOf('Trident') ? [] : null;

var classTypeRegExp = /^class\s/;
var ariaRegExp = /^aria-/;
var svgNsRegExp = /\/svg$/;
var wsRegExp = / |\r|\n/;
var onAttachRegExp = /^on:?attach$/i
var onDetachRegExp = /^on:?detach$/i

function nullish(x) { return x === undefined || x === null }

// Possible class values:
// nullish,
// single-class strings (e.g. 'foo');
// multi-class strings (whitespace separated, e.g. 'foo  bar\n baz');
// (nested) arrays of any of the above.
// This function normalizes all possibilities to arrays of single-class strings.
// Note that numbers and booleans are always filtered out (so we can use short-circuit
// operators without accidentally adding classes like 'true' or '1').
function normalizeClasses(x) {
  if (!Array.isArray(x)) { x = [x] }

  return flatMap(x, function(y) {
    return (y && typeof y !== 'boolean' && typeof y !== 'number') && String(y).split(wsRegExp);
  }).filter(Boolean);
}

// All functions accepting child node values use this function to convert
// strings and numbers to text nodes. Booleans are converted to null (for
// basically the same reason as described above in normalizeClasses).
function appendableNode(x) {
  if (x instanceof Node) { return x }
  if (typeof x === 'boolean' || (!x && typeof x !== 'number')) { return null }

  return document.createTextNode(x);
}

// Some nodes have n.anchoredNodes. When removing n, it's important to also
// removed all anchored nodes. This function can be safely used to remove any
// node, even ones that don't have anchored nodes.
function removeWithAnchoredNodes(n) {
  var i;

  if (n.anchoredNodes) {
    for (i = 0; i < n.anchoredNodes.length; i++) {
      removeWithAnchoredNodes(n.anchoredNodes[i]);
    }
  }

  n.parentNode && n.parentNode.removeChild(n);
}

// Some nodes have n.anchoredNodes. When moving n, it's important to also
// move all anchored nodes. This function can be safely used to move any
// node(s), even ones that don't have anchored nodes.
function insertBeforeWithAnchoredNodes(parentEl, n, n2) {
  if (Array.isArray(n)) {
    n.forEach(function(n) { insertBeforeWithAnchoredNodes(parentEl, n, n2) });
    return;
  }

  parentEl.insertBefore(n, n2);

  if (n.anchoredNodes) {
    insertBeforeWithAnchoredNodes(parentEl, n.anchoredNodes, n2);
  }
}

// All bindings are represented as instances of this class.
function Binding(x) {
  // Incorporate all key-values in x when x is an object.
  // typeof array === 'object', but arrays are to be stored as this.get
  // (e.g. class: new Binding([fn1, fn2...])), that's why we need the extra
  // check.
  if (typeof x === 'object' && !Array.isArray(x)) { objAssign(this, x) }
  else { this.get = x }
}

// Most prop bindings can be updated in a unified fashion:
Binding.prototype.update = function() {
  var newValue = this.get();

  // If the value hasn't changed, do nothing.
  if (newValue === this.lastValue) { return }

  var el = this.target;

  // aria-* and SVG element props need to be managed as attributes.
  if (ariaRegExp.test(this.key) || svgNsRegExp.test(el.namespaceURI)) {
    if (!nullish(newValue)) { el.setAttribute(this.key, newValue) }
    else { el.removeAttribute(this.key) }
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
    var i, x, el = this.target, newValue = Array.isArray(this.get)
      ? flatMap(this.get, function(x) { return x() })
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
      if (this.lastValue.indexOf(x) === -1) { el.classList.add(x) }
    }

    // Remember updated value.
    this.lastValue = newValue;
  },

  style: function styleBindingUpdate() {
    var newValue = this.get();

    // If the value hasn't changed, do nothing.
    if (newValue === this.lastValue) { return }

    // Nullish values are converted to empty strings, everything else is
    // assigned as-is (the browser itself converts them to strings).
    this.target.style[this.subkey] = !nullish(newValue) ? newValue : '';

    // Remember updated value.
    this.lastValue = newValue;
  },

  checked: function checkedBindingUpdate() {
    var self = this, newValue;

    // On first update, lazily creates event handlers for tracking input value
    // changes.
    if (!self.setHandler) {
      self.target.addEventListener('change', self.setHandler = function(ev) {
        var x = ev.target.checked;
        self.lastValue = self.set ? self.set(x) : x;

        // Calling self.set inherently changes application state, so we may
        // need to update other bindings elsewhere that depend on it.
        self.set && updateSync();
      });
    }

    if (self.get) {
      newValue = Boolean(self.get());

      // If the value hasn't changed, do nothing.
      if (newValue === self.lastValue) { return }

      // Update element and remember updated value.
      self.lastValue = self.target.checked = newValue;
    }
  },

  value: function valueBindingUpdate() {
    var self = this, newValue;

    // On first update, lazily creates event handlers for tracking input value
    // changes.
    if (!self.setHandler) {
      self.target.addEventListener('input', self.setHandler = function(ev) {
        var x = ev.target.value;
        self.lastValue = self.set ? self.set(x) : x;

        // Calling self.set inherently changes application state, so we may
        // need to update other bindings elsewhere that depend on it.
        self.set && updateSync();
      });
    }

    if (self.get) {
      newValue = self.get();

      // Convert nullish and boolean values to empty strings. Cast everything
      // else to string.
      if (nullish(newValue) || typeof newValue === 'boolean') { newValue = '' }
      else { newValue = String(newValue) }

      // If the value hasn't changed, do nothing.
      if (newValue === self.lastValue) { return }

      // Update element and remember updated value.
      self.lastValue = self.target.value = newValue;
    }
  },
};

function createBinding(x) { return new Binding(x) }

// Initializes common binding props (target, key, subkey, update) and adds
// bindings to DOM nodes.
function bindToNode(n, key, subkey, binding) {
  var bindingUpdateFn = Binding.specialUpdateFnsByKey[key];

  objAssign(binding, { target: n, key: key, subkey: subkey });
  if (bindingUpdateFn) { binding.update = bindingUpdateFn }

  (n.bindings = n.bindings || []).push(binding);
}

// Support for JSX "fragment" syntax.
function JsxFragment(props) { return props.children || [] }

function createElement(type) {
  var el, evName, getters, i, k, k2, v, v2, rest = [].slice.call(arguments, 1);

  // If second arg is nullish or a plain object, it's the props arg.
  var props = nullish(rest[0]) ||
    (rest[0] && rest[0].constructor === Object) ? rest.shift() : null;

  // Create one if missing.
  props = props || {};

  // Detect ambiguity.
  if (props.children && rest.length) {
    throw new Error('Ambiguous children parameters');
  }

  // Flatten child arrays.
  var children = flat(props.children ? arrayify(props.children) : rest, 10);

  // If the element type is a function, delegate everything to its implementation.
  if (typeof type === 'function') {
    // Pass children as prop to components.
    props = objAssign({}, props);
    props.children = children;

    for (k in props) {
      v = props[k];
      if (!(v instanceof Binding)) { continue }

      (function(k, v) {
        Object.defineProperty(props, k, {
          enumerable: true,
          get: v.get,

          set: v.set || function() {
            throw new TypeError('Missing setter for ' + k + ' binding');
          },
        });
      })(k, v);
    }

    // Instantiate and call render if type is a class and/or its prototype has
    // a render method.
    if (type.prototype && (
      typeof type.prototype.render === 'function' ||
      classTypeRegExp.test(type.toString())
    )) {
      return new type(props).render();
    }

    // Otherwise just call it as a regular function.
    return type(props);
  }

  // If type is an existing element, use it.
  if (type instanceof Node) { el = type }
  else {
    // Otherwise element type is a string representing a tag name, which we create.
    el = type.indexOf('svg:') !== 0
      ? document.createElement(type)
      : document.createElementNS('http://www.w3.org/2000/svg', type.split(':')[1]);
  }

  // For each prop...
  for (k in props) {
    if (!props.hasOwnProperty(k) || k === 'children') { continue }
    v = props[k];

    // Add on* props as event listeners.
    if (k.indexOf('on') === 0 && v) {
      evName = k.replace(/^on:?/, '').toLowerCase();

      if (v instanceof Binding) { v = v.get() }

      if (evName === 'attach' || evName === 'detach') {
        bindToNode(el, k, null, createBinding({ update: null, handler: v }));
        continue;
      }

      el.addEventListener(evName, (function(v, ev) {
        var ret = v(ev);
        updateSync();

        if (ret && typeof ret.then === 'function') {
          ret.then(function() { updateSync() });
        }
      }).bind(null, v));

      continue;
    }

    // Wrap any other function props in Bindings.
    if (v instanceof Function) { v = new Binding(v) }

    // Bind Bindings to element.
    if (v instanceof Binding) {
      bindToNode(el, k, null, v);
      continue;
    }

    // Special handling for class props.
    if (k === 'class') {
      // Special handling for arrays.
      if (Array.isArray(v)) {
        getters = [];

        for (i = 0; i < v.length; i++) {
          v2 = v[i];

          // Collect class getter functions.
          if (typeof v2 === 'function') { getters.push(v2); continue }

          // Bind Bindings to element.
          if (v2 instanceof Binding) { bindToNode(el, k, null, v2); continue }

          // Normalize remaining values and statically add them to the element.
          normalizeClasses(v2).forEach(function(x) { el.classList.add(x) });
        }

        // Wrap getters (if any) in a Binding instance and bind to element.
        if (getters.length) { bindToNode(el, k, null, new Binding(getters)) }

        continue;
      }

      // Normalize values and statically add them to the element.
      normalizeClasses(v).forEach(function(x) { el.classList.add(x) });

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

          // Bind Bindings to element.
          if (v2 instanceof Binding) {
            bindToNode(el, 'style', k2, v2);
            continue;
          }

          // Otherwise it's a string or something convertible into string.
          el.style[k2] = v2;
        }

        continue;
      }

      // Otherwise it's a string or something convertible to string.
      el.style = v;

      continue;
    }

    // aria-* and SVG element props need to be managed as attributes.
    if (ariaRegExp.test(k) || svgNsRegExp.test(el.namespaceURI)) {
      if (!nullish(v)) { el.setAttribute(k, v) }
      else { el.removeAttribute(k) }
    }

    // All else are (static) regular DOM element properties.
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
  var c = createComment(text);
  c.bindings = [new Binding(objAssign(bindingProps, { target: c }))];
  ieNodes && ieNodes.push(c);
  return c;
}

function createIfAnchor(predFn, thenNodes, elseNodes) {
  return createBoundComment('if anchor', {
    get: predFn,
    thenNodes: thenNodes,
    elseNodes: elseNodes,
    update: ifAnchorBindingUpdate,
  });
}

function ifAnchorBindingUpdate() {
  var i, n;
  var nAnchor = this.target, parentEl = nAnchor.parentNode;
  var newValue = Boolean(this.get()), nNew, nTail;

  if (newValue === this.lastValue) {
    // Ensure anchoredNodes (if any) are really anchored to parentEl.
    // Other binding updates may have ejected them.
    if (
      nAnchor.anchoredNodes &&
      nAnchor.anchoredNodes.length &&
      nAnchor.anchoredNodes[0].parentNode !== parentEl
    ) {
      insertBeforeWithAnchoredNodes(
        parentEl, nAnchor.anchoredNodes, nAnchor.nextSibling);
    }

    // If the value hasn't changed, do nothing else.
    return;
  }

  // Since the value has changed, remove currently anchored nodes (if any).
  if (nAnchor.anchoredNodes && nAnchor.anchoredNodes.length) {
    for (i = 0; i < nAnchor.anchoredNodes.length; i++) {
      removeWithAnchoredNodes(nAnchor.anchoredNodes[i]);
    }
  }

  if (!nAnchor.anchoredNodes || nAnchor.anchoredNodes.length) {
    nAnchor.anchoredNodes = [];
  }

  nNew = newValue ? this.thenNodes : this.elseNodes;

  // Append new nodes (if any) after anchor and store them as anchored nodes.
  if (nNew) {
    nTail = nAnchor.nextSibling;
    nNew = Array.isArray(nNew) ? nNew : [nNew];

    for (i = 0; i < nNew.length; i++) {
      n = appendableNode(nNew[i]);
      if (!n) { continue }

      insertBeforeWithAnchoredNodes(parentEl, n, nTail);
      nAnchor.anchoredNodes.push(n);
    }
  }

  // Remember updated value.
  this.lastValue = newValue;
}

function createMapAnchor(getFn) {
  var sep = arguments.length === 3 && arguments[1];
  var mapFn = arguments.length === 2 ? arguments[1] : arguments[2];

  return createBoundComment('map anchor', {
    get: getFn,
    map: mapFn,
    nSep: sep && appendableNode(sep),
    nSepPool: [],
    update: mapAnchorBindingUpdate,
  });
}

function Cursor() {}

Cursor.prototype.toString = function() { return String(this.index) };
Cursor.prototype.valueOf = function() { return this.index };

function mapAnchorBindingUpdate() {
  var self = this, i, j, n, meta, nFirst, nSep;
  var nAnchor = self.target, nTail, parentEl = nAnchor.parentNode, updatedNodes;
  var newArray = [].slice.call(self.get() || []), dirty = false;

  // Initialize to empty arrays/maps if this is the first execution.
  self.lastArray = self.lastArray || [];
  self.lastNodes = self.lastNodes || [];
  self.valueMap = self.valueMap || new Map();

  // Ensure anchoredNodes (if any) are really anchored to parentEl.
  // Other binding updates may have ejected them.
  if (
    nAnchor.anchoredNodes &&
    nAnchor.anchoredNodes.length &&
    nAnchor.anchoredNodes[0].parentNode !== parentEl
  ) {
    insertBeforeWithAnchoredNodes(
      parentEl, nAnchor.anchoredNodes, nAnchor.nextSibling);
  }

  for (i = 0; i < Math.max(self.lastArray.length, newArray.length); i++) {
    if (self.lastArray[i] !== newArray[i]) { dirty = true; break }
  }

  if (!dirty) { return }

  (nAnchor.anchoredNodes || []).forEach(function(n) { removeWithAnchoredNodes(n) });
  nTail = nAnchor.nextSibling;
  self.valueMap = new Map();

  updatedNodes = newArray.map(function(x, i) {
    meta = self.valueMap.get(x) || {};
    objAssign(meta.cursor = meta.cursor || new Cursor(), { index: i });
    n = meta.n;

    if (!n) {
      n = meta.n = self.map(x, meta.cursor);

      n = meta.n = !Array.isArray(n)
        ? appendableNode(n)
        : n.map(appendableNode).filter(Boolean);
    }

    insertBeforeWithAnchoredNodes(parentEl, n, nTail);
    self.valueMap.set(x, meta);
    return n;
  });

  // Remember updated array values and its associated nodes.
  self.lastArray = newArray;
  self.lastNodes = updatedNodes;

  // Copy updatedNodes so we can add separators as well to anchoredNodes,
  // without affecting updatedNodes/lastNodes.
  nAnchor.anchoredNodes = [].slice.call(updatedNodes);

  // Create/move separators into place.
  if (self.nSep) {
    for (i = 1, j = 0; i < updatedNodes.length; i++) {
      nSep = self.nSepPool[i - 1];
      if (!nSep) { nSep = self.nSep.cloneNode(true); self.nSepPool.push(nSep) }

      n = updatedNodes[i];
      nFirst = Array.isArray(n) ? n[0] : n;

      if (nFirst && nSep.nextSibling !== nFirst) {
        parentEl.insertBefore(nSep, nFirst);

        // j keeps track of the index drift between updatedNodes and
        // anchoredNodes caused by the insertion of previous separators.
        nAnchor.anchoredNodes.splice(i + j++, 0, nSep);
      }
    }

    // Remove unused separators from the document.
    for (; i < self.nSepPool.length; i++) {
      nSep = self.nSepPool[i];
      parentEl.removeChild(nSep);
    }

    // Truncate nSepPool (lets unused separators be garbage collected).
    self.nSepPool.length = Math.max(0, updatedNodes.length - 1);
  }

  nAnchor.anchoredNodes = flat(nAnchor.anchoredNodes, 10);
}

function createTextNode(getFn) {
  var n = document.createTextNode('');

  n.bindings = [new Binding({
    get: getFn,
    update: textNodeBindingUpdate,
    target: n,
  })];

  ieNodes && ieNodes.push(n);
  return n;
}

function textNodeBindingUpdate() {
  var newValue = this.get();

  // Convert nullish and boolean values to empty strings. Cast everything
  // else to string.
  if (nullish(newValue) || typeof newValue === 'boolean') { newValue = '' }
  else { newValue = String(newValue) }

  // If the value hasn't changed, do nothing.
  if (newValue === this.lastValue) { return }

  // Update node and remember updated value.
  this.lastValue = this.target.textContent = newValue;
}

function createPortalNode(getFn) {
  return createBoundComment('portal anchor', {
    get: getFn,
    update: portalAnchorBindingUpdate,
  });
}

function portalAnchorBindingUpdate() {
  var newValue = this.get();

  // If the value hasn't changed, do nothing.
  if (newValue === this.lastValue) { return }

  // Remove old node.
  this.lastValue && this.lastValue.remove();

  // Insert new one.
  newValue &&
    this.target.parentNode.insertBefore(newValue, this.target.nextSibling);

  // Remember updated value.
  this.lastValue = newValue;
}

function fromContext(n, k) {
  while (n) {
    if (n.context && n.context[k]) { return n.context[k] }
    n = n.parentNode;
  }
}

function forEachNodeWithBindings(ns, cb) {
  var queue = [].slice.call(ns), n;

  while (queue.length) {
    n = queue.shift();
    n.bindings && cb(n);
    if (n.childNodes) { [].unshift.apply(queue, n.childNodes) }
  }
}

function processMutations(muts, observer, di) {
  di = di || {};
  di.boundNodes = di.boundNodes || boundNodes;
  di.updateSync = di.updateSync || updateSync;
  di.console = di.console || console;

  var i, j, mut, n, b;
  var newNodes = [], orphanedNodes = [];

  // Collect newNodes.
  for (i = 0; i < muts.length; i++) {
    mut = muts[i];

    for (j = 0; j < mut.addedNodes.length; j++) {
      newNodes.push(mut.addedNodes[j]);
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
    if (i === -1) { return }

    di.boundNodes.splice(i, 1);

    for (i = 0; i < n.bindings.length; i++) {
      b = n.bindings[i];

      if (onDetachRegExp.test(b.key)) {
        try { b.handler(n) } catch (e) { di.console.error(e) }
        break;
      }
    }
  });

  // Recursively add boundNodes collected in the newNodes array.
  forEachNodeWithBindings(newNodes, function(n) {
    if (di.boundNodes.indexOf(n) !== -1) { return }

    di.boundNodes.push(n);

    for (i = 0; i < n.bindings.length; i++) {
      b = n.bindings[i];

      if (onAttachRegExp.test(b.key)) {
        try { b.handler(n) } catch (e) { di.console.error(e) }
        break;
      }
    }
  });

  di.updateSync();
}

var observer = typeof MutationObserver !== 'undefined' &&
  new MutationObserver(processMutations);

observer && observer.observe(document, { childList: true, subtree: true });

function childMacro(fn) {
  try {
    var ret = fn();

    if (nullish(ret) || ret instanceof Node || Array.isArray(ret)) {
      return ret;
    }
  } catch(err) {}

  return createTextNode(fn);
}

function resolve(x) { return typeof x === 'function' ? x() : x }

function update() {
  var p = window.Promise && new Promise(function(cb) {
    update.promiseCallbacks.push(cb);
  });

  if (update.frame) { return p }

  update.frame = requestAnimationFrame(function() {
    var i;

    updateSync();
    update.frame = null;

    for (i = 0; i < update.promiseCallbacks.length; i++) {
      try { update.promiseCallbacks[i]() } catch (e) { console.error(e) }
    }

    update.promiseCallbacks.length = 0;
  });

  return p;
}

update.promiseCallbacks = [];

function updateSync(di) {
  di = di || {};
  di.boundNodes = di.boundNodes || boundNodes;
  di.updateNode = di.updateNode || updateNode;
  di.evListeners = di.evListeners || evListeners;
  di.console = di.console || console;

  var i;

  for (i = 0; i < di.evListeners.beforeUpdate.length; i++) {
    try { di.evListeners.beforeUpdate[i]() } catch (e) { di.console.error(e) }
  }

  for (i = 0; i < di.boundNodes.length; i++) {
    di.updateNode(di.boundNodes[i], di);
  }

  for (i = 0; i < di.evListeners.update.length; i++) {
    try { di.evListeners.update[i]() } catch (e) { di.console.error(e) }
  }
}

function updateNode(n, di) {
  di = di || {};

  var i, b;

  // n.parentNode is a workaround for IE11's Node#contains not working on
  // non-Element nodes.
  if (!document.body || !document.body.contains(n.parentNode)) { return }

  for (i = 0; i < n.bindings.length; i++) {
    b = n.bindings[i];

    try {
      b.update && b.update();

      if (b.error) {
        if (--b.error.count <= 0) { clearError(b.error) }
        b.error = null;
      }
    } catch (e) {
      handleBindingError(e, b, di);
    }
  }
}

var errors = {};

function handleBindingError(e, binding, di) {
  di.console = di.console || console;

  var eDesc = e.toString();

  var eEntry = errors[eDesc] = errors[eDesc] || {
    firstInstance: e,
    count: 0,
    bindings: [],
  };

  if (eEntry.bindings.indexOf(binding) === -1) {
    eEntry.bindings.push(binding);
  }

  binding.error = eEntry;

  if (++eEntry.count === 1) {
    di.console.error(e);
    di.console.error('in', binding);
  }
}

function clearError(e) { delete errors[e.toString()] }

var evListeners = { beforeUpdate: [], update: [] };

function addEventListener(evName, fn) { evListeners[evName].push(fn) }

function removeEventListener(evName, fn) {
  var i = evListeners[evName].indexOf(fn);
  if (i !== -1) { evListeners[evName].splice(i, 1) }
}

objAssign(exports, {
  Binding: Binding,
  binding: createBinding,

  JsxFragment: JsxFragment,
  el: createElement,
  comment: createComment,
  child: childMacro,

  if: createIfAnchor,
  map: createMapAnchor,
  text: createTextNode,
  portal: createPortalNode,

  fromContext: fromContext,

  processMutations: processMutations,
  boundNodes: boundNodes,
  ieNodes: ieNodes,

  on: addEventListener,
  off: removeEventListener,
  evListeners: evListeners,

  resolve: resolve,
  update: update,
  updateSync: updateSync,
  updateNode: updateNode,

  errors: errors,
  handleBindingError: handleBindingError,
  clearError: clearError,
});

// General helpers:
function arrayify(x) { return Array.isArray(x) ? x : [x] }

// IE11 helpers:
function objAssign(a, b) {
  var k;

  for (k in b) {
    if (!b.hasOwnProperty(k)) { continue }
    a[k] = b[k];
  }

  return a;
}

function flat(xs, d) {
  if (d === undefined) { d = 1 }
  if (xs.flat) { return xs.flat(d) }

  return xs.reduce(function(acc, x) {
    return acc.concat(Array.isArray(x) ? (d > 0 ? flat(x, d - 1) : x) : x);
  }, []);
}

function flatMap(xs, fn) { return xs.flatMap ? xs.flatMap(fn) : flat(xs.map(fn)) }
