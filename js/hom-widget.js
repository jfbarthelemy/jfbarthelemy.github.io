// Mean-field homogenization in the browser.
//
// A matrix with spherical inclusions, both isotropic: the effective Young's
// modulus as a function of the inclusion volume fraction φ, for the bounds and
// the classical schemes. Each scheme gives a bulk modulus k and a shear
// modulus μ, and E = 9kμ / (3k + μ), which increases in both, so a bound on k
// and μ is a bound on E.
//
// - Voigt and Reuss: k = ⟨k⟩, μ = ⟨μ⟩ and 1/k = ⟨1/k⟩, 1/μ = ⟨1/μ⟩, with ⟨·⟩
//   the volume average over the phases.
// - Hashin–Shtrikman estimate for a reference medium (k₀, μ₀):
//
//     k(μ₀)     = ⟨k / (k + 4μ₀/3)⟩ / ⟨1 / (k + 4μ₀/3)⟩,
//     μ(k₀, μ₀) = ⟨μ / (μ + ζ₀)⟩ / ⟨1 / (μ + ζ₀)⟩,   ζ₀ = μ₀ (9k₀ + 8μ₀) / (6 (k₀ + 2μ₀)).
//
//   The bounds take the stiffest and the softest moduli (Walpole's form, which
//   stays a bound when the phases are not well ordered); Mori–Tanaka takes the
//   matrix; the self-consistent estimate takes the effective medium itself, a
//   fixed point found here by bisection on μ.
// - Dilute, on the stiffness: k = kₘ + φ (kᵢ − kₘ) aₖ, μ = μₘ + φ (μᵢ − μₘ) a_μ,
//   with the strain concentration factors of a sphere in the matrix
//   aₖ = (kₘ + 4μₘ/3) / (kᵢ + 4μₘ/3) and a_μ = (μₘ + ζₘ) / (μᵢ + ζₘ); on the
//   compliance: 1/k = 1/kₘ + φ (kₘ − kᵢ) aₖ / kₘ², and likewise for μ. Both
//   hold for small φ only, and lose a modulus to zero or to infinity further.
// - Three-phase model (generalized self-consistent): an inclusion in a shell
//   of matrix, embedded in the effective medium. Its bulk modulus is the
//   Mori–Tanaka one; its shear modulus is the root of Christensen and Lo's
//   quadratic.
// - Differential: inclusions added in infinitesimal steps to the current
//   effective medium, dk/dt = (kᵢ − k) (k + 4μ/3) / (kᵢ + 4μ/3) and
//   dμ/dt = (μᵢ − μ) (μ + ζ) / (μᵢ + ζ) in t = −ln(1 − φ), integrated by
//   fourth-order Runge–Kutta.
//
// Loaded on demand by _config/motion.html on the page that has a
// `#hom-widget` element. Without JavaScript that element stays empty and the
// page reads as before.
(function () {
  "use strict";

  var M = window.jfbMotion;
  if (!M) return;

  // --- Mechanics -------------------------------------------------------------

  function zeta(k, mu) { return mu * (9 * k + 8 * mu) / (6 * (k + 2 * mu)); }

  function k_of(phases, mu0) {
    var z = 4 * mu0 / 3, num = 0, den = 0;
    phases.forEach(function (p) { num += p.f * p.k / (p.k + z); den += p.f / (p.k + z); });
    return num / den;
  }

  function mu_of(phases, k0, mu0) {
    var z = zeta(k0, mu0), num = 0, den = 0;
    phases.forEach(function (p) { num += p.f * p.mu / (p.mu + z); den += p.f / (p.mu + z); });
    return num / den;
  }

  // A modulus driven to zero or below (the dilute estimates beyond their
  // range) has no Young's modulus.
  function young(k, mu) { return k > 0 && mu > 0 && isFinite(k) && isFinite(mu) ? 9 * k * mu / (3 * k + mu) : NaN; }

  function moduli(E, nu) { return { k: E / (3 * (1 - 2 * nu)), mu: E / (2 * (1 + nu)) }; }

  function nu_of(p) { return (3 * p.k - 2 * p.mu) / (2 * (3 * p.k + p.mu)); }

  // Christensen & Lo (1979): A x² + 2B x + C = 0 for x = μ/μₘ, with g = μᵢ/μₘ.
  // At φ = 0 its roots are 1 and a negative one, and A, C keep opposite signs
  // over the whole range, so the positive root is the estimate.
  function gsc_shear(m, i, phi) {
    var nm = nu_of(m), ni = nu_of(i), g = i.mu / m.mu, g1 = g - 1;
    var e1 = g1 * (49 - 50 * ni * nm) + 35 * g * (ni - 2 * nm) + 35 * (2 * ni - nm);
    var e2 = 5 * ni * (g - 8) + 7 * (g + 4);
    var e3 = g * (8 - 10 * nm) + (7 - 5 * nm);
    var c103 = Math.pow(phi, 10 / 3), c73 = Math.pow(phi, 7 / 3), c53 = Math.pow(phi, 5 / 3);
    var mid = 2 * (63 * g1 * e2 + 2 * e1 * e3) * c73 - 252 * g1 * e2 * c53;
    var A = 8 * g1 * (4 - 5 * nm) * e1 * c103 - mid
      - 50 * g1 * (7 - 12 * nm + 8 * nm * nm) * e2 * phi + 4 * (7 - 10 * nm) * e2 * e3;
    var B = -2 * g1 * (1 - 5 * nm) * e1 * c103 + mid
      + 75 * g1 * (3 - nm) * e2 * nm * phi + 1.5 * (15 * nm - 7) * e2 * e3;
    var C = 4 * g1 * (5 * nm - 7) * e1 * c103 - mid
      + 25 * g1 * (nm * nm - 7) * e2 * phi - (7 + 5 * nm) * e2 * e3;
    if (A < 0) { A = -A; B = -B; C = -C; }
    var s = Math.sqrt(B * B - A * C);
    // The positive root, written to avoid cancellation.
    var x = B > 0 ? -C / (B + s) : (s - B) / A;
    return m.mu * x;
  }

  function differential(m, i, phi) {
    if (phi >= 1) return { k: i.k, mu: i.mu };
    function rate(k, mu) {
      var z = zeta(k, mu);
      return [(i.k - k) * (k + 4 * mu / 3) / (i.k + 4 * mu / 3), (i.mu - mu) * (mu + z) / (i.mu + z)];
    }
    var T = -Math.log(1 - phi), n = Math.max(1, Math.ceil(T / 0.0025)), h = T / n;
    var k = m.k, mu = m.mu;
    for (var s = 0; s < n; s++) {
      var a = rate(k, mu);
      var b = rate(k + h / 2 * a[0], mu + h / 2 * a[1]);
      var c = rate(k + h / 2 * b[0], mu + h / 2 * b[1]);
      var d = rate(k + h * c[0], mu + h * c[1]);
      k += h / 6 * (a[0] + 2 * b[0] + 2 * c[0] + d[0]);
      mu += h / 6 * (a[1] + 2 * b[1] + 2 * c[1] + d[1]);
    }
    return { k: k, mu: mu };
  }

  function estimates(m, i, phi) {
    var phases = [
      { f: 1 - phi, k: m.k, mu: m.mu },
      { f: phi, k: i.k, mu: i.mu }
    ];
    var kmax = Math.max(m.k, i.k), kmin = Math.min(m.k, i.k);
    var mmax = Math.max(m.mu, i.mu), mmin = Math.min(m.mu, i.mu);
    var r = {};
    r.voigt = young((1 - phi) * m.k + phi * i.k, (1 - phi) * m.mu + phi * i.mu);
    r.reuss = young(1 / ((1 - phi) / m.k + phi / i.k), 1 / ((1 - phi) / m.mu + phi / i.mu));
    r.upper = young(k_of(phases, mmax), mu_of(phases, kmax, mmax));
    r.lower = young(k_of(phases, mmin), mu_of(phases, kmin, mmin));
    var kmt = k_of(phases, m.mu);
    r.mt = young(kmt, mu_of(phases, m.k, m.mu));
    var ak = (m.k + 4 * m.mu / 3) / (i.k + 4 * m.mu / 3), zm = zeta(m.k, m.mu), am = (m.mu + zm) / (i.mu + zm);
    r.dilute = young(m.k + phi * (i.k - m.k) * ak, m.mu + phi * (i.mu - m.mu) * am);
    r.dilutec = young(1 / (1 / m.k + phi * (m.k - i.k) * ak / (m.k * m.k)),
      1 / (1 / m.mu + phi * (m.mu - i.mu) * am / (m.mu * m.mu)));
    r.gsc = young(kmt, gsc_shear(m, i, phi));
    var dif = differential(m, i, phi);
    r.diff = young(dif.k, dif.mu);
    // Self-consistent: μ = μ(k(μ), μ), bracketed by [μmin, μmax].
    var lo = mmin, hi = mmax;
    for (var n = 0; n < 200 && hi - lo > 1e-15 * hi; n++) {
      var mid = 0.5 * (lo + hi);
      if (mu_of(phases, k_of(phases, mid), mid) > mid) lo = mid;
      else hi = mid;
    }
    var mu = 0.5 * (lo + hi);
    r.sc = young(k_of(phases, mu), mu);
    return r;
  }

  M.homEstimates = function (Em, num, Ei, nui, phi) {
    return estimates(moduli(Em, num), moduli(Ei, nui), phi);
  };

  // --- UI ------------------------------------------------------------------

  // A pair draws two curves (a bound from below and one from above) under one
  // entry of the legend. The order is the order of the legend.
  var SERIES = [
    { id: "hs", label: "Hashin–Shtrikman bounds", keys: ["lower", "upper"], on: true },
    { id: "vr", label: "Voigt–Reuss bounds", keys: ["reuss", "voigt"], on: false },
    { id: "dilute", label: "Dilute", keys: ["dilute"], on: false },
    { id: "dilutec", label: "Dilute, on the compliance", keys: ["dilutec"], on: false },
    { id: "mt", label: "Mori–Tanaka", keys: ["mt"], on: true },
    { id: "gsc", label: "Three-phase model", keys: ["gsc"], on: true },
    { id: "diff", label: "Differential", keys: ["diff"], on: true },
    { id: "sc", label: "Self-consistent", keys: ["sc"], on: true }
  ];

  // The chart is drawn in CSS pixels at the width it is shown, so that its
  // labels keep their size on a phone.
  var H = 300, PAD = { l: 52, r: 16, t: 14, b: 40 };

  function el(tag, attrs, parent, text) {
    var e = document.createElement(tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }

  function fmt(v) {
    if (!isFinite(v)) return "—";
    return v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(v >= 1 ? 2 : 3);
  }

  // Ticks of a linear axis: a step of 1, 2 or 5 times a power of ten, about
  // five of them.
  function linearTicks(y0, y1) {
    var raw = (y1 - y0) / 5, mag = Math.pow(10, Math.floor(Math.log10(raw))), r = raw / mag;
    var step = mag * (r < 1.5 ? 1 : r < 3.5 ? 2 : r < 7.5 ? 5 : 10);
    var dec = Math.max(0, -Math.floor(Math.log10(step) + 1e-9)), ticks = [];
    for (var v = Math.ceil(y0 / step - 1e-9) * step; v <= y1 + 1e-9 * step; v += step) {
      ticks.push({ v: v, label: v.toFixed(dec), major: true });
    }
    return ticks;
  }

  // Ticks of a logarithmic axis: 1, 2 and 5 in every decade, the decades
  // drawn solid.
  function logTicks(y0, y1) {
    var ticks = [];
    for (var d = Math.floor(Math.log10(y0)); d <= Math.ceil(Math.log10(y1)); d++) {
      [1, 2, 5].forEach(function (mant) {
        var v = mant * Math.pow(10, d);
        if (v < y0 || v > y1) return;
        ticks.push({ v: v, label: String(+v.toPrecision(v >= 1 ? 3 : 2)), major: mant === 1 });
      });
    }
    return ticks;
  }

  M.homWidget = function (mount) {
    mount.textContent = "";
    mount.classList.add("hom-widget");
    var form = el("div", { class: "hom-controls" }, mount);
    var uid = Math.random().toString(36).slice(2, 7);

    function slider(id, label, min, max, step, value, show) {
      var wrap = el("label", { class: "hom-slider", for: id }, form);
      var head = el("span", { class: "hom-slider-head" }, wrap);
      el("span", { class: "hom-slider-label" }, head).innerHTML = label;
      var out = el("output", { for: id }, head);
      var input = el("input", { type: "range", id: id, min: min, max: max, step: step, value: value }, wrap);
      function sync() { out.textContent = show(+input.value); }
      input.addEventListener("input", function () { sync(); update(); });
      sync();
      return input;
    }

    var sPhi = slider("hom-phi-" + uid, "Inclusion volume fraction <i>φ</i>", 0, 1, 0.01, 0.3, function (v) { return v.toFixed(2); });
    var sC = slider("hom-c-" + uid, "Stiffness contrast <i>E</i><sub>i</sub>/<i>E</i><sub>m</sub>", -2, 2, 0.05, 1, function (v) {
      var c = Math.pow(10, v);
      return c >= 1 ? fmt(c) : "1/" + fmt(1 / c);
    });
    var sNm = slider("hom-nm-" + uid, "Poisson ratio of the matrix <i>ν</i><sub>m</sub>", 0, 0.49, 0.01, 0.2, function (v) { return v.toFixed(2); });
    var sNi = slider("hom-ni-" + uid, "Poisson ratio of the inclusions <i>ν</i><sub>i</sub>", 0, 0.49, 0.01, 0.2, function (v) { return v.toFixed(2); });

    // Scale of the E/Em axis: a pair of radio buttons drawn as one switch.
    var scaleBox = el("div", { class: "hom-scale", role: "radiogroup", "aria-labelledby": "hom-scale-label-" + uid }, mount);
    el("span", { class: "hom-scale-label", id: "hom-scale-label-" + uid }, scaleBox).innerHTML =
      "Scale of <i>E</i>/<i>E</i><sub>m</sub>";
    var scaleSwitch = el("span", { class: "hom-switch" }, scaleBox);
    var scale = "log";
    ["log", "linear"].forEach(function (v) {
      var lab = el("label", {}, scaleSwitch);
      var r = el("input", { type: "radio", name: "hom-scale-" + uid, value: v }, lab);
      r.checked = v === scale;
      el("span", {}, lab, v === "log" ? "logarithmic" : "linear");
      r.addEventListener("change", function () { if (r.checked) { scale = v; update(); } });
    });

    var NS = "http://www.w3.org/2000/svg";
    function s(tag, attrs, parent) {
      var e = document.createElementNS(NS, tag);
      for (var k in attrs) e.setAttribute(k, attrs[k]);
      if (parent) parent.appendChild(e);
      return e;
    }
    var figure = el("figure", { class: "hom-figure" }, mount);
    var W = 560;
    var svg = s("svg", { class: "hom-chart", role: "img" }, figure);
    var clip = s("rect", {}, s("clipPath", { id: "hom-clip-" + uid }, s("defs", {}, svg)));
    var gAxes = s("g", { class: "hom-axes" }, svg);
    var gPlot = s("g", { "clip-path": "url(#hom-clip-" + uid + ")" }, svg);
    var band = s("path", { class: "hom-band" }, gPlot);
    var cursor = s("line", { class: "hom-cursor" }, svg);
    var gDots = s("g", {}, svg);
    // One path and one dot per curve, in the order of SERIES so that the
    // estimates are drawn over the bounds.
    SERIES.forEach(function (sr) {
      sr.paths = sr.keys.map(function () { return s("path", { class: "hom-line hom-" + sr.id }, gPlot); });
      sr.dots = sr.keys.map(function () { return s("circle", { r: 3.6, class: "hom-dot hom-dot-" + sr.id }, gDots); });
    });

    var legend = el("figcaption", { class: "hom-legend", role: "group", "aria-label": "Bounds and schemes shown" }, figure);
    SERIES.forEach(function (sr) {
      var item = el("label", { class: "hom-legend-item" }, legend);
      var box = el("input", { type: "checkbox" }, item);
      box.checked = sr.on;
      var key = s("svg", { class: "hom-key", viewBox: "0 0 26 8", "aria-hidden": "true" }, item);
      if (sr.id === "hs") s("rect", { x: 0, y: 0.5, width: 26, height: 7, class: "hom-band" }, key);
      s("line", { x1: 2, x2: 24, y1: 4, y2: 4, class: "hom-line hom-" + sr.id }, key);
      el("span", {}, item, sr.label + " ");
      sr.value = el("strong", {}, item);
      sr.item = item;
      box.addEventListener("change", function () { sr.on = box.checked; update(); });
    });

    var lastKey = null, Y = null, X = null, inRange = null;

    function drawCurves(c, nm, ni) {
      var m = moduli(1, nm), inc = moduli(c, ni);
      var lo = Math.min(1, c), hi = Math.max(1, c), ticks, y0, y1;
      if (scale === "log") {
        y0 = Math.pow(10, Math.log10(lo) - 0.08);
        y1 = Math.pow(10, Math.log10(hi) + 0.08);
        ticks = logTicks(y0, y1);
      } else {
        var pad = Math.max(0.05 * (hi - lo), 0.02 * hi);
        y0 = Math.max(0, lo - pad);
        y1 = hi + pad;
        ticks = linearTicks(y0, y1);
      }
      var top = PAD.t, bottom = H - PAD.b;
      X = function (f) { return PAD.l + (W - PAD.l - PAD.r) * f; };
      Y = scale === "log"
        ? function (v) { return top + (bottom - top) * (1 - Math.log10(v / y0) / Math.log10(y1 / y0)); }
        : function (v) { return top + (bottom - top) * (1 - (v - y0) / (y1 - y0)); };
      inRange = function (v) { return isFinite(v) && v >= y0 && v <= y1; };
      clip.setAttribute("x", PAD.l);
      clip.setAttribute("y", top);
      clip.setAttribute("width", W - PAD.l - PAD.r);
      clip.setAttribute("height", bottom - top);

      // Axes and ticks.
      while (gAxes.firstChild) gAxes.removeChild(gAxes.firstChild);
      ticks.forEach(function (t) {
        s("line", { x1: PAD.l, x2: W - PAD.r, y1: Y(t.v), y2: Y(t.v), class: t.major ? "hom-grid" : "hom-grid hom-grid-minor" }, gAxes);
        s("text", { x: PAD.l - 8, y: Y(t.v) + 4, class: "hom-tick", "text-anchor": "end" }, gAxes).textContent = t.label;
      });
      for (var k = 0; k <= 10; k += 2) {
        var x = X(k / 10);
        s("line", { x1: x, x2: x, y1: top, y2: bottom, class: "hom-grid hom-grid-minor" }, gAxes);
        s("text", { x: x, y: bottom + 16, class: "hom-tick", "text-anchor": "middle" }, gAxes).textContent = (k / 10).toFixed(1);
      }
      var lx = s("text", { x: (PAD.l + W - PAD.r) / 2, y: H - 6, class: "hom-axis-label", "text-anchor": "middle" }, gAxes);
      lx.innerHTML = 'volume fraction <tspan font-style="italic">φ</tspan>';
      var ly = s("text", { x: 14, y: (top + bottom) / 2, class: "hom-axis-label", "text-anchor": "middle",
        transform: "rotate(-90 14 " + (top + bottom) / 2 + ")" }, gAxes);
      ly.innerHTML = '<tspan font-style="italic">E</tspan>/<tspan font-style="italic">E</tspan><tspan baseline-shift="sub" font-size="75%">m</tspan>' +
        (scale === "log" ? " (log scale)" : "");

      // Curves. A value with no Young's modulus breaks the line; one beyond
      // the axis is held a little outside it and clipped, so that the line
      // leaves the plot with its own slope.
      var N = 120, pts = {};
      for (var j = 0; j <= N; j++) {
        var f = j / N, e = estimates(m, inc, f);
        for (var key in e) {
          (pts[key] = pts[key] || []).push(e[key] > 0 && isFinite(e[key]) ? [X(f), Math.max(top - H, Math.min(bottom + H, Y(e[key])))] : null);
        }
      }
      function line(p) {
        var d = "", pen = false;
        p.forEach(function (q) {
          if (!q) { pen = false; return; }
          d += (pen ? "L" : "M") + q[0].toFixed(1) + " " + q[1].toFixed(1);
          pen = true;
        });
        return d;
      }
      SERIES.forEach(function (sr) {
        sr.paths.forEach(function (p, n) { p.setAttribute("d", line(pts[sr.keys[n]])); });
      });
      band.setAttribute("d", line(pts.upper) + line(pts.lower.slice().reverse()).replace(/^M/, "L") + "Z");
    }

    function update() {
      W = Math.max(300, Math.min(760, Math.round(figure.clientWidth || 560)));
      H = W < 480 ? 260 : 300;
      svg.setAttribute("viewBox", "0 0 " + W + " " + H);
      var phi = +sPhi.value, c = Math.pow(10, +sC.value), nm = +sNm.value, ni = +sNi.value;
      var key = [W, c, nm, ni, scale].join("|");
      if (key !== lastKey) { drawCurves(c, nm, ni); lastKey = key; }

      band.style.display = SERIES[0].on ? "" : "none";
      var here = estimates(moduli(1, nm), moduli(c, ni), phi);
      cursor.setAttribute("x1", X(phi));
      cursor.setAttribute("x2", X(phi));
      cursor.setAttribute("y1", PAD.t);
      cursor.setAttribute("y2", H - PAD.b);
      var spoken = [];
      SERIES.forEach(function (sr) {
        var vals = sr.keys.map(function (k) { return here[k]; });
        sr.paths.forEach(function (p) { p.style.display = sr.on ? "" : "none"; });
        sr.dots.forEach(function (d, n) {
          var show = sr.on && inRange(vals[n]);
          d.style.display = show ? "" : "none";
          if (show) { d.setAttribute("cx", X(phi)); d.setAttribute("cy", Y(vals[n])); }
        });
        sr.item.classList.toggle("is-off", !sr.on);
        sr.value.textContent = vals.length === 2 ? fmt(vals[0]) + "–" + fmt(vals[1]) : fmt(vals[0]);
        if (sr.on) spoken.push(sr.label + " " + (vals.length === 2 ? fmt(vals[0]) + " to " + fmt(vals[1]) : fmt(vals[0])));
      });
      svg.setAttribute("aria-label", "Effective Young's modulus against the inclusion volume fraction, " +
        (scale === "log" ? "on a logarithmic scale" : "on a linear scale") + ". At φ = " + phi.toFixed(2) +
        ", in units of the matrix modulus: " + spoken.join(", ") + ".");
    }

    // Dragging across the chart moves the volume fraction, as the slider does.
    svg.addEventListener("pointerdown", function (ev) {
      if (ev.button !== 0) return;
      svg.setPointerCapture(ev.pointerId);
      seek(ev);
    });
    svg.addEventListener("pointermove", function (ev) { if (svg.hasPointerCapture(ev.pointerId)) seek(ev); });
    function seek(ev) {
      var box = svg.getBoundingClientRect();
      var x = (ev.clientX - box.left) * W / box.width;
      var f = Math.max(0, Math.min(1, (x - PAD.l) / (W - PAD.l - PAD.r)));
      var v = (Math.round(f * 100) / 100).toFixed(2);
      if (sPhi.value !== v) { sPhi.value = v; sPhi.dispatchEvent(new Event("input")); }
    }

    update();
    if ("ResizeObserver" in window) {
      var lastW = W;
      new ResizeObserver(function () {
        if (Math.abs((figure.clientWidth || 0) - lastW) > 4) { update(); lastW = W; }
      }).observe(figure);
    }
  };
})();
