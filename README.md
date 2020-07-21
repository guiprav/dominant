# <img src="logo.svg" alt="Dominant logo" height="40" align="top"> Dominant – Dysfunctional JavaScript UI library

[React](http://reactjs.org) has been truly revolutionary back in the day, and it's taught us many important lessons, but I think it's about time we move on, and I'm not excited about any of the existing alternatives as they're all similarly complex.

I need a UI library that allows me to create components bound to mutable JavaScript state, that's it.

I can call an update function whenever state changes (à la [Mithril](https://mithril.js.org)), so there's no need to track changes.

  * This means no special APIs for changing state; just mutate your variables and objects.
  * Also no observables or hacky object property/array method monkey-patching (like [Aurelia](https://aurelia.io) and [VueJS](https://vuejs.org) do).
  * A global **update** function reevaluates all bindings and updates the DOM strictly as needed.

It should let me leverage DOM APIs, not abstract them away.

  * This means no virtual DOM.
  * It also means there's no **mount** function; components are just functions or Component classes with render functions that return DOM nodes you can compose using a familiar [Hyperscript](https://github.com/hyperhype/hyperscript)-like API and append wherever.
  * A DOM [mutation observer](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver) keeps track of which DOM nodes with bindings are attached to the document and calls lifecycle listeners (**attach**/**detach**, if any).
  * This plays well with other DOM-based UI libraries, such as vanilla JS components and jQuery UI.
  * Finally, the API is JSX-compatible.

I don't care much about benchmarks, so long as my apps are always snappy, never slow.

These are this library's design principles. I thought about them by applying first principles thinking to come up with a minimum set of features a JavaScript UI library needs to enable sane, comfortable development of modern web apps.

## Setup

Install Dominant:

```sh
$ npm install --save guiprav/dominant-ui
```

Install a JavaScript bundler and (optionally) a development server. I recommend [Browserify](https://github.com/browserify) and [wzrd](https://github.com/maxogden/wzrd):

```sh
$ npm install --save-dev browserify wzrd
```

If you want JSX, you also need a few more dev dependencies:

```sh
$ npm install --save-dev babelify @babel/core @babel/plugin-transform-react-jsx
```

Don't forget to start all your JSX files with this comment annotation:

```js
// @jsx dom.el
```

Create your **app.js** or whatever you wanna call your app's entrypoint module:

```js
let dom = require('dominant-ui');

let HelloWorld = () => {
  let model = {
    color: 'blue',
    whom: 'world',
  };

  // JSX version:
  // return (
  //   <div
  //     model={model}
  //     style={() => ({ color: model.color })}
  //
  //     onAttach={() => {
  //       setTimeout(() => {
  //         model.color = 'red';
  //         model.whom = 'human';
  //       }, 1000);
  //     }}
  //   >
  //     Hello, {dom.text(() => model.whom)}!
  //   </div>
  // );

  // Pure JavaScript version:
  return dom.el('div', {
    model,

    style: { color: model.color },

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

// JSX version:
// document.body.append(<HelloWorld />);

// Pure JavaScript version:
document.body.append(dom.el(HelloWorld));

// Global variables greatly help development and debugging, but avoid them in
// actual source code.
window.dom = dom;
```

Start your development server (if you're using one, e.g. wzrd):

```sh
$ wzrd app.js
```

And open up your app in a browser.

If you want JSX, supply the appropriate wzrd/browserify/babelify/babel parameters as well:

```sh
$ wzrd app.js -- -t [ babelify --plugins [ @babel/plugin-transform-react-jsx ] ]
```

## API

### dom.el(tagName | el | fn | Component, { props }, [children])

Creates a DOM element of the specified tag name (`tagName`), function (`fn`),
or class (`Component`), or sets props/children on an existing element (`el`).

When a tag name or existing element is supplied, key/values in the (optional)
**props** object can be used to set an element's attributes, properties,
bindings, and event listeners.

Also any **children** (optional) are appended to the created element.

When a component function or Component class are supplied, any  **children**
supplied are stored in `props.children` before **props** is forwarded to the
component function or constructor.

When a component function is supplied, the return value of `fn(props)` is returned.

When a Component class is supplied, the return value of
`new Component(props).render()` is returned.

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
      backgroundColor: 'blue',
    },
  }),

  // Dynamic class and style props example (one-way bindings):
  dom.el('div', {
    class: () => [
      'foo',
      isThirsy && 'bar',
      'baz',
    ],

    style: () => ({
      width: '40px',
      height: '40px',
      border: '1px solid red',
      backgroundColor: someBgColorVariable,
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

// Component function:
const HelloFn = ({ whom }) => dom.text(() => `Hello, ${dom.resolve(whom)}!`);
document.body.append(dom.el(HelloFn, { whom: 'functions' }));

// Component class (with dom.resolving property getter `this.whom`):
class HelloClass extends dom.Component {
  constructor(props) {
    super();
    this.props = props;
  }

  // This getter calls `dom.resolve(this.props.whom)` internally so you don't have
  // to do that every time you want `this.props.whom`'s resolved value. See
  // `dom.resolve(x)`'s documentation below.
  get whom() {
    return dom.resolve(this.props.whom);
  }

  render = () => dom.text(() => `Hello, ${this.whom}!`);
}

document.body.append(dom.el(HelloClass, { whom: 'classes' }));
```

**Note:** Dominant has no way of knowing when your application's state changes.
It's up to you to call **dom.update()** after any (potential) state changes.

### dom.resolve(x)

This helper function will call **x** if it's a function, or just return **x**
itself otherwise. That is:

```js
dom.resolve(() => 123); // returns 123.
dom.resolve(123); // also returns 123.
```

This is useful when you're writing a component which may receive a regular
value as prop or a getter function that works as a live reference to some
expression in the getter function's scope. E.g.:


```js
let name = 'John Doe';

// Since we're passing `name` here directly, we're actually passing `name`'s
// current value as a constant.
document.body.append(HelloFn({ whom: name }));

// I.e., this has no effect:
name = 'Jane Doe';
dom.update();

// If we pass a getter function, on the other hand, HelloFn can call it anytime
// to get the most up-to-date value:
document.body.append(HelloFn({ whom: () => name }));

// So this causes the UI to update accordingly:
name = 'Foo Bar';
dom.update();
```

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
  dom.el('div', { style: { color } }, [
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

### dom.map(array, fn)

The `array.map(fn)` analog to `dom.if`.

When updated, the binding resolves `array`, removes nodes associated to removed array values, reorders nodes to match the order of associated values in the new array, maps new values to new nodes using `fn`, and adds them to the DOM.

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
