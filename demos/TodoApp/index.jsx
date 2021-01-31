import d from '../../index.js';

class App {
  todos = [];
  filter = 'all';

  onInputKeyUp = ev => {
    if (ev.key === 'Enter') {
      this.addTodo(ev.target.value);
      if (this.filter === 'completed') { this.filter = 'all' }

      ev.target.value = '';
    }
  };

  addTodo(text) { this.todos.push({ text, completed: false }) }

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
    <div class="todoapp">
      <header class="header">
        <h1>todos</h1>

        <input
          class="new-todo"
          onKeyUp={this.onInputKeyUp}
          placeholder="What needs to be done?"
        />
      </header>

      {d.if(() => this.todos.length, (
        <>
          <main class="main">
            <input type="checkbox" id="toggle-all" class="toggle-all" />
            <label for="toggle-all" />

            <ul class="todo-list">
              {d.map(() => this.filteredTodos(this.filter), x => (
                <li class={() => x.completed && 'completed'}>
                  <div class="view">
                    <input
                      type="checkbox"
                      class="toggle"
                      checked={d.binding({
                        get: () => x.completed,
                        set: y => x.completed = y,
                      })}
                    />

                    <label>{d.text(() => x.text)}</label>
                    <button class="destroy" onClick={() => this.removeTodo(x)} />
                  </div>

                  <input
                    class="edit"
                    value={d.binding({ get: () => x.text, set: y => x.text = y })}
                  />
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