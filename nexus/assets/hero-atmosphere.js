(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var canvas = document.getElementById('heroCanvas');
  if (!canvas || reduced) return;

  var ctx = canvas.getContext('2d');
  if (!ctx) return;

  var hero = canvas.closest('.hero');
  var COLORS = ['rgba(124,92,255,ALPHA)', 'rgba(117,227,255,ALPHA)', 'rgba(255,142,216,ALPHA)'];
  var COLOR_WEIGHTS = [0.62, 0.28, 0.1];

  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  var width = 0, height = 0, running = false, rafId = null;
  var nodes = [];
  var NODE_COUNT = 46;

  function pickColor() {
    var r = Math.random();
    var acc = 0;
    for (var i = 0; i < COLOR_WEIGHTS.length; i++) {
      acc += COLOR_WEIGHTS[i];
      if (r <= acc) return COLORS[i];
    }
    return COLORS[0];
  }

  function makeNode() {
    return {
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.18,
      vy: (Math.random() - 0.5) * 0.12,
      r: 0.6 + Math.random() * 1.6,
      color: pickColor()
    };
  }

  function resize() {
    var rect = hero.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    nodes = [];
    for (var i = 0; i < NODE_COUNT; i++) nodes.push(makeNode());
  }

  var LINK_DIST = 150;

  function step() {
    ctx.clearRect(0, 0, width, height);

    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      n.x += n.vx;
      n.y += n.vy;
      if (n.x < -20) n.x = width + 20; else if (n.x > width + 20) n.x = -20;
      if (n.y < -20) n.y = height + 20; else if (n.y > height + 20) n.y = -20;
    }

    for (var a = 0; a < nodes.length; a++) {
      for (var b = a + 1; b < nodes.length; b++) {
        var na = nodes[a], nb = nodes[b];
        var dx = na.x - nb.x, dy = na.y - nb.y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < LINK_DIST) {
          var alpha = (1 - dist / LINK_DIST) * 0.16;
          ctx.strokeStyle = 'rgba(200,188,255,' + alpha.toFixed(3) + ')';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(na.x, na.y);
          ctx.lineTo(nb.x, nb.y);
          ctx.stroke();
        }
      }
    }

    for (var j = 0; j < nodes.length; j++) {
      var node = nodes[j];
      ctx.beginPath();
      ctx.fillStyle = node.color.replace('ALPHA', '0.85');
      ctx.arc(node.x, node.y, node.r, 0, Math.PI * 2);
      ctx.fill();
    }

    if (running) rafId = requestAnimationFrame(step);
  }

  function start() {
    if (running) return;
    running = true;
    rafId = requestAnimationFrame(step);
  }

  function stop() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
  }

  resize();

  var resizeTimer = null;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 200);
  });

  var heroVisible = false;

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stop(); else if (heroVisible) start();
  });

  if ('IntersectionObserver' in window) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        heroVisible = entry.isIntersecting;
        if (heroVisible && !document.hidden) start(); else stop();
      });
    }, { threshold: 0.05 });
    observer.observe(hero);
  } else {
    heroVisible = true;
    start();
  }
})();
