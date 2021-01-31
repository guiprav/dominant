import App from './components/App.jsx';
import d from '../../index.js';

document.addEventListener('click', ev => {
  let sel = 'a[href="#"]';
  if (ev.target.matches(sel) || ev.target.closest(sel)) { ev.preventDefault() }
});

document.querySelector('#demo').append(<App />);