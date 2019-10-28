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

exports.el = (tagNameOrEl, ...args) => {
  let props;

  if (args[0] && args[0].constructor === Object) {
    props = args.shift();
  }

  let el = tagNameOrEl instanceof Element
    ? tagNameOrEl
    : document.createElement(tagNameOrEl);

  for (let [k, v] of Object.entries(props || {})) {
    if (v instanceof exports.Binding) {
      let elBindings = el.bindings = el.bindings || {};
      let propBindings = elBindings[k] = elBindings[k] || [];

      propBindings.push(v);
      continue;
    }

    if (k.startsWith('aria-') || k.startsWith('data-')) {
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

exports.comment = text => document.createComment(` ${text || 'comment'} `);

exports.if = (predFn, thenNode, elseNode) => {
  let anchorComment = exports.comment('anchorComment: conditional');

  anchorComment.bindings = {
    conditional: [dom.binding({
      get: predFn,
      thenNode,
      elseNode,
    })],
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
    console.log('attached:', n);
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
});

addEventListener('DOMContentLoaded', () => {
  exports.mutationObserver.observe(document.body, {
    childList: true,
    subtree: true,
  });
});

exports.resolve = x => typeof x === 'function' ? x() : x;

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

exports.update.otherProps = (el, propName, binding) => {
  let newValue = binding.get();
  let { lastValue } = binding;

  if (newValue !== lastValue) {
    if (propName.startsWith('aria-') || propName.startsWith('data-')) {
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

exports.update.value = (el, propName, binding) => {
  if (!binding.setHandler) {
    el.addEventListener('keyup', binding.setHandler = ev => {
      let x = ev.target.value;
      binding.lastValue = binding.set ? binding.set(x) : x;
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
