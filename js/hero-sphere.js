// The sphere behind the portrait of the home page: a medium being homogenized.
//
// A sphere of matrix holds inclusions of the shapes whose Eshelby problem is
// solved in closed form — spheres, prolate and oblate spheroids, fibers,
// penny-shaped cracks — in the two accent colors of the theme, and turns
// slowly. Every ten seconds the inclusions melt into the matrix and the sphere
// becomes its effective medium: one uniform tint, the volume average of the
// colors of its phases. As in the 2D disk it replaces, the inclusions keep
// their colors and fade out, dissolving into the mass while the matrix
// thickens into the effective medium; the sphere then comes back the other
// way, as a new realization of the same random medium.
//
// Loaded on demand by the hero module of _config/motion.html, whose helpers it
// uses. It draws with plain WebGL and the lighting of js/echoes-viewer.js; with
// no WebGL the portrait simply stands alone. A reader who asks for reduced
// motion gets the heterogeneous sphere, still.
(function () {
  "use strict";

  var M = window.jfbMotion;
  if (!M) return;

  var CYCLE = 10;          // seconds
  var MELT = [3.4, 6.4, 7.6, 9.9];  // the inclusions dissolve, and come back
  var SWAP = 7;            // the next realization is drawn while the sphere is uniform
  var TURN = 36;           // seconds per turn
  var TILT = 0.35;         // rad: the axis of rotation leans toward the reader
  var SEED = 1949;
  var FRACTION = 0.06;     // volume fraction of the inclusions
  var SHARE = 0.55;        // part of it in the first phase
  var TRIES = 300;         // random positions tried for each
  var GAP = 0.015;         // smallest distance between two inclusions
  var R_IN = 0.93;         // inclusions stay inside this radius
  var NU = 14, NV = 28;    // mesh resolution of one inclusion
  var LIGHT = [0.4477, 0.4973, 0.7431];   // the light of the echoes scene

  // --- Microstructure --------------------------------------------------------

  // Semi-axes a ≥ b ≥ c of one inclusion, the sphere having radius 1.
  function semiAxes(r) {
    var k = r(), a, b;
    if (k < 0.4) { a = 0.105 + 0.075 * r(); return [a, a, a]; }                         // sphere
    if (k < 0.6) { a = 0.145 + 0.07 * r(); b = a * (0.5 + 0.2 * r()); return [a, b, b]; } // prolate spheroid
    if (k < 0.72) { a = 0.13 + 0.05 * r(); return [a, a, a * (0.45 + 0.2 * r())]; }     // oblate spheroid
    if (k < 0.9) { a = 0.2 + 0.075 * r(); b = a / (4 + 3 * r()); return [a, b, b]; }     // fiber
    a = 0.11 + 0.05 * r(); return [a, a, 0.012];                                        // crack
  }

  // An inclusion's volume over that of the sphere.
  function volume(s) { return s.ax[0] * s.ax[1] * s.ax[2]; }

  // A uniformly random rotation (Shoemake's quaternion), as a row-major 3×3
  // whose columns are the axes of the inclusion.
  function orientation(r) {
    var u = r(), s1 = Math.sqrt(1 - u), s2 = Math.sqrt(u);
    var t1 = 2 * Math.PI * r(), t2 = 2 * Math.PI * r();
    var x = s1 * Math.sin(t1), y = s1 * Math.cos(t1), z = s2 * Math.sin(t2), w = s2 * Math.cos(t2);
    return [
      1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w),
      2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w),
      2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)
    ];
  }

  // Each inclusion is kept apart from the others through a capsule that holds
  // it: the segment ±(a − b) along its major axis, swept by a ball of radius b.
  // A prolate spheroid lies inside its capsule (in every plane through the
  // axis, the ellipse of semi-axes a, b lies inside the stadium of the same
  // length and width); a sphere, an oblate spheroid or a crack (a = b) gets
  // its circumscribed ball. Two inclusions whose capsules are GAP apart cannot
  // touch.
  function capsule(s) {
    var h = s.ax[0] - s.ax[1];
    return { u: [h * s.q[0], h * s.q[3], h * s.q[6]], b: s.ax[1] };
  }

  function dot(x, y) { return x[0] * y[0] + x[1] * y[1] + x[2] * y[2]; }
  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }

  // Smallest distance between the segments [p − u, p + u] and [q − v, q + v]
  // (the closest points of two segments, after Ericson, Real-Time Collision
  // Detection, 2005, § 5.1.9).
  function segmentDistance(p, u, q, v) {
    var p1 = [p[0] - u[0], p[1] - u[1], p[2] - u[2]], d1 = [2 * u[0], 2 * u[1], 2 * u[2]];
    var q1 = [q[0] - v[0], q[1] - v[1], q[2] - v[2]], d2 = [2 * v[0], 2 * v[1], 2 * v[2]];
    var r = [p1[0] - q1[0], p1[1] - q1[1], p1[2] - q1[2]];
    var a = dot(d1, d1), e = dot(d2, d2), f = dot(d2, r), s = 0, t = 0, eps = 1e-12;
    if (a <= eps && e <= eps) return Math.sqrt(dot(r, r));
    if (a <= eps) {
      t = clamp01(f / e);
    } else {
      var c = dot(d1, r);
      if (e <= eps) {
        s = clamp01(-c / a);
      } else {
        var b = dot(d1, d2), den = a * e - b * b;
        s = den > eps ? clamp01((b * f - c * e) / den) : 0;
        t = (b * s + f) / e;
        if (t < 0) { t = 0; s = clamp01(-c / a); }
        else if (t > 1) { t = 1; s = clamp01((b - c) / a); }
      }
    }
    var w = [0, 1, 2].map(function (k) { return p1[k] + d1[k] * s - q1[k] - d2[k] * t; });
    return Math.sqrt(dot(w, w));
  }

  function overlap(s, t) {
    var dx = [s.x[0] - t.x[0], s.x[1] - t.x[1], s.x[2] - t.x[2]];
    if (Math.sqrt(dot(dx, dx)) >= s.ax[0] + t.ax[0] + GAP) return false;
    return segmentDistance(s.x, s.cap.u, t.x, t.cap.u) < s.cap.b + t.cap.b + GAP;
  }

  // Realization n: inclusions are drawn until their volume fraction reaches
  // FRACTION, each going to the phase that is short of its share, so that
  // every realization has the same effective tint; they are then placed
  // largest first, each at the first of TRIES random positions where it
  // overlaps nothing.
  function medium(n) {
    var r = M.random(SEED + n), wanted = [], placed = [], f = [0, 0];
    while (f[0] + f[1] < FRACTION) {
      var w = { ax: semiAxes(r), c: f[0] <= SHARE * (f[0] + f[1]) ? 0 : 1 };
      wanted.push(w);
      f[w.c] += volume(w);
    }
    wanted.sort(function (u, v) { return volume(v) - volume(u); });
    wanted.forEach(function (w) {
      for (var k = 0; k < TRIES; k++) {
        var rho = (R_IN - w.ax[0]) * Math.cbrt(r()), ct = 2 * r() - 1, st = Math.sqrt(1 - ct * ct);
        var ph = 2 * Math.PI * r();
        var s = { x: [rho * st * Math.cos(ph), rho * st * Math.sin(ph), rho * ct], ax: w.ax, q: orientation(r), c: w.c };
        s.cap = capsule(s);
        if (!placed.some(function (t) { return overlap(s, t); })) { placed.push(s); break; }
      }
    });
    return placed;
  }

  // --- Meshes ----------------------------------------------------------------

  // The points x + Q (a u₁, b u₂, c u₃) for u on the unit sphere, with the
  // outward normal Q (u₁/a, u₂/b, u₃/c).
  function inclusionMesh(s) {
    var out = { pos: [], nor: [], phase: [], idx: [] }, q = s.q, ax = s.ax;
    for (var i = 0; i <= NU; i++) {
      var t1 = Math.PI * i / NU, s1 = Math.sin(t1), c1 = Math.cos(t1);
      for (var j = 0; j <= NV; j++) {
        var t2 = 2 * Math.PI * j / NV;
        var u = [s1 * Math.cos(t2), s1 * Math.sin(t2), c1], n = [0, 0, 0];
        for (var r = 0; r < 3; r++) {
          var p = s.x[r];
          for (var k = 0; k < 3; k++) {
            p += q[3 * r + k] * ax[k] * u[k];
            n[r] += q[3 * r + k] * u[k] / ax[k];
          }
          out.pos.push(p);
        }
        var l = Math.hypot(n[0], n[1], n[2]) || 1;
        out.nor.push(n[0] / l, n[1] / l, n[2] / l);
        out.phase.push(s.c);
      }
    }
    grid(out, NU, NV, 0);
    return out;
  }

  function sphereMesh() {
    var out = { pos: [], nor: [], phase: [], idx: [] }, nu = 32, nv = 64;
    for (var i = 0; i <= nu; i++) {
      var t1 = Math.PI * i / nu;
      for (var j = 0; j <= nv; j++) {
        var t2 = 2 * Math.PI * j / nv;
        var x = Math.sin(t1) * Math.cos(t2), y = Math.cos(t1), z = Math.sin(t1) * Math.sin(t2);
        out.pos.push(x, y, z);
        out.nor.push(x, y, z);
        out.phase.push(0);
      }
    }
    grid(out, nu, nv, 0);
    return out;
  }

  function grid(out, nu, nv, base) {
    for (var i = 0; i < nu; i++) {
      for (var j = 0; j < nv; j++) {
        var a0 = base + i * (nv + 1) + j, a1 = a0 + 1, b0 = a0 + nv + 1, b1 = b0 + 1;
        out.idx.push(a0, b0, a1, a1, b0, b1);
      }
    }
  }

  // --- WebGL -----------------------------------------------------------------

  var VS = [
    "attribute vec3 aPos; attribute vec3 aNor; attribute float aPhase;",
    "uniform mat3 uRot; uniform float uScale;",
    "varying vec3 vN; varying float vPhase;",
    "void main() {",
    "  vec3 p = uRot * aPos;",
    "  vN = uRot * aNor; vPhase = aPhase;",
    "  gl_Position = vec4(p.xy * uScale, -p.z * 0.5, 1.0);",
    "}"
  ].join("\n");

  // Lambert plus a GGX highlight, as in js/echoes-viewer.js; the color is the
  // inclusion's phase. uAlpha (premultiplied) is 1 except where the layer
  // cannot be used (see below).
  var FS_INCLUSION = [
    "precision mediump float;",
    "varying vec3 vN; varying float vPhase;",
    "uniform vec3 uLight; uniform vec3 uPhase0; uniform vec3 uPhase1; uniform float uAlpha;",
    "void main() {",
    "  vec3 N = normalize(vN); if (N.z < 0.0) N = -N;",
    "  vec3 L = normalize(uLight); vec3 V = vec3(0.0, 0.0, 1.0); vec3 H = normalize(L + V);",
    "  float nl = max(dot(N, L), 0.0), nh = max(dot(N, H), 0.0), nv = max(N.z, 1e-3);",
    "  float a2 = 0.09 * 0.09;",
    "  float d = nh * nh * (a2 - 1.0) + 1.0;",
    "  float D = a2 / (3.14159 * d * d);",
    "  float F = 0.04 + 0.96 * pow(1.0 - max(dot(H, V), 0.0), 5.0);",
    "  float spec = 0.75 * D * F / (4.0 * nv);",
    "  vec3 c = mix(uPhase0, uPhase1, vPhase);",
    "  gl_FragColor = vec4(c * (0.2 + 0.85 * nl) + vec3(min(spec, 1.2) * nl), 1.0) * uAlpha;",
    "}"
  ].join("\n");

  // The matrix. As glass (uSolid = 0) it is a veil of the matrix color, denser
  // toward the rim, where it takes the page's ink so that it reads on either
  // ground; as the effective medium (uSolid = 1) it is an opaque, lit sphere of
  // the effective tint. Premultiplied alpha.
  var FS_MEDIUM = [
    "precision mediump float;",
    "varying vec3 vN;",
    "uniform vec3 uLight; uniform vec3 uInk; uniform vec3 uMatrix; uniform vec3 uTint;",
    "uniform float uBase; uniform float uRim; uniform float uSolid;",
    "void main() {",
    "  vec3 N = normalize(vN);",
    "  float rim = pow(1.0 - abs(N.z), 2.0);",
    "  vec3 L = normalize(uLight); vec3 H = normalize(L + vec3(0.0, 0.0, 1.0));",
    "  float spec = pow(max(dot(N, H), 0.0), 60.0) * 0.55;",
    "  float a = uBase + uRim * rim;",
    "  vec3 glass = uMatrix * uBase + uInk * uRim * rim;",
    "  vec3 solid = mix(uTint * (0.84 + 0.22 * max(dot(N, L), 0.0)), uInk, 0.6 * uRim * rim);",
    "  vec3 col = mix(glass, solid, uSolid);",
    "  float alpha = mix(a, 1.0, uSolid);",
    "  gl_FragColor = vec4(col + vec3(spec), min(alpha + spec, 1.0));",
    "}"
  ].join("\n");

  var ATTRIBUTES = [["pos", 0, 3, "aPos"], ["nor", 1, 3, "aNor"], ["phase", 2, 1, "aPhase"]];

  // The inclusion layer laid over the matrix: a square covering the canvas,
  // read with the alpha of the stage. Premultiplied alpha.
  var VS_LAYER = [
    "attribute vec2 aCorner; varying vec2 vUV;",
    "void main() { vUV = aCorner * 0.5 + 0.5; gl_Position = vec4(aCorner, 0.0, 1.0); }"
  ].join("\n");

  var FS_LAYER = [
    "precision mediump float;",
    "varying vec2 vUV; uniform sampler2D uLayer; uniform float uAlpha;",
    "void main() { gl_FragColor = texture2D(uLayer, vUV) * uAlpha; }"
  ].join("\n");

  var UNIFORMS = ["uRot", "uScale", "uLight", "uPhase0", "uPhase1", "uAlpha", "uInk", "uMatrix",
    "uTint", "uBase", "uRim", "uSolid", "uLayer"];

  function program(gl, vs, fs, attributes) {
    function sh(type, src) {
      var s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    }
    var p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
    attributes.forEach(function (a) { gl.bindAttribLocation(p, a[1], a[3]); });
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    var u = {};
    UNIFORMS.forEach(function (n) { u[n] = gl.getUniformLocation(p, n); });
    return { id: p, u: u };
  }

  // An offscreen layer for the inclusions, so that they fade out as one body:
  // drawn opaque at twice the canvas resolution, since WebGL 1 has no
  // multisampling offscreen, then laid over the matrix, where the bilinear
  // read at each pixel center averages a 2×2 block. Null if the platform
  // refuses it, in which case each inclusion fades on its own.
  function Layer(gl) {
    var tex = gl.createTexture(), depth = gl.createRenderbuffer(), fbo = gl.createFramebuffer();
    var corners = gl.createBuffer(), side = 0;
    gl.bindBuffer(gl.ARRAY_BUFFER, corners);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    var limit = Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE), gl.getParameter(gl.MAX_RENDERBUFFER_SIZE), 2048);

    function resize(n) {
      side = n;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, n, n, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.bindRenderbuffer(gl.RENDERBUFFER, depth);
      gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, n, n);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depth);
      return gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    }

    if (!resize(Math.min(512, limit))) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return null;
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return {
      // Render into the layer, sized for a canvas of `size` pixels.
      begin: function (size) {
        var n = Math.min(2 * size, limit);
        if (n !== side) resize(n);
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        gl.viewport(0, 0, n, n);
      },
      // Back to the canvas, and lay the layer over it.
      end: function (prog, size, alpha) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, size, size);
        gl.useProgram(prog.id);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.uniform1i(prog.u.uLayer, 0);
        gl.uniform1f(prog.u.uAlpha, alpha);
        ATTRIBUTES.forEach(function (a) { gl.disableVertexAttribArray(a[1]); });
        gl.bindBuffer(gl.ARRAY_BUFFER, corners);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
    };
  }

  // Meshes go up in batches of fewer than 65,536 vertices (WebGL 1 indices are
  // 16-bit without an extension).
  function upload(gl, meshes) {
    var batches = [], cur = null;
    meshes.forEach(function (m) {
      var n = m.pos.length / 3;
      if (!cur || cur.n + n > 65535) {
        cur = { n: 0, pos: [], nor: [], phase: [], idx: [] };
        batches.push(cur);
      }
      var off = cur.n;
      Array.prototype.push.apply(cur.pos, m.pos);
      Array.prototype.push.apply(cur.nor, m.nor);
      Array.prototype.push.apply(cur.phase, m.phase);
      for (var k = 0; k < m.idx.length; k++) cur.idx.push(m.idx[k] + off);
      cur.n += n;
    });
    return batches.map(function (b) {
      function buf(target, data) {
        var o = gl.createBuffer();
        gl.bindBuffer(target, o);
        gl.bufferData(target, data, gl.STATIC_DRAW);
        return o;
      }
      return {
        pos: buf(gl.ARRAY_BUFFER, new Float32Array(b.pos)),
        nor: buf(gl.ARRAY_BUFFER, new Float32Array(b.nor)),
        phase: buf(gl.ARRAY_BUFFER, new Float32Array(b.phase)),
        idx: buf(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(b.idx)),
        count: b.idx.length
      };
    });
  }

  function release(gl, batches) {
    batches.forEach(function (b) {
      [b.pos, b.nor, b.phase, b.idx].forEach(function (o) { gl.deleteBuffer(o); });
    });
  }

  function draw(gl, batches) {
    batches.forEach(function (b) {
      ATTRIBUTES.forEach(function (a) {
        gl.bindBuffer(gl.ARRAY_BUFFER, b[a[0]]);
        gl.enableVertexAttribArray(a[1]);
        gl.vertexAttribPointer(a[1], a[2], gl.FLOAT, false, 0, 0);
      });
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, b.idx);
      gl.drawElements(gl.TRIANGLES, b.count, gl.UNSIGNED_SHORT, 0);
    });
  }

  // Rotation Rx(pitch) · Ry(yaw), column-major for uniformMatrix3fv.
  function rotation(yaw, pitch) {
    var cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    var r = [
      cy, 0, sy,
      sp * sy, cp, -sp * cy,
      -cp * sy, sp, cp * cy
    ];
    return new Float32Array([r[0], r[3], r[6], r[1], r[4], r[7], r[2], r[5], r[8]]);
  }

  // --- The hero --------------------------------------------------------------

  // A stage of the cycle, [rise start, rise end, fall start, fall end] in
  // seconds, eased by smoothstep: its steepest slope is half that of the
  // cubic ease of the other animations, so the change is spread out.
  function stage(phase, s) {
    function smooth(f) { return f * f * (3 - 2 * f); }
    return smooth(M.span(phase, s[0], s[1])) - smooth(M.span(phase, s[2], s[3]));
  }

  M.heroSphere = function (portrait) {
    var canvas = document.createElement("canvas");
    var attrs = { antialias: true, premultipliedAlpha: true, alpha: true };
    var gl = canvas.getContext("webgl", attrs) || canvas.getContext("experimental-webgl", attrs);
    if (!gl) return;
    var pIncl, pMedium, pLayer, layer;
    try {
      pIncl = program(gl, VS, FS_INCLUSION, ATTRIBUTES);
      pMedium = program(gl, VS, FS_MEDIUM, ATTRIBUTES);
      pLayer = program(gl, VS_LAYER, FS_LAYER, [["corner", 0, 2, "aCorner"]]);
      layer = Layer(gl);
    } catch (err) {
      if (window.console) console.warn("hero sphere:", err);
      return;
    }

    var figure = document.createElement("span");
    figure.className = "hero-figure";
    portrait.parentNode.insertBefore(figure, portrait);
    figure.appendChild(portrait);
    canvas.className = "hero-sphere";
    canvas.setAttribute("aria-hidden", "true");
    figure.insertBefore(canvas, portrait);

    var bGlass = upload(gl, [sphereMesh()]);
    var light = new Float32Array(LIGHT);
    var current = -1, set = null, bIncl = null, palette = null, tint = null, clock = 0;

    function readTheme() {
      var dark = document.body.classList.contains("quarto-dark");
      palette = {
        matrix: M.mix(M.rgb("surface-2"), M.rgb("accent"), 0.12),
        phases: [M.rgb("accent"), M.rgb("accent-2")],
        ink: M.rgb("ink"),
        base: dark ? 0.16 : 0.12,
        rim: dark ? 0.28 : 0.2
      };
      if (set) tint = effective();
    }

    // The effective medium's tint: the colors of the matrix and of the two
    // phases, weighted by their volume fractions.
    function effective() {
      var f = [0, 0];
      set.forEach(function (s) { f[s.c] += volume(s); });
      return palette.matrix.map(function (m, k) {
        return m + f[0] * (palette.phases[0][k] - m) + f[1] * (palette.phases[1][k] - m);
      });
    }

    function realize(n) {
      if (n === current) return;
      if (bIncl) release(gl, bIncl);
      set = medium(n);
      bIncl = upload(gl, set.map(inclusionMesh));
      tint = effective();
      current = n;
    }

    function render(t) {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var size = Math.round(canvas.clientWidth * dpr);
      if (!size) return;
      if (canvas.width !== size) canvas.width = canvas.height = size;

      var phase = t % CYCLE;
      realize(Math.floor((t + CYCLE - SWAP) / CYCLE));
      // 0 while heterogeneous, 1 once homogenized.
      var h = stage(phase, MELT);
      var rot = rotation(2 * Math.PI * t / TURN, TILT), scale = 0.96;

      gl.viewport(0, 0, size, size);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.disable(gl.DEPTH_TEST);

      // The matrix, back half: glass.
      drawMatrix(rot, scale, gl.FRONT, 0);

      // The inclusions, fading out as one body over it.
      var alpha = 1 - h;
      if (alpha > 0) {
        var fading = alpha < 1;
        if (fading && layer) layer.begin(size);
        if (fading && layer) gl.clear(gl.COLOR_BUFFER_BIT);
        gl.depthMask(true);
        gl.clear(gl.DEPTH_BUFFER_BIT);
        gl.enable(gl.DEPTH_TEST);
        gl.disable(gl.CULL_FACE);
        if (fading && !layer) gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        else gl.disable(gl.BLEND);
        gl.useProgram(pIncl.id);
        gl.uniformMatrix3fv(pIncl.u.uRot, false, rot);
        gl.uniform1f(pIncl.u.uScale, scale);
        gl.uniform3fv(pIncl.u.uLight, light);
        gl.uniform3fv(pIncl.u.uPhase0, palette.phases[0]);
        gl.uniform3fv(pIncl.u.uPhase1, palette.phases[1]);
        gl.uniform1f(pIncl.u.uAlpha, fading && !layer ? alpha : 1);
        draw(gl, bIncl);
        gl.disable(gl.DEPTH_TEST);
        gl.enable(gl.BLEND);
        if (fading && layer) layer.end(pLayer, size, alpha);
      }

      // The matrix, front half: from glass to the effective medium.
      drawMatrix(rot, scale, gl.BACK, h);
    }

    function drawMatrix(rot, scale, cull, solid) {
      gl.enable(gl.CULL_FACE);
      gl.cullFace(cull);
      gl.useProgram(pMedium.id);
      gl.uniformMatrix3fv(pMedium.u.uRot, false, rot);
      gl.uniform1f(pMedium.u.uScale, scale);
      gl.uniform3fv(pMedium.u.uLight, light);
      gl.uniform3fv(pMedium.u.uInk, palette.ink);
      gl.uniform3fv(pMedium.u.uMatrix, palette.matrix);
      gl.uniform3fv(pMedium.u.uTint, tint);
      gl.uniform1f(pMedium.u.uBase, palette.base);
      gl.uniform1f(pMedium.u.uRim, palette.rim);
      gl.uniform1f(pMedium.u.uSolid, solid);
      draw(gl, bGlass);
    }

    readTheme();
    M.onTheme(function () { readTheme(); render(clock); });
    new ResizeObserver(function () { render(clock); }).observe(canvas);
    render(0);
    // Deterministic frames for the GIF/MP4 exporter.
    M.heroFrame = function (seconds) { clock = seconds; render(clock); };
    if (M.calm) return;
    M.loop(canvas, function (dt) { clock += dt; render(clock); return true; }, 30).start();
  };
})();
