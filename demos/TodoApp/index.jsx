import d from '../../index.js';

class App {
  todos = [];
  filter = 'all';

  onNewKeyUp = ev => {
    if (ev.key === 'Enter') {
      let value = ev.target.value.trim();

      if (!value) { return }

      this.addTodo(value);
      if (this.filter === 'completed') { this.filter = 'all' }

      ev.target.value = '';
    }
  };

  addTodo(text) { this.todos.push({ text, completed: false }) }

  async editTodo(x) {
    x.editing = true;

    await d.update();
    x.editInputEl.select();
  }

  onEditKeyUp = (ev, x) => {
    if (ev.key === 'Enter') {
      x.editing = false;
      if (!ev.target.value.trim()) { return this.removeTodo(x) }
    }
  };

  removeTodo(x) {
    let i = this.todos.indexOf(x);
    if (i !== -1) { this.todos.splice(i, 1) }
  }

  get activeTodos() {
    return this.todos.filter(x => !x.completed);
  }

  get completedTodos() {
    return this.todos.filter(x => x.completed);
  }

  toggleAll = toggle => this.todos.forEach(x => x.completed = toggle);

  showFilters = () =>
    Boolean(this.activeTodos.length && this.completedTodos.length);

  filteredTodos(filter) {
    switch (filter) {
      case 'all': return this.todos;
      case 'active': return this.activeTodos;
      case 'completed': return this.completedTodos;
      default: return [];
    }
  }

  clearCompleted = () => {
    this.todos = this.activeTodos;
    if (this.filter === 'completed') { this.filter = 'all' }
  };

  render = () => (
    <div class="todoapp" model={this}>
      <header class="header">
        <h1>todos</h1>

        <input
          class="new-todo"
          onKeyUp={this.onNewKeyUp}
          placeholder="What needs to be done?"
        />
      </header>

      {d.if(() => this.todos.length, (
        <>
          <main class="main">
            <input
              type="checkbox"
              id="toggle-all"
              class="toggle-all"
              checked={() => !this.activeTodos.length}
              onChange={ev => this.toggleAll(ev.target.checked)}
            />

            <label htmlFor="toggle-all" />

            <ul class="todo-list">
              {d.map(() => this.filteredTodos(this.filter), x => (
                <li class={() => [
                  x.completed && 'completed',
                  x.editing && 'editing'
                ]}>
                  <div class="view">
                    <input
                      type="checkbox"
                      class="toggle"
                      checked={d.binding({
                        get: () => x.completed,
                        set: y => x.completed = y,
                      })}
                    />

                    <label
                      onDblClick={() => this.editTodo(x)}
                      children={d.text(() => x.text)}
                    />

                    <button
                      class="destroy"
                      onClick={() => this.removeTodo(x)}
                    />
                  </div>

                  {x.editInputEl = (
                    <input
                      class="edit"
                      value={d.binding({
                        get: () => x.text,
                        set: y => x.text = y,
                      })}
                      onKeyUp={ev => this.onEditKeyUp(ev, x)}
                      onBlur={() => x.editing = false}
                    />
                  )}
                </li>
              ))}
            </ul>
          </main>

          <footer class="footer">
            <span class="todo-count">
              {d.text(() => `${this.activeTodos.length} items left`)}
            </span>

            {d.if(this.showFilters, (
              <ul class="filters">
                {[...Object.entries({
                  all: 'All',
                  active: 'Active',
                  completed: 'Completed',
                })].map(([k, label]) => (
                  d.if(() => this.filteredTodos(k).length, (
                    <li>
                      <a
                        href="#"
                        class={() => this.filter === k && 'selected'}
                        onClick={() => this.filter = k}
                        textContent={label}
                      />
                    </li>
                  ))
                ))}
              </ul>
            ))}

            {d.if(() => this.completedTodos.length, (
              <button class="clear-completed" onClick={this.clearCompleted}>
                Clear completed
              </button>
            ))}
          </footer>
        </>
      ))}
    </div>
  );
}

document.addEventListener('click', ev => {
  let sel = 'a[href="#"]';
  if (ev.target.matches(sel) || ev.target.closest(sel)) { ev.preventDefault() }
});

document.querySelector('#demo').append(<App />);