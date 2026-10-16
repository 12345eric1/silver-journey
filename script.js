// Pong with fly brainmap upload & playback
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

  const W = canvas.width;
  const H = canvas.height;

  const paddle = { width: 12, height: 100, speed: 6 };
  const leftPaddle = { x: 20, y: (H - paddle.height) / 2, w: paddle.width, h: paddle.height };
  const rightPaddle = { x: W - 20 - paddle.width, y: (H - paddle.height) / 2, w: paddle.width, h: paddle.height };

  const ball = { x: W / 2, y: H / 2, r: 8, speed: 5, vx: 0, vy: 0 };
  let leftScore = 0, rightScore = 0;

  const keys = { ArrowUp: false, ArrowDown: false };
  let mouseY = null;
  let pointerLocked = false;

  // Playback state
  const playback = {
    data: [], // normalized 0..1
    playing: false,
    rate: Number(rateEl.value), // samples per second
    startTime: 0,
    index: 0,
    elapsedSamples: 0,
  };

  function resetBall(servingToRight = Math.random() > 0.5) {
    ball.x = W / 2; ball.y = H / 2; ball.speed = 5;
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
      leftPaddle.y = clamp(val * (H - leftPaddle.h), 0, H - leftPaddle.h);
    } else if (mapping === 'ball') {
      const minFactor = 0.6, maxFactor = 2.0; // ball speed range multiplier
      const newSpeed = 3 * (minFactor + val * (maxFactor - minFactor));
      // preserve direction
      const angle = Math.atan2(ball.vy, ball.vx);
      ball.speed = newSpeed;
      ball.vx = ball.speed * Math.cos(angle);
      ball.vy = ball.speed * Math.sin(angle);
    } else if (mapping === 'ai') {
      // set AI target directly (blend a bit to avoid jumps)
      const target = val * (H - rightPaddle.h);
      rightPaddle.y = clamp(rightPaddle.y * 0.85 + target * 0.15, 0, H - rightPaddle.h);
    }
  }

  let lastFrame = performance.now();
  function update(now) {
    const dt = (now - lastFrame) / 1000; // seconds
    lastFrame = now;

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
      // movement handled on mousemove
    } else if (mouseY !== null) {
      leftPaddle.y = clamp(mouseY - leftPaddle.h / 2, 0, H - leftPaddle.h);
    } else {
      if (keys.ArrowUp) leftPaddle.y = clamp(leftPaddle.y - paddle.speed, 0, H - leftPaddle.h);
      if (keys.ArrowDown) leftPaddle.y = clamp(leftPaddle.y + paddle.speed, 0, H - leftPaddle.h);
    }

    // Right paddle AI if mapping not forcing it
    if (mappingSelect.value !== 'ai') {
      const aiSpeed = 5.2;
      const targetY = ball.y - rightPaddle.h / 2;
      const dy = targetY - rightPaddle.y;
      rightPaddle.y += clamp(dy * 0.12, -aiSpeed, aiSpeed);
      rightPaddle.y = clamp(rightPaddle.y, 0, H - rightPaddle.h);
    }

    // Move ball
    ball.x += ball.vx * dt * 60 / 1; // scale to feel like previous fixed-step
    ball.y += ball.vy * dt * 60 / 1;

    // Wall collision
    if (ball.y - ball.r < 0) { ball.y = ball.r; ball.vy = -ball.vy; }
    if (ball.y + ball.r > H) { ball.y = H - ball.r; ball.vy = -ball.vy; }

    // Left paddle collision
    if (ball.x - ball.r <= leftPaddle.x + leftPaddle.w) {
      if (ball.y >= leftPaddle.y && ball.y <= leftPaddle.y + leftPaddle.h) {
        const rel = (ball.y - (leftPaddle.y + leftPaddle.h / 2)) / (leftPaddle.h / 2);
        const maxBounce = Math.PI / 3;
        const angle = rel * maxBounce;
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
        const maxBounce = Math.PI / 3;
        const angle = rel * maxBounce;
        ball.speed = Math.max(3, ball.speed + 0.3);
        ball.vx = -Math.abs(ball.speed * Math.cos(angle));
        ball.vy = ball.speed * Math.sin(angle);
        ball.x = rightPaddle.x - ball.r - 0.1;
      }
    }

    // Scoring
    if (ball.x + ball.r < 0) { rightScore++; scoreRightEl.textContent = rightScore; resetBall(true); }
    else if (ball.x - ball.r > W) { leftScore++; scoreLeftEl.textContent = leftScore; resetBall(false); }
  }

  function draw() {
    ctx.fillStyle = '#07122b';
    ctx.fillRect(0, 0, W, H);

    // center dashed line
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    const seg = 12;
    for (let y = 10; y < H; y += seg * 1.6) ctx.fillRect(W / 2 - 3, y, 6, seg);

    // paddles
    ctx.fillStyle = '#7dd3fc';
    roundRect(ctx, leftPaddle.x, leftPaddle.y, leftPaddle.w, leftPaddle.h, 6);
    roundRect(ctx, rightPaddle.x, rightPaddle.y, rightPaddle.w, rightPaddle.h, 6);

    // ball
    ctx.beginPath(); ctx.fillStyle = '#ffffff'; ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2); ctx.fill(); ctx.closePath();

    // Draw playback sparkline along top if data exists
    if (playback.data.length > 0) {
      const pad = 6, w = W - pad * 2, h = 40; let x = pad;
      ctx.save(); ctx.translate(pad, pad);
      ctx.strokeStyle = 'rgba(125,211,252,0.9)'; ctx.lineWidth = 1; ctx.beginPath();
      for (let i = 0; i < playback.data.length; i++) {
        const vx = (i / playback.data.length) * w;
        const vy = (1 - playback.data[i]) * h;
        if (i === 0) ctx.moveTo(vx, vy); else ctx.lineTo(vx, vy);
      }
      ctx.stroke();
      // current index marker
      const ix = (playback.index / playback.data.length) * w;
      ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillRect(ix - 1, 0, 2, h);
      ctx.restore();
    }

    // hint when not pointer locked
    if (!pointerLocked) {
      ctx.font = '14px Arial'; ctx.fillStyle = 'rgba(159,182,199,0.9)';
      ctx.textAlign = 'center';
      ctx.fillText('Click the canvas to lock pointer. Use mouse or Arrow keys to control left paddle.', W/2, H - 20);
    }
  }

  function roundRect(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w/2, h/2);
    ctx.beginPath(); ctx.moveTo(x+rr, y); ctx.arcTo(x+w, y, x+w, y+h, rr);
    ctx.arcTo(x+w, y+h, x, y+h, rr); ctx.arcTo(x, y+h, x, y, rr); ctx.arcTo(x, y, x+ w, y, rr);
    ctx.closePath(); ctx.fill();
  }

  function loop(now) {
    update(now);
    draw();
    requestAnimationFrame(loop);
  }

  // File parsing
  function parseFileContent(text, name) {
    // try JSON
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return parsed.map(Number).filter(v => !isNaN(v));
    } catch (e) {}
    // try CSV / lines
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length);
    const nums = lines.map(l => {
      const parts = l.split(/[,\s]+/);
      return Number(parts[0]);
    }).filter(v => !isNaN(v));
    return nums;
  }

  function normalizeArray(arr) {
    if (!arr || arr.length === 0) return [];
    let min = Infinity, max = -Infinity;
    for (const v of arr) { if (v < min) min = v; if (v > max) max = v; }
    if (!isFinite(min) || !isFinite(max)) return [];
    if (max === min) return Array(arr.length).fill(0.5);
    return arr.map(v => (v - min) / (max - min));
  }

  fileInput.addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const raw = String(reader.result);
      const parsed = parseFileContent(raw, f.name);
      const norm = normalizeArray(parsed);
      playback.data = norm;
      playback.playing = false;
      playback.elapsedSamples = 0;
      playback.index = 0;
      playPauseBtn.disabled = false; playPauseBtn.textContent = 'Play';
    };
    reader.readAsText(f);
  });

  playPauseBtn.addEventListener('click', () => {
    if (playback.data.length === 0) return;
    playback.playing = !playback.playing;
    if (playback.playing) { playPauseBtn.textContent = 'Pause'; }
    else { playPauseBtn.textContent = 'Play'; }
  });

  rateEl.addEventListener('input', () => { playback.rate = Number(rateEl.value); rateVal.textContent = rateEl.value; });

  // Pointer lock handling
  canvas.addEventListener('click', () => { if (document.pointerLockElement !== canvas) canvas.requestPointerLock?.(); });
  document.addEventListener('pointerlockchange', () => { pointerLocked = (document.pointerLockElement === canvas); if (!pointerLocked) mouseY = null; });

  canvas.addEventListener('mousemove', (e) => {
    if (pointerLocked) {
      leftPaddle.y = clamp(leftPaddle.y + e.movementY, 0, H - leftPaddle.h);
    } else {
      const rect = canvas.getBoundingClientRect();
      mouseY = (e.clientY - rect.top) * (canvas.height / rect.height);
    }
  });

  canvas.addEventListener('mouseleave', () => { if (!pointerLocked) mouseY = null; });

  window.addEventListener('keydown', (e) => { if (e.code === 'ArrowUp' || e.code === 'ArrowDown') { keys[e.code] = true; e.preventDefault(); } }, { passive: false });
  window.addEventListener('keyup', (e) => { if (e.code === 'ArrowUp' || e.code === 'ArrowDown') { keys[e.code] = false; e.preventDefault(); } }, { passive: false });

  // Start
  resetBall(Math.random() > 0.5);
  lastFrame = performance.now();
  requestAnimationFrame(loop);

  window._pong = { leftPaddle, rightPaddle, ball, resetBall, playback };
})();
