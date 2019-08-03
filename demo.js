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
