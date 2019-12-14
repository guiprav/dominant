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

},{".":2}],2:[function(require,module,exports){
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

},{}]},{},[1]);
