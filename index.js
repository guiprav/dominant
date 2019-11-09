let arrayDiff = require('./arrayDiff');

exports.Binding = class Binding {
  constructor(x) {
    switch (typeof x) {
      case 'function':
        this.get = x;
        break;

      case 'object':
        Object.assign(this, x);
        break;

      default:
        throw new Error(`Unexpected binding argument type "${typeof x}"`);
    }
  }
};

exports.binding = (...args) => new exports.Binding(...args);

exports.boundNodes = new Set();

exports.comment = text => document.createComment(` ${text || 'comment'} `);

exports.el = (el, ...args) => {
  let props;

  if (args[0] && args[0].constructor === Object) {
    props = args.shift();
  }

  switch (typeof el) {
    case 'string':
      el = document.createElement(el);
      break;

    case 'function':
      el = el();
      break;

    default:
      break;
  }

  for (let [k, v] of Object.entries(props || {})) {
    if (v instanceof exports.Binding) {
      let elBindings = el.bindings = el.bindings || {};
      let propBindings = elBindings[k] = elBindings[k] || [];

      propBindings.push(v);
      continue;
    }

    if (k.startsWith('on')) {
      el.addEventListener(k.replace(/^on:?/, '').toLowerCase(), v);
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

    if (k === 'class') {
      k = 'className';
    }

    el[k] = v;
  }

  if (args.length) {
    el.innerHTML = '';
    el.append(...args.flat(10));
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
  let anchorComment = exports.comment('anchorComment: conditional');

  anchorComment.bindings = {
    conditional: [exports.binding({ get: predFn, thenNode, elseNode })],
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

  let boundNodesArray = [...boundNodes];

  let addedNodes = muts.map(x => [...x.addedNodes]).flat();

  let removedNodes = muts.map(x => [...x.removedNodes]).flat().filter(
    x => !addedNodes.includes(x),
  );

  let detachedBoundNodes = [];

  for (let n of removedNodes) {
    if (n.bindings) {
      detachedBoundNodes.push(n);
    }

    let detachedBoundChildNodes = boundNodesArray.filter(x => n.contains(x));
    detachedBoundNodes.push(...detachedBoundChildNodes);
  }

  for (let n of detachedBoundNodes) {
    boundNodes.delete(n);

    let { listeners } = n.bindings || {};

    if (listeners) {
      for (let fn of listeners.detach || []) {
        fn(n);
      }
    }
  }

  let attachNode = n => {
    if (boundNodes.has(n)) {
      return;
    }

    boundNodes.add(n);
    exports.update(n);
  };

  for (let n of addedNodes) {
    if (n.bindings) {
      attachNode(n);
    }

    if (n.nodeName === '#comment') {
      return;
    }

    for (
      let childComment of
      [...n.childNodes].filter(x => x.nodeName === '#comment')
    ) {
      if (childComment.bindings) {
        attachNode(childComment);
      }
    }

    if (n.querySelectorAll) {
      for (let el of n.querySelectorAll('*')) {
        if (el.bindings) {
          attachNode(el);
        }

        for (
          let childComment of
          [...el.childNodes].filter(x => x.nodeName === '#comment')
        ) {
          if (childComment.bindings) {
            attachNode(childComment);
          }
        }
      }
    }
  }
});

exports.mutationObserver.observe(document, {
  childList: true,
  subtree: true,
});

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

exports.update.class = (el, propName, binding) => {
  let newValues = {};
  let { lastValues = {} } = binding;

  for (let [k, v] of Object.entries(binding.get())) {
    newValues[k] = Boolean(v);
  }

  for (let k of new Set([
    ...Object.keys(lastValues),
    ...Object.keys(newValues),
  ])) {
    let v = newValues[k];

    if (v !== lastValues[k]) {
      el.classList.toggle(k, v);
    }
  }

  binding.lastValues = newValues;
};

exports.update.conditional = (el, key, binding) => {
  let newValue = Boolean(binding.get());
  let { lastValue } = binding;

  if (lastValue === undefined || newValue !== lastValue) {
    let parentEl = el.parentElement;

    if (parentEl) {
      let nNew = newValue ? binding.thenNode : binding.elseNode;
      let nOld = newValue ? binding.elseNode : binding.thenNode;

      if (nNew) {
        parentEl.insertBefore(nNew, el.nextSibling);
      }

      if (nOld) {
        nOld.remove();
      }
    }
  }

  binding.lastValue = newValue;
};

exports.update.map = (anchorComment, key, binding) => {
  let newArray = [...binding.get() || []];
  let { lastArray, lastNodes } = binding;

  let diffs = arrayDiff(lastArray || [], newArray);

  if (!diffs) {
    return;
  }

  for (let el of lastNodes || []) {
    el.remove();
  }

  let cursor = anchorComment;
  let parentEl = anchorComment.parentElement;
  let updatedNodes = [];

  for (let diff of diffs) {
    switch (diff.type) {
      case 'new': {
        let nNew = binding.fn(diff.value);

        parentEl.insertBefore(nNew, cursor.nextSibling);
        cursor = nNew;

        updatedNodes.push(nNew);
        break;
      }

      case 'existing': {
        let nExisting = lastNodes[diff.from];

        parentEl.insertBefore(nExisting, cursor.nextSibling);
        cursor = nExisting;

        updatedNodes.push(nExisting);
        break;
      }
    }
  }

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
      if (v === undefined || v === null) {
        el.style.removeProperty(k);
      }
      else {
        el.style.setProperty(k, v);
      }
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
        n.remove();
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

        for (let n of Array.isArray(nNew) ? nNew : [nNew]) {
          parentEl.insertBefore(n, nAnchor.nextSibling);
          nAnchor.anchoredNodes.push(n);
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
