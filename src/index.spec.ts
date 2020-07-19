import *  as sinon from 'sinon';
import dom from '.';
import { JSDOM } from 'jsdom';
import { assert } from 'chai';

let jsdom = new JSDOM('<!doctype html>');

for (let k of [
  'Comment',
  'HTMLElement',
  'document',
]) {
  (global as any)[k] = (jsdom as any).window[k];
}

describe('Binding', () => {
  describe('constructor', () => {
    it('accepts and stores BindingGetterSetter object', () => {
      let props = {
        get: () => 1,
        set: (x: any) => null,
      };

      let b = new dom.Binding(props);

      assert.equal(b.get, props.get);
      assert.equal(b.set, props.set);
    });

    it('accepts and stores BindingGetters array', () => {
      let getters = [() => 1, () => 2];
      let b = new dom.Binding(getters);

      assert.equal(b.get, getters);
    });

    it('accepts and stores a single BindingGetter', () => {
      let getter = () => 1;
      let b = new dom.Binding(getter);

      assert.equal(b.get, getter);
    });
  });
});

describe('binding', () => {
  it('is a function that creates a Binding', () => {
    let getter = () => 1;
    let b = dom.binding(getter);

    assert.instanceOf(b, dom.Binding);
    assert.equal(b.get, getter);
  });
});

describe('Component', () => {
  describe('#render', () => {
    it('throws when not implemented', () => {
      class TestComponent extends dom.Component {}

      let c = new TestComponent();
      assert.throws(() => c.render(), 'TestComponent does not implement render');
    });

    it('does not throw when implemented', () => {
      class TestComponent extends dom.Component {
        render() {
          return null;
        }
      }

      let c = new TestComponent();
      c.render();
    });
  });
});

describe('el', () => {
  describe('when type extends Component', () => {
    let instance: any;

    beforeEach(() => {
      instance = null;
    });

    class TestComponent extends dom.Component {
      props: any;

      constructor(props: any) {
        super();

        this.props = props;
        instance = this;
      }

      render() {
        return null;
      }
    }

    it('instantiates it, calls the render method, and returns the result', () => {
      let props = { test: 123 };
      let el = dom.el(TestComponent, props);

      assert.isNull(el);

      assert.instanceOf(instance, TestComponent);
      assert.deepEqual(instance.props.test, 123);
    });

    it('passes flattened children array as prop', () => {
      let children = [[dom.el('div')], [[dom.el('div')]]];
      let el = dom.el(TestComponent, null, children);

      assert.deepEqual(instance.props.children, children.flat(10));
    });
  });

  describe('when type is any other function', () => {
    it('calls the function and returns the result', () => {
      let el = document.createElement('div');
      let fn = sinon.fake.returns(el);

      let props = { test: 123 };
      let el2 = dom.el(fn, props);

      assert.equal(el, el2);

      assert.isTrue(fn.called);
      assert.deepEqual(fn.args[0][0].test, 123);
    });

    it('passes flattened children array as prop', () => {
      let fn = sinon.fake();
      let children = [[dom.el('div')], [[dom.el('div')]]];

      let el = dom.el(fn, null, children);

      assert.deepEqual(fn.args[0][0].children, children.flat(10));
    });
  });

  describe('when type is a string', () => {
    it('creates the specified element', () => {
      let el = dom.el('div');

      assert.instanceOf(el, HTMLElement);
      assert.equal(el.tagName, 'DIV');
    });
  });

  describe('when props are supplied', () => {
    it('adds event listeners for event listener props', () => {
      let fn = sinon.fake();
      let el = dom.el('button', { onClick: fn });

      assert.isFalse(fn.called);
      el.click();
      assert.isTrue(fn.called);
    });

    it('stores Binding props on el.bindings', () => {
      let b = dom.binding({
        get: () => 1,
        set: (x: string) => null,
      });

      let el = dom.el('input', { value: b });

      assert.deepEqual((el as any).bindings, { value: b });
    });

    it('wraps non-event listener function props as Bindings and store on el.bindings', () => {
      let fn = () => 'test';
      let el = dom.el('input', { value: fn });

      assert.instanceOf((el as any).bindings.value, dom.Binding);
      assert.deepEqual((el as any).bindings.value, { get: fn });
    });

    it('sets class prop to the created element (array)', () => {
      let el = dom.el('div', { class: ['test1', 'test2'] });
      assert.equal(el.className, 'test1 test2');
    });

    it('sets class prop to the created element (array of space-delimited class names)', () => {
      let el = dom.el('div', { class: ['test1 test2', 'test3   test4 '] });
      assert.equal(el.className, 'test1 test2 test3 test4');
    });

    it('sets class prop to the created element (string)', () => {
      let el = dom.el('div', { class: 'test' });
      assert.equal(el.className, 'test');
    });

    it('sets style prop to the created element (object)', () => {
      let el = dom.el('div', {
        style: { textAlign: 'center' },
      });

      assert.equal(el.style.getPropertyValue('text-align'), 'center');
    });

    it('sets style prop to the created element (string)', () => {
      let el = dom.el('div', { style: 'text-align: center' });
      assert.equal(el.style.getPropertyValue('text-align'), 'center');
    });

    it('sets regular props to the created element', () => {
      let el = dom.el('div', { id: 'test' });
      assert.equal(el.id, 'test');
    });
  });

  describe('when children are supplied', () => {
    it('flattens the array and appends them to the created element', () => {
      let children = [[dom.el('div')], [[dom.el('div')]]];
      let el = dom.el('div', null, children);

      assert.deepEqual([...el.children], children.flat(10));
    });
  });
});

describe('comment', () => {
  it('creates and returns the properly formatted comment (when text.length > 0)', () => {
    let c = dom.comment('test');

    assert.instanceOf(c, Comment);
    assert.equal(c.textContent, ' test ');
  });

  it('creates and returns the properly formatted comment (when text.length === 0)', () => {
    let c = dom.comment();

    assert.instanceOf(c, Comment);
    assert.equal(c.textContent, ' ');
  });
});
