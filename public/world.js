/* A small, dependency-free world. Everything is drawn here; no image assets required. */
(() => {
  'use strict';

  const canvas = document.getElementById('world-canvas');
  if (!canvas) return;
  const output = canvas.getContext('2d');
  if (!output) return;

  const WIDTH = 800;
  const HEIGHT = 580;
  const SIZE = 12;
  const ORIGIN = { x: 400, y: 139 };
  const TW = 26;
  const TH = 13;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const scene = document.createElement('canvas');
  scene.width = WIDTH / 2;
  scene.height = HEIGHT / 2;
  const ctx = scene.getContext('2d');
  if (!ctx) return;
  ctx.scale(0.5, 0.5);
  output.imageSmoothingEnabled = false;
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  output.imageSmoothingEnabled = false;

  const hint = document.getElementById('world-hint');
  const gemCounter = document.getElementById('world-gems');
  const keys = new Set();
  const collected = new Set();
  const player = { u: 8.8, v: 9.4, facing: 'down', moving: false };
  const home = { u: player.u, v: player.v };
  let route = [];
  let destination = null;
  let inView = true;
  let frame = 0;
  let lastTime = 0;
  let lastPaint = 0;
  let hover = null;
  let started = false;
  let sparkle = null;
  let announcement = null;

  const stations = [
    { id: 'projects', label: 'PROJECTS', u: 3.7, v: 3.4, entry: { u: 5.15, v: 4.3 }, labelY: -124, width: 100, color: '#c6f789', type: 'cabin', radius: 1.38 },
    { id: 'about', label: 'ABOUT', u: 3.7, v: 8.4, entry: { u: 4.7, v: 8.4 }, labelY: -81, width: 76, color: '#dbc6fa', type: 'observatory', radius: 0.76 },
    { id: 'contact', label: 'CONTACT', u: 8.8, v: 3.5, entry: { u: 9.1, v: 4.7 }, labelY: -99, width: 96, color: '#f2b986', type: 'terminal', radius: 0.82 },
  ];
  const crystals = [
    { id: 'crystal-1', u: 6.1, v: 3.15, color: '#b5f984' },
    { id: 'crystal-2', u: 5.0, v: 8.4, color: '#bc9cf9' },
    { id: 'crystal-3', u: 9.8, v: 7.6, color: '#e9bb76' },
  ];

  const trees = [
    [1.15, 1.8, 0.86], [1.3, 3.5, 0.96], [2.9, 1.2, 0.83],
    [1.3, 5.9, 1.12], [1.0, 8.3, 0.90], [2.2, 10.4, 0.85],
    [4.3, 10.7, 0.88], [5.8, 1.1, 0.90], [7.5, 1.2, 1.15],
    [9.1, 1.2, 0.95], [10.8, 2.5, 0.84], [10.8, 4.8, 1.0],
    [7.0, 11.1, 0.72], [5.1, 10.8, 0.68],
  ].map(([u, v, scale], index) => ({ u, v, scale, type: 'tree', radius: 0.4, index }));
  const solidObjects = [...trees, ...stations, { u: 7.5, v: 7.0, radius: 0.48 }];
  const decorations = [
    { type: 'fire', u: 7.5, v: 7.0 },
    { type: 'log', u: 6.8, v: 8.1 },
    { type: 'bench', u: 5.6, v: 6.1 },
    { type: 'sign', u: 8.0, v: 9.4 },
    { type: 'rocks', u: 1.3, v: 10.1 },
    { type: 'rocks', u: 10.65, v: 6.4 },
    { type: 'rocks', u: 5.0, v: 1.2 },
  ];
  const objects = [...trees, ...stations, ...decorations];

  function project(u, v) {
    return { x: ORIGIN.x + (u - v) * TW, y: ORIGIN.y + (u + v) * TH };
  }
  function unproject(x, y) {
    const dx = (x - ORIGIN.x) / TW;
    const dy = (y - ORIGIN.y) / TH;
    return { u: (dx + dy) / 2, v: (dy - dx) / 2 };
  }
  function rect(context, x, y, w, h, color) {
    context.fillStyle = color;
    context.fillRect(Math.round(x / 2) * 2, Math.round(y / 2) * 2, Math.round(w / 2) * 2, Math.round(h / 2) * 2);
  }
  function polygon(context, points, color) {
    context.fillStyle = color;
    context.beginPath();
    points.forEach(([x, y], i) => i ? context.lineTo(x, y) : context.moveTo(x, y));
    context.closePath();
    context.fill();
  }
  function ellipse(context, x, y, rx, ry, color) {
    context.fillStyle = color;
    context.beginPath();
    context.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    context.fill();
  }
  function seeded(seed) {
    let value = seed;
    return () => {
      value = (value * 16807) % 2147483647;
      return (value - 1) / 2147483646;
    };
  }
  function land(u, v) {
    return u >= 0 && v >= 0 && u < SIZE && v < SIZE &&
      !((u < 1 || u >= 11) && (v < 1 || v >= 11));
  }
  function traversable(u, v) {
    if (!land(u, v) || u < 0.42 || v < 0.42 || u > SIZE - 0.42 || v > SIZE - 0.42) return false;
    return !solidObjects.some(object => Math.hypot(u - object.u, v - object.v) < object.radius + 0.2);
  }

  const ground = document.createElement('canvas');
  ground.width = WIDTH / 2;
  ground.height = HEIGHT / 2;
  const terrain = ground.getContext('2d');
  if (!terrain) return;
  terrain.scale(0.5, 0.5);

  function pathDistance(u, v) {
    const segments = [
      [8.9, 10.8, 7.5, 7.9], [7.5, 7.9, 6.1, 5.9], [6.1, 5.9, 4.8, 4.1],
      [6.1, 5.9, 4.9, 8.3], [4.9, 8.3, 3.1, 9.0],
      [6.1, 5.9, 8.3, 5.0], [8.3, 5.0, 9.3, 4.2],
      [8.0, 8.6, 10.0, 7.6],
    ];
    return Math.min(...segments.map(([ax, ay, bx, by]) => {
      const dx = bx - ax;
      const dy = by - ay;
      const t = Math.max(0, Math.min(1, ((u - ax) * dx + (v - ay) * dy) / (dx * dx + dy * dy)));
      return Math.hypot(u - (ax + dx * t), v - (ay + dy * t));
    }));
  }

  function drawTerrain() {
    const random = seeded(1871);
    const glow = terrain.createRadialGradient(400, 300, 60, 400, 300, 340);
    glow.addColorStop(0, '#1c2e2266');
    glow.addColorStop(1, '#1c2e2200');
    terrain.fillStyle = glow;
    terrain.fillRect(0, 0, WIDTH, HEIGHT);
    ellipse(terrain, 405, 492, 210, 24, '#030c0970');
    ellipse(terrain, 405, 492, 147, 13, '#02080580');

    // The exposed rock faces make the island a little diorama in space.
    for (let u = 0; u < SIZE; u++) {
      for (let v = 0; v < SIZE; v++) {
        if (!land(u, v)) continue;
        const a = project(u, v);
        const b = project(u + 1, v);
        const c = project(u + 1, v + 1);
        const d = project(u, v + 1);
        const depth = 39 + Math.floor(random() * 12);
        if (!land(u + 1, v)) {
          polygon(terrain, [[b.x, b.y], [c.x, c.y], [c.x, c.y + depth], [b.x, b.y + depth - 4]], '#182b23');
          polygon(terrain, [[b.x, b.y + 5], [c.x, c.y + 5], [c.x, c.y + 12], [b.x, b.y + 12]], '#283d2c');
          polygon(terrain, [[b.x - 5, b.y + 17], [c.x + 5, c.y + 15], [c.x + 5, c.y + 20], [b.x - 5, b.y + 23]], '#21352a');
          rect(terrain, c.x + 3, c.y + 24, 4, 9, '#2b3e30');
        }
        if (!land(u, v + 1)) {
          polygon(terrain, [[d.x, d.y], [c.x, c.y], [c.x, c.y + depth], [d.x, d.y + depth - 5]], '#23362a');
          polygon(terrain, [[d.x, d.y + 4], [c.x, c.y + 4], [c.x, c.y + 11], [d.x, d.y + 11]], '#384a30');
          polygon(terrain, [[d.x + 5, d.y + 21], [c.x - 5, c.y + 18], [c.x - 5, c.y + 22], [d.x + 5, d.y + 26]], '#2c402d');
          rect(terrain, d.x + 6, d.y + 25, 6, 5, '#40503a');
        }
      }
    }

    const grass = ['#425b3b', '#3e5739', '#465d3d', '#405a3a', '#3c5238'];
    const sand = ['#ad9770', '#b59d74', '#bba67d', '#ad976e'];
    for (let sum = 0; sum < SIZE * 2; sum++) {
      for (let u = 0; u < SIZE; u++) {
        const v = sum - u;
        if (!land(u, v)) continue;
        const a = project(u, v);
        const b = project(u + 1, v);
        const c = project(u + 1, v + 1);
        const d = project(u, v + 1);
        polygon(terrain, [[a.x, a.y], [b.x, b.y], [c.x, c.y], [d.x, d.y]], grass[Math.floor(random() * grass.length)]);
        // Smaller diamonds make the paths feel hand tiled, with an irregular edge.
        for (let su = 0; su < 4; su++) for (let sv = 0; sv < 4; sv++) {
          const pu = u + su * 0.25;
          const pv = v + sv * 0.25;
          const distance = pathDistance(pu + 0.125, pv + 0.125);
          if (distance < 0.42 + random() * 0.16) {
            const pa = project(pu, pv);
            const pb = project(pu + 0.25, pv);
            const pc = project(pu + 0.25, pv + 0.25);
            const pd = project(pu, pv + 0.25);
            polygon(terrain, [[pa.x, pa.y], [pb.x, pb.y], [pc.x, pc.y], [pd.x, pd.y]], sand[Math.floor(random() * sand.length)]);
            if (random() > 0.75) rect(terrain, pc.x, pc.y - 4, 3, 2, '#8e805f');
          }
        }
        for (let index = 0; index < 5; index++) {
          const pu = u + random();
          const pv = v + random();
          if (pathDistance(pu, pv) < 0.65) continue;
          const position = project(pu, pv);
          rect(terrain, position.x, position.y, 2, 3, '#728451');
          rect(terrain, position.x + 2, position.y + 1, 4, 2, random() > 0.5 ? '#536d43' : '#324e36');
          if (random() > 0.78) {
            rect(terrain, position.x, position.y - 2, 2, 2, random() > 0.5 ? '#ccb689' : '#b2b97a');
          }
        }
      }
    }

    // Small stepping stones, flowers, and trailing vines break up the grid.
    [[8.9, 10.5], [8.65, 10.0], [8.4, 9.5], [5.1, 4.9], [5.5, 5.5]].forEach(([u, v]) => {
      const point = project(u, v);
      polygon(terrain, [[point.x - 10, point.y], [point.x, point.y - 5], [point.x + 12, point.y], [point.x + 1, point.y + 6]], '#c4b48e');
      rect(terrain, point.x - 3, point.y + 3, 5, 2, '#8f8467');
    });
    [[3, 11.8], [5.7, 11.8], [11.8, 7.1], [11.8, 9.8]].forEach(([u, v], index) => {
      const point = project(u, v);
      for (let part = 0; part < 5; part++) {
        rect(terrain, point.x + ((part % 2) * 4), point.y + part * 7, 4, 8, '#456143');
        rect(terrain, point.x - 3 + ((part % 2) * 7), point.y + part * 7 + 2, 7, 3, index % 2 ? '#69804a' : '#577047');
      }
    });
    [[2.0, 7.0], [9.7, 5.5], [6.6, 9.3], [4.4, 2.0]].forEach(([u, v]) => {
      const point = project(u, v);
      rect(terrain, point.x, point.y - 5, 2, 7, '#75915b');
      rect(terrain, point.x - 2, point.y - 6, 6, 4, '#d7a277');
      rect(terrain, point.x + 7, point.y - 1, 2, 7, '#75915b');
      rect(terrain, point.x + 5, point.y - 3, 6, 4, '#e8c98c');
    });
  }

  function drawTree(object) {
    const point = project(object.u, object.v);
    ctx.save();
    ctx.translate(point.x, point.y);
    ctx.scale(object.scale, object.scale);
    ellipse(ctx, 5, 0, 25, 10, '#22352a80');
    rect(ctx, -5, -34, 12, 36, '#66563d');
    rect(ctx, 2, -31, 5, 33, '#3c392c');
    rect(ctx, -7, -5, 5, 8, '#8a7350');
    const canopy = [[0, -101], [-8, -89], [-6, -89], [-18, -74], [-12, -74], [-27, -53], [-20, -53], [-34, -33], [-25, -33], [-39, -16], [-17, -8], [4, -5], [33, -17], [25, -30], [31, -30], [19, -49], [24, -49], [13, -68], [16, -68], [7, -86], [9, -86]];
    polygon(ctx, canopy, '#263e32');
    polygon(ctx, [[0, -99], [-17, -75], [-10, -75], [-26, -54], [-18, -54], [-33, -34], [-24, -34], [-37, -17], [-14, -10], [0, -20], [-8, -20], [0, -37], [-7, -37], [3, -55], [-4, -55], [3, -75]], '#456345');
    polygon(ctx, [[0, -95], [-13, -76], [-5, -77], [-18, -55], [-11, -55], [-23, -35], [-14, -36], [-26, -19], [-14, -22], [-5, -40], [-10, -40], [0, -58], [-4, -59], [4, -76]], '#5b794c');
    rect(ctx, -14, -58, 9, 3, '#799155');
    rect(ctx, -22, -37, 10, 3, '#71874e');
    rect(ctx, -28, -20, 9, 3, '#6f824d');
    rect(ctx, 12, -21, 12, 3, '#35543a');
    rect(ctx, 8, -42, 9, 3, '#35543a');
    ctx.restore();
  }

  function drawCabin(object) {
    const point = project(object.u, object.v);
    ctx.save();
    ctx.translate(point.x, point.y);
    ellipse(ctx, 3, 5, 75, 23, '#16291fa0');
    polygon(ctx, [[-59, -20], [6, 13], [66, -16], [0, -49]], '#8b8566');
    polygon(ctx, [[-59, -20], [6, 13], [6, 21], [-59, -12]], '#6e7256');
    polygon(ctx, [[6, 13], [66, -16], [66, -8], [6, 21]], '#4b5843');
    polygon(ctx, [[-54, -64], [8, -33], [8, 10], [-54, -21]], '#ab9568');
    polygon(ctx, [[8, -33], [61, -59], [61, -16], [8, 10]], '#776c4e');
    for (let y = -53; y < -16; y += 9) {
      polygon(ctx, [[-54, y], [8, y + 31], [8, y + 33], [-54, y + 2]], '#877a55');
      polygon(ctx, [[8, y + 31], [61, y + 5], [61, y + 7], [8, y + 33]], '#625d46');
    }
    polygon(ctx, [[-62, -66], [-15, -109], [53, -75], [8, -30]], '#d38f68');
    polygon(ctx, [[-59, -67], [-15, -103], [46, -74], [7, -36]], '#b96f4f');
    polygon(ctx, [[-15, -109], [53, -75], [68, -59], [8, -30], [53, -75]], '#884b3a');
    polygon(ctx, [[-62, -66], [8, -30], [8, -23], [-62, -58]], '#774638');
    polygon(ctx, [[8, -30], [68, -59], [68, -53], [8, -23]], '#613e31');
    // Individual roof shingles: a little deliberately imperfect pixel texture.
    for (let row = 0; row < 5; row++) {
      const t = (row + 0.5) / 5;
      const lx = -15 - 45 * t;
      const ly = -105 + 39 * t;
      for (let tile = 0; tile < 6; tile++) {
        const x = lx + tile * 10.5;
        const y = ly + tile * 5.25;
        polygon(ctx, [[x, y], [x + 9, y + 4], [x + 7, y + 6], [x - 2, y + 2]], (tile + row) % 3 ? '#c37c58' : '#d49365');
      }
    }
    // Lit workstation window, complete with green code lines.
    polygon(ctx, [[-43, -49], [-12, -34], [-12, -13], [-43, -28]], '#534d38');
    polygon(ctx, [[-40, -46], [-15, -34], [-15, -17], [-40, -29]], '#e0cc83');
    polygon(ctx, [[-38, -44], [-17, -34], [-17, -22], [-38, -32]], '#273d30');
    polygon(ctx, [[-35, -40], [-23, -34], [-23, -32], [-35, -38]], '#c4f68b');
    polygon(ctx, [[-35, -36], [-20, -29], [-20, -27], [-35, -34]], '#8ab56c');
    rect(ctx, -28, -24, 4, 5, '#7d704d');
    polygon(ctx, [[-45, -27], [-10, -10], [-10, -7], [-45, -24]], '#cfb881');
    // Open doorway and a welcoming hanging lamp.
    polygon(ctx, [[22, -27], [41, -36], [41, -7], [22, 2]], '#282f26');
    polygon(ctx, [[25, -25], [38, -31], [38, -9], [25, -2]], '#3e4b34');
    rect(ctx, 28, -17, 3, 3, '#d3d989');
    polygon(ctx, [[20, 2], [43, -9], [50, -5], [27, 7]], '#bdaf85');
    polygon(ctx, [[27, 7], [50, -5], [50, -1], [27, 11]], '#817c5c');
    rect(ctx, 48, -40, 4, 9, '#eac47d');
    rect(ctx, 46, -42, 8, 3, '#d6b276');
    rect(ctx, 46, -31, 8, 3, '#3c4232');
    // Chimney and tiny roof antenna.
    polygon(ctx, [[17, -96], [27, -91], [27, -76], [17, -81]], '#797869');
    polygon(ctx, [[27, -91], [34, -95], [34, -80], [27, -76]], '#50574d');
    polygon(ctx, [[15, -98], [25, -103], [36, -97], [26, -92]], '#919181');
    rect(ctx, -40, -92, 2, 20, '#777d63');
    rect(ctx, -49, -90, 18, 2, '#9faa83');
    rect(ctx, -45, -96, 2, 13, '#9faa83');
    rect(ctx, -36, -94, 2, 12, '#9faa83');
    ctx.restore();
  }

  function drawObservatory(object) {
    const point = project(object.u, object.v);
    ctx.save();
    ctx.translate(point.x, point.y);
    ellipse(ctx, 0, 1, 40, 16, '#243b2a90');
    polygon(ctx, [[-33, -4], [-3, -20], [31, -4], [1, 13]], '#8a8d72');
    polygon(ctx, [[-33, -4], [1, 13], [1, 18], [-33, 1]], '#6b765a');
    polygon(ctx, [[1, 13], [31, -4], [31, 1], [1, 18]], '#455d45');
    polygon(ctx, [[-3, -37], [1, -36], [-17, 4], [-21, 2]], '#b3ae8c');
    polygon(ctx, [[-1, -38], [3, -38], [19, 3], [15, 5]], '#787f6c');
    rect(ctx, -2, -37, 5, 46, '#c7bd9b');
    polygon(ctx, [[-14, -49], [13, -64], [25, -44], [-2, -29]], '#81929b');
    polygon(ctx, [[-14, -49], [13, -64], [16, -59], [-11, -44]], '#c5c5b9');
    polygon(ctx, [[-6, -35], [21, -50], [25, -44], [-2, -29]], '#51666c');
    polygon(ctx, [[11, -66], [19, -69], [31, -46], [24, -41]], '#bdc5b9');
    polygon(ctx, [[18, -65], [21, -62], [28, -47], [25, -45]], '#273e47');
    polygon(ctx, [[20, -61], [23, -57], [26, -49], [23, -49]], '#bda6ef');
    rect(ctx, -22, -41, 13, 6, '#566b6d');
    rect(ctx, -25, -39, 5, 6, '#bdc5b9');
    // Field notebook on a small crate.
    rect(ctx, -41, -14, 17, 14, '#8a714e');
    rect(ctx, -41, -14, 17, 3, '#ba9867');
    rect(ctx, -38, -19, 14, 5, '#a79cb5');
    rect(ctx, -36, -19, 2, 5, '#d8cae5');
    ctx.restore();
  }

  function drawTerminal(object) {
    const point = project(object.u, object.v);
    ctx.save();
    ctx.translate(point.x, point.y);
    ellipse(ctx, 0, 1, 37, 13, '#203429a0');
    polygon(ctx, [[-26, -4], [6, 12], [30, 0], [-2, -16]], '#8b8d6f');
    polygon(ctx, [[-26, -4], [6, 12], [6, 17], [-26, 1]], '#6b7259');
    polygon(ctx, [[6, 12], [30, 0], [30, 5], [6, 17]], '#475441');
    polygon(ctx, [[-24, -63], [7, -48], [7, 10], [-24, -5]], '#657c72');
    polygon(ctx, [[7, -48], [27, -58], [27, -1], [7, 10]], '#3f594f');
    polygon(ctx, [[-24, -63], [-3, -73], [27, -58], [7, -48]], '#8a9c83');
    polygon(ctx, [[-22, -64], [-3, -73], [26, -59], [7, -50]], '#7b9381');
    polygon(ctx, [[-20, -54], [2, -44], [2, -23], [-20, -33]], '#d4c286');
    polygon(ctx, [[-17, -50], [-1, -43], [-1, -28], [-17, -36]], '#1f3830');
    polygon(ctx, [[-15, -45], [-3, -39], [-3, -33], [-15, -39]], '#baf18c');
    polygon(ctx, [[-15, -45], [-9, -38], [-3, -39], [-9, -41]], '#629665');
    polygon(ctx, [[-22, -28], [4, -15], [9, -20], [-17, -33]], '#859b82');
    rect(ctx, -11, -23, 4, 3, '#f3b981');
    rect(ctx, -4, -19, 4, 3, '#c6f293');
    polygon(ctx, [[-14, -10], [-1, -4], [-1, 0], [-14, -6]], '#304b40');
    polygon(ctx, [[14, -46], [21, -49], [21, -22], [14, -19]], '#324c42');
    rect(ctx, 7, -90, 3, 21, '#849481');
    rect(ctx, 5, -92, 7, 5, '#e5af79');
    rect(ctx, -2, -81, 20, 2, '#677e6c');
    ctx.restore();
  }

  function drawFire(object, time) {
    const point = project(object.u, object.v);
    ellipse(ctx, point.x, point.y - 4, 29, 15, '#e8ad6220');
    ellipse(ctx, point.x, point.y, 23, 10, '#303e2d');
    const stones = [[-19, 0], [-13, 6], [0, 8], [14, 5], [20, -2], [13, -7], [-11, -7]];
    stones.forEach(([x, y], i) => {
      rect(ctx, point.x + x - 4, point.y + y - 3, 9, 6, i < 4 ? '#98957b' : '#6a755c');
      rect(ctx, point.x + x - 3, point.y + y - 3, 5, 2, '#b2a58a');
    });
    polygon(ctx, [[point.x - 12, point.y - 4], [point.x + 11, point.y + 3], [point.x + 14, point.y], [point.x - 9, point.y - 8]], '#947045');
    polygon(ctx, [[point.x - 11, point.y + 3], [point.x + 10, point.y - 8], [point.x + 12, point.y - 4], [point.x - 9, point.y + 6]], '#674c32');
    const shift = reducedMotion.matches ? 0 : Math.sin(time * 7) * 3;
    polygon(ctx, [[point.x - 11, point.y - 5], [point.x - 8, point.y - 18], [point.x - 3, point.y - 12], [point.x + 1, point.y - 31 + shift], [point.x + 8, point.y - 19], [point.x + 10, point.y - 23], [point.x + 13, point.y - 8], [point.x + 7, point.y + 1], [point.x - 6, point.y + 1]], '#de8550');
    polygon(ctx, [[point.x - 7, point.y - 6], [point.x - 3, point.y - 18], [point.x + 1, point.y - 11], [point.x + 5, point.y - 22 - shift], [point.x + 8, point.y - 6], [point.x + 4, point.y - 1], [point.x - 4, point.y - 1]], '#f0bd6c');
    rect(ctx, point.x - 2, point.y - 9, 6, 8, '#fae1a0');
  }

  function drawDecoration(object, time) {
    const p = project(object.u, object.v);
    if (object.type === 'fire') return drawFire(object, time);
    if (object.type === 'rocks') {
      polygon(ctx, [[p.x - 15, p.y], [p.x - 10, p.y - 13], [p.x + 2, p.y - 15], [p.x + 9, p.y - 5], [p.x + 4, p.y + 3]], '#929581');
      polygon(ctx, [[p.x + 2, p.y - 15], [p.x + 9, p.y - 5], [p.x + 4, p.y + 3], [p.x - 2, p.y + 1]], '#667860');
      rect(ctx, p.x + 10, p.y - 4, 9, 7, '#828c72');
    } else if (object.type === 'sign') {
      rect(ctx, p.x - 2, p.y - 26, 4, 31, '#8b7851');
      polygon(ctx, [[p.x - 17, p.y - 33], [p.x + 14, p.y - 33], [p.x + 21, p.y - 26], [p.x + 14, p.y - 19], [p.x - 17, p.y - 19]], '#c4a576');
      rect(ctx, p.x - 11, p.y - 28, 20, 3, '#705f45');
      rect(ctx, p.x + 6, p.y - 30, 3, 7, '#705f45');
    } else if (object.type === 'log') {
      polygon(ctx, [[p.x - 20, p.y - 8], [p.x + 12, p.y + 7], [p.x + 19, p.y + 1], [p.x - 13, p.y - 14]], '#8b7048');
      polygon(ctx, [[p.x - 20, p.y - 8], [p.x + 12, p.y + 7], [p.x + 12, p.y + 13], [p.x - 20, p.y - 2]], '#65543a');
      rect(ctx, p.x + 11, p.y + 4, 8, 8, '#b59b66');
      rect(ctx, p.x + 13, p.y + 6, 3, 3, '#806642');
    } else if (object.type === 'bench') {
      rect(ctx, p.x - 21, p.y - 4, 4, 12, '#6a6848');
      rect(ctx, p.x + 19, p.y - 2, 4, 12, '#5c6043');
      polygon(ctx, [[p.x - 29, p.y - 8], [p.x - 15, p.y - 15], [p.x + 30, p.y + 6], [p.x + 16, p.y + 13]], '#a58b5b');
      polygon(ctx, [[p.x - 29, p.y - 8], [p.x + 16, p.y + 13], [p.x + 16, p.y + 17], [p.x - 29, p.y - 4]], '#6e6846');
      polygon(ctx, [[p.x - 22, p.y - 11], [p.x + 23, p.y + 9], [p.x + 25, p.y + 7], [p.x - 20, p.y - 13]], '#c1a576');
    }
  }

  function drawPlayer(time) {
    const p = project(player.u, player.v);
    const bob = player.moving && !reducedMotion.matches ? Math.sin(time * 17) * 1.5 : 0;
    const step = player.moving ? Math.sin(time * 17) * 3 : 0;
    const y = p.y + bob;
    ellipse(ctx, p.x, p.y + 2, 12, 5, '#172b2570');
    if (started) {
      ctx.strokeStyle = '#c4eb8580';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + 1, 17, 8, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    rect(ctx, p.x - 7, y - 10, 6, 10 + step, '#3c4a47');
    rect(ctx, p.x + 1, y - 10, 6, 10 - step, '#293a38');
    rect(ctx, p.x - 9, y - 2 + step, 8, 4, '#d9d1ab');
    rect(ctx, p.x + 1, y - 2 - step, 8, 4, '#c2c3a2');
    rect(ctx, p.x - 10, y - 24, 20, 17, '#c3dba1');
    rect(ctx, p.x + 5, y - 24, 5, 17, '#83a374');
    rect(ctx, p.x - 13, y - 23 + step / 2, 5, 13, '#a5be8b');
    rect(ctx, p.x + 9, y - 23 - step / 2, 5, 13, '#7f9e72');
    rect(ctx, p.x - 13, y - 12 + step / 2, 5, 5, '#d3a47c');
    rect(ctx, p.x + 9, y - 12 - step / 2, 5, 5, '#c48f6c');
    // Rust-colored backpack with a brass clasp.
    const back = player.facing === 'up';
    if (back) {
      rect(ctx, p.x - 7, y - 23, 15, 17, '#9c694a');
      rect(ctx, p.x - 5, y - 22, 11, 6, '#ce9960');
      rect(ctx, p.x - 5, y - 13, 11, 5, '#b88350');
      rect(ctx, p.x, y - 18, 3, 5, '#e4c78c');
    } else {
      rect(ctx, p.x - 8, y - 24, 3, 16, '#b08c59');
      rect(ctx, p.x + 5, y - 24, 3, 16, '#947a50');
    }
    rect(ctx, p.x - 8, y - 39, 16, 16, '#dba881');
    rect(ctx, p.x - 10, y - 42, 19, 8, '#3e362c');
    rect(ctx, p.x - 10, y - 37, 5, 9, '#3e362c');
    rect(ctx, p.x - 7, y - 44, 14, 3, '#584535');
    rect(ctx, p.x + 6, y - 36, 4, 7, '#48392e');
    if (back) {
      rect(ctx, p.x - 7, y - 36, 14, 9, '#493a2e');
    } else {
      const look = player.facing === 'left' ? -2 : player.facing === 'right' ? 2 : 0;
      rect(ctx, p.x - 4 + look, y - 32, 3, 3, '#323c32');
      rect(ctx, p.x + 3 + look, y - 32, 3, 3, '#323c32');
      rect(ctx, p.x - 1 + look, y - 26, 5, 2, '#b87859');
    }
  }

  function drawCrystal(crystal, time) {
    if (collected.has(crystal.id)) return;
    const p = project(crystal.u, crystal.v);
    const bob = reducedMotion.matches ? 0 : Math.sin(time * 2.4 + crystal.u) * 3;
    ellipse(ctx, p.x, p.y + 1, 13, 5, '#192f2680');
    ellipse(ctx, p.x, p.y - 10, 22, 18, crystal.color + '0b');
    polygon(ctx, [[p.x, p.y - 29 + bob], [p.x + 8, p.y - 16 + bob], [p.x, p.y - 3 + bob], [p.x - 8, p.y - 16 + bob]], crystal.color);
    polygon(ctx, [[p.x, p.y - 29 + bob], [p.x, p.y - 3 + bob], [p.x - 8, p.y - 16 + bob]], '#ffffff50');
    polygon(ctx, [[p.x, p.y - 29 + bob], [p.x + 8, p.y - 16 + bob], [p.x, p.y - 16 + bob]], '#ffffff30');
    rect(ctx, p.x - 14, p.y - 24 + bob, 2, 2, crystal.color);
    rect(ctx, p.x + 13, p.y - 11 - bob, 2, 2, crystal.color);
  }

  function stationAt(x, y) {
    return stations.find(station => {
      const p = project(station.u, station.v);
      return (Math.abs(x - p.x) < station.width / 2 + 4 && y > p.y + station.labelY - 5 && y < p.y + station.labelY + 27) ||
        (Math.abs(x - p.x) < 32 && y > p.y - 61 && y < p.y + 12);
    });
  }

  function nearbyStation() {
    return stations.find(station => Math.hypot(player.u - station.entry.u, player.v - station.entry.v) < 1.55);
  }

  function drawLabels() {
    const nearby = nearbyStation();
    stations.forEach(station => {
      const p = project(station.u, station.v);
      const x = p.x - station.width / 2;
      const y = p.y + station.labelY;
      const active = nearby === station || hover === station.id;
      rect(ctx, x - 2, y - 2, station.width + 4, 28, active ? station.color : '#445645');
      rect(ctx, x, y, station.width, 24, active ? '#24392b' : '#17261e');
      ctx.font = 'bold 14px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = station.color;
      ctx.fillText(station.label, p.x, y + 13);
      polygon(ctx, [[p.x - 4, y + 26], [p.x + 4, y + 26], [p.x, y + 30]], active ? station.color : '#445645');
      if (active && nearby === station && started) {
        rect(ctx, p.x - 10, p.y + 17, 20, 20, '#d1e7a4');
        ctx.fillStyle = '#24392b';
        ctx.fillText('E', p.x, p.y + 27);
      }
    });
  }

  function paint(time = 0) {
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    ctx.drawImage(ground, 0, 0, WIDTH, HEIGHT);
    const sorted = [...objects, ...crystals.filter(crystal => !collected.has(crystal.id)).map(crystal => ({ ...crystal, type: 'crystal' })), { u: player.u, v: player.v, type: 'player' }].sort((a, b) => a.u + a.v - b.u - b.v);
    sorted.forEach(object => {
      switch (object.type) {
        case 'tree': drawTree(object); break;
        case 'cabin': drawCabin(object); break;
        case 'observatory': drawObservatory(object); break;
        case 'terminal': drawTerminal(object); break;
        case 'player': drawPlayer(time); break;
        case 'crystal': drawCrystal(object, time); break;
        default: drawDecoration(object, time);
      }
    });
    if (destination && route.length) {
      const p = project(destination.u, destination.v);
      polygon(ctx, [[p.x - 9, p.y], [p.x, p.y - 5], [p.x + 9, p.y], [p.x, p.y + 5]], '#dcf3a044');
      rect(ctx, p.x - 2, p.y - 2, 4, 4, '#d5f099');
    }
    if (!reducedMotion.matches) {
      // A few fireflies, chimney smoke, and embers; never a distracting particle cloud.
      for (let i = 0; i < 9; i++) {
        const x = 180 + ((i * 71) % 440) + Math.sin(time * 0.6 + i) * 8;
        const y = 182 + ((i * 47) % 208) + Math.cos(time * 0.8 + i) * 7;
        ctx.globalAlpha = 0.35 + Math.sin(time * 1.7 + i * 2) * 0.25;
        rect(ctx, x, y, 2, 2, '#e1eda4');
      }
      ctx.globalAlpha = 1;
      const cabin = project(stations[0].u, stations[0].v);
      for (let i = 0; i < 3; i++) {
        const progress = (time * 0.19 + i / 3) % 1;
        ctx.globalAlpha = (1 - progress) * 0.2;
        rect(ctx, cabin.x + 20 + progress * 10, cabin.y - 108 - progress * 35, 8 + progress * 8, 6 + progress * 4, '#b3b89c');
      }
      ctx.globalAlpha = 1;
    }
    if (sparkle) {
      const age = time - sparkle.time;
      if (age > 1.2) sparkle = null;
      else {
        ctx.globalAlpha = 1 - age / 1.2;
        ctx.font = 'bold 14px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#d6f7a2';
        ctx.fillText('+25 XP', sparkle.x, sparkle.y - 32 - age * 22);
        ctx.globalAlpha = 1;
      }
    }
    drawLabels();
    output.clearRect(0, 0, WIDTH, HEIGHT);
    output.drawImage(scene, 0, 0, WIDTH, HEIGHT);
  }

  function updateHint() {
    if (!hint) return;
    const nearby = nearbyStation();
    const value = announcement || (nearby && started ? `Press E to explore ${nearby.label.toLowerCase()}` :
      started ? 'WASD / arrows to move · E to interact · collect the crystals' : 'Click to wander. There’s a little more to discover.');
    if (hint.textContent !== value) hint.textContent = value;
  }

  function updateCounter() {
    if (gemCounter) gemCounter.textContent = `${collected.size} / 3`;
  }

  function collectNearby(time) {
    crystals.forEach(crystal => {
      if (collected.has(crystal.id) || Math.hypot(player.u - crystal.u, player.v - crystal.v) > 0.48) return;
      collected.add(crystal.id);
      const point = project(crystal.u, crystal.v);
      sparkle = { ...point, time };
      updateCounter();
      document.dispatchEvent(new CustomEvent('portfolio:collect', { detail: { id: crystal.id, label: 'World explorer', xp: 25 } }));
    });
  }

  function move(dx, dy, seconds) {
    const speed = 82;
    const length = Math.hypot(dx, dy);
    if (!length) return false;
    const sx = dx / length * speed * seconds;
    const sy = dy / length * speed * seconds;
    const du = (sx / TW + sy / TH) / 2;
    const dv = (sy / TH - sx / TW) / 2;
    let moved = false;
    if (traversable(player.u + du, player.v + dv)) {
      player.u += du;
      player.v += dv;
      moved = true;
    } else {
      if (traversable(player.u + du, player.v)) { player.u += du; moved = true; }
      if (traversable(player.u, player.v + dv)) { player.v += dv; moved = true; }
    }
    if (moved) player.facing = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down');
    return moved;
  }

  function update(seconds, time) {
    let dx = (keys.has('right') ? 1 : 0) - (keys.has('left') ? 1 : 0);
    let dy = (keys.has('down') ? 1 : 0) - (keys.has('up') ? 1 : 0);
    player.moving = false;
    if (dx || dy) {
      route = [];
      destination = null;
      player.moving = move(dx, dy, seconds);
    } else if (route.length) {
      const p = project(player.u, player.v);
      const next = project(route[0].u, route[0].v);
      dx = next.x - p.x;
      dy = next.y - p.y;
      if (Math.hypot(dx, dy) < 3) {
        route.shift();
      } else player.moving = move(dx, dy, seconds);
      if (!route.length) destination = null;
    }
    collectNearby(time);
    updateHint();
  }

  function tick(timestamp) {
    frame = 0;
    if (!inView || document.hidden) return;
    const seconds = lastTime ? Math.min((timestamp - lastTime) / 1000, 0.045) : 0;
    lastTime = timestamp;
    update(seconds, timestamp / 1000);
    if (timestamp - lastPaint > 30 || reducedMotion.matches) {
      paint(timestamp / 1000);
      lastPaint = timestamp;
    }
    if (!reducedMotion.matches || keys.size || route.length || sparkle) frame = requestAnimationFrame(tick);
  }

  function wake() {
    if (!frame && inView && !document.hidden) {
      lastTime = 0;
      frame = requestAnimationFrame(tick);
    }
  }

  function stop() {
    cancelAnimationFrame(frame);
    frame = 0;
    lastTime = 0;
    keys.clear();
    player.moving = false;
  }

  // A small A* grid lets point-and-click movement navigate around trees and buildings.
  function findRoute(target) {
    const resolution = 4;
    const span = SIZE * resolution;
    const index = (u, v) => v * span + u;
    const pointAt = (u, v) => ({ u: (u + 0.5) / resolution, v: (v + 0.5) / resolution });
    const start = { u: Math.floor(player.u * resolution), v: Math.floor(player.v * resolution) };
    let goal = { u: Math.floor(target.u * resolution), v: Math.floor(target.v * resolution) };
    if (goal.u < 0 || goal.v < 0 || goal.u >= span || goal.v >= span) return [];
    const canVisit = (u, v) => {
      if (u < 0 || v < 0 || u >= span || v >= span) return false;
      const point = pointAt(u, v);
      return traversable(point.u, point.v);
    };
    if (!canVisit(goal.u, goal.v)) {
      let best = null;
      let distance = Infinity;
      for (let u = goal.u - 7; u <= goal.u + 7; u++) for (let v = goal.v - 7; v <= goal.v + 7; v++) {
        if (!canVisit(u, v)) continue;
        const d = Math.hypot(u - goal.u, v - goal.v);
        if (d < distance) { distance = d; best = { u, v }; }
      }
      if (!best) return [];
      goal = best;
    }
    const startIndex = index(start.u, start.v);
    const goalIndex = index(goal.u, goal.v);
    const opened = [{ ...start, g: 0, f: 0, id: startIndex }];
    const costs = new Map([[startIndex, 0]]);
    const parents = new Map();
    const closed = new Set();
    const directions = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]];
    while (opened.length) {
      let lowest = 0;
      for (let i = 1; i < opened.length; i++) if (opened[i].f < opened[lowest].f) lowest = i;
      const current = opened.splice(lowest, 1)[0];
      if (current.id === goalIndex) {
        const result = [];
        let cursor = current.id;
        while (cursor !== startIndex) {
          result.unshift(pointAt(cursor % span, Math.floor(cursor / span)));
          cursor = parents.get(cursor);
          if (cursor === undefined) return [];
        }
        if (traversable(target.u, target.v)) result.push(target);
        return result;
      }
      if (closed.has(current.id)) continue;
      closed.add(current.id);
      directions.forEach(([du, dv]) => {
        const u = current.u + du;
        const v = current.v + dv;
        const id = index(u, v);
        if (closed.has(id) || !canVisit(u, v)) return;
        if (du && dv && (!canVisit(current.u + du, current.v) || !canVisit(current.u, current.v + dv))) return;
        const g = current.g + Math.hypot(du, dv);
        if (costs.has(id) && costs.get(id) <= g) return;
        costs.set(id, g);
        parents.set(id, current.id);
        opened.push({ u, v, id, g, f: g + Math.hypot(goal.u - u, goal.v - v) });
      });
    }
    return [];
  }

  function navigate(station) {
    keys.clear();
    route = [];
    destination = null;
    document.dispatchEvent(new CustomEvent('portfolio:navigate', { detail: { section: station.id } }));
  }

  function begin() {
    started = true;
    canvas.focus({ preventScroll: true });
    announcement = null;
    updateHint();
    wake();
  }

  const keyDirections = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', a: 'left', s: 'down', d: 'right' };
  canvas.addEventListener('keydown', event => {
    if (event.ctrlKey || event.metaKey || event.altKey || document.querySelector('dialog[open]')) return;
    const direction = keyDirections[event.key] || keyDirections[event.key.toLowerCase()];
    if (direction) {
      event.preventDefault();
      started = true;
      announcement = null;
      keys.add(direction);
      wake();
    } else if (event.key.toLowerCase() === 'e' || event.key === 'Enter') {
      event.preventDefault();
      if (event.repeat) return;
      const station = nearbyStation();
      if (station) navigate(station);
      else {
        started = true;
        announcement = 'Walk up to a station, then press E to explore.';
        updateHint();
        wake();
      }
    }
  });
  window.addEventListener('keyup', event => {
    const direction = keyDirections[event.key] || keyDirections[event.key.toLowerCase()];
    if (direction) keys.delete(direction);
  });
  canvas.addEventListener('blur', () => { keys.clear(); });
  window.addEventListener('blur', stop);
  window.addEventListener('focus', wake);

  function canvasPoint(event) {
    const bounds = canvas.getBoundingClientRect();
    return { x: (event.clientX - bounds.left) / bounds.width * WIDTH, y: (event.clientY - bounds.top) / bounds.height * HEIGHT };
  }

  canvas.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    begin();
    const point = canvasPoint(event);
    const station = stationAt(point.x, point.y);
    if (station) return navigate(station);
    let target = unproject(point.x, point.y);
    const crystal = crystals.find(item => {
      const p = project(item.u, item.v);
      return !collected.has(item.id) && Math.abs(point.x - p.x) < 17 && point.y > p.y - 35 && point.y < p.y + 5;
    });
    if (crystal) target = { u: crystal.u, v: crystal.v };
    if (!land(target.u, target.v)) return;
    route = findRoute(target);
    destination = route.length ? route[route.length - 1] : null;
    wake();
  });
  canvas.addEventListener('pointermove', event => {
    const point = canvasPoint(event);
    const station = stationAt(point.x, point.y);
    const nextHover = station ? station.id : null;
    canvas.style.cursor = station ? 'pointer' : 'crosshair';
    if (nextHover !== hover) { hover = nextHover; wake(); }
  });
  canvas.addEventListener('pointerleave', () => { hover = null; wake(); });

  document.querySelectorAll('[data-move]').forEach(button => {
    const direction = button.dataset.move;
    if (!['up', 'down', 'left', 'right'].includes(direction)) return;
    button.addEventListener('pointerdown', event => {
      event.preventDefault();
      begin();
      keys.add(direction);
      if (button.setPointerCapture) button.setPointerCapture(event.pointerId);
      wake();
    });
    const release = () => keys.delete(direction);
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
    button.addEventListener('lostpointercapture', release);
    // Keyboard and screen-reader activation moves one small step, too.
    button.addEventListener('click', event => {
      if (event.detail !== 0) return;
      begin();
      const vector = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[direction];
      move(vector[0], vector[1], 0.12);
      wake();
    });
  });

  document.addEventListener('portfolio:start', begin);
  document.addEventListener('portfolio:reset', () => {
    collected.clear();
    player.u = home.u;
    player.v = home.v;
    player.facing = 'down';
    player.moving = false;
    route = [];
    destination = null;
    keys.clear();
    sparkle = null;
    announcement = null;
    updateCounter();
    updateHint();
    wake();
  });
  document.addEventListener('portfolio:progress', event => {
    const completed = event.detail && event.detail.completed;
    if (!Array.isArray(completed)) return;
    collected.clear();
    crystals.forEach(crystal => { if (completed.includes(crystal.id)) collected.add(crystal.id); });
    updateCounter();
    wake();
  });
  document.addEventListener('visibilitychange', () => document.hidden ? stop() : wake());
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      inView = entries[0].isIntersecting;
      if (inView) wake(); else stop();
    }, { threshold: 0.01 });
    observer.observe(canvas);
  }
  reducedMotion.addEventListener('change', wake);

  drawTerrain();
  updateCounter();
  updateHint();
  paint();
  wake();
  document.dispatchEvent(new CustomEvent('portfolio:request-progress'));
})();
