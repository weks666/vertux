// Glass fold: the page background as panes of glass folded over each other, in
// the site's violet (warm on Confectionery pages), always at the screen's own pixels.
//
// Where it moves, and where it holds still:
// - with a graphics card the folds drift slowly: one canvas fixed behind the
//   page, one triangle, one shader, at most 24 frames a second (20 on touch
//   screens), still while the page scrolls and paused in a hidden tab;
// - a browser that draws without a graphics card (software WebGL) would spend
//   several processor cores redrawing the whole picture every frame, so there
//   a finished picture is drawn about once a second, a band per frame, and the
//   screen blends the last two 12 times a second: slower, calmer motion at
//   the same quality for a fraction of the cost (under one core instead of ten);
// - reduced motion, saved data or a two-core device get the still frame too;
// - if the page starts dropping frames the folds stop and keep the last frame;
// - without WebGL the old still background stays as it is.
//
// The fold pattern is adapted from GradFlow's "fold" shader by Meer Bahadin
// (https://github.com/meerbahadin/gradflow), MIT License:
// Permission is hereby granted, free of charge, to any person obtaining a copy of
// this software and associated documentation files (the "Software"), to deal in
// the Software without restriction, including without limitation the rights to
// use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
// the Software, and to permit persons to whom the Software is furnished to do so,
// subject to the following conditions: The above copyright notice and this
// permission notice shall be included in all copies or substantial portions of
// the Software. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
// EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO
// EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR
// OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
// FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.
(() => {
  const host = document.querySelector('.nx-atmosphere');
  if (!host || !window.WebGLRenderingContext) return;
  // Hide the old still glow from the start, so the page never swaps one
  // background for another; it comes back if WebGL fails after all.
  const root = document.documentElement;
  root.classList.add('nx-fold-on');

  const warm = document.body.classList.contains('nx-confectionery');
  const touch = matchMedia('(pointer: coarse)').matches;
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches
    || navigator.connection?.saveData === true
    || (navigator.hardwareConcurrency || 4) <= 2;

  const hex = value => [1, 3, 5].map(i => parseInt(value.slice(i, i + 2), 16) / 255);
  // c1 and c4: the two pane tints, c2: the ground, c3: the lit creases.
  const PALETTE = warm
    ? {c1:'#ec8f45', c4:'#e9806a', c2:'#fff8f1', c3:'#ffc89a', strength:.85}
    : {c1:'#6a3ce0', c4:'#4b55dc', c2:'#120f22', c3:'#d9b9ff', strength:.62};

  const VERTEX = 'attribute vec2 p;varying vec2 v;void main(){v=p*.5+.5;gl_Position=vec4(p,0.,1.);}';
  const FRAGMENT = `
    #ifdef GL_FRAGMENT_PRECISION_HIGH
      precision highp float;
    #else
      precision mediump float;
    #endif
    uniform vec2 u_res;
    uniform float u_time;
    uniform float u_strength;
    uniform float u_warm;
    uniform vec3 u_c1;
    uniform vec3 u_c2;
    uniform vec3 u_c3;
    uniform vec3 u_c4;
    varying vec2 v;

    mat2 rot(float a){float s=sin(a),c=cos(a);return mat2(c,-s,s,c);}
    float grain(vec2 st){return fract(sin(dot(st,vec2(12.9898,78.233)))*43758.5453);}

    void main(){
      vec2 p=v-.5;
      p.x*=u_res.x/max(u_res.y,1.);
      vec2 q=rot(.6)*p*2.;
      float t=u_time*.6;
      float pixel=2./max(u_res.y,1.);

      // Each pane has one creased edge that catches the light and thins out
      // behind it; panes screen over one another, so overlaps get brighter.
      vec3 acc=vec3(0.);
      for(int i=0;i<6;i++){
        float fi=float(i);
        float odd=mod(fi,2.);
        float bend=odd*2.-1.;
        float crease=(fi-2.5)*.4
          +.26*sin(q.x*(1.05+.12*fi)+fi*1.9+t*(.25+.05*fi))
          +.1*bend*q.x*q.x;
        float s=q.y-crease;
        // In front of the crease only a faint bloom is left; far from it, nothing.
        if(s<-.3)continue;
        float pane=smoothstep(-pixel,pixel,s);
        float back=max(s,0.);
        float body=exp(-back*1.7);
        float fresnel=exp(-back*8.);
        float rim=exp(-back*80.);
        float d=(back-.045)/.014;
        float inner=exp(-d*d);
        float bloom=exp(-abs(s)*20.);
        vec3 base=mix(u_c1,u_c4,odd);
        vec3 tint=mix(base,u_c3,clamp(fresnel*.6+.08+.14*sin(fi*2.1+q.x*.8+t*.2),0.,1.));
        vec3 light=tint*pane*(body*.42+fresnel*.4)+u_c3*(pane*(rim*.6+inner*.12)+bloom*.1);
        acc+=light*(1.-acc);
      }

      vec3 color;
      if(u_warm<.5){
        vec3 ground=mix(u_c2,u_c2*.45,clamp(length(p)*1.3,0.,1.));
        color=ground+acc*u_strength*(1.-ground);
      }else{
        // On the light page the panes tint the cream like warm glass.
        float a=dot(acc,vec3(.3,.5,.2));
        color=u_c2*(1.-a*u_strength*(1.-u_c1));
      }
      // A fine grain at screen pixels keeps the dark gradients free of bands.
      color*=1.-.035+.035*grain(floor(gl_FragCoord.xy));
      gl_FragColor=vec4(clamp(color,0.,1.),1.);
    }`;

  // Without a graphics card: two finished pictures blended pixel for pixel. The
  // grain is already in both (it depends only on the pixel), so it is not added twice.
  const BLEND = `
    #ifdef GL_FRAGMENT_PRECISION_HIGH
      precision highp float;
    #else
      precision mediump float;
    #endif
    uniform sampler2D u_from;
    uniform sampler2D u_to;
    uniform float u_mix;
    uniform vec2 u_res;
    void main(){
      vec2 uv=gl_FragCoord.xy/u_res;
      gl_FragColor=vec4(mix(texture2D(u_from,uv).rgb,texture2D(u_to,uv).rgb,u_mix),1.);
    }`;

  const canvas = document.createElement('canvas');
  canvas.className = 'nx-fold';
  canvas.setAttribute('aria-hidden', 'true');
  // live: the shader every frame (graphics card); keys: pictures drawn now and
  // then and blended in between (no graphics card); still: one picture.
  let gl, fold, blend, at = {}, mode = 'live';

  // True when WebGL would be drawn by the processor instead of a graphics card.
  function software() {
    const probe = document.createElement('canvas').getContext('webgl', {failIfMajorPerformanceCaveat:true});
    if (!probe) return true;
    const info = probe.getExtension('WEBGL_debug_renderer_info');
    const name = info ? String(probe.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '';
    probe.getExtension('WEBGL_lose_context')?.loseContext();
    return /swiftshader|basic render|llvmpipe|softpipe|software|warp/iu.test(name);
  }

  // Compiling the shaders can take a moment, so it happens only after the page
  // has loaded (see boot below), never while the page is being shown.
  function setup() {
    gl = canvas.getContext('webgl', {alpha:false, antialias:false, depth:false, stencil:false, preserveDrawingBuffer:false, powerPreference:'low-power'});
    if (!gl) return false;
    const shader = (type, source) => {
      const node = gl.createShader(type);
      gl.shaderSource(node, source);
      gl.compileShader(node);
      return gl.getShaderParameter(node, gl.COMPILE_STATUS) ? node : null;
    };
    const program = source => {
      const vertex = shader(gl.VERTEX_SHADER, VERTEX), fragment = shader(gl.FRAGMENT_SHADER, source);
      if (!vertex || !fragment) return null;
      const node = gl.createProgram();
      gl.attachShader(node, vertex);
      gl.attachShader(node, fragment);
      gl.bindAttribLocation(node, 0, 'p');
      gl.linkProgram(node);
      return gl.getProgramParameter(node, gl.LINK_STATUS) ? node : null;
    };
    fold = program(FRAGMENT);
    if (!fold) return false;
    if (mode === 'keys') {
      blend = program(BLEND);
      if (!blend) return false;
      gl.useProgram(blend);
      gl.uniform1i(gl.getUniformLocation(blend, 'u_from'), 0);
      gl.uniform1i(gl.getUniformLocation(blend, 'u_to'), 1);
      at.mix = gl.getUniformLocation(blend, 'u_mix');
      at.blendRes = gl.getUniformLocation(blend, 'u_res');
    }

    // One triangle that covers the screen.
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    gl.useProgram(fold);
    const uniform = name => gl.getUniformLocation(fold, name);
    at.res = uniform('u_res');
    at.time = uniform('u_time');
    for (const key of ['c1', 'c2', 'c3', 'c4']) gl.uniform3fv(uniform(`u_${key}`), hex(PALETTE[key]));
    gl.uniform1f(uniform('u_strength'), PALETTE.strength);
    gl.uniform1f(uniform('u_warm'), warm ? 1 : 0);
    return true;
  }

  // The canvas matches the screen's pixels (up to twice the CSS size, 1.5 on
  // touch screens) and is shown pixel for pixel, so the lit creases stay sharp.
  let size = [0, 0];
  function resize() {
    const cssWidth = host.clientWidth || innerWidth, cssHeight = host.clientHeight || innerHeight;
    const scale = Math.min(devicePixelRatio || 1, touch ? 1.5 : 2);
    const next = [Math.max(1, Math.round(cssWidth * scale)), Math.max(1, Math.round(cssHeight * scale))];
    // Mobile browsers change the height while the address bar slides; small
    // changes simply stretch the picture instead of redrawing it mid-scroll.
    if (size[0] === next[0] && Math.abs(size[1] - next[1]) / Math.max(1, size[1]) < .15) return false;
    size = next;
    canvas.width = size[0];
    canvas.height = size[1];
    // Pixel for pixel, the browser can show the canvas without filtering it again.
    canvas.classList.toggle('is-exact', scale === (devicePixelRatio || 1));
    gl.viewport(0, 0, size[0], size[1]);
    gl.useProgram(fold);
    gl.uniform2f(at.res, size[0], size[1]);
    if (blend) {
      gl.useProgram(blend);
      gl.uniform2f(at.blendRes, size[0], size[1]);
    }
    return true;
  }

  // Time starts at a fixed point, so the first frame (and the still one) is always the same.
  const SPEED = .45, START = 14;
  let clock = START, shown = false;
  function reveal() { if (!shown) { shown = true; host.classList.add('has-fold'); } }
  function drawLive() {
    gl.useProgram(fold);
    gl.uniform1f(at.time, clock);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    reveal();
  }

  // Without a graphics card a whole picture costs too much for every frame, so
  // the folds go from one finished picture to the next: the next one is drawn a
  // band at a time while the screen blends the last two. Between two pictures
  // the creases move only a few pixels, so the blend reads as slow motion (a
  // larger step showed doubled creases halfway through the blend).
  const KEY_PERIOD = 1200, KEY_STEP = .15, KEY_GAP = 1000 / 12;
  const keys = [];
  let from = 0, to = 1, next = 2, built = 0, bands = 1, fade = 0, keyClock = START;
  function allocateKeys() {
    for (let i = 0; i < 3; i++) {
      keys[i] ||= {texture:gl.createTexture(), buffer:gl.createFramebuffer()};
      gl.bindTexture(gl.TEXTURE_2D, keys[i].texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size[0], size[1], 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, keys[i].buffer);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, keys[i].texture, 0);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) return false;
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return true;
  }
  function paintKey(index, time, top = 0, bottom = size[1]) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, keys[index].buffer);
    gl.useProgram(fold);
    gl.uniform1f(at.time, time);
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(0, top, size[0], bottom - top);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.disable(gl.SCISSOR_TEST);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }
  function showBlend() {
    gl.useProgram(blend);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, keys[from].texture);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, keys[to].texture);
    gl.uniform1f(at.mix, fade);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    reveal();
  }
  function restartKeys() {
    if (!allocateKeys()) return false;
    from = 0; to = 1; next = 2; built = 0; fade = 0;
    bands = Math.max(4, Math.floor(KEY_PERIOD / KEY_GAP) - 2);
    paintKey(from, keyClock);
    paintKey(to, keyClock + KEY_STEP);
    showBlend();
    return true;
  }
  function stepKeys(elapsed) {
    if (built < bands) {
      paintKey(next, keyClock + 2 * KEY_STEP, Math.floor(built * size[1] / bands), Math.floor((built + 1) * size[1] / bands));
      built += 1;
    }
    fade += elapsed / KEY_PERIOD;
    if (fade >= 1) {
      if (built < bands) fade = 1;
      else {
        [from, to, next] = [to, next, from];
        keyClock += KEY_STEP;
        fade = Math.min(fade - 1, 1);
        built = 0;
      }
    }
    showBlend();
  }

  // Pacing. While the page scrolls the folds hold still, so every frame goes to
  // the scroll itself; once it stops they move on from the same place. A guard:
  // if the browser keeps delivering frames late while the tab is visible, the
  // page is struggling and the folds stop where they are.
  let step = 1000 / 24;
  let running = false, frame = 0, last = 0, slow = 0, checked = 0, scrolled = -1e9;
  function tick(now) {
    if (!running) return;
    frame = requestAnimationFrame(tick);
    if (now - scrolled < 220) { last = 0; return; }
    const gap = now - last;
    if (gap < step - 2) return;
    let elapsed = 0;
    if (last) {
      checked += 1;
      if (gap > step + 40) slow += 1;
      if (checked >= 90) {
        if (slow > 45) { stop(); return; }
        checked = slow = 0;
      }
      elapsed = Math.min(gap, 100);
    }
    last = now;
    if (mode === 'keys') stepKeys(elapsed);
    else { clock += elapsed / 1000 * SPEED; drawLive(); }
  }
  function start() {
    if (running || document.hidden) return;
    running = true;
    last = 0;
    frame = requestAnimationFrame(tick);
  }
  function stop() { running = false; cancelAnimationFrame(frame); }

  // Without a working canvas the old still background returns.
  function fail() {
    stop();
    host.classList.remove('has-fold');
    root.classList.remove('nx-fold-on');
    canvas.remove();
  }
  canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); fail(); });

  // Start after the page itself has loaded, so the canvas never delays it.
  function boot() {
    mode = calm ? 'still' : software() ? 'keys' : 'live';
    if (mode === 'keys') step = KEY_GAP;
    else step = 1000 / (touch ? 20 : 24);
    if (!setup()) { fail(); return; }
    host.append(canvas);
    resize();
    const paint = () => (mode === 'keys' ? restartKeys() : (drawLive(), true));
    if (!paint()) { fail(); return; }
    if (mode !== 'still') {
      addEventListener('scroll', () => { scrolled = performance.now(); }, {passive:true});
      document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
      start();
    }
    // A new size clears the canvas; it is drawn again once resizing settles.
    let settle = 0;
    addEventListener('resize', () => {
      clearTimeout(settle);
      settle = setTimeout(() => { if (resize() && !paint()) fail(); }, 150);
    }, {passive:true});
  }
  if (document.readyState === 'complete') requestAnimationFrame(boot);
  else addEventListener('load', () => requestAnimationFrame(boot), {once:true});
})();
