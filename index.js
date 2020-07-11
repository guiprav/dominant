exports.Binding = class Binding {
  constructor(x) {
    if (typeof x === 'object' && !Array.isArray(x)) {
      Object.assign(this, x);
    }
    else {
      this.get = x;
    }
  }
};

exports.Component = class Component {
  render() {
    throw new Error(`${this.constructor.name} does not implement render`);
  }
};

exports.binding = (...args) => new exports.Binding(...args);

exports.boundNodes = new Set();

exports.comment = text => document.createComment(` ${text || 'comment'} `);

exports.el = (el, ...args) => {
  let props = {};

  if (args[0] === null || (args[0] && args[0].constructor === Object)) {
    props = args.shift() || {};
  }

  if (args.length === 1 && Array.isArray(args[0])) {
    props.children = args.shift();
  }
  else {
    props.children = args;
  }

  let { children } = props;

  switch (typeof el) {
    case 'string':
      el = document.createElement(el);
      break;

    case 'function':
      if (el.prototype instanceof exports.Component) {
        return new el(props).render();
      }

      return el(props);

    default:
      break;
  }

  for (let [k, v] of Object.entries(props || {})) {
    if (k === 'children') {
      continue;
    }

    let isEventListenerKey = k.startsWith('on');

    if (!isEventListenerKey && v instanceof Function) {
      v = new exports.Binding(v);
    }

    if (v instanceof exports.Binding) {
      let elBindings = el.bindings = el.bindings || {};
      let propBindings = elBindings[k] = elBindings[k] || [];

      propBindings.push(v);
      continue;
    }

    if (isEventListenerKey) {
      let evName = k.replace(/^on:?/, '').toLowerCase();

      if (['attach', 'detach'].includes(evName)) {
        let bindingKey = `${evName}Listeners`;

        let elBindings = el.bindings = el.bindings || {};
        let listenerBindings = elBindings[bindingKey] = elBindings[bindingKey] || [];

        listenerBindings.push(exports.binding({
          dispatch: (...args) => {
            v(...args);
            exports.update();
          },
        }));
      }
      else {
        el.addEventListener(evName, ev => {
          v(ev);
          exports.update();
        });
      }

      continue;
    }

    if (
      k.startsWith('aria-') ||
      k.startsWith('data-') ||
      el.tagName.toUpperCase() === 'SVG'
    ) {
      el.setAttribute(k, v);
      continue;
    }

    if (k === 'style') {
      if (typeof v !== 'object') {
        el.style = v;
        continue;
      }

      for (let [k2, v2] of Object.entries(v)) {
        el.style[k2] = v2;
      }

      continue;
    }

    if (k === 'class') {
      if (Array.isArray(v)) {
        let bindingFns = [];

        for (let x of v) {
          if (x instanceof Function) {
            bindingFns.push(x);
          }
          else if (x) {
            el.classList.add(...String(x).split(/ |\r|\n/).filter(Boolean));
          }
        }

        if (bindingFns.length) {
          let binding = new exports.Binding(bindingFns);

          let elBindings = el.bindings = el.bindings || {};
          let propBindings = elBindings[k] = elBindings[k] || [];

          propBindings.push(binding);
        }

        continue;
      }

      k = 'className';
    }

    el[k] = v;
  }

  if (children.length) {
    el.innerHTML = '';
    el.append(...children.flat(10));
  }

  if (el.bindings && document.body.contains(el)) {
    exports.update(el);
    exports.boundNodes.add(el);
  }

  return el;
};

exports.html = html => {
  let wrapper = exports.el('div');

  wrapper.innerHTML = html.trim();

  switch (wrapper.childNodes.length) {
    case 0:
      return null;

    case 1:
      return wrapper.childNodes[0];

    default:
      return [...wrapper.childNodes];
  }
};

exports.if = (predFn, thenNode, elseNode) => {
  let anchorComment = exports.comment('anchorComment: if');

  anchorComment.bindings = {
    if: [exports.binding({ get: predFn, thenNode, elseNode })],
  };

  return anchorComment;
};

exports.map = (array, fn) => {
  let anchorComment = exports.comment('anchorComment: map');

  anchorComment.bindings = {
    map: [exports.binding({ get: () => exports.resolve(array), fn })],
  };

  return anchorComment;
};

