// Mean-field homogenization in the browser.
//
// A matrix with spherical inclusions, both isotropic: the effective Young's
// modulus as a function of the inclusion volume fraction, for the
// Hashin–Shtrikman bounds, the Mori–Tanaka estimate and the self-consistent
// estimate. All four are closed forms of one expression — the
// Hashin–Shtrikman estimate for a reference medium (k₀, μ₀):
//
//   k(μ₀)     = ⟨k / (k + 4μ₀/3)⟩ / ⟨1 / (k + 4μ₀/3)⟩,
//   μ(k₀, μ₀) = ⟨μ / (μ + ζ₀)⟩ / ⟨1 / (μ + ζ₀)⟩,   ζ₀ = μ₀ (9k₀ + 8μ₀) / (6 (k₀ + 2μ₀)),
//
// with ⟨·⟩ the volume average over the phases. Mori–Tanaka takes the matrix as
// reference; the bounds take the stiffest and the softest moduli (Walpole's
// form, which stays a bound when the phases are not well ordered); the
// self-consistent estimate takes the effective medium itself, a fixed point
// found here by bisection on μ.
//
// Loaded on demand by _config/motion.html on the page that has a
// `#hom-widget` element. Without JavaScript that element stays empty and the
// page reads as before.
(function () {
  "use strict";

  var M = window.jfbMotion;
  if (!M) return;

  function k_of(phases, mu0) {
    var z = 4 * mu0 / 3, num = 0, den = 0;
    phases.forEach(function (p) { num += p.f * p.k / (p.k + z); den += p.f / (p.k + z); });
    return num / den;
  }

  function mu_of(phases, k0, mu0) {
    var z = mu0 * (9 * k0 + 8 * mu0) / (6 * (k0 + 2 * mu0)), num = 0, den = 0;
    phases.forEach(function (p) { num += p.f * p.mu / (p.mu + z); den += p.f / (p.mu + z); });
    return num / den;
  }

  function young(k, mu) { return 9 * k * mu / (3 * k + mu); }

  function moduli(E, nu) { return { k: E / (3 * (1 - 2 * nu)), mu: E / (2 * (1 + nu)) }; }

  function estimates(m, i, phi) {
    var phases = [
      { f: 1 - phi, k: m.k, mu: m.mu },
      { f: phi, k: i.k, mu: i.mu }
    ];
    var kmax = Math.max(m.k, i.k), kmin = Math.min(m.k, i.k);
    var mmax = Math.max(m.mu, i.mu), mmin = Math.min(m.mu, i.mu);
    var upper = young(k_of(phases, mmax), mu_of(phases, kmax, mmax));
    var lower = young(k_of(phases, mmin), mu_of(phases, kmin, mmin));
    var mt = young(k_of(phases, m.mu), mu_of(phases, m.k, m.mu));
    // Self-consistent: μ = μ(k(μ), μ), bracketed by [μmin, μmax].
    var lo = mmin, hi = mmax;
    for (var n = 0; n < 200 && hi - lo > 1e-15 * hi; n++) {
      var mid = 0.5 * (lo + hi);
      if (mu_of(phases, k_of(phases, mid), mid) > mid) lo = mid;
      else hi = mid;
    }
    var mu = 0.5 * (lo + hi);
    var sc = young(k_of(phases, mu), mu);
    return { lower: lower, upper: upper, mt: mt, sc: sc };
  }

  M.homEstimates = function (Em, num, Ei, nui, phi) {
    return estimates(moduli(Em, num), moduli(Ei, nui), phi);
  };

  // --- UI ------------------------------------------------------------------

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
    return v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(v >= 1 ? 2 : 3);
  }

  M.homWidget = function (mount) {
    mount.textContent = "";
    mount.classList.add("hom-widget");
    var form = el("div", { class: "hom-controls" }, mount);

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

    var uid = Math.random().toString(36).slice(2, 7);
    var sPhi = slider("hom-phi-" + uid, "Inclusion volume fraction <i>φ</i>", 0, 1, 0.01, 0.3, function (v) { return v.toFixed(2); });
    var sC = slider("hom-c-" + uid, "Stiffness contrast <i>E</i><sub>i</sub>/<i>E</i><sub>m</sub>", -2, 2, 0.05, 1, function (v) {
      var c = Math.pow(10, v);
      return c >= 1 ? fmt(c) : "1/" + fmt(1 / c);
    });
    var sNm = slider("hom-nm-" + uid, "Poisson ratio of the matrix <i>ν</i><sub>m</sub>", 0, 0.49, 0.01, 0.2, function (v) { return v.toFixed(2); });
    var sNi = slider("hom-ni-" + uid, "Poisson ratio of the inclusions <i>ν</i><sub>i</sub>", 0, 0.49, 0.01, 0.2, function (v) { return v.toFixed(2); });

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
    var gAxes = s("g", { class: "hom-axes" }, svg);
    var band = s("path", { class: "hom-band" }, svg);
    var pUp = s("path", { class: "hom-bound" }, svg);
    var pLo = s("path", { class: "hom-bound" }, svg);
    var pMT = s("path", { class: "hom-mt" }, svg);
    var pSC = s("path", { class: "hom-sc" }, svg);
    var cursor = s("line", { class: "hom-cursor" }, svg);
    var dots = ["lower", "upper", "mt", "sc"].map(function (k) {
      return s("circle", { r: 3.6, class: "hom-dot hom-dot-" + k }, svg);
    });

    var legend = el("figcaption", { class: "hom-legend" }, figure);
    var rows = [
      ["upper", "Hashin–Shtrikman upper bound", "hom-key-bound"],
      ["sc", "Self-consistent", "hom-key-sc"],
      ["mt", "Mori–Tanaka", "hom-key-mt"],
      ["lower", "Hashin–Shtrikman lower bound", "hom-key-bound"]
    ].map(function (r) {
      var item = el("span", { class: "hom-legend-item" }, legend);
      el("span", { class: "hom-key " + r[2], "aria-hidden": "true" }, item);
      el("span", {}, item, r[1] + " ");
      return { key: r[0], value: el("strong", {}, item) };
    });

    function update() {
      W = Math.max(300, Math.min(760, Math.round(figure.clientWidth || 560)));
      H = W < 480 ? 260 : 300;
      svg.setAttribute("viewBox", "0 0 " + W + " " + H);
      var phi = +sPhi.value, c = Math.pow(10, +sC.value), nm = +sNm.value, ni = +sNi.value;
      var m = moduli(1, nm), inc = moduli(c, ni);
      var lo = Math.min(1, c), hi = Math.max(1, c);
      var ylo = Math.log10(lo) - 0.08, yhi = Math.log10(hi) + 0.08;
      function X(f) { return PAD.l + (W - PAD.l - PAD.r) * f; }
      function Y(v) { return PAD.t + (H - PAD.t - PAD.b) * (1 - (Math.log10(v) - ylo) / (yhi - ylo)); }

      // Axes and ticks: decades of E/E_m, and φ by tenths.
      while (gAxes.firstChild) gAxes.removeChild(gAxes.firstChild);
      for (var d = Math.ceil(ylo); d <= Math.floor(yhi); d++) {
        [1, 2, 5].forEach(function (mant) {
          var v = mant * Math.pow(10, d);
          if (Math.log10(v) < ylo || Math.log10(v) > yhi) return;
          s("line", { x1: PAD.l, x2: W - PAD.r, y1: Y(v), y2: Y(v), class: mant === 1 ? "hom-grid" : "hom-grid hom-grid-minor" }, gAxes);
          var t = s("text", { x: PAD.l - 8, y: Y(v) + 4, class: "hom-tick", "text-anchor": "end" }, gAxes);
          t.textContent = v >= 1 ? String(+v.toPrecision(3)) : String(+v.toPrecision(2));
        });
      }
      for (var k = 0; k <= 10; k += 2) {
        var x = X(k / 10);
        s("line", { x1: x, x2: x, y1: PAD.t, y2: H - PAD.b, class: "hom-grid hom-grid-minor" }, gAxes);
        var tx = s("text", { x: x, y: H - PAD.b + 16, class: "hom-tick", "text-anchor": "middle" }, gAxes);
        tx.textContent = (k / 10).toFixed(1);
      }
      var lx = s("text", { x: (PAD.l + W - PAD.r) / 2, y: H - 6, class: "hom-axis-label", "text-anchor": "middle" }, gAxes);
      lx.innerHTML = 'volume fraction <tspan font-style="italic">φ</tspan>';
      var ly = s("text", { x: 14, y: (PAD.t + H - PAD.b) / 2, class: "hom-axis-label", "text-anchor": "middle",
        transform: "rotate(-90 14 " + (PAD.t + H - PAD.b) / 2 + ")" }, gAxes);
      ly.innerHTML = '<tspan font-style="italic">E</tspan>/<tspan font-style="italic">E</tspan><tspan baseline-shift="sub" font-size="75%">m</tspan>';

      var N = 120, up = [], low = [], mt = [], sc = [];
      for (var j = 0; j <= N; j++) {
        var f = j / N, e = estimates(m, inc, f);
        up.push([X(f), Y(e.upper)]);
        low.push([X(f), Y(e.lower)]);
        mt.push([X(f), Y(e.mt)]);
        sc.push([X(f), Y(e.sc)]);
      }
      function line(pts) { return pts.map(function (p, i) { return (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1); }).join(""); }
      band.setAttribute("d", line(up) + line(low.slice().reverse()).replace(/^M/, "L") + "Z");
      pUp.setAttribute("d", line(up));
      pLo.setAttribute("d", line(low));
      pMT.setAttribute("d", line(mt));
      pSC.setAttribute("d", line(sc));

      var here = estimates(m, inc, phi);
      cursor.setAttribute("x1", X(phi));
      cursor.setAttribute("x2", X(phi));
      cursor.setAttribute("y1", PAD.t);
      cursor.setAttribute("y2", H - PAD.b);
      ["lower", "upper", "mt", "sc"].forEach(function (key, i) {
        dots[i].setAttribute("cx", X(phi));
        dots[i].setAttribute("cy", Y(here[key]));
      });
      rows.forEach(function (r) { r.value.textContent = fmt(here[r.key]); });
      svg.setAttribute("aria-label", "Effective Young's modulus against the inclusion volume fraction. At φ = " +
        phi.toFixed(2) + ": lower bound " + fmt(here.lower) + ", Mori–Tanaka " + fmt(here.mt) +
        ", self-consistent " + fmt(here.sc) + ", upper bound " + fmt(here.upper) + " times the matrix modulus.");
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
