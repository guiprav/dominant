let sinon = require('sinon');
let d = require('.');
let { JSDOM } = require('jsdom');
let { assert } = require('chai');

let jsdom = new JSDOM('<!doctype html>');

for (let k of [
  'Comment',
  'HTMLElement',
  'NodeFilter',
  'Text',
  'document',
]) {
  global[k] = jsdom.window[k];
}

describe('Binding', () => {
  describe('constructor', () => {
    it('accepts and stores BindingGetterSetter object', () => {
      let props = { get: () => 1, set: x => null };
      let b = new d.Binding(props);

      assert.equal(b.get, props.get);
      assert.equal(b.set, props.set);
    });

    it('accepts and stores BindingGetters array', () => {
      let getters = [() => 1, () => 2];
      let b = new d.Binding(getters);

      assert.equal(b.get, getters);
    });

    it('accepts and stores a single BindingGetter', () => {
      let getter = () => 1;
      let b = new d.Binding(getter);

      assert.equal(b.get, getter);
    });
  });
});

describe('binding', () => {
  it('is a function that creates a Binding', () => {
    let getter = () => 1;
    let b = d.binding(getter);

    assert.instanceOf(b, d.Binding);
    assert.equal(b.get, getter);
  });
});

describe('el', () => {
  describe('when type implements IRenderable', () => {
    let instance;

    beforeEach(() => { instance = null });

    class TestComponent {
      constructor(props) {
        this.props = props;
        instance = this;
      }

      render() {
        return null;
      }
    }

    it('instantiates it, calls the render method, and returns the result', () => {
      let props = { test: 123 };
      let el = d.el(TestComponent, props);

      assert.isNull(el);

      assert.instanceOf(instance, TestComponent);
      assert.equal(instance.props.test, 123);
    });

    it('passes flattened children array as prop', () => {
      let children = [[d.el('div')], [[d.el('div')]]];
      let el = d.el(TestComponent, null, children);

      assert.deepEqual(instance.props.children, children.flat(10));
    });
  });

  describe('when type is any other function', () => {
    it('calls the function and returns the result', () => {
      let el = document.createElement('div');
      let fn = sinon.fake.returns(el);

      let props = { test: 123 };
      let el2 = d.el(fn, props);

      assert.equal(el, el2);

      assert.isTrue(fn.called);
      assert.deepEqual(fn.args[0][0].test, 123);
    });

    it('passes flattened children array as prop', () => {
      let fn = sinon.fake();
      let children = [[d.el('div')], [[d.el('div')]]];

      let el = d.el(fn, null, children);

      assert.deepEqual(fn.args[0][0].children, children.flat(10));
    });
  });

  describe('when type is a string', () => {
    it('creates the specified element', () => {
      let el = d.el('div');

      assert.instanceOf(el, HTMLElement);
      assert.equal(el && el.tagName, 'DIV');
    });

    describe('when props are supplied', () => {
      it('adds event listeners for event listener props', () => {
        let fn = sinon.fake();
        let el = d.el('button', { onClick: fn });

        assert.isFalse(fn.called);
        el.click();
        assert.isTrue(fn.called);
      });

      it('stores Binding props on el.bindings', () => {
        let b = d.binding({ get: () => 1, set: x => null });
        let el = d.el('input', { value: b });

        assert.deepEqual(el.bindings, [b]);
      });

      it('wraps non-event listener function props as Bindings and store on el.bindings', () => {
        let fn = () => 'test';
        let el = d.el('input', { value: fn });

        assert.instanceOf(el.bindings[0], d.Binding);
        assert.equal(el.bindings[0].get, fn);
      });

      it('sets class prop to the created element (array)', () => {
        let el = d.el('div', { class: ['test1', 'test2'] });
        assert.equal(el.className, 'test1 test2');
      });

      it('sets class prop to the created element (array of space-delimited class names)', () => {
        let el = d.el('div', { class: ['test1 test2', 'test3   test4 '] });
        assert.equal(el.className, 'test1 test2 test3 test4');
      });

      it('sets class prop to the created element (string of space-delimited class names)', () => {
        let el = d.el('div', { class: 'test1 test2' });
        assert.equal(el.className, 'test1 test2');
      });

      it('sets style prop to the created element (object)', () => {
        let el = d.el('div', { style: { textAlign: 'center' } });
        assert.equal(el.style.getPropertyValue('text-align'), 'center');
      });

      it('sets style prop to the created element (string)', () => {
        let el = d.el('div', { style: 'text-align: center' });
        assert.equal(el.style.getPropertyValue('text-align'), 'center');
      });

      it('sets regular props to the created element', () => {
        let el = d.el('div', { id: 'test' });
        assert.equal(el.id, 'test');
      });
    });

    describe('when children are supplied', () => {
      it('flattens the array and appends them to the created element', () => {
        let children = [[d.el('div')], [[d.el('div')]]];
        let el = d.el('div', null, children);

        assert.deepEqual([...el.children], children.flat(10));
      });
    });
  });
});

