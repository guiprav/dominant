window.dom = require('.');

window.shuffle = xs => {
  for (let i = xs.length - 1; i > 0; i--) {
    let j = Math.floor(Math.random() * (i + 1));
    [xs[i], xs[j]] = [xs[j], xs[i]];
  }

  return xs;
};

let TodoApp = () => {
  let app = dom.el('div', { class: 'todoApp' }, [
    dom.el('h1', document.title),

    dom.el('div', { class: 'todoApp-contentBox' }, [
      dom.el('input', {
        class: 'todoApp-newItemInput',
        placeholder: 'What next?',
      }),

      dom.el('div', { class: 'todoApp-tabs' }, [
        ['all', 'pending', 'done'].map(
          x => dom.el('a', { class: 'todoApp-tab', key: x, href: '#' }),
        ),
      ]),

      dom.el('div', { class: 'todoApp-todoList' }, [
        dom.el('div', { class: 'todoListItem' }, [
          dom.el('button', { class: 'todoListItem-toggle' }),
          dom.el('input', { class: 'todoListItem-input' }),
          dom.el('span', { class: 'todoListItem-label' }),
        ]),
      ]),

      dom.el('button', { class: 'todoApp-listShuffleBtn' }, 'Shuffle'),
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

    get pending() {
      return this.todos.filter(x => !x.isDone);
    },

    get done() {
      return this.todos.filter(x => x.isDone);
    },
  };

  let newItemInput = app.querySelector('.todoApp-newItemInput');

  dom.bindValue(newItemInput, {
    get: () => app.state.newItemLabel,
    set: x => app.state.newItemLabel = x,
  });

  newItemInput.addEventListener('keyup', ev => {
    if (ev.key === 'Enter') {
      app.state.todos.unshift({
        label: app.state.newItemLabel,
        isDOne: false,
      });

      app.state.newItemLabel = '';

      dom.update();
    }
  });

  for (let tab of app.querySelectorAll('.todoApp-tab')) {
    let { key } = tab;

    let label = { all: 'All', pending: 'Pending', done: 'Done' }[key];
    let arrayKey = { all: 'todos', pending: 'pending', done: 'done' }[key];

    dom.bindTextContent(tab, () => `${label} (${app.state[arrayKey].length})`);

    dom.bindClass(tab, () => ({
      'todoApp-mActive': app.state.activeTab === key,
    }));

    tab.addEventListener('click', ev => {
      ev.preventDefault();

      app.state.activeTab = key;
      dom.update();
    });
  }

  dom.bindArray(app.querySelector('.todoListItem'), {
    get: () => app.state[
      app.state.activeTab === 'all'
        ? 'todos'
        : app.state.activeTab
    ],

    forEach: (listItem, todo) => {
      dom.bindClass(listItem, () => ({
        'todoListItem-mDone': todo.isDone,
      }));

      let toggle = listItem.querySelector('.todoListItem-toggle');

      dom.bindTextContent(toggle, () => todo.isDone ? 'Undo' : 'Done');

      toggle.addEventListener('click', () => {
        todo.isDone = !todo.isDone;
        dom.update();
      });

      let input = listItem.querySelector('.todoListItem-input');

      dom.bindPresence(input, () => todo.isEditing);

      dom.bindValue(input, {
        get: () => todo.label,
        set: x => todo.label = x,
      });

      input.addEventListener('keyup', ev => {
        if (ev.key === 'Enter') {
          todo.isEditing = false;
          dom.update();
        }
      });

      let label = listItem.querySelector('.todoListItem-label');

      label.addEventListener('click', () => {
        for (let todo of app.state.todos) {
          todo.isEditing = false;
        }

        todo.isEditing = true;
        dom.update();
      });

      dom.bindPresence(label, () => !todo.isEditing);
      dom.bindTextContent(label, () => todo.label);
    },
  });

  app.querySelector('.todoApp-listShuffleBtn').addEventListener('click', () => {
    shuffle(app.state.todos);
    dom.update();
  });

  return app;
};

addEventListener('DOMContentLoaded', () => {
  document.body.appendChild(window.todoApp = TodoApp());
});