exports.mutationObserver = new MutationObserver(muts => {
  let { body } = document;
  let { boundNodes } = exports;

  let addedNodes = muts.map(x => [...x.addedNodes]).flat();

  let removedNodes = muts.map(x => [...x.removedNodes]).flat().filter(
    x => !addedNodes.includes(x),
  );

  let detachedBoundNodes = [];

  for (let n of removedNodes) {
    if (n.bindings) {
      detachedBoundNodes.push(n);
    }

    let walker = document.createTreeWalker(
      n,
      NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_COMMENT,
    );

    while (walker.nextNode()) {
      let n2 = walker.currentNode;
      n2.bindings && detachedBoundNodes.push(n2);
    }
  }

  for (let n of detachedBoundNodes) {
    boundNodes.delete(n);

    for (let binding of n.bindings.detachListeners || []) {
      binding.dispatch(n);
    }
  }

  let attachNode = n => {
    if (boundNodes.has(n)) {
      return;
    }

    boundNodes.add(n);
    exports.update(n);

    for (let binding of n.bindings.attachListeners || []) {
      binding.dispatch(n);
    }
  };

  for (let n of addedNodes) {
    n.bindings && attachNode(n);

    let walker = document.createTreeWalker(
      n,
      NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_COMMENT,
    );

    while (walker.nextNode()) {
      let n2 = walker.currentNode;
      n2.bindings && attachNode(n2);
    }
  }
});

exports.mutationObserver.observe(document, {
  childList: true,
  subtree: true,
});

exports.remove = n => {
  for (let nAnchored of n.anchoredNodes || []) {
    exports.remove(nAnchored);
  }

  n.remove();
};

exports.resolve = x => typeof x === 'function' ? x() : x;

exports.switch = (fn, cases) => {
  let anchorComment = exports.comment('anchorComment: switch');

  anchorComment.bindings = {
    switch: [exports.binding({ get: fn, cases })],
  };

  return anchorComment;
};

exports.text = fn => {
  let anchorComment = exports.comment('anchorComment: text');

  anchorComment.bindings = {
    text: [exports.binding({ get: fn })],
  };

  return anchorComment;
};

exports.update = (n, key, binding) => {
  if (!n) {
    for (let n of exports.boundNodes) {
      exports.update(n);
    }

    return;
  }

  if (!key) {
    for (let key of Object.keys(n.bindings || {})) {
      exports.update(n, key);
    }

    return;
  }

  if (!binding) {
    for (let binding of n.bindings[key] || []) {
      exports.update(n, key, binding);
    }

    return;
  }

  let updateFn = exports.update[key] || exports.update.otherProps;
  updateFn(n, key, binding);
};

exports.update.attachListeners = () => null;
exports.update.detachListeners = () => null;

exports.update.class = (el, propName, binding) => {
  let newValues = Array.isArray(binding.get)
    ? binding.get.flatMap(x => x())
    : binding.get();

  let { lastValues = [] } = binding;

  if (typeof newValues === 'string') {
    newValues = [newValues];
  }

  newValues = newValues
    .flatMap(x => x && String(x).split(/ |\r|\n/))
    .filter(Boolean);

  for (let x of lastValues) {
    if (!newValues.includes(x)) {
      el.classList.remove(x);
    }
  }

  for (let x of newValues) {
    if (!lastValues.includes(x)) {
      el.classList.add(x);
    }
  }

  binding.lastValues = newValues;
};

exports.update.if = (nAnchor, key, binding) => {
  let newValue = Boolean(exports.resolve(binding.get));
  let { lastValue } = binding;

  if (lastValue === undefined || newValue !== lastValue) {
    let parentEl = nAnchor.parentElement;

    if (parentEl) {
      for (let n of nAnchor.anchoredNodes || []) {
        exports.remove(n);
      }

      nAnchor.anchoredNodes = [];

      let nNew = newValue ? binding.thenNode : binding.elseNode;

      if (nNew) {
        let nCursor = nAnchor;

        for (let n of Array.isArray(nNew) ? nNew : [nNew]) {
          if (!(n instanceof Node)) {
            n = document.createTextNode(n);
          }

          parentEl.insertBefore(n, nCursor.nextSibling);
          nAnchor.anchoredNodes.push(n);

          nCursor = n;

          for (let nAnchored of n.anchoredNodes || []) {
            parentEl.insertBefore(nAnchored, nCursor.nextSibling);
            nCursor = nAnchored;
          }
        }
      }
    }
  }

  binding.lastValue = newValue;
};

