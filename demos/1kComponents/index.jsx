import App from './components/App.jsx';
import d from '../../index.js';
import { startFPSMonitor, startMemMonitor } from 'perf-monitor';

startFPSMonitor();
startMemMonitor();

document.querySelector('#main').append(<App />);
