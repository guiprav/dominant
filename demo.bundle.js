(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
window.dom = require('.');
window.h = require('hyperscript');

let TodoApp = () => {
  let app = h('.todoApp', [
    h('.todoApp-heading', 'Dominance To-Do Demo'),

    h('.todoApp-contentBox', [
      h('input.todoApp-newItemInput', {
        placeholder: 'What next?',
      }),

      h('.todoApp-tabs', [
        ['all', 'pending', 'done'].map(
          x => h('.todoApp-tab', { key: x }),
        ),
      ]),

      h('.todoApp-todoList', [
        h('.todoListItem', [
          h('button.todoListItem-toggle'),
          h('input.todoListItem-input'),
          h('span.todoListItem-label'),
        ]),
      ]),
    ]),
  ]);

  app.state = {
    newItemLabel: '',
    activeTab: 'all',

    todos: [
      { label: 'Procrastinate for months', isDone: true },
      { label: 'Implement Dominance', isDone: false },
      { label: 'Add to the fatigue', isDone: false },
    ],
  };

  dom.bindValue(app.querySelector('.todoApp-newItemInput'), {
    get: () => app.state.newItemLabel,
    set: x => app.state.newItemLabel = x,
  });

  for (let tab of app.querySelectorAll('.todoApp-tab')) {
    let { key } = tab;

    dom.bindClass(tab, () => ({
      'todoApp-mActive': app.state.activeTab === key,
    }));
  }

  dom.bindArray(app.querySelector('.todoListItem'), {
    get: () => app.state.todos,

    forEach: (listItem, todo) => {
      let toggle = listItem.querySelector('.todoListItem-toggle');

      dom.bindTextContent(toggle, () => todo.isDone ? 'Undo' : 'Done');

      toggle.addEventListener('click', () => {
        todo.isDone = !todo.isDone;
        dom.update();
      });

      let input = listItem.querySelector('.todoListItem-input');

      //dom.bindPresence(input, () => todo.isEditing);

      dom.bindValue(input, {
        get: () => todo.label,
        set: x => todo.label = x,
      });

      let label = listItem.querySelector('.todoListItem-label');

      //dom.bindPresence(label, () => todo.isEditing);
      dom.bindTextContent(label, () => todo.label);
    },
  });

  return app;
};

addEventListener('DOMContentLoaded', () => {
  document.body.appendChild(window.todoApp = TodoApp());
});

},{".":2,"hyperscript":6}],2:[function(require,module,exports){
exports.arrayDiff = (a, b) => {
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
  let newValues = binding.get();
  let { lastValues } = binding;

  let diffs = exports.arrayDiff(lastValues || [], newValues);

  if (!diffs) {
    return;
  }
  console.log(diffs);

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

    if (v !== lastValues[k]) {
      el.classList.toggle(k, v);
    }
  }

  binding.lastValues = newValues;
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

},{}],3:[function(require,module,exports){

},{}],4:[function(require,module,exports){
/*!
 * Cross-Browser Split 1.1.1
 * Copyright 2007-2012 Steven Levithan <stevenlevithan.com>
 * Available under the MIT License
 * ECMAScript compliant, uniform cross-browser split method
 */

/**
 * Splits a string into an array of strings using a regex or string separator. Matches of the
 * separator are not included in the result array. However, if `separator` is a regex that contains
 * capturing groups, backreferences are spliced into the result each time `separator` is matched.
 * Fixes browser bugs compared to the native `String.prototype.split` and can be used reliably
 * cross-browser.
 * @param {String} str String to split.
 * @param {RegExp|String} separator Regex or string to use for separating the string.
 * @param {Number} [limit] Maximum number of items to include in the result array.
 * @returns {Array} Array of substrings.
 * @example
 *
 * // Basic use
 * split('a b c d', ' ');
 * // -> ['a', 'b', 'c', 'd']
 *
 * // With limit
 * split('a b c d', ' ', 2);
 * // -> ['a', 'b']
 *
 * // Backreferences in result array
 * split('..word1 word2..', /([a-z]+)(\d+)/i);
 * // -> ['..', 'word', '1', ' ', 'word', '2', '..']
 */
module.exports = (function split(undef) {

  var nativeSplit = String.prototype.split,
    compliantExecNpcg = /()??/.exec("")[1] === undef,
    // NPCG: nonparticipating capturing group
    self;

  self = function(str, separator, limit) {
    // If `separator` is not a regex, use `nativeSplit`
    if (Object.prototype.toString.call(separator) !== "[object RegExp]") {
      return nativeSplit.call(str, separator, limit);
    }
    var output = [],
      flags = (separator.ignoreCase ? "i" : "") + (separator.multiline ? "m" : "") + (separator.extended ? "x" : "") + // Proposed for ES6
      (separator.sticky ? "y" : ""),
      // Firefox 3+
      lastLastIndex = 0,
      // Make `global` and avoid `lastIndex` issues by working with a copy
      separator = new RegExp(separator.source, flags + "g"),
      separator2, match, lastIndex, lastLength;
    str += ""; // Type-convert
    if (!compliantExecNpcg) {
      // Doesn't need flags gy, but they don't hurt
      separator2 = new RegExp("^" + separator.source + "$(?!\\s)", flags);
    }
    /* Values for `limit`, per the spec:
     * If undefined: 4294967295 // Math.pow(2, 32) - 1
     * If 0, Infinity, or NaN: 0
     * If positive number: limit = Math.floor(limit); if (limit > 4294967295) limit -= 4294967296;
     * If negative number: 4294967296 - Math.floor(Math.abs(limit))
     * If other: Type-convert, then use the above rules
     */
    limit = limit === undef ? -1 >>> 0 : // Math.pow(2, 32) - 1
    limit >>> 0; // ToUint32(limit)
    while (match = separator.exec(str)) {
      // `separator.lastIndex` is not reliable cross-browser
      lastIndex = match.index + match[0].length;
      if (lastIndex > lastLastIndex) {
        output.push(str.slice(lastLastIndex, match.index));
        // Fix browsers whose `exec` methods don't consistently return `undefined` for
        // nonparticipating capturing groups
        if (!compliantExecNpcg && match.length > 1) {
          match[0].replace(separator2, function() {
            for (var i = 1; i < arguments.length - 2; i++) {
              if (arguments[i] === undef) {
                match[i] = undef;
              }
            }
          });
        }
        if (match.length > 1 && match.index < str.length) {
          Array.prototype.push.apply(output, match.slice(1));
        }
        lastLength = match[0].length;
        lastLastIndex = lastIndex;
        if (output.length >= limit) {
          break;
        }
      }
      if (separator.lastIndex === match.index) {
        separator.lastIndex++; // Avoid an infinite loop
      }
    }
    if (lastLastIndex === str.length) {
      if (lastLength || !separator.test("")) {
        output.push("");
      }
    } else {
      output.push(str.slice(lastLastIndex));
    }
    return output.length > limit ? output.slice(0, limit) : output;
  };

  return self;
})();

},{}],5:[function(require,module,exports){
// contains, add, remove, toggle
var indexof = require('indexof')

module.exports = ClassList

function ClassList(elem) {
    var cl = elem.classList

    if (cl) {
        return cl
    }

    var classList = {
        add: add
        , remove: remove
        , contains: contains
        , toggle: toggle
        , toString: $toString
        , length: 0
        , item: item
    }

    return classList

    function add(token) {
        var list = getTokens()
        if (indexof(list, token) > -1) {
            return
        }
        list.push(token)
        setTokens(list)
    }

    function remove(token) {
        var list = getTokens()
            , index = indexof(list, token)

        if (index === -1) {
            return
        }

        list.splice(index, 1)
        setTokens(list)
    }

    function contains(token) {
        return indexof(getTokens(), token) > -1
    }

    function toggle(token) {
        if (contains(token)) {
            remove(token)
            return false
        } else {
            add(token)
            return true
        }
    }

    function $toString() {
        return elem.className
    }

    function item(index) {
        var tokens = getTokens()
        return tokens[index] || null
    }

    function getTokens() {
        var className = elem.className

        return filter(className.split(" "), isTruthy)
    }

    function setTokens(list) {
        var length = list.length

        elem.className = list.join(" ")
        classList.length = length

        for (var i = 0; i < list.length; i++) {
            classList[i] = list[i]
        }

        delete list[length]
    }
}

function filter (arr, fn) {
    var ret = []
    for (var i = 0; i < arr.length; i++) {
        if (fn(arr[i])) ret.push(arr[i])
    }
    return ret
}

function isTruthy(value) {
    return !!value
}

},{"indexof":7}],6:[function(require,module,exports){
var split = require('browser-split')
var ClassList = require('class-list')

var w = typeof window === 'undefined' ? require('html-element') : window
var document = w.document
var Text = w.Text

function context () {

  var cleanupFuncs = []

  function h() {
    var args = [].slice.call(arguments), e = null
    function item (l) {
      var r
      function parseClass (string) {
        // Our minimal parser doesn’t understand escaping CSS special
        // characters like `#`. Don’t use them. More reading:
        // https://mathiasbynens.be/notes/css-escapes .

        var m = split(string, /([\.#]?[^\s#.]+)/)
        if(/^\.|#/.test(m[1]))
          e = document.createElement('div')
        forEach(m, function (v) {
          var s = v.substring(1,v.length)
          if(!v) return
          if(!e)
            e = document.createElement(v)
          else if (v[0] === '.')
            ClassList(e).add(s)
          else if (v[0] === '#')
            e.setAttribute('id', s)
        })
      }

      if(l == null)
        ;
      else if('string' === typeof l) {
        if(!e)
          parseClass(l)
        else
          e.appendChild(r = document.createTextNode(l))
      }
      else if('number' === typeof l
        || 'boolean' === typeof l
        || l instanceof Date
        || l instanceof RegExp ) {
          e.appendChild(r = document.createTextNode(l.toString()))
      }
      //there might be a better way to handle this...
      else if (isArray(l))
        forEach(l, item)
      else if(isNode(l))
        e.appendChild(r = l)
      else if(l instanceof Text)
        e.appendChild(r = l)
      else if ('object' === typeof l) {
        for (var k in l) {
          if('function' === typeof l[k]) {
            if(/^on\w+/.test(k)) {
              (function (k, l) { // capture k, l in the closure
                if (e.addEventListener){
                  e.addEventListener(k.substring(2), l[k], false)
                  cleanupFuncs.push(function(){
                    e.removeEventListener(k.substring(2), l[k], false)
                  })
                }else{
                  e.attachEvent(k, l[k])
                  cleanupFuncs.push(function(){
                    e.detachEvent(k, l[k])
                  })
                }
              })(k, l)
            } else {
              // observable
              e[k] = l[k]()
              cleanupFuncs.push(l[k](function (v) {
                e[k] = v
              }))
            }
          }
          else if(k === 'style') {
            if('string' === typeof l[k]) {
              e.style.cssText = l[k]
            }else{
              for (var s in l[k]) (function(s, v) {
                if('function' === typeof v) {
                  // observable
                  e.style.setProperty(s, v())
                  cleanupFuncs.push(v(function (val) {
                    e.style.setProperty(s, val)
                  }))
                } else
                  var match = l[k][s].match(/(.*)\W+!important\W*$/);
                  if (match) {
                    e.style.setProperty(s, match[1], 'important')
                  } else {
                    e.style.setProperty(s, l[k][s])
                  }
              })(s, l[k][s])
            }
          } else if(k === 'attrs') {
            for (var v in l[k]) {
              e.setAttribute(v, l[k][v])
            }
          }
          else if (k.substr(0, 5) === "data-") {
            e.setAttribute(k, l[k])
          } else {
            e[k] = l[k]
          }
        }
      } else if ('function' === typeof l) {
        //assume it's an observable!
        var v = l()
        e.appendChild(r = isNode(v) ? v : document.createTextNode(v))

        cleanupFuncs.push(l(function (v) {
          if(isNode(v) && r.parentElement)
            r.parentElement.replaceChild(v, r), r = v
          else
            r.textContent = v
        }))
      }

      return r
    }
    while(args.length)
      item(args.shift())

    return e
  }

  h.cleanup = function () {
    for (var i = 0; i < cleanupFuncs.length; i++){
      cleanupFuncs[i]()
    }
    cleanupFuncs.length = 0
  }

  return h
}

var h = module.exports = context()
h.context = context

function isNode (el) {
  return el && el.nodeName && el.nodeType
}

function forEach (arr, fn) {
  if (arr.forEach) return arr.forEach(fn)
  for (var i = 0; i < arr.length; i++) fn(arr[i], i)
}

function isArray (arr) {
  return Object.prototype.toString.call(arr) == '[object Array]'
}



},{"browser-split":4,"class-list":5,"html-element":3}],7:[function(require,module,exports){

var indexOf = [].indexOf;

module.exports = function(arr, obj){
  if (indexOf) return arr.indexOf(obj);
  for (var i = 0; i < arr.length; ++i) {
    if (arr[i] === obj) return i;
  }
  return -1;
};
},{}]},{},[1]);
