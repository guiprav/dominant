exports._arrayDiff = (a, b) => {
  let diffs = {
    moved: [],
    added: [],
    removed: [],
  };

  for (let [i, x] of a.entries()) {
    if (b[i] === x) {
      continue;
    }

    let newIndex = b.findIndex((y, j) => {
      if (y !== x) {
        return false;
      }

      return !diffs.moved.some(
        z => z.value === y && z.to !== j,
      );
    });

    if (newIndex === -1) {
      diffs.removed.push({ from: i });
      continue;
    }

    diffs.moved.push({
      value: x,
      from: i,
      to: newIndex,
    });
  }

  for (let [i, x] of b.entries()) {
    if (a[i] === x) {
      continue;
    }

    if (diffs.moved.some(y => y.value == x && y.to === i)) {
      continue;
    }

    diffs.added.push({
      value: x,
      to: i,
    });
  }
  
  if (Object.values(diffs).every(x => x.length === 0)) {
    return null;
  }

  return b.map((x, i) => {
    if (a[i] === x) {
      return { type: 'existing', from: i };
    }

    let moved = diffs.moved.find(y => y.to === i);

    return moved
      ? { type: 'existing', from: moved.from }
      : { type: 'new', value: x };
  });
};

exports.boundElements = new Set();

exports.bindArray = (el, { get, forEach }) => {
	let bindings = el.bindings = el.bindings || {};

  let anchorComment = document.createComment(' domArrayBindingAnchor ');

  let binding = bindings.array = {
    anchorComment,
    templateEl: el,
    lastEls: [],
    get,
    forEach,
  };

  anchorComment.binding = binding;

  el.parentElement.insertBefore(binding.anchorComment, el);
  el.remove();

  exports.boundElements.add(el);
  exports.update(el, { bindingType: 'array' });

  return el;
};

exports.bindClass = (el, fn) => {
	let bindings = el.bindings = el.bindings || {};

  let binding = bindings.class = bindings.class || {
    fns: [],
    lastValues: {},
  };

  binding.fns.unshift(fn);

  exports.boundElements.add(el);
  exports.update(el, { bindingType: 'class' });

  return el;
};

exports.bindPresence = (el, fn) => {
	let bindings = el.bindings = el.bindings || {};

  let anchorComment = document.createComment(' domPresenceBindingAnchor ');
  let binding = bindings.presence = { anchorComment, el, fn };

  anchorComment.binding = binding;

  el.parentElement.insertBefore(binding.anchorComment, el);

  exports.boundElements.add(el);
  exports.update(el, { bindingType: 'presence' });

  return el;
};

exports.bindTextContent = (el, fn) => {
	let bindings = el.bindings = el.bindings || {};
  let binding = bindings.textContent = { fn };

  exports.boundElements.add(el);
  exports.update(el, { bindingType: 'textContent' });

  return el;
};

exports.bindValue = (el, { get, set }) => {
	let bindings = el.bindings = el.bindings || {};
  let binding = bindings.value = bindings.value || {};

  if (set && binding.set) {
    el.removeEventListener('keyup', binding.keyupHandler);
  }

  binding.get = get || binding.get;
  binding.set = set || binding.set;

  exports.boundElements.add(el);
  exports.update(el, { bindingType: 'value' });

  if (set) {
    binding.keyupHandler = ev => set(ev.target.value);
    el.addEventListener('keyup', binding.keyupHandler);
  }

  return el;
};

exports.el = (tagName, ...args) => {
  let props;

  if (args[0] && args[0].constructor === Object) {
    props = args.shift();
  }

  let el = document.createElement(tagName);

  for (let [k, v] of Object.entries(props || {})) {
    if (k === 'class') {
      k = 'className';
    }

    if (k.startsWith('aria-') || k.startsWith('data-')) {
      el.setAttribute(k, v);
      continue;
    }

    el[k] = v;
  }

  el.append(...args.flat(10));

  return el;
};

exports.update = (el, { bindingType } = {}) => {
  if (!el) {
    for (let el of exports.boundElements) {
      exports.update(el);
    }

    return;
  }

  if (!bindingType) {
    for (let bindingType of Object.keys(el.bindings || {})) {
      exports.update(el, { bindingType });
    }

    return;
  }

  let binding = el.bindings[bindingType];

  if (!binding) {
    return;
  }

  exports.update[bindingType](el, binding);
};

exports.update.array = (el, binding) => {
  let newValues = [...binding.get()];
  let { lastValues } = binding;

  let diffs = exports._arrayDiff(lastValues || [], newValues);

  if (!diffs) {
    return;
  }

  const { lastEls } = binding;

  for (let el of lastEls) {
    el.remove();
  }

  let { anchorComment } = binding;

  let cursor = anchorComment;
  let parentEl = cursor.parentElement;
  let updatedEls = [];

  for (let diff of diffs) {
    switch (diff.type) {
      case 'new': {
        let newEl = binding.templateEl.cloneNode(true);

        binding.forEach(newEl, diff.value);

        parentEl.insertBefore(newEl, cursor.nextSibling);
        cursor = newEl;

        updatedEls.push(newEl);

        break;
      }

      case 'existing': {
        let el = lastEls[diff.from];

        parentEl.insertBefore(el, cursor.nextSibling);
        updatedEls.push(el);

        break;
      }
    }
  }

  binding.lastEls = updatedEls;
  binding.lastValues = newValues;
};

exports.update.class = (el, binding) => {
  let newValues = {};
  let { lastValues } = binding;

  for (let fn of binding.fns) {
    let ret = fn();

    for (let [k, v] of Object.entries(ret)) {
      if (!Object.keys(newValues).includes(k)) {
        newValues[k] = v;
      }
    }
  }

  for (let k of new Set([
    ...Object.keys(newValues),
    ...Object.keys(lastValues),
  ])) {
    let v = newValues[k];

    if (!Object.keys(lastValues).includes(k) || v !== lastValues[k]) {
      el.classList.toggle(k, v);
    }
  }

  binding.lastValues = newValues;
};

exports.update.presence = (el, binding) => {
  let newValue = binding.fn();
  let { anchorComment, lastValue } = binding;

  if (!Object.keys(binding).includes('lastValue') || newValue !== lastValue) {
    if (newValue) {
      if (!el.parentElement) {
        anchorComment.parentElement.insertBefore(
          el, anchorComment.nextSibling,
        );
      }
    } else {
      el.remove();
    }
  }

  binding.lastValue = newValue;
};

exports.update.textContent = (el, binding) => {
  let newValue = binding.fn();
  let { lastValue } = binding;

  if (newValue !== lastValue) {
    el.textContent = newValue;
  }

  binding.lastValue = newValue;
};

exports.update.value = (el, binding) => {
  let newValue = binding.get();
  let { lastValue } = binding;

  if (newValue !== lastValue) {
    el.value = newValue;
  }

  binding.lastValue = newValue;
};
