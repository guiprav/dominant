(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
window.dom = require('.');

window.shuffle = xs => {
  for (let i = xs.length - 1; i > 0; i--) {
    let j = Math.floor(Math.random() * (i + 1));
    [xs[i], xs[j]] = [xs[j], xs[i]];
  }

  return xs;
};

let TodoApp = () => {
  let app = dom.el('div', { class: 'todoApp' }, [
    dom.el('h1', document.title),

    dom.el('div', { class: 'todoApp-contentBox' }, [
      dom.el('input', {
        class: 'todoApp-newItemInput',
        placeholder: 'What next?',
      }),

      dom.el('div', { class: 'todoApp-tabs' }, [
        ['all', 'pending', 'done'].map(
          x => dom.el('a', { class: 'todoApp-tab', key: x, href: '#' }),
        ),
      ]),

      dom.el('div', { class: 'todoApp-todoList' }, [
        dom.el('div', { class: 'todoListItem' }, [
          dom.el('button', { class: 'todoListItem-toggle' }),
          dom.el('input', { class: 'todoListItem-input' }),
          dom.el('span', { class: 'todoListItem-label' }),
        ]),
      ]),

      dom.el('button', { class: 'todoApp-listClearBtn' }, 'Clear'),
      dom.el('button', { class: 'todoApp-listShuffleBtn' }, 'Shuffle'),
    ]),
  ]);

  app.state = {
    newItemLabel: '',
    activeTab: 'all',

    todos: [
      { label: 'Procrastinate for months', isDone: true },
      { label: 'Implement Dominant', isDone: false },
      { label: 'Add to the fatigue', isDone: false },
    ],

    get pending() {
      return this.todos.filter(x => !x.isDone);
    },

    get done() {
      return this.todos.filter(x => x.isDone);
    },

    get tabTodos() {
      switch (this.activeTab) {
        case 'all': return this.todos;
        case 'pending': return this.pending;
        case 'done': return this.done;
      }
    }
  };

  let newItemInput = app.querySelector('.todoApp-newItemInput');

  dom.value(newItemInput, {
    get: () => app.state.newItemLabel,
    set: x => app.state.newItemLabel = x,
  });

  newItemInput.addEventListener('keyup', ev => {
    if (ev.key === 'Enter') {
      app.state.todos.unshift({
        label: app.state.newItemLabel,
        isDOne: false,
      });

      app.state.newItemLabel = '';

      dom.update();
    }
  });

  for (let tab of app.querySelectorAll('.todoApp-tab')) {
    let { key } = tab;

    let label = { all: 'All', pending: 'Pending', done: 'Done' }[key];
    let arrayKey = { all: 'todos', pending: 'pending', done: 'done' }[key];

    dom.props(tab, () => ({
      textContent: `${label} (${app.state[arrayKey].length})`,
    }));

    dom.class(tab, () => ({
      'todoApp-mActive': app.state.activeTab === key,
    }));

    tab.addEventListener('click', ev => {
      ev.preventDefault();

      app.state.activeTab = key;
      dom.update();
    });
  }

  dom.repeat(app.querySelector('.todoListItem'), {
    get: () => app.state.tabTodos,

    map: (todo, listItem) => {
      console.log({ todo, listItem });
      dom.class(listItem, () => ({ 'todoListItem-mDone': todo.isDone }));

      let toggle = listItem.querySelector('.todoListItem-toggle');

      dom.props(toggle, () => ({ textContent: todo.isDone ? 'Undo' : 'Done' }));

      toggle.addEventListener('click', () => {
        todo.isDone = !todo.isDone;
        dom.update();
      });

      let input = listItem.querySelector('.todoListItem-input');

      dom.presence(input, () => todo.isEditing);

      dom.value(input, {
        get: () => todo.label,
        set: x => todo.label = x,
      });

      input.addEventListener('keyup', ev => {
        if (ev.key === 'Enter') {
          todo.isEditing = false;
          dom.update();
        }
      });

      let label = listItem.querySelector('.todoListItem-label');

      label.addEventListener('click', () => {
        for (let todo of app.state.todos) {
          todo.isEditing = false;
        }

        todo.isEditing = true;
        dom.update();
      });

      dom.presence(label, () => !todo.isEditing);
      dom.props(label, () => ({ textContent: todo.label }));
    },
  });

  app.querySelector('.todoApp-listClearBtn').addEventListener('click', () => {
    app.state.todos = [];
    dom.update();
  });

  app.querySelector('.todoApp-listShuffleBtn').addEventListener('click', () => {
    shuffle(app.state.todos);
    dom.update();
  });

  return app;
};

addEventListener('DOMContentLoaded', () => {
  document.body.appendChild(window.todoApp = TodoApp());
});

},{".":2}],2:[function(require,module,exports){
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

exports.comment = text => document.createComment(
  ` ${text !== null && text !== undefined ? text : 'comment'} `,
);

exports.repeat = (el, { get, map }) => {
	let bindings = el.bindings = el.bindings || {};

  let anchorComment = document.createComment(' domCommentAnchor: arrayBinding ');

  anchorComment.anchoredElements = new Set([el]);

  let binding = bindings.repeat = {
    anchorComment,
    templateEl: el,
    lastEls: [],
    get,
    map,
  };

  anchorComment.binding = binding;

  // TODO: Don't attach anchorComment unless array is empty.
  el.parentElement.insertBefore(binding.anchorComment, el);

  el.anchorComment = anchorComment;
  el.remove();

  if (exports.contains(document.body, anchorComment)) {
    exports.boundElements.add(el);
  }

  exports.update(el, { bindingType: 'array' });

  return el;
};

exports.attrs = (el, fn) => {
	let bindings = el.bindings = el.bindings || {};

  let binding = bindings.attrs = bindings.attrs || {
    fns: [],
    lastValues: {},
  };

  binding.fns.unshift(fn);

  if (exports.contains(document.body, el)) {
    exports.boundElements.add(el);
  }

  exports.update(el, { bindingType: 'attrs' });

  return el;
};

exports.class = (el, fn) => {
	let bindings = el.bindings = el.bindings || {};

  let binding = bindings.class = bindings.class || {
    fns: [],
    lastValues: {},
  };

  binding.fns.unshift(fn);

  if (exports.contains(document.body, el)) {
    exports.boundElements.add(el);
  }

  exports.update(el, { bindingType: 'class' });

  return el;
};

exports.listener = (el, type, fn) => {
	let bindings = el.bindings = el.bindings || {};

  let binding = bindings.listeners = bindings.listeners || {
    attach: [],
    detach: [],
  };

  binding[type].push(fn);

  if (exports.contains(document.body, el)) {
    exports.boundElements.add(el);
  }

  return el;
};

exports.presence = (el, fn) => {
	let bindings = el.bindings = el.bindings || {};

  let anchorComment = document.createComment(' domCommentAnchor: presenceBinding ');

  anchorComment.anchoredElements = new Set([el]);

  let binding = bindings.presence = { anchorComment, el, fn };

  anchorComment.binding = binding;
  el.anchorComment = anchorComment;

  if (exports.contains(document.body, el)) {
    exports.boundElements.add(el);
  }

  exports.update(el, { bindingType: 'presence' });

  return el;
};

exports.props = (el, fn) => {
	let bindings = el.bindings = el.bindings || {};

  let binding = bindings.props = bindings.props || {
    fns: [],
    lastValues: {},
  };

  binding.fns.unshift(fn);

  if (exports.contains(document.body, el)) {
    exports.boundElements.add(el);
  }

  exports.update(el, { bindingType: 'props' });

  return el;
};

exports.resolve = x => typeof x === 'function' ? x() : x;

exports.style = (el, fn) => {
	let bindings = el.bindings = el.bindings || {};

  let binding = bindings.style = bindings.style || {
    fns: [],
    lastValues: {},
  };

  binding.fns.unshift(fn);

  if (exports.contains(document.body, el)) {
    exports.boundElements.add(el);
  }

  exports.update(el, { bindingType: 'style' });

  return el;
};

exports.value = (el, { get, set }) => {
	let bindings = el.bindings = el.bindings || {};
  let binding = bindings.value = bindings.value || {};

  if (set && binding.set) {
    el.removeEventListener('keyup', binding.keyupHandler);
  }

  binding.get = get || binding.get;
  binding.set = set || binding.set;

  if (set) {
    binding.keyupHandler = ev => {
      let x = ev.target.value;

      set(x);
      binding.lastValue = x;
    };

    el.addEventListener('keyup', binding.keyupHandler);
  }

  if (exports.contains(document.body, el)) {
    exports.boundElements.add(el);
  }

  exports.update(el, { bindingType: 'value' });

  return el;
};

exports.contains = (el, node) => {
  if (el.contains(node)) {
    return true;
  }

  let anchorCommentAncestors = [];
  let cursor = node;

  while (cursor) {
    let { anchorComment } = cursor;

    if (anchorComment) {
      anchorCommentAncestors.push(anchorComment);
    }

    cursor = cursor.parentNode;
  }

  return anchorCommentAncestors.some(x => el.contains(x));
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

exports.mutationObserver = new MutationObserver(muts => {
  let { body } = document;
  let { boundElements } = exports;

  let addedNodes = muts.map(x => [...x.addedNodes]).flat();
  let removedNodes = muts.map(x => [...x.removedNodes]).flat();

  let attachedNodes = addedNodes.filter(x => !removedNodes.includes(x));
  let detachedNodes = removedNodes.filter(x => !addedNodes.includes(x));

  if (detachedNodes.length) {
    for (let el of boundElements) {
      if (!exports.contains(body, el)) {
        boundElements.delete(el);

        let { listeners } = el.bindings;

        if (listeners && listeners.detach) {
          for (let fn of listeners.detach) {
            fn(el);
          }
        }
      }
    }
  }

  let attachedAnchorComments = new Set();

  let attachElement = el => {
    if (!boundElements.has(el)) {
      boundElements.add(el);
      exports.update(el);

      let { listeners } = el.bindings;

      if (listeners && listeners.attach) {
        for (let fn of listeners.attach) {
          fn(el);
        }
      }
    }
  };

  let findRelevantNodes = root => {
    if (root.bindings) {
      attachElement(root);
    }

    for (let n of root.childNodes) {
      if (n.anchoredElements) {
        attachedAnchorComments.add(n);
      }
    }

    for (let el of root.querySelectorAll('*')) {
      if (el.bindings) {
        attachElement(el);
      }

      for (let n of el.childNodes) {
        if (n.anchoredElements) {
          attachedAnchorComments.add(n);
        }
      }
    }
  };

  for (let node of attachedNodes) {
    if (node.anchoredElements) {
      attachedAnchorComments.add(node);
    }
    else
    if (node.querySelectorAll) {
      findRelevantNodes(node);
    }
  }

  while (attachedAnchorComments.size) {
    for (let anchorComment of attachedAnchorComments) {
      for (let el of anchorComment.anchoredElements) {
        findRelevantNodes(el);
      }

      attachedAnchorComments.delete(anchorComment);
    }
  }
});

addEventListener('DOMContentLoaded', () => {
  exports.mutationObserver.observe(document.body, {
    childList: true,
    subtree: true,
  });
});

exports.removeListener = (el, type, fn) => {
	let { bindings } = el;

  if (!bindings) {
    return el;
  }

  let binding = bindings.listeners;

  if (!binding) {
    return el;
  }

  let listenerFns = binding[type];

  if (!listenerFns) {
    return el;
  }

  let fnIndex = listenerFns.indexOf(fn);

  if (fnIndex === -1) {
    return el;
  }

  listenerFns.splice(fnIndex, 1);

  if (!binding.attach.length && !binding.detach.length) {
    delete bindings.listeners;
  }

  if (!Object.keys(bindings).length) {
    delete el.bindings;
    exports.boundElements.delete(el);
  }

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

exports.update.repeat = (el, binding) => {
  let newValues = [...binding.get() || []];
  let { lastValues } = binding;

  let diffs = exports._arrayDiff(lastValues || [], newValues);

  if (!diffs) {
    return;
  }

  let { anchorComment, lastEls } = binding;

  for (let el of lastEls) {
    anchorComment.anchoredElements.delete(el);
    el.remove();
  }

  let cursor = anchorComment;
  let parentEl = cursor.parentElement;
  let updatedEls = [];

  for (let diff of diffs) {
    switch (diff.type) {
      case 'new': {
        let clonedEl = binding.templateEl.cloneNode(true);
        let newEl = binding.map(diff.value, clonedEl);

        if (newEl === undefined) {
          newEl = clonedEl;
        }

        anchorComment.anchoredElements.add(newEl);
        newEl.templateElement = binding.templateEl;

        parentEl.insertBefore(newEl, cursor.nextSibling);
        cursor = newEl;

        updatedEls.push(newEl);

        break;
      }

      case 'existing': {
        let el = lastEls[diff.from];

        anchorComment.anchoredElements.add(el);

        parentEl.insertBefore(el, cursor.nextSibling);
        cursor = el;

        updatedEls.push(el);

        break;
      }
    }
  }

  binding.lastEls = updatedEls;
  binding.lastValues = newValues;
};

exports.update.attrs = (el, binding) => {
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
      if (v !== undefined && v !== null) {
        el.setAttribute(k, v);
      }
      else {
        el.removeAttribute(k);
      }
    }
  }

  binding.lastValues = newValues;
};

exports.update.class = (el, binding) => {
  let newValues = {};
  let { lastValues } = binding;

  for (let fn of binding.fns) {
    let ret = fn();

    for (let [k, v] of Object.entries(ret)) {
      if (!Object.keys(newValues).includes(k)) {
        newValues[k] = Boolean(v);
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

exports.update.listeners = () => null;

exports.update.presence = (el, binding) => {
  let newValue = binding.fn();
  let { anchorComment, lastValue } = binding;

  if (!Object.keys(binding).includes('lastValue') || newValue !== lastValue) {
    if (newValue) {
      if (!el.parentElement) {
        anchorComment.parentElement.insertBefore(
          el, anchorComment.nextSibling,
        );

        anchorComment.remove();
      }
    } else {
      if (el.parentElement) {
        el.parentElement.insertBefore(anchorComment, el);
        el.remove();
      }
    }
  }

  binding.lastValue = newValue;
};

exports.update.props = (el, binding) => {
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
      el[k] = v;
    }
  }

  binding.lastValues = newValues;
};

exports.update.style = (el, binding) => {
  let newValues = {};
  let { lastValues } = binding;

  for (let fn of binding.fns) {
    let ret = fn();

    for (let [k, v] of Object.entries(ret)) {
      if (!Object.keys(newValues).includes(k)) {
        newValues[k] = Boolean(v);
      }
    }
  }

  for (let k of new Set([
    ...Object.keys(newValues),
    ...Object.keys(lastValues),
  ])) {
    let v = newValues[k];

    if (!Object.keys(lastValues).includes(k) || v !== lastValues[k]) {
      el.style.setProperty(k, v);
    }
  }

  binding.lastValues = newValues;
};

exports.update.value = (el, binding) => {
  let newValue = binding.get();
  let { lastValue } = binding;

  if (newValue !== lastValue) {
    el.value = newValue;
  }

  binding.lastValue = newValue;
};

},{}]},{},[1]);