describe('comment', () => {
  it('creates and returns the properly formatted comment (when text.length > 0)', () => {
    let c = d.comment('test');

    assert.instanceOf(c, Comment);
    assert.equal(c.textContent, ' test ');
  });

  it('creates and returns the properly formatted comment (when text.length === 0)', () => {
    let c = d.comment();

    assert.instanceOf(c, Comment);
    assert.equal(c.textContent, ' ');
  });
});

describe('if', () => {
  it('creates and returns the properly formatted comment node', () => {
    let c = d.if(() => false, document.createElement('div'));

    assert.instanceOf(c, Comment);
    assert.equal(c.textContent, ' if anchor ');
  });

  it('creates and stores the conditional Binding on c.bindings (thenNode only)', () => {
    let fn = () => false;
    let el = document.createElement('div');

    let c = d.if(fn, el);

    assert.instanceOf(c.bindings[0], d.Binding);

    assert.equal(c.bindings[0].get, fn);
    assert.equal(c.bindings[0].thenNode, el);
  });

  it('creates and stores the conditional Binding on c.bindings (thenNode + elseNode)', () => {
    let fn = () => false;
    let thenNode = document.createElement('div');
    let elseNode = document.createElement('div');

    let c = d.if(fn, thenNode, elseNode);

    assert.instanceOf(c.bindings[0], d.Binding);

    assert.equal(c.bindings[0].get, fn);
    assert.equal(c.bindings[0].thenNode, thenNode);
    assert.equal(c.bindings[0].elseNode, elseNode);
  });
});

describe('map', () => {
  it('creates and returns the properly formatted comment node', () => {
    let c = d.map(() => [1], x => document.createElement('div'));

    assert.instanceOf(c, Comment);
    assert.equal(c.textContent, ' map anchor ');
  });

  it('creates and stores the conditional Binding on c.bindings', () => {
    let getFn = () => [1];
    let mapFn = x => document.createElement('div');

    let c = d.map(getFn, mapFn);

    assert.instanceOf(c.bindings[0], d.Binding);

    assert.equal(c.bindings[0].get, getFn);
    assert.equal(c.bindings[0].map, mapFn);
  });
});

describe('text', () => {
  it('creates and returns a text node', () => {
    let n = d.text(() => 'hello');
    assert.instanceOf(n, Text);
  });

  it('creates and stores the textContent Binding on n.bindings', () => {
    let getFn = () => 'hello';
    let n = d.text(getFn);

    assert.instanceOf(n.bindings[0], d.Binding);
    assert.equal(n.bindings[0].get, getFn);
  });
});

