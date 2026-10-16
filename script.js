// Simple Pong with pointer lock and external scoreboard UI
(() => {
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');

  const scoreLeftEl = document.getElementById('leftScore');
  const scoreRightEl = document.getElementById('rightScore');

  // Logical canvas size from attributes
  const W = canvas.width;
  const H = canvas.height;

  // Game objects
  const paddle = { width: 12, height: 100, speed: 6 };

  const leftPaddle = { x: 20, y: (H - paddle.height) / 2, w: paddle.width, h: paddle.height };
  const rightPaddle = { x: W - 20 - paddle.width, y: (H - paddle.height) / 2, w: paddle.width, h: paddle.height };

  const ball = { x: W / 2, y: H / 2, r: 8, speed: 5, vx: 0, vy: 0 };
  let leftScore = 0, rightScore = 0;

  // Input state
  const keys = { ArrowUp: false, ArrowDown: false };
  let mouseY = null;
  let pointerLocked = false;

  // Initialize ball direction
  function resetBall(servingToRight = Math.random() > 0.5) {
    ball.x = W / 2; ball.y = H / 2; ball.speed = 5;
    const angle = (Math.random() * Math.PI / 3) - (Math.PI / 6); // -30..30 deg
    ball.vx = (servingToRight ? 1 : -1) * ball.speed * Math.cos(angle);
    ball.vy = ball.speed * Math.sin(angle);
  }

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function update() {
    // Left paddle: pointer lock movement takes precedence
    if (pointerLocked) {
      // movement handled on mousemove with movementY
    } else if (mouseY !== null) {
      leftPaddle.y = clamp(mouseY - leftPaddle.h / 2, 0, H - leftPaddle.h);
    } else {
      if (keys.ArrowUp) leftPaddle.y = clamp(leftPaddle.y - paddle.speed, 0, H - leftPaddle.h);
      if (keys.ArrowDown) leftPaddle.y = clamp(leftPaddle.y + paddle.speed, 0, H - leftPaddle.h);
    }

    // Right paddle AI
    const aiSpeed = 5.2;
    const targetY = ball.y - rightPaddle.h / 2;
    const dy = targetY - rightPaddle.y;
    rightPaddle.y += clamp(dy * 0.12, -aiSpeed, aiSpeed);
    rightPaddle.y = clamp(rightPaddle.y, 0, H - rightPaddle.h);

    // Move ball
    ball.x += ball.vx;
    ball.y += ball.vy;

    // Wall collision
    if (ball.y - ball.r < 0) { ball.y = ball.r; ball.vy = -ball.vy; }
    if (ball.y + ball.r > H) { ball.y = H - ball.r; ball.vy = -ball.vy; }

    // Left paddle collision
    if (ball.x - ball.r <= leftPaddle.x + leftPaddle.w) {
      if (ball.y >= leftPaddle.y && ball.y <= leftPaddle.y + leftPaddle.h) {
        const rel = (ball.y - (leftPaddle.y + leftPaddle.h / 2)) / (leftPaddle.h / 2);
        const maxBounce = Math.PI / 3;
        const angle = rel * maxBounce;
        ball.speed += 0.3;
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
        ball.speed += 0.3;
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
    // background
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

  function loop() { update(); draw(); requestAnimationFrame(loop); }

  // Pointer lock handling
  canvas.addEventListener('click', () => { if (document.pointerLockElement !== canvas) canvas.requestPointerLock?.(); });
  document.addEventListener('pointerlockchange', () => {
    pointerLocked = (document.pointerLockElement === canvas);
    if (!pointerLocked) mouseY = null; // fallback
  });

  // Mouse movement: pointer lock uses movementY, otherwise use clientY
  canvas.addEventListener('mousemove', (e) => {
    if (pointerLocked) {
      leftPaddle.y = clamp(leftPaddle.y + e.movementY, 0, H - leftPaddle.h);
    } else {
      const rect = canvas.getBoundingClientRect();
      mouseY = (e.clientY - rect.top) * (canvas.height / rect.height);
    }
  });

  canvas.addEventListener('mouseleave', () => { if (!pointerLocked) mouseY = null; });

  // Keyboard
  window.addEventListener('keydown', (e) => {
    if (e.code === 'ArrowUp' || e.code === 'ArrowDown') { keys[e.code] = true; e.preventDefault(); }
  }, { passive: false });
  window.addEventListener('keyup', (e) => {
    if (e.code === 'ArrowUp' || e.code === 'ArrowDown') { keys[e.code] = false; e.preventDefault(); }
  }, { passive: false });

  // Start
  resetBall(Math.random() > 0.5);
  requestAnimationFrame(loop);

  // expose for debugging
  window._pong = { leftPaddle, rightPaddle, ball, resetBall };
})();
