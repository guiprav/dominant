(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
module.exports = (a, b) => {
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

},{}],2:[function(require,module,exports){
window.dom = require('.');

window.shuffle = xs => {
  for (let i = xs.length - 1; i > 0; i--) {
    let j = Math.floor(Math.random() * (i + 1));
    [xs[i], xs[j]] = [xs[j], xs[i]];
  }

  return xs;
};

let TodoApp = () => {
  let state = {
    newItemLabel: '',
    activeTab: 'all',

    todos: [
      { label: 'Procrastinate for months', isDone: true },
      { label: 'Implement Dominant', isDone: false },
      { label: 'Add to the fatigue', isDone: false },
    ],

    get pending() {
      return state.todos.filter(x => !x.isDone);
    },

    get done() {
      return state.todos.filter(x => x.isDone);
    },

    get tabTodos() {
      switch (state.activeTab) {
        case 'all': return state.todos;
        case 'pending': return state.pending;
        case 'done': return state.done;
      }
    }
  };

  return dom.el('div', { state, class: 'todoApp' }, [
    dom.el('h1', document.title),

    dom.el('div', { class: 'todoApp-contentBox' }, [
      dom.el('input', {
        class: 'todoApp-newItemInput',
        placeholder: 'What next?',

        value: dom.binding({
          get: () => state.newItemLabel,
          set: x => state.newItemLabel = x,
        }),

        onKeyUp: ev => {
          if (ev.key === 'Enter') {
            state.todos.unshift({ label: state.newItemLabel, isDone: false });
            state.newItemLabel = '';
          }
        },
      }),

      dom.el('div', { class: 'todoApp-tabs' }, [
        dom.map(['all', 'pending', 'done'], key => {
          let label = { all: 'All', pending: 'Pending', done: 'Done' }[key];
          let arrayKey = { all: 'todos', pending: 'pending', done: 'done' }[key];

          return dom.el('a', {
            href: '#',

            class: dom.binding(() => ({
              'todoApp-tab': true,
              'todoApp-mActive': state.activeTab === key,
            })),

            onClick: ev => {
              ev.preventDefault();
              state.activeTab = key;
            },
          }, [
            dom.text(() => `${label} (${state[arrayKey].length})`),
          ]);
        }),
      ]),

      dom.el('div', { class: 'todoApp-todoList' }, dom.map(
        () => state.tabTodos, todo => dom.el('div', {
          class: dom.binding(() => ({
            todoListItem: true,
            'todoApp-mDone': todo.isDone,
          })),
        }, [
          dom.el('button', {
            class: 'todoListItem-toggle',
            onClick: () => todo.isDone = !todo.isDone,
          }, [
            dom.text(() => todo.isDone ? 'Undo' : 'Done'),
          ]),

          dom.if(
            () => todo.isEditing,

            dom.el('input', {
              class: 'todoListItem-input',

              value: dom.binding({
                get: () => todo.label,
                set: x => todo.label = x,
              }),

              onKeyUp: ev => {
                if (ev.key === 'Enter') {
                  todo.isEditing = false;
                }
              },
            }),

            dom.el('span', {
              class: 'todoListItem-label',

              onClick: () => {
                for (let todo of state.todos) {
                  todo.isEditing = false;
                }

                todo.isEditing = true;
              },

              textContent: dom.binding(() => todo.label),
            }),
          ),
        ]),
      )),

      dom.el('button', {
        class: 'todoApp-listClearBtn',
        onClick: () => state.todos = [],
      }, [
        'Clear',
      ]),

      dom.el('button', {
        class: 'todoApp-listShuffleBtn',
        onClick: () => shuffle(state.todos),
      }, [
        'Shuffle',
      ]),
    ]),
  ]);
};

addEventListener('DOMContentLoaded', () => {
  document.body.appendChild(window.todoApp = TodoApp());
});

},{".":3}],3:[function(require,module,exports){
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
    if (n.bindings) {
      attachNode(n);
    }

    if (n.nodeName === '#comment') {
      continue;
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

exports.update.if = (nAnchor, key, binding) => {
  let newValue = Boolean(binding.get());
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
        for (let n of Array.isArray(nNew) ? nNew : [nNew]) {
          parentEl.insertBefore(n, nAnchor.nextSibling);
          nAnchor.anchoredNodes.push(n);
        }
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

  for (let n of lastNodes || []) {
    exports.remove(n);
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

},{"./arrayDiff":1}]},{},[2]);
