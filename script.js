const canvas = document.getElementById('graphCanvas');
const ctx    = canvas.getContext('2d');

let nodes         = [];   // { id, x, y, label }
let edges         = [];   // { from, to, weight }
let finalPath     = [];   // node IDs on shortest path (never mutated during animation)
let revealedEdges = [];   // edges revealed step by step: [{from,to,weight}]
let isAnimating   = false;
let nodeCounter   = 0;

// --- Colours ---
const C = {
  nodeDefault:  '#1e1b4b',
  nodeStroke:   '#7c3aed',
  nodeStart:    '#1e40af',
  nodeEnd:      '#7f1d1d',
  nodePath:     '#064e3b',
  ringDefault:  '#7c3aed',
  ringStart:    '#3b82f6',
  ringEnd:      '#ef4444',
  ringPath:     '#10b981',
  edgeDefault:  '#334155',
  edgeWeight:   '#94a3b8',
  pathLine:     '#39ff14',
  text:         '#e2e8f0',
};

//  Canvas sizing

function resizeCanvas() {
  const container = canvas.parentElement;
  canvas.width  = container.clientWidth;
  canvas.height = Math.max(500, container.clientHeight || 500);
  draw();
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();


//  DRAW

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  edges.forEach(e => drawRegularEdge(e));
  revealedEdges.forEach(pe => drawPathEdge(pe));
  nodes.forEach(n => drawNode(n));
}

function drawRegularEdge(edge) {
  const a = nodeById(edge.from);
  const b = nodeById(edge.to);
  if (!a || !b) return;
  ctx.save();
  ctx.strokeStyle = C.edgeDefault;
  ctx.lineWidth   = 1.8;
  ctx.lineCap     = 'round';
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.restore();
  drawWeightPill((a.x+b.x)/2, (a.y+b.y)/2, edge.weight, false);
}

function drawPathEdge(pe) {
  const a = nodeById(pe.from);
  const b = nodeById(pe.to);
  if (!a || !b) return;

  // Same thickness as regular edges, just lime green color
  ctx.save();
  ctx.strokeStyle = C.pathLine;
  ctx.lineWidth   = 1.8;
  ctx.lineCap     = 'round';
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.restore();

  drawWeightPill((a.x+b.x)/2, (a.y+b.y)/2, pe.weight, true);
}

function drawWeightPill(x, y, weight, onPath) {
  ctx.save();
  ctx.font = 'bold 13px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const tw = ctx.measureText(String(weight)).width + 12;
  ctx.fillStyle = onPath ? 'rgba(0,0,0,0.85)' : 'rgba(13,17,23,0.82)';
  ctx.beginPath();
  ctx.roundRect(x - tw/2, y - 9, tw, 18, 5);
  ctx.fill();
  ctx.fillStyle = onPath ? C.pathLine : C.edgeWeight;
  ctx.fillText(weight, x, y);
  ctx.restore();
}

function drawNode(node) {
  const startId  = parseInt(document.getElementById('startNode').value);
  const endId    = parseInt(document.getElementById('endNode').value);
  const isStart  = node.id === startId;
  const isEnd    = node.id === endId;
  const isOnPath = finalPath.includes(node.id);
  const r = 22;

  ctx.save();
  const ringColor = isStart ? C.ringStart : isEnd ? C.ringEnd : isOnPath ? C.ringPath : C.ringDefault;
  ctx.shadowColor = ringColor;
  ctx.shadowBlur  = (isStart || isEnd || isOnPath) ? 22 : 8;

  ctx.beginPath();
  ctx.arc(node.x, node.y, r + 3, 0, Math.PI * 2);
  ctx.strokeStyle = ringColor;
  ctx.lineWidth   = isOnPath ? 3 : 1.5;
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.beginPath();
  ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
  const g = ctx.createRadialGradient(node.x-6, node.y-6, 2, node.x, node.y, r);
  const inner = isStart ? '#1d4ed8' : isEnd ? '#991b1b' : isOnPath ? '#065f46' : '#1e1b4b';
  const outer = isStart ? '#1e40af' : isEnd ? '#7f1d1d' : isOnPath ? '#064e3b' : '#0f0e2a';
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.fillStyle = C.text;
  ctx.font = 'bold 13px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(node.label, node.x, node.y);
  ctx.restore();
}


//  Helpers

function nodeById(id) {
  return nodes.find(n => n.id == id) || null;
}

