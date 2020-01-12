# <img src="logo.svg" alt="Dominant logo" height="40" align="top"> Dominant – First principles JavaScript UI library

I'm too old and tired for [React](http://reactjs.org) and its awful ecosystem getting in my way almost every single day at work.

I need a UI library that allows me to create components bound to mutable JavaScript state, that's it.

I can call an update function whenever state changes (à la [Mithril](https://mithril.js.org)), so there's no need to track changes.

  * This means no special APIs for changing state; just mutate your variables and objects.
  * Also no observables or hacky object property/array method monkey-patching (like [Aurelia](https://aurelia.io) and [VueJS](https://vuejs.org) do).
  * A global **update** function reevaluates all bindings and updates the DOM strictly as needed.

It should let me leverage DOM APIs, not abstract them away.

  * This means no virtual DOM.
  * It also means there's no **mount** function; components are just functions that return DOM nodes you can compose using a familiar [Hyperscript](https://github.com/hyperhype/hyperscript)-like API and append wherever.
  * A DOM [mutation observer](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver) keeps track of which DOM nodes with bindings are attached to the document and calls lifecycle listeners (**attach**/**detach**, if any).
  * This plays well with other DOM-based UI libraries, such as vanilla JS components and jQuery UI.

I don't care much about benchmarks, so long as my apps are always snappy, never slow.

These are this library's design principles. I thought about them by applying first principles thinking to figure out the minimum set of features a JavaScript UI library needs to provide to enable sane, comfortable development of modern web apps.

## Setup

Install Dominant:

```sh
$ npm install --save guipra/dominant
```

Install a JavaScript bundler and (optionally) a development server. I recommend [Browserify](https://github.com/browserify) and [wzrd](https://github.com/maxogden/wzrd):

```sh
$ npm install --save-dev browserify wzrd
```

Create your **app.js** or whatever you wanna call your app's entrypoint module:

```js
let dom = require('dominant');

let HelloWorld = () => {
  let model = {
    color: 'blue',
    whom: 'world',
  };

  return dom.el('div', {
    model,

    style: () => ({ color: model.color }),

    onAttach: () => {
      setTimeout(() => {
        model.color = 'red';
        model.whom = 'human';

        dom.update();
      }, 1000);
    },
  }, [
    dom.text(() => `Hello, ${model.whom}!`),
  ]),
};

document.body.append(HelloWorld());

// Global variables greatly help development and debugging, but avoid them in
// actual source code.
window.dom = dom;
```

Start your development server (if you're using one, e.g. wzrd):

```sh
$ wzrd app.js
```

And open up your app in a browser.

## API

### dom.el(tagNameOrExistingElement, { props }, [children])

Creates a DOM element of the specified tag name or sets props/children on an existing element.

Key/values in the **props** object (if supplied) can be used to set an element's attributes, properties, bindings, and event listeners.

Any supplied child nodes are also appended to the element.

```js
document.body.append(
  // Static prop examples:
  dom.el('div', { class: 'foo bar' }, ['foobar']),
  dom.el('input', { type: 'text', value: 'foo' }),
  dom.el('img', { alt: 'bar', src: 'baz.png' }),
  dom.el('button', { onClick: () => alert('quux') }, ['Click me']),

  // Dynamic prop examples (one-way bindings):
  dom.el('div', { hidden: () => shouldHideDiv }),
  dom.el('img', { alt: () => someImage.description, src: () => someImage.url }),

  // Static style prop example:
  dom.el('div', {
    style: {
      width: '40px',
      height: '40px',
      border: '1px solid red',
      'background-color': 'blue',
    },
  }),

  // Dynamic class and style props example (one-way bindings):
  dom.el('div', {
    class: () => ({
      foo: true,
      bar: isThirsty,
      baz: true,
    }),

    style: () => ({
      width: '40px',
      height: '40px',
      border: '1px solid red',
      'background-color': someBgColorVariable,
    }),
  }),

  // Input value prop example (two-way bindings):
  dom.el('input', {
    value: dom.binding({
      get: () => currentInputValue,
      set: x => currentInputValue = x,
    }),
  }),
);
```

**Note:** Dominant has no way of knowing when your application's state changes. It's up to you to call **dom.update()** after any (potential) state changes.

### dom.update()

Reevaluates all DOM data bindings set with **dom.el**, executing all the supplied functions and comparing return values with the ones from previous invocations.

Only bindings whose values have changed since the last invocation are applied to the DOM.

```js
let color = 'blue';
let whom = 'world';

setTimeout(() => {
  color = 'red';
  whom = 'human';

  dom.update();
}, 1000);

document.body.append(
  dom.el('div', { style: () => ({ color }) }, [
    dom.text(() => `Hello, ${whom}!`),
  ]),
);
```

### dom.text(fn)

Returns a DOM text node with contents bound to the supplied **fn**.

Whenever **dom.update** gets called, text bindings are reevaluated, meaning the supplied functions are reexecuted and their return values are compared to the return values from previous invocations.

Only text bindings whose values have changed since the last invocation are updated in the DOM.

```js
let whom = 'world';

setTimeout(() => {
  whom = 'human';
  dom.update();
}, 1000);

document.body.append(dom.text(() => `Hello, ${whom}!`));
```

### dom.if(pred, thenNode, elseNode)

Returns a conditional anchor comment node (`<!-- anchorComment: if -->`) that represents a conditional node attachment in the document.

When updated, the binding resolves `pred` and adds `thenNode` as its next sibling if the result is truthy, `elseNode` otherwise.

Note: Nodes, including anchor comment nodes, are automatically updated when attached to the document (`dom.mutationObserver` does this).

```js
let isNewVisitor = true;

document.body.append(dom.if(
  () => isNewVisitor,
  dom.el('div', ['Nice to meet you!']),
  dom.el('div', ['Welcome back!']),
));

setTimeout(() => {
  isNewVisitor = false;
  dom.update();
}, 1000);
```

### dom.switch(value, cases)

The `switch` analog to `dom.if`.

```js
let keys = ['harder', 'better', 'faster', 'stronger'];
let i = 0;

document.body.append(dom.switch(() => keys[i], {
  harder: dom.el('div', ['HARDER']),
  better: dom.el('div', ['BETTER']),
  faster: dom.el('div', ['FASTER']),
  stronger: dom.el('div', ['STRONGER']),
}));

setInterval(() => {
  if (++i >= 4) {
    i = 0;
  }

  dom.update();
}, 1000);
```

### dom.map(array, mapFn)

The `array.map(fn)` analog to `dom.if`.

When updated, the binding resolves `array`, removes nodes associated to removed array values, reorders nodes to match the order of associated values in the new array, maps new values to new nodes using `mapFn`, and adds them to the DOM.

```js
let fruits = [
  { name: 'Apple', color: 'Red' },
  { name: 'Grape', color: 'Purple' },
  { name: 'Lemon', color: 'Green' },
];

let wikipediaPagePrefix = 'https://en.wikipedia.org/wiki';

document.body.append(dom.map(
  () => fruits, fruit => dom.el('li', [
    'The ',

    dom.el('a', { href: () => `${wikipediaPagePrefix}/${fruit.name}` }, [
      dom.text(() => fruit.name),
    ]),

    ' is ',

    dom.el('a', { href: () => `${wikipediaPagePrefix}/${fruit.color}` }, [
      dom.text(() => fruit.color),
    ]),

    '.',
  ]),
));
```

## License

<img src="https://duckduckgo.com/i/07eb45d6.png" height="40" /><br />

Dominant is free software: you can redistribute it and/or modify it under the terms of the [MIT License](COPYING).

## Exclusion of warranty

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
