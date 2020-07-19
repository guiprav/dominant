import *  as sinon from 'sinon';
import dom from '.';
import { JSDOM } from 'jsdom';
import { assert } from 'chai';

let jsdom = new JSDOM('<!doctype html>');

for (let k of [
  'HTMLElement',
  'document',
]) {
  (global as any)[k] = (jsdom as any).window[k];
}

describe('Binding', () => {
  describe('constructor', () => {
    it('accepts and stores a BindingGetter', () => {
      let getter = () => 1;
      let b = new dom.Binding(getter);

      assert.equal(b.get, getter);
    });

    it('accepts and stores BindingGetters array', () => {
      let getters = [() => 1, () => 2];
      let b = new dom.Binding(getters);

      assert.equal(b.get, getters);
    });

    it('accepts and stores BindingGetterSetter object', () => {
      let props = {
        get: () => 1,
        set: (x: any) => null,
      };

      let b = new dom.Binding(props);

      assert.equal(b.get, props.get);
      assert.equal(b.set, props.set);
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
  describe('when type is a string', () => {
    it('creates the specified element', () => {
      let el = dom.el('div');

      assert.instanceOf(el, HTMLElement);
      assert.equal(el.tagName, 'DIV');
    });
  });

  describe('when type extends Component', () => {
    it('instantiates it, calls the render method, and returns the result', () => {
      let instance: any;

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

      let props = { test: 123 };
      let el = dom.el(TestComponent, props);

      assert.isNull(el);

      assert.instanceOf(instance, TestComponent);
      assert.deepEqual(instance.props, { ...props, children: [] });
    });
  });

  describe('when props are supplied', () => {
    it('sets regular props to the created element', () => {
      let el = dom.el('div', { id: 'test' });
      assert.equal(el.id, 'test');
    });

    it('sets class prop to the created element (string)', () => {
      let el = dom.el('div', { class: 'test' });
      assert.equal(el.className, 'test');
    });

    it('sets class prop to the created element (array)', () => {
      let el = dom.el('div', { class: ['test1', 'test2'] });
      assert.equal(el.className, 'test1 test2');
    });

    it('sets class prop to the created element (array of space-delimited class names)', () => {
      let el = dom.el('div', { class: ['test1 test2', 'test3   test4 '] });
      assert.equal(el.className, 'test1 test2 test3 test4');
    });

    it('sets style prop to the created element (string)', () => {
      let el = dom.el('div', { style: 'text-align: center' });
      assert.equal(el.style.getPropertyValue('text-align'), 'center');
    });

    it('sets style prop to the created element (object)', () => {
      let el = dom.el('div', {
        style: { textAlign: 'center' },
      });

      assert.equal(el.style.getPropertyValue('text-align'), 'center');
    });

    it('adds event listeners for event listener props', () => {
      let fn = sinon.fake();
      let el = dom.el('button', { onClick: fn });

      assert.isFalse(fn.called);
      el.click();
      assert.isTrue(fn.called);
    });
  });

  describe('when childNodes are supplied', () => {
    it('appends them to the created element', () => {
      let childNodes = [dom.el('div'), dom.el('div')];
      let el = dom.el('div', null, childNodes);

      assert.deepEqual([...el.childNodes], childNodes);
    });
  });

  describe('when childNodes are nested arrays', () => {
    it('flattens the array and appends them to the created element', () => {
      let childNodes = [[dom.el('div')], [[dom.el('div')]]];
      let el = dom.el('div', null, childNodes);

      assert.deepEqual([...el.childNodes], childNodes.flat(10));
    });
  });
});