function updateSelects() {
  ['startNode','endNode'].forEach(selId => {
    const sel  = document.getElementById(selId);
    const prev = sel.value;
    while (sel.options.length > 1) sel.remove(1);
    nodes.forEach(n => {
      const o = document.createElement('option');
      o.value = n.id;
      o.text  = 'Node ' + n.label;
      sel.add(o);
    });
    sel.value = prev;
  });
}

function updateStats() {
  document.getElementById('totalNodes').textContent = nodes.length;
  document.getElementById('totalEdges').textContent = edges.length;
}


//  Dijkstra

function dijkstra(srcId, dstId) {
  const dist = {};
  const prev = {};
  const seen = new Set();

  nodes.forEach(n => { dist[n.id] = Infinity; prev[n.id] = null; });
  dist[srcId] = 0;

  while (true) {
    let u = null;
    nodes.forEach(n => {
      if (!seen.has(n.id) && (u === null || dist[n.id] < dist[u])) u = n.id;
    });
    if (u === null || dist[u] === Infinity || u == dstId) break;
    seen.add(u);

    edges.forEach(e => {
      let v = null;
      if (e.from == u) v = e.to;
      else if (e.to == u) v = e.from;
      if (v === null || seen.has(v)) return;
      const alt = dist[u] + e.weight;
      if (alt < dist[v]) { dist[v] = alt; prev[v] = u; }
    });
  }

  if (dist[dstId] === Infinity) return null;

  const path = [];
  let cur = dstId;
  while (cur != null) {
    path.unshift(Number(cur));
    cur = prev[cur];
  }
  if (path[0] !== Number(srcId)) return null;

  return { path, totalDist: dist[dstId] };
}


//  Find Path button

document.getElementById('findPathBtn').addEventListener('click', () => {
  if (isAnimating) return;

  const startId = parseInt(document.getElementById('startNode').value);
  const endId   = parseInt(document.getElementById('endNode').value);

  if (isNaN(startId) || isNaN(endId)) { flash('Please select Start and End nodes.'); return; }
  if (startId === endId)               { flash('Start and End must be different.');   return; }
  if (nodes.length < 2)                { flash('Load a preset graph first.');         return; }

  const result = dijkstra(startId, endId);

  if (!result) {
    flash('No path found between selected nodes.');
    finalPath = []; revealedEdges = []; draw();
    return;
  }

  finalPath     = result.path;
  revealedEdges = [];

  // Build all edges at once
  for (let i = 0; i < finalPath.length - 1; i++) {
    const f = finalPath[i];
    const t = finalPath[i + 1];
    const e = edges.find(e => (e.from==f&&e.to==t)||(e.from==t&&e.to==f));
    revealedEdges.push({ from: f, to: t, weight: e ? e.weight : '' });
  }

  // Update info panel
  document.getElementById('shortestDistance').textContent = result.totalDist;
  document.getElementById('pathNodes').textContent        = finalPath.length;
  const labels = finalPath.map(id => nodeById(id) ? nodeById(id).label : '?').join(' → ');
  document.getElementById('pathSequence').innerHTML =
    '<span style="color:#94a3b8;font-size:0.8rem">Shortest Path:</span><br>' +
    '<span style="color:#39ff14;font-weight:bold;letter-spacing:1px">' + labels + '</span><br><br>' +
    '<span style="color:#94a3b8;font-size:0.8rem">Total Weight: </span>' +
    '<span style="color:#f59e0b;font-weight:bold">' + result.totalDist + '</span>';

  draw();
});


//  Clear button

document.getElementById('clearGraphBtn').addEventListener('click', () => {
  nodes = []; edges = [];
  finalPath = []; revealedEdges = [];
  nodeCounter = 0; isAnimating = false;
  updateSelects(); updateStats();
  document.getElementById('shortestDistance').textContent = '-';
  document.getElementById('pathNodes').textContent        = '-';
  document.getElementById('pathSequence').innerHTML       = '';
  draw();
});


//  Preset Graphs

