import VizDemo from './VizDemo.jsx';
import d from '../../../index.js';

class App {
  numPoints = 1000;

  render = () => (
    <div model={this} class="app-wrapper">
      <VizDemo count={this.numPoints} />

      <div class="controls">
        # Points

        <input
          type="range"
          min={10}
          max={10000}
          value={this.numPoints}
          onInput={ev => this.numPoints = Number(ev.target.value)}
        />

        {this.numPoints}
      </div>

      <div class="about">
        Dominant 1k Components Demo
        based on InfernoJS 1k Components Demo,
        itself based on the Glimmer demo by{' '}
        <a href="http://mlange.io" target="_blank">Michael Lange</a>.
      </div>
    </div>
  );
}

export default App;
