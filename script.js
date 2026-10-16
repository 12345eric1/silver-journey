// Pong with fly brain connections simulation + playback
(() => {
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');

  const scoreLeftEl = document.getElementById('leftScore');
  const scoreRightEl = document.getElementById('rightScore');
  const fileInput = document.getElementById('fileInput');
  const playPauseBtn = document.getElementById('playPauseBtn');
  const mappingSelect = document.getElementById('mappingSelect');
  const rateEl = document.getElementById('rate');
  const rateVal = document.getElementById('rateVal');
  const simulateBtn = document.getElementById('simulateBtn');
  const autoFetch = document.getElementById('autoFetch');
  const neuronIdxEl = document.getElementById('neuronIdx');
  const popModeEl = document.getElementById('popMode');
  const simStepsEl = document.getElementById('simSteps');
  const downsampleEl = document.getElementById('downsampleN');

  const W_CAN = canvas.width;
  const H_CAN = canvas.height;

  const paddle = { width: 12, height: 100, speed: 6 };
  const leftPaddle = { x: 20, y: (H_CAN - paddle.height) / 2, w: paddle.width, h: paddle.height };
  const rightPaddle = { x: W_CAN - 20 - paddle.width, y: (H_CAN - paddle.height) / 2, w: paddle.width, h: paddle.height };

  const ball = { x: W_CAN / 2, y: H_CAN / 2, r: 8, speed: 5, vx: 0, vy: 0 };
  let leftScore = 0, rightScore = 0;

  const keys = { ArrowUp: false, ArrowDown: false };
  let mouseY = null;
  let pointerLocked = false;

  // Playback state (time series)
  const playback = { data: [], playing: false, rate: Number(rateEl.value), elapsedSamples: 0, index: 0 };

  // Connection matrix (if loaded)
  let connMatrix = null; // Float32Array flattened row-major
  let connN = 0;

  function resetBall(servingToRight = Math.random() > 0.5) {
    ball.x = W_CAN / 2; ball.y = H_CAN / 2; ball.speed = 5;
    const angle = (Math.random() * Math.PI / 3) - (Math.PI / 6);
    ball.vx = (servingToRight ? 1 : -1) * ball.speed * Math.cos(angle);
    ball.vy = ball.speed * Math.sin(angle);
  }

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  // Apply current playback sample according to mapping
  function applySample(val) {
    if (!isFinite(val)) return;
    const mapping = mappingSelect.value;
    if (mapping === 'paddle') {
      leftPaddle.y = clamp(val * (H_CAN - leftPaddle.h), 0, H_CAN - leftPaddle.h);
    } else if (mapping === 'ball') {
      const minFactor = 0.6, maxFactor = 2.0;
      const newSpeed = 3 * (minFactor + val * (maxFactor - minFactor));
      const angle = Math.atan2(ball.vy, ball.vx || 1e-6);
      ball.speed = newSpeed;
      ball.vx = (ball.vx >= 0 ? 1 : -1) * Math.abs(ball.speed * Math.cos(angle));
      ball.vy = ball.speed * Math.sin(angle);
    } else if (mapping === 'ai') {
      const target = val * (H_CAN - rightPaddle.h);
      rightPaddle.y = clamp(rightPaddle.y * 0.85 + target * 0.15, 0, H_CAN - rightPaddle.h);
    }
  }

  let lastFrame = performance.now();
  function update(now) {
    const dt = (now - lastFrame) / 1000; lastFrame = now;

    // Playback advance
    if (playback.playing && playback.data.length > 0) {
      playback.elapsedSamples += playback.rate * dt;
      const idx = Math.floor(playback.elapsedSamples) % playback.data.length;
      playback.index = idx;
      const sample = playback.data[idx];
      applySample(sample);
    }

    // Left paddle: pointer lock movement takes precedence, else keyboard/mouse
    if (pointerLocked) {
      // handled in mousemove
    } else if (mouseY !== null) {
      leftPaddle.y = clamp(mouseY - leftPaddle.h / 2, 0, H_CAN - leftPaddle.h);
    } else {
      if (keys.ArrowUp) leftPaddle.y = clamp(leftPaddle.y - paddle.speed, 0, H_CAN - leftPaddle.h);
      if (keys.ArrowDown) leftPaddle.y = clamp(leftPaddle.y + paddle.speed, 0, H_CAN - leftPaddle.h);
    }

    // Right paddle AI if not controlled by mapping
    if (mappingSelect.value !== 'ai') {
      const aiSpeed = 5.2;
      const targetY = ball.y - rightPaddle.h / 2;
      const dy = targetY - rightPaddle.y;
      rightPaddle.y += clamp(dy * 0.12, -aiSpeed, aiSpeed);
      rightPaddle.y = clamp(rightPaddle.y, 0, H_CAN - rightPaddle.h);
    }

    // Move ball (fixed-step feel)
    ball.x += ball.vx * dt * 60;
    ball.y += ball.vy * dt * 60;

    // Wall collision
    if (ball.y - ball.r < 0) { ball.y = ball.r; ball.vy = -ball.vy; }
    if (ball.y + ball.r > H_CAN) { ball.y = H_CAN - ball.r; ball.vy = -ball.vy; }

    // Left paddle collision
    if (ball.x - ball.r <= leftPaddle.x + leftPaddle.w) {
      if (ball.y >= leftPaddle.y && ball.y <= leftPaddle.y + leftPaddle.h) {
        const rel = (ball.y - (leftPaddle.y + leftPaddle.h / 2)) / (leftPaddle.h / 2);
        const angle = rel * (Math.PI / 3);
        ball.speed = Math.max(3, ball.speed + 0.3);
        ball.vx = Math.abs(ball.speed * Math.cos(angle));
        ball.vy = ball.speed * Math.sin(angle);
        ball.x = leftPaddle.x + leftPaddle.w + ball.r + 0.1;
      }
    }

    // Right paddle collision
    if (ball.x + ball.r >= rightPaddle.x) {
      if (ball.y >= rightPaddle.y && ball.y <= rightPaddle.y + rightPaddle.h) {
        const rel = (ball.y - (rightPaddle.y + rightPaddle.h / 2)) / (rightPaddle.h / 2);
        const angle = rel * (Math.PI / 3);
        ball.speed = Math.max(3, ball.speed + 0.3);
        ball.vx = -Math.abs(ball.speed * Math.cos(angle));
        ball.vy = ball.speed * Math.sin(angle);
        ball.x = rightPaddle.x - ball.r - 0.1;
      }
    }

    // Scoring
    if (ball.x + ball.r < 0) { rightScore++; scoreRightEl.textContent = rightScore; resetBall(true); }
    else if (ball.x - ball.r > W_CAN) { leftScore++; scoreLeftEl.textContent = leftScore; resetBall(false); }
  }

  function draw() {
    ctx.fillStyle = '#07122b'; ctx.fillRect(0, 0, W_CAN, H_CAN);
    ctx.fillStyle = 'rgba(255,255,255,0.06)'; const seg = 12; for (let y = 10; y < H_CAN; y += seg * 1.6) ctx.fillRect(W_CAN / 2 - 3, y, 6, seg);
    ctx.fillStyle = '#7dd3fc'; roundRect(ctx, leftPaddle.x, leftPaddle.y, leftPaddle.w, leftPaddle.h, 6); roundRect(ctx, rightPaddle.x, rightPaddle.y, rightPaddle.w, rightPaddle.h, 6);
    ctx.beginPath(); ctx.fillStyle = '#ffffff'; ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2); ctx.fill(); ctx.closePath();

    // Draw playback sparkline
    if (playback.data.length > 0) {
      const pad = 6, w = W_CAN - pad * 2, h = 40; ctx.save(); ctx.translate(pad, pad);
      ctx.strokeStyle = 'rgba(125,211,252,0.9)'; ctx.lineWidth = 1; ctx.beginPath();
      for (let i = 0; i < playback.data.length; i++) {
        const vx = (i / playback.data.length) * w; const vy = (1 - playback.data[i]) * h; if (i === 0) ctx.moveTo(vx, vy); else ctx.lineTo(vx, vy);
      }
      ctx.stroke(); const ix = (playback.index / playback.data.length) * w; ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillRect(ix - 1, 0, 2, h); ctx.restore();
    }

    if (!pointerLocked) { ctx.font = '14px Arial'; ctx.fillStyle = 'rgba(159,182,199,0.9)'; ctx.textAlign = 'center'; ctx.fillText('Click the canvas to lock pointer. Use mouse or Arrow keys to control left paddle.', W_CAN/2, H_CAN - 20); }
  }

  function roundRect(ctx, x, y, w, h, r) { const rr = Math.min(r, w/2, h/2); ctx.beginPath(); ctx.moveTo(x+rr, y); ctx.arcTo(x+w, y, x+w, y+h, rr); ctx.arcTo(x+w, y+h, x, y+h, rr); ctx.arcTo(x, y+h, x, y, rr); ctx.arcTo(x, y, x+ w, y, rr); ctx.closePath(); ctx.fill(); }

  function loop(now) { update(now); draw(); requestAnimationFrame(loop); }

  // Parse CSV/JSON
  function parseFileContent(text) {
    try { const parsed = JSON.parse(text); if (Array.isArray(parsed)) return { type: 'timeseries', data: parsed.map(Number).filter(v => !isNaN(v)) }; } catch (e) {}
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    // try numeric matrix (same #cols each row and numeric)
    const rows = lines.map(l => l.split(',').map(s => s.trim()));
    const isMatrix = rows.every(r => r.length === rows[0].length && r.every(c => c !== '' && !isNaN(Number(c))));
    if (isMatrix) {
      if (rows.length === rows[0].length) {
        // square adjacency matrix
        const N = rows.length; const flat = new Float32Array(N*N);
        for (let i=0;i<N;i++) for (let j=0;j<N;j++) flat[i*N + j] = Number(rows[i][j]);
        return { type: 'matrix', N, data: flat };
      }
    }
    // try edge list or timeseries: see if lines contain one number or three
    const splitCounts = lines.map(l => l.split(/[,\s]+/).length);
    const oneCol = splitCounts.every(c => c === 1);
    if (oneCol) {
      const nums = lines.map(l => Number(l.split(/[,\s]+/)[0])).filter(v => !isNaN(v));
      return { type: 'timeseries', data: nums };
    }
    const threeCol = splitCounts.every(c => c >= 3);
    if (threeCol) {
      // parse edge list src,tgt,weight
      const edges = lines.map(l => { const p = l.split(/[,\s]+/); return { s: Number(p[0]), t: Number(p[1]), w: Number(p[2]) }; }).filter(e => !isNaN(e.s) && !isNaN(e.t) && !isNaN(e.w));
      return { type: 'edgelist', data: edges };
    }
    return { type: 'unknown', data: null };
  }

  function normalizeArray(arr) { if (!arr || arr.length === 0) return []; let min = Infinity, max = -Infinity; for (const v of arr) { if (v < min) min = v; if (v > max) max = v; } if (!isFinite(min) || !isFinite(max)) return []; if (max === min) return Array(arr.length).fill(0.5); return arr.map(v => (v - min) / (max - min)); }

  // Build adjacency from edgelist, optionally downsample
  function buildMatrixFromEdges(edges, targetN) {
    let maxIdx = 0; for (const e of edges) maxIdx = Math.max(maxIdx, e.s, e.t);
    let N = maxIdx + 1;
    if (targetN && N > targetN) {
      // simple downsample: map indices to first targetN by modulo (not ideal but fast)
      const map = new Map(); let next = 0; for (const e of edges) { if (!map.has(e.s)) map.set(e.s, next++ % targetN); if (!map.has(e.t)) map.set(e.t, next++ % targetN); }
      N = targetN; const flat = new Float32Array(N*N); for (const e of edges) { const a = map.get(e.s)%N; const b = map.get(e.t)%N; flat[a*N + b] += e.w; } return { N, flat };
    } else {
      const flat = new Float32Array(N*N); for (const e of edges) { flat[e.s*N + e.t] += e.w; } return { N, flat };
    }
  }

  // Downsample square matrix (take first targetN rows/cols)
  function downsampleMatrix(flat, N, targetN) {
    if (N <= targetN) return { N, flat };
    const newFlat = new Float32Array(targetN*targetN);
    for (let i = 0; i < targetN; i++) for (let j = 0; j < targetN; j++) newFlat[i*targetN + j] = flat[i*N + j];
    return { N: targetN, flat: newFlat };
  }

  // Power iteration to get leading eigenvector of W (row-major): returns normalized vector length N
  function leadingEigenvector(flat, N, iterations=100) {
    const x = new Float32Array(N); for (let i=0;i<N;i++) x[i]=Math.random();
    const y = new Float32Array(N);
    for (let it=0; it<iterations; it++) {
      // y = W * x
      for (let i=0;i<N;i++) { let s=0; const row = i*N; for (let j=0;j<N;j++) s += flat[row + j] * x[j]; y[i]=s; }
      // normalize y
      let norm=0; for (let i=0;i<N;i++) norm += y[i]*y[i]; norm = Math.sqrt(norm)||1;
      for (let i=0;i<N;i++) x[i] = y[i]/norm;
    }
    // final normalize to unit
    let nrm=0; for (let i=0;i<N;i++) nrm += x[i]*x[i]; nrm = Math.sqrt(nrm)||1; for (let i=0;i<N;i++) x[i]/=nrm;
    return x;
  }

  // Simulate discrete-time dynamics x <- tanh(W * x + noise)
  function simulateFromMatrix(flat, N, steps, downsampleTo, popMode, neuronIndex) {
    const target = downsampleTo && downsampleTo > 0 ? Math.min(downsampleTo, N) : N;
    let used = flat; let usedN = N;
    if (target < N) { const res = downsampleMatrix(flat, N, target); used = res.flat; usedN = res.N; }

    // prepare
    const x = new Float32Array(usedN); for (let i=0;i<usedN;i++) x[i] = (Math.random()-0.5)*0.1;
    const series = new Float32Array(steps);
    let pc = null; if (popMode === 'pca') pc = leadingEigenvector(used, usedN, Math.min(200, Math.max(40, Math.floor(steps/10))));

    for (let t=0;t<steps;t++) {
      // compute next x: x' = tanh(W * x + noise)
      const nx = new Float32Array(usedN);
      for (let i=0;i<usedN;i++) {
        let s = 0; const row = i*usedN;
        for (let j=0;j<usedN;j++) s += used[row + j] * x[j];
        // noise
        s += (Math.random()-0.5) * 0.01;
        nx[i] = Math.tanh(s);
      }
      for (let i=0;i<usedN;i++) x[i] = nx[i];
      // extract output
      if (popMode === 'mean') {
        let sum=0; for (let i=0;i<usedN;i++) sum += x[i]; series[t] = sum / usedN * 0.5 + 0.5; // scale from -1..1 to 0..1
      } else if (popMode === 'pca') {
        // projection onto pc
        let s=0; for (let i=0;i<usedN;i++) s += x[i] * pc[i]; series[t] = (s - (-1)) / (2); // rough normalize assuming s in [-1,1]
      } else {
        const idx = Math.max(0, Math.min(usedN-1, neuronIndex||0)); series[t] = (x[idx] + 1)/2;
      }
    }
    return Array.from(series).map(v => clamp(v,0,1));
  }

  // handle file input
  fileInput.addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    const reader = new FileReader(); reader.onload = () => {
      const raw = String(reader.result);
      const parsed = parseFileContent(raw);
      if (parsed.type === 'timeseries') {
        playback.data = normalizeArray(parsed.data);
        playback.playing = false; playback.elapsedSamples = 0; playback.index = 0; playPauseBtn.disabled = false; playPauseBtn.textContent='Play';
      } else if (parsed.type === 'matrix') {
        connMatrix = parsed.data; connN = parsed.N; alert('Loaded adjacency matrix with N=' + connN + '. Click Simulate to generate a time series.');
      } else if (parsed.type === 'edgelist') {
        const downN = Number(downsampleEl.value) || 200;
        const {N, flat} = buildMatrixFromEdges(parsed.data, downN);
        connMatrix = flat; connN = N; alert('Loaded edge list converted to matrix with N=' + connN + '. Click Simulate to generate a time series.');
      } else {
        alert('Unrecognized file format. Provide JSON array, CSV timeseries, square adjacency matrix, or edge list src,tgt,weight.');
      }
    };
    reader.readAsText(f);
  });

  playPauseBtn.addEventListener('click', () => { if (playback.data.length === 0) return; playback.playing = !playback.playing; playPauseBtn.textContent = playback.playing ? 'Pause' : 'Play'; });
  rateEl.addEventListener('input', () => { playback.rate = Number(rateEl.value); rateVal.textContent = rateEl.value; });

  simulateBtn.addEventListener('click', () => {
    if (!connMatrix) { alert('No connections matrix loaded. Drop connections_princeton.csv or upload a matrix/edge list file.'); return; }
    const steps = Number(simStepsEl.value) || 2000;
    const downN = Number(downsampleEl.value) || connN;
    const popMode = popModeEl.value;
    const neuronIndex = Number(neuronIdxEl.value) || 0;
    // run simulation (may take time)
    simulateBtn.disabled = true; simulateBtn.textContent = 'Simulating...';
    setTimeout(() => {
      const series = simulateFromMatrix(connMatrix, connN, steps, downN, popMode, neuronIndex);
      playback.data = normalizeArray(series);
      playback.playing = false; playback.elapsedSamples = 0; playback.index = 0; playPauseBtn.disabled = false; playPauseBtn.textContent='Play';
      simulateBtn.disabled = false; simulateBtn.textContent = 'Simulate from connections';
      alert('Simulation complete: loaded ' + playback.data.length + ' samples.');
    }, 50);
  });

  // Auto-fetch if present on server
  async function tryAutoFetch() {
    if (!autoFetch.checked) return;
    try {
      const res = await fetch('/connections_princeton.csv');
      if (!res.ok) return;
      const text = await res.text();
      const parsed = parseFileContent(text);
      if (parsed.type === 'matrix') { connMatrix = parsed.data; connN = parsed.N; console.log('Auto-loaded connections_princeton.csv matrix N=', connN); }
      else if (parsed.type === 'edgelist') { const {N, flat} = buildMatrixFromEdges(parsed.data, Number(downsampleEl.value)||200); connMatrix = flat; connN = N; console.log('Auto-loaded edge list -> matrix N=', connN); }
      else if (parsed.type === 'timeseries') { playback.data = normalizeArray(parsed.data); playPauseBtn.disabled=false; console.log('Auto-loaded timeseries'); }
    } catch (e) { console.log('Auto-fetch failed', e); }
  }

  // Pointer lock
  canvas.addEventListener('click', () => { if (document.pointerLockElement !== canvas) canvas.requestPointerLock?.(); });
  document.addEventListener('pointerlockchange', () => { pointerLocked = (document.pointerLockElement === canvas); if (!pointerLocked) mouseY = null; });
  canvas.addEventListener('mousemove', (e) => { if (pointerLocked) leftPaddle.y = clamp(leftPaddle.y + e.movementY, 0, H_CAN - leftPaddle.h); else { const rect = canvas.getBoundingClientRect(); mouseY = (e.clientY - rect.top) * (canvas.height / rect.height); } });
  canvas.addEventListener('mouseleave', () => { if (!pointerLocked) mouseY = null; });
  window.addEventListener('keydown', (e) => { if (e.code === 'ArrowUp' || e.code === 'ArrowDown') { keys[e.code] = true; e.preventDefault(); } }, { passive: false });
  window.addEventListener('keyup', (e) => { if (e.code === 'ArrowUp' || e.code === 'ArrowDown') { keys[e.code] = false; e.preventDefault(); } }, { passive: false });

  // Start
  resetBall(Math.random() > 0.5);
  lastFrame = performance.now(); requestAnimationFrame(loop);
  tryAutoFetch();

  window._pong = { leftPaddle, rightPaddle, ball, resetBall, playback, connN };
})();