document.getElementById('presetGraph').addEventListener('change', function () {
  const val = this.value;
  if (!val) return;

  nodes = []; edges = []; finalPath = []; revealedEdges = [];
  nodeCounter = 0; isAnimating = false;

  const W = canvas.width, H = canvas.height;
  const cx = W / 2, cy = H / 2;

  const presets = {
    simple: {
      n: [[cx,cy-150],[cx+150,cy-50],[cx+100,cy+130],[cx-100,cy+130],[cx-150,cy-50]],
      e: [[0,1,4],[0,4,2],[1,2,5],[1,4,1],[2,3,3],[3,4,7],[2,4,6]]
    },
    city: {
      n: [[cx-180,cy-120],[cx,cy-180],[cx+180,cy-120],[cx+200,cy+40],
          [cx+80,cy+160],[cx-80,cy+160],[cx-200,cy+40],[cx,cy]],
      e: [[0,1,7],[1,2,6],[2,3,5],[3,4,8],[4,5,4],[5,6,6],[6,0,9],
          [0,7,3],[1,7,4],[2,7,5],[3,7,6],[4,7,3],[5,7,2],[6,7,4]]
    },
    complex: {
      n: [[cx-200,cy-100],[cx-80,cy-180],[cx+80,cy-180],[cx+200,cy-100],
          [cx+200,cy+80],[cx+80,cy+180],[cx-80,cy+180],[cx-200,cy+80],
          [cx-50,cy-40],[cx+50,cy+40]],
      e: [[0,1,3],[1,2,5],[2,3,4],[3,4,6],[4,5,3],[5,6,5],[6,7,4],[7,0,7],
          [0,8,6],[2,8,4],[3,9,5],[5,9,3],[8,9,2],[1,8,3],[7,8,5]]
    },
    dense: {
      n: [[cx-200,cy-150],[cx-70,cy-180],[cx+70,cy-180],[cx+200,cy-150],
          [cx+230,cy],[cx+200,cy+150],[cx+70,cy+180],[cx-70,cy+180],
          [cx-200,cy+150],[cx-230,cy],[cx,cy-80],[cx,cy+80]],
      e: [[0,1,4],[1,2,3],[2,3,5],[3,4,4],[4,5,6],[5,6,3],[6,7,4],[7,8,5],[8,9,3],[9,0,6],
          [0,10,8],[1,10,5],[2,10,4],[3,10,7],[10,11,3],[6,11,5],[7,11,4],[8,11,6],[4,11,8]]
    },
    grid: {
      n: [
        [cx-160,cy-160],[cx-80,cy-160],[cx,cy-160],[cx+80,cy-160],[cx+160,cy-160],
        [cx-160,cy-60 ],[cx-80,cy-60 ],[cx,cy-60 ],[cx+80,cy-60 ],[cx+160,cy-60 ],
        [cx-160,cy+60 ],[cx-80,cy+60 ],[cx,cy+60 ],[cx+80,cy+60 ],[cx+160,cy+60 ]
      ],
      e: [
        [0,1,3],[1,2,4],[2,3,2],[3,4,5],
        [5,6,3],[6,7,4],[7,8,3],[8,9,2],
        [10,11,5],[11,12,3],[12,13,4],[13,14,2],
        [0,5,4],[5,10,3],[1,6,5],[6,11,4],[2,7,3],[7,12,5],
        [3,8,4],[8,13,3],[4,9,5],[9,14,4],
        [0,6,6],[1,7,5],[6,12,6],[7,13,4],[2,8,6]
      ]
    },
    large: {
      n: Array.from({length:20}, (_,i) => {
        const angle = (i / 20) * Math.PI * 2;
        const r = i % 2 === 0 ? 180 : 90;
        return [cx + Math.cos(angle)*r, cy + Math.sin(angle)*r];
      }),
      e: []
    }
  };

  if (val === 'large') {
    const p = presets.large;
    for (let i = 0; i < 20; i++)
      p.e.push([i, (i+1)%20, Math.floor(Math.random()*10)+1]);
    for (let i = 0; i < 20; i += 2)
      p.e.push([i, i+1, Math.floor(Math.random()*8)+1]);
    for (let i = 0; i < 10; i++) {
      const a = Math.floor(Math.random()*20), b = Math.floor(Math.random()*20);
      if (a !== b) p.e.push([a, b, Math.floor(Math.random()*12)+1]);
    }
  }

  const preset = presets[val];
  preset.n.forEach(([x, y]) => {
    nodes.push({
      id:    nodeCounter,
      x:     Math.round(x),
      y:     Math.round(y),
      label: String.fromCharCode(65 + nodeCounter % 26)
    });
    nodeCounter++;
  });
  preset.e.forEach(([f, t, w]) => {
    if (!edges.some(e => (e.from===f&&e.to===t)||(e.from===t&&e.to===f)))
      edges.push({ from: f, to: t, weight: w });
  });

  updateSelects(); updateStats(); draw();
  this.value = '';
});


//  Flash message

function flash(msg) {
  document.getElementById('pathSequence').innerHTML =
    '<span style="color:#ef4444">' + msg + '</span>';
}


draw();