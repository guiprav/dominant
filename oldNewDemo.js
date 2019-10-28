window.dom = require('./newIndex');

let TodoApp = () => {
  let state = {
    inputAriaWhatever: 'who cares?',
    inputBgColor: 'salmon',
    inputColor: 'yellow',
    inputValue: 'test',
    derp: true,
    durr: 0,
  };

  return dom.el('div', { state, class: 'todoApp' }, [
    dom.el('input', {
      'aria-whatever': dom.binding(() => state.inputAriaWhatever),

      style: dom.binding(() => ({
        'background-color': state.inputBgColor,
        color: state.inputColor,
      })),

      value: dom.binding({
        get: () => state.inputValue,
        set: x => state.inputValue = x,
      }),
    }),

    dom.el('div', {
      class: dom.binding(() => ({
        derp: state.derp,
        durr: state.durr,
        derpDurr: state.derp && state.durr,
      })),
    }, [
      'Derp? Durr? ', dom.if(
        () => state.derp && state.durr,

        dom.el('span', [
          'Derp-',

          dom.el('b', {
            style: dom.binding(() => ({ color: state.inputColor })),
          }, [
            'durr',
          ]),

          '!',
        ]),

        dom.el('span', '...'),
      ),
    ]),

    dom.el('ul', [
      dom.map(() => Object.keys(state), k => dom.el(
        'li', `${k}: ${state[k]}`,
      )),
    ]),
  ]);
};

addEventListener('DOMContentLoaded', () => {
  document.body.appendChild(window.todoApp = TodoApp());
});