exports.update.map = (anchorComment, key, binding) => {
  let newArray = [...binding.get() || []];
  let { lastArray, lastNodes } = binding;

  lastArray = lastArray || [];
  lastNodes = lastNodes || [];

  let valueMap = new Map();

  for (let i = 0; i < Math.max(lastArray.length, newArray.length); ++i) {
    let xLast = lastArray[i];
    let xNew = newArray[i];

    if (xLast === xNew) {
      valueMap.set(xLast, { iLast: i, iNew: i, n: lastNodes[i] });
      continue;
    }

    if (i < lastArray.length) {
      let metaLast = valueMap.get(xLast) || {};
      valueMap.set(xLast, { ...metaLast, iLast: i, n: lastNodes[i] });
    }

    if (i < newArray.length) {
      let metaNew = valueMap.get(xNew) || {};
      valueMap.set(xNew, { ...metaNew, iNew: i });
    }
  }

  let parentEl = anchorComment.parentElement;
  let tail = lastNodes.length ? lastNodes[lastNodes.length - 1].nextSibling : anchorComment.nextSibling;
  let updatedNodes = [...lastNodes];

  for (let [x, { iNew, iLast, n }] of valueMap) {
    let nextSibling = updatedNodes[iNew] || tail;

    if (!n) {
      n = binding.fn(x);

      if (!(n instanceof Node)) {
        n = document.createTextNode(n);
      }

      parentEl.insertBefore(n, nextSibling);
      updatedNodes.splice(iNew, 0, n);

      continue;
    }

    if (iNew === undefined) {
      n.remove();
      updatedNodes = updatedNodes.filter(n2 => n2 !== n);

      continue;
    }

    if (iLast !== iNew && n !== nextSibling) {
      parentEl.insertBefore(n, nextSibling);

      updatedNodes = [];

      for (let n2 = anchorComment.nextSibling; n2 !== tail; n2 = n2.nextSibling) {
        updatedNodes.push(n2);
      }
    }
  }

  anchorComment.anchoredNodes = [...updatedNodes];

  binding.lastArray = newArray;
  binding.lastNodes = updatedNodes;
};

exports.update.otherProps = (el, propName, binding) => {
  let newValue = binding.get();
  let { lastValue } = binding;

  if (newValue !== lastValue) {
    if (
      propName.startsWith('aria-') ||
      propName.startsWith('data-') ||
      el.tagName.toUpperCase() === 'SVG'
    ) {
      if (newValue === undefined || newValue === null) {
        el.removeAttribute(propName);
      }
      else {
        el.setAttribute(propName, newValue);
      }
    }
    else {
      el[propName] = newValue;
    }
  }

  binding.lastValue = newValue;
};

exports.update.style = (el, propName, binding) => {
  let newValues = binding.get();
  let { lastValues = {} } = binding;

  for (let k of new Set([
    ...Object.keys(lastValues),
    ...Object.keys(newValues),
  ])) {
    let v = newValues[k];

    if (v !== lastValues[k]) {
      el.style[k] = v !== undefined && v !== null ? v : '';
    }
  }

  binding.lastValues = newValues;
};

exports.update.switch = (nAnchor, key, binding) => {
  let newValue = binding.get();
  let { lastValue } = binding;

  if (lastValue === undefined || newValue !== lastValue) {
    let parentEl = nAnchor.parentElement;

    if (parentEl) {
      for (let n of nAnchor.anchoredNodes || []) {
        exports.remove(n);
      }

      nAnchor.anchoredNodes = [];

      let cases = exports.resolve(binding.cases);

      if (!Array.isArray(cases)) {
        cases = Object.entries(cases).map(
          ([k, v]) => ({ case: k, then: v }),
        );
      }

      let matchingCase = cases.find(x => x.case === newValue);

      if (matchingCase) {
        let nNew = exports.resolve(matchingCase.then);
        let nCursor = nAnchor;

        for (let n of Array.isArray(nNew) ? nNew : [nNew]) {
          if (!(n instanceof Node)) {
            n = document.createTextNode(n);
          }

          parentEl.insertBefore(n, nCursor.nextSibling);
          nAnchor.anchoredNodes.push(n);

          nCursor = n;
        }
      }
    }
  }

  binding.lastValue = newValue;
};

exports.update.text = (n, key, binding) => {
  let newValue = binding.get();

  let newText = newValue !== undefined && newValue !== null
    ? String(newValue)
    : '';

  let { lastText } = binding;

  if (newText !== lastText) {
    if (binding.textNode) {
      binding.textNode.remove();
    }

    n.parentElement.insertBefore(
      binding.textNode = document.createTextNode(newText),
      n.nextSibling,
    );
  }

  binding.lastText = newText;
};

exports.update.value = (el, propName, binding) => {
  if (!binding.setHandler) {
    el.addEventListener('keyup', binding.setHandler = ev => {
      let x = ev.target.value;
      binding.lastValue = binding.set ? binding.set(x) : x;

      exports.update();
    });
  }

  if (binding.get) {
    let newValue = binding.get();
    let { lastValue } = binding;

    if (newValue !== lastValue) {
      el.value = newValue;
    }

    binding.lastValue = newValue;
  }
};