describe('processMutations', () => {
  let makeBoundNode = () => {
    let n = document.createElement('div');
    n.bindings = true;

    return n;
  };

  it('adds addedNodes with n.bindings to boundNodes', () => {
    let boundNodes = [];

    let nodes = [
      document.createElement('div'),
      makeBoundNode(),
      document.createElement('div'),
      makeBoundNode(),
      document.createElement('div'),
      makeBoundNode(),
      document.createElement('div'),
      makeBoundNode(),
    ];

    let muts = [
      { addedNodes: nodes.slice(0, 4), removedNodes: [] },
      { addedNodes: nodes.slice(4, 8), removedNodes: [] },
    ];

    let update = sinon.fake();
    d.processMutations(muts, null, { boundNodes, update });

    assert.sameMembers(boundNodes, nodes.filter(n => n.bindings));
  });

  it('updates addedNodes with n.bindings', () => {
    let boundNodes = [];

    let nodes = [
      document.createElement('div'),
      makeBoundNode(),
      document.createElement('div'),
      makeBoundNode(),
      document.createElement('div'),
      makeBoundNode(),
      document.createElement('div'),
      makeBoundNode(),
    ];

    let muts = [
      { addedNodes: nodes.slice(0, 4), removedNodes: [] },
      { addedNodes: nodes.slice(4, 8), removedNodes: [] },
    ];

    let update = sinon.fake();
    d.processMutations(muts, null, { boundNodes, update });

    for (let n of nodes.filter(n => n.bindings)) {
      assert.ok(update.calledWith(n));
    }
  });

  it('removes removedNodes with n.bindings from boundNodes', () => {
    let removedNodes = [
      makeBoundNode(),
      makeBoundNode(),
    ];

    let allNodes = [
      removedNodes[0],
      makeBoundNode(),
      removedNodes[1],
      makeBoundNode(),
    ];

    let boundNodes = [];

    let muts = [
      { addedNodes: [], removedNodes: [removedNodes[0]] },
      { addedNodes: [], removedNodes: [removedNodes[1]] },
    ];

    let update = sinon.fake();
    d.processMutations(muts, null, { boundNodes, update });

    for (let n of removedNodes) {
      assert.notInclude(boundNodes, n);
    }
  });

  it('adds addedNodes descendants with n.bindings to boundNodes', () => {
    let boundNodes = [];

    let parentNodes = [
      document.createElement('div'),
      makeBoundNode(),
      document.createElement('div'),
      makeBoundNode(),
    ];

    let descendantNodes = [
      document.createElement('div'),
      makeBoundNode(),
      document.createElement('div'),
      makeBoundNode(),
    ];

    parentNodes[0].append(descendantNodes[0], descendantNodes[1]);
    parentNodes[3].append(descendantNodes[2], descendantNodes[3]);

    let muts = [
      { addedNodes: parentNodes.slice(0, 2), removedNodes: [] },
      { addedNodes: parentNodes.slice(2, 4), removedNodes: [] },
    ];

    let update = sinon.fake();
    d.processMutations(muts, null, { boundNodes, update });

    for (let n of descendantNodes.filter(n => n.bindings)) {
      assert.include(boundNodes, n);
    }
  });

  it('updates addedNodes descendants with n.bindings', () => {
    let boundNodes = [];

    let parentNodes = [
      document.createElement('div'),
      makeBoundNode(),
      document.createElement('div'),
      makeBoundNode(),
    ];

    let descendantNodes = [
      document.createElement('div'),
      makeBoundNode(),
      document.createElement('div'),
      makeBoundNode(),
    ];

    parentNodes[0].append(descendantNodes[0], descendantNodes[1]);
    parentNodes[3].append(descendantNodes[2], descendantNodes[3]);

    let muts = [
      { addedNodes: parentNodes.slice(0, 2), removedNodes: [] },
      { addedNodes: parentNodes.slice(2, 4), removedNodes: [] },
    ];

    let update = sinon.fake();
    d.processMutations(muts, null, { boundNodes, update });

    for (let n of descendantNodes.filter(n => n.bindings)) {
      assert.ok(update.calledWith(n));
    }
  });

  it('removes removedNodes descendants with n.bindings from boundNodes', () => {
    let removedNodes = [
      document.createElement('div'),
      document.createElement('div'),
    ];

    let removedDescendantNodes = [
      makeBoundNode(),
      makeBoundNode(),
    ];

    removedNodes[0]
      .append(document.createElement('div'), removedDescendantNodes[0]);

    removedNodes[1]
      .append(document.createElement('div'), removedDescendantNodes[1]);

    let allNodes = [
      makeBoundNode(),
      removedNodes[0],
      removedDescendantNodes[0],
      makeBoundNode(),
      removedNodes[1],
      removedDescendantNodes[1],
    ];

    let boundNodes = [...allNodes];

    let muts = [
      { addedNodes: [], removedNodes: [removedNodes[0]] },
      { addedNodes: [], removedNodes: [removedNodes[1]] },
    ];

    let update = sinon.fake();
    d.processMutations(muts, null, { boundNodes, update });

    for (let n of removedDescendantNodes) {
      assert.notInclude(boundNodes, n);
    }
  });
});

describe('resolve', () => {
  it('returns x() when x is a Function', () => {
    assert.equal(d.resolve(() => 123), 123);
  });

  it('returns x when x is not a Function', () => {
    assert.equal(d.resolve(321), 321);
  });
});
