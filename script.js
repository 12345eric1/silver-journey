// Simple Pong game
(() => {
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');

  const scoreLeftEl = document.getElementById('leftScore');
  const scoreRightEl = document.getElementById('rightScore');

  const W = canvas.width;
  const H = canvas.height;

  // Game objects
  const paddle = {
    width: 12,
    height: 100,
    speed: 6
  };

  const leftPaddle = {
    x: 20,
    y: (H - paddle.height) / 2,
    w: paddle.width,
    h: paddle.height
  };

  const rightPaddle = {
    x: W - 20 - paddle.width,
    y: (H - paddle.height) / 2,
    w: paddle.width,
    h: paddle.height
  };

  const ball = {
    x: W / 2,
    y: H / 2,
    r: 8,
    speed: 5,
    vx: 0,
    vy: 0
  };

  let leftScore = 0;
  let rightScore = 0;

  // Input state
  const keys = { ArrowUp: false, ArrowDown: false };
  let mouseY = null;

  // Initialize ball with a random direction
  function resetBall(servingToRight = Math.random() > 0.5) {
    ball.x = W / 2;
    ball.y = H / 2;
    ball.speed = 5;
    const angle = (Math.random() * Math.PI / 3) - (Math.PI / 6); // -30deg..30deg
    ball.vx = (servingToRight ? 1 : -1) * ball.speed * Math.cos(angle);
    ball.vy = ball.speed * Math.sin(angle);
  }

  // Clamp helper
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  // Update game state
  function update() {
    // Left paddle: mouse or keys
    if (mouseY !== null) {
      // mouse controls (center paddle on mouse)
      leftPaddle.y = clamp(mouseY - leftPaddle.h / 2, 0, H - leftPaddle.h);
    } else {
      // keyboard controls
      if (keys.ArrowUp) leftPaddle.y = clamp(leftPaddle.y - paddle.speed, 0, H - leftPaddle.h);
      if (keys.ArrowDown) leftPaddle.y = clamp(leftPaddle.y + paddle.speed, 0, H - leftPaddle.h);
    }

    // Also allow keyboard movement in addition to mouse (mouse takes precedence each frame if moved)
    if (keys.ArrowUp && mouseY === null) leftPaddle.y = clamp(leftPaddle.y - paddle.speed, 0, H - leftPaddle.h);
    if (keys.ArrowDown && mouseY === null) leftPaddle.y = clamp(leftPaddle.y + paddle.speed, 0, H - leftPaddle.h);

    // Right paddle: simple AI, moves towards ball with some max speed
    const aiSpeed = 5.2;
    const targetY = ball.y - rightPaddle.h / 2;
    const dy = targetY - rightPaddle.y;
    rightPaddle.y += clamp(dy * 0.12, -aiSpeed, aiSpeed);
    rightPaddle.y = clamp(rightPaddle.y, 0, H - rightPaddle.h);

    // Move ball
    ball.x += ball.vx;
    ball.y += ball.vy;

    // Wall collision
    if (ball.y - ball.r < 0) {
      ball.y = ball.r;
      ball.vy = -ball.vy;
    }
    if (ball.y + ball.r > H) {
      ball.y = H - ball.r;
      ball.vy = -ball.vy;
    }

    // Paddle collisions
    // Left paddle
    if (ball.x - ball.r <= leftPaddle.x + leftPaddle.w) {
      if (ball.y >= leftPaddle.y && ball.y <= leftPaddle.y + leftPaddle.h) {
        // collision
        // Calculate hit position (-1..1)
        const rel = (ball.y - (leftPaddle.y + leftPaddle.h / 2)) / (leftPaddle.h / 2);
        const maxBounce = Math.PI / 3; // 60 degrees max
        const angle = rel * maxBounce;
        ball.speed += 0.3; // slight speedup
        ball.vx = Math.abs(ball.speed * Math.cos(angle));
        ball.vy = ball.speed * Math.sin(angle);
        ball.x = leftPaddle.x + leftPaddle.w + ball.r + 0.1; // push out to avoid sticking
      }
    }

    // Right paddle
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
    if (ball.x + ball.r < 0) {
      // right scores
      rightScore++;
      scoreRightEl.textContent = rightScore;
      resetBall(true);
    } else if (ball.x - ball.r > W) {
      // left scores
      leftScore++;
      scoreLeftEl.textContent = leftScore;
      resetBall(false);
    }
  }

  // Draw everything
  function draw() {
    // background
    ctx.fillStyle = '#07122b';
    ctx.fillRect(0, 0, W, H);

    // mid line
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    const seg = 12;
    for (let y = 10; y < H; y += seg * 1.6) {
      ctx.fillRect(W / 2 - 3, y, 6, seg);
    }

    // paddles
    ctx.fillStyle = '#7dd3fc';
    roundRect(ctx, leftPaddle.x, leftPaddle.y, leftPaddle.w, leftPaddle.h, 6);
    roundRect(ctx, rightPaddle.x, rightPaddle.y, rightPaddle.w, rightPaddle.h, 6);

    // ball
    ctx.beginPath();
    ctx.fillStyle = '#ffffff';
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.closePath();
  }

  // Utility: rounded rect
  function roundRect(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
    ctx.fill();
  }

  // Main loop
  function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
  }

  // Input handlers
  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouseY = (e.clientY - rect.top) * (canvas.height / rect.height);
  });

  canvas.addEventListener('mouseleave', () => {
    // when mouse leaves canvas, fall back to keyboard controls
    mouseY = null;
  });

  window.addEventListener('keydown', (e) => {
    if (e.code === 'ArrowUp' || e.code === 'ArrowDown') {
      keys[e.code] = true;
      // prevent page scroll
      e.preventDefault();
    }
  }, { passive: false });

  window.addEventListener('keyup', (e) => {
    if (e.code === 'ArrowUp' || e.code === 'ArrowDown') {
      keys[e.code] = false;
      e.preventDefault();
    }
  }, { passive: false });

  // Start game
  resetBall(Math.random() > 0.5);
  requestAnimationFrame(loop);

  // Expose for debugging in console (optional)
  window._pong = {
    leftPaddle, rightPaddle, ball, resetBall
  };
})();
