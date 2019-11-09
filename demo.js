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
