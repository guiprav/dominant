import d from '../../../index.js';
import { interpolateViridis } from 'd3-scale-chromatic';

const Layout = {
  PHYLLOTAXIS: 0,
  GRID: 1,
  WAVE: 2,
  SPIRAL: 3
};

const LAYOUT_ORDER = [
  Layout.PHYLLOTAXIS,
  Layout.SPIRAL,
  Layout.PHYLLOTAXIS,
  Layout.GRID,
  Layout.WAVE
];

class VizDemo {
  count = 0;

  constructor(props) {
    this.props = props;
    this.layout= 0;
    this.phyllotaxis= genPhyllotaxis(100);
    this.grid= genGrid(100);
    this.wave= genWave(100);
    this.spiral= genSpiral(100);
    this.points= [];
    this.step= 0;
    this.numSteps= 60 * 2;
  }

  next() {
    const newCount = this.props.count;

    if (newCount !== this.count) {
      this.count = newCount;
      console.log('new count:', newCount);
      this.phyllotaxis = genPhyllotaxis(this.count);
      this.grid = genGrid(this.count);
      this.wave = genWave(this.count);
      this.spiral = genSpiral(this.count);

      this.makePoints(this.count);
    }

    this.step = (this.step + 1) % this.numSteps;

    if (this.step === 0) {
      this.layout = (this.layout + 1) % LAYOUT_ORDER.length;
    }

    // Clamp the linear interpolation at 80% for a pause at each finished layout state
    const pct = Math.min(1, this.step / (this.numSteps * 0.8));

    const currentLayout = LAYOUT_ORDER[this.layout];
    const nextLayout = LAYOUT_ORDER[(this.layout + 1) % LAYOUT_ORDER.length];

    // Keep these redundant computations out of the loop
    const pxProp = xForLayout(currentLayout);
    const nxProp = xForLayout(nextLayout);
    const pyProp = yForLayout(currentLayout);
    const nyProp = yForLayout(nextLayout);

    for (let point of this.points) {
      const oldPoint = { ...point };
      point.x = lerp(oldPoint, pct, pxProp, nxProp);
      point.y = lerp(oldPoint, pct, pyProp, nyProp);
    }

    d.update();
    requestAnimationFrame(() => { this.next() });
  }



  setAnchors(arr) {
    arr.map((p, index) => {
      const [ gx, gy ] = project(this.grid(index));
      const [ wx, wy ] = project(this.wave(index));
      const [ sx, sy ] = project(this.spiral(index));
      const [ px, py ] = project(this.phyllotaxis(index));

      Object.assign(p, { gx, gy, wx, wy, sx, sy, px, py });

    });

    const deltaLen = arr.length - this.points.length;

    if (deltaLen < 0) {
      this.points.length = arr.length;
    } else if (deltaLen > 0) {
      for (let i = 0; i < deltaLen; i++) {
        this.points.push({});
      }
    }

    for (let i = 0; i < arr.length; i++) {
      Object.assign(this.points[i], arr[i]);
    }
  }


  makePoints(count) {
    const newPoints = [];
    for (var i = 0; i < count; i++) {
      newPoints.push({
        x: 0,
        y: 0,
        color: interpolateViridis(i / count),
      });
    }
    this.setAnchors(newPoints);
  }

  render = () => (
    <svg:svg onAttach={el => { el.model = this; this.next() }} class="demo">
      <svg:g>{d.map(() => this.points, x => <Point data={x} />)}</svg:g>
    </svg:svg>
  );
}

const Point = ({ data }) => (
  <svg:rect
    class="point"
    transform={() => `translate(
      ${Math.floor(d.resolve(data.x))},
      ${Math.floor(d.resolve(data.y))}
    )`}
    fill={() => d.resolve(data.color)}
  />
);

const theta = Math.PI * (3 - Math.sqrt(5));

function xForLayout(layout) {
  switch (layout) {
    case Layout.PHYLLOTAXIS:
      return 'px';
    case Layout.GRID:
      return 'gx';
    case Layout.WAVE:
      return 'wx';
    case Layout.SPIRAL:
      return 'sx';
  }
}

function yForLayout(layout) {
  switch (layout) {
    case Layout.PHYLLOTAXIS:
      return 'py';
    case Layout.GRID:
      return 'gy';
    case Layout.WAVE:
      return 'wy';
    case Layout.SPIRAL:
      return 'sy';
  }
}

function lerp(obj, percent, startProp, endProp) {
  let px = obj[startProp];
  return px + (obj[endProp] - px) * percent;
}

function genPhyllotaxis(n) {
  return i => {
    let r = Math.sqrt(i / n);
    let th = i * theta;
    return [r * Math.cos(th), r * Math.sin(th)];
  };
}

function genGrid(n) {
  let rowLength = Math.round(Math.sqrt(n));
  return i => [
    -0.8 + 1.6 / rowLength * (i % rowLength),
    -0.8 + 1.6 / rowLength * Math.floor(i / rowLength),
  ];
}

function genWave(n) {
  let xScale = 2 / (n - 1);
  return i => {
    let x = -1 + i * xScale;
    return [x, Math.sin(x * Math.PI * 3) * 0.3];
  };
}

function genSpiral(n) {
  return i => {
    let t = Math.sqrt(i / (n - 1)),
      phi = t * Math.PI * 10;
    return [t * Math.cos(phi), t * Math.sin(phi)];
  };
}

function scale(magnitude, vector) {
  return vector.map(p => p * magnitude);
}

function translate(translation, vector) {
  return vector.map((p, i) => p + translation[i]);
}

function project(vector) {
  const wh = window.innerHeight / 2;
  const ww = window.innerWidth / 2;
  return translate([ ww, wh ], scale(Math.min(wh, ww), vector));
}

export default VizDemo;
