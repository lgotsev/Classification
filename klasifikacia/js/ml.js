/* Алгоритми за класификация, подготовка на данните и метрики.
   Настройките по подразбиране следват scikit-learn, за да съвпадат резултатите с тетрадката в Colab. */
window.CLS = window.CLS || {};
(function (C) {
  const ML = {};

  /* ---------- Генератор на псевдослучайни числа (за повторяемост) ---------- */
  ML.rng = seed => {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  /* ---------- Подготовка: кодиране и мащабиране ----------
     opts: { num: [имена], cat: [имена], scaling: 'z' | 'minmax' | 'none', minFreq }
     Параметрите се изчисляват САМО върху обучаващите редове. */
  ML.prep = (trainRows, opts) => {
    const num = opts.num, cat = opts.cat || [], minFreq = opts.minFreq || 20;
    const levels = {};
    cat.forEach(c => {
      const cnt = new Map();
      trainRows.forEach(r => cnt.set(r[c], (cnt.get(r[c]) || 0) + 1));
      const keep = [...cnt.entries()].filter(([, n]) => n >= minFreq).map(([v]) => v).sort();
      const rare = [...cnt.entries()].some(([, n]) => n < minFreq);
      levels[c] = { keep, rare };
    });
    const names = num.slice();
    cat.forEach(c => { levels[c].keep.forEach(v => names.push(`${c}=${v}`)); if (levels[c].rare) names.push(`${c}=друг`); });
    const stats = num.map(k => {
      const v = trainRows.map(r => r[k]);
      const n = v.length;
      let mean = 0; v.forEach(x => { mean += x; }); mean /= n;
      let ss = 0; v.forEach(x => { ss += (x - mean) ** 2; });
      let lo = Infinity, hi = -Infinity; v.forEach(x => { if (x < lo) lo = x; if (x > hi) hi = x; });
      return { mean, std: Math.sqrt(ss / n) || 1, min: lo, max: hi };
    });
    const p = names.length;
    const transform = rows => rows.map(r => {
      const x = new Float64Array(p);
      num.forEach((k, j) => {
        const v = r[k], s = stats[j];
        x[j] = opts.scaling === 'z' ? (v - s.mean) / s.std : opts.scaling === 'minmax' ? (s.max > s.min ? (v - s.min) / (s.max - s.min) : 0) : v;
      });
      let j = num.length;
      cat.forEach(c => {
        const L = levels[c];
        const i = L.keep.indexOf(r[c]);
        L.keep.forEach((_, t) => { x[j + t] = t === i ? 1 : 0; });
        j += L.keep.length;
        if (L.rare) { x[j] = i < 0 ? 1 : 0; j += 1; }
      });
      return x;
    });
    return { names, stats, levels, transform, p };
  };

  /* ---------- Логистична регресия: метод на Нютон (IRLS), L2 регуляризация като в scikit-learn ----------
     Минимизира C·Σ log-загуба + ½‖w‖² (свободният член не се наказва). */
  ML.logreg = (X, y, { C = 1, maxIter = 100 } = {}) => {
    const n = X.length, p = X[0].length, q = p + 1;
    const w = new Float64Array(q); // w[p] = свободен член
    const solve = (A, b) => { // Холецки за симетрична положително определена матрица
      const m = b.length, L = A.map(r => r.slice());
      for (let i = 0; i < m; i++) {
        for (let j = 0; j <= i; j++) {
          let s = L[i][j];
          for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k];
          if (i === j) L[i][i] = Math.sqrt(Math.max(s, 1e-12)); else L[i][j] = s / L[j][j];
        }
      }
      const z = new Float64Array(m);
      for (let i = 0; i < m; i++) { let s = b[i]; for (let k = 0; k < i; k++) s -= L[i][k] * z[k]; z[i] = s / L[i][i]; }
      const x = new Float64Array(m);
      for (let i = m - 1; i >= 0; i--) { let s = z[i]; for (let k = i + 1; k < m; k++) s -= L[k][i] * x[k]; x[i] = s / L[i][i]; }
      return x;
    };
    const objective = ww => {
      let s = 0;
      for (let i = 0; i < n; i++) {
        let z = ww[p];
        for (let j = 0; j < p; j++) z += ww[j] * X[i][j];
        s += C * (z > 0 ? z + Math.log1p(Math.exp(-z)) - y[i] * z : Math.log1p(Math.exp(z)) - y[i] * z);
      }
      for (let j = 0; j < p; j++) s += 0.5 * ww[j] * ww[j];
      return s;
    };
    let iter = 0;
    for (; iter < maxIter; iter++) {
      const g = new Float64Array(q);
      const H = Array.from({ length: q }, () => new Float64Array(q));
      for (let i = 0; i < n; i++) {
        const xi = X[i];
        let z = w[p];
        for (let j = 0; j < p; j++) z += w[j] * xi[j];
        const pr = 1 / (1 + Math.exp(-z));
        const r = C * (pr - y[i]), s = C * pr * (1 - pr);
        for (let j = 0; j < p; j++) {
          g[j] += r * xi[j];
          const sx = s * xi[j];
          for (let k = 0; k <= j; k++) H[j][k] += sx * xi[k];
          H[p][j] += sx;
        }
        g[p] += r; H[p][p] += s;
      }
      for (let j = 0; j < p; j++) { g[j] += w[j]; H[j][j] += 1; }
      for (let j = 0; j < q; j++) for (let k = 0; k < j; k++) H[k][j] = H[j][k];
      const step = solve(H, g);
      // Стъпка на Нютон с намаляване (line search): целевата функция трябва да намалява
      const f0 = objective(w);
      let t = 1, wNew = w;
      for (let ls = 0; ls < 40; ls++) {
        wNew = w.map((v, j) => v - t * step[j]);
        const f1 = objective(wNew);
        if (Number.isFinite(f1) && f1 <= f0) break;
        t /= 2;
      }
      let mx = 0;
      for (let j = 0; j < q; j++) { mx = Math.max(mx, Math.abs(wNew[j] - w[j])); w[j] = wNew[j]; }
      if (mx < 1e-8) break;
    }
    const coef = Array.from(w.slice(0, p)), b = w[p];
    const logit = x => { let z = b; for (let j = 0; j < p; j++) z += coef[j] * x[j]; return z; };
    const proba = x => 1 / (1 + Math.exp(-logit(x)));
    return { type: 'logreg', coef, intercept: b, iter: iter + 1, logit, proba, score: proba };
  };

  /* ---------- k най-близки съседи ---------- */
  ML.knn = (X, y, { k = 5, metric = 'euclidean' } = {}) => {
    const n = X.length, p = X[0].length;
    const dist = metric === 'manhattan'
      ? (a, b) => { let s = 0; for (let j = 0; j < p; j++) s += Math.abs(a[j] - b[j]); return s; }
      : (a, b) => { let s = 0; for (let j = 0; j < p; j++) { const d = a[j] - b[j]; s += d * d; } return s; };
    const neighbors = x => {
      const best = []; // сортиран масив от [разстояние, индекс]
      for (let i = 0; i < n; i++) {
        const d = dist(x, X[i]);
        if (best.length < k || d < best[best.length - 1][0]) {
          let pos = best.length;
          while (pos > 0 && best[pos - 1][0] > d) pos--;
          best.splice(pos, 0, [d, i]);
          if (best.length > k) best.pop();
        }
      }
      return best;
    };
    const proba = x => { const nb = neighbors(x); let s = 0; nb.forEach(([, i]) => { s += y[i]; }); return s / nb.length; };
    return { type: 'knn', k, neighbors, proba, score: proba };
  };

  /* ---------- Дърво на решенията (CART) ---------- */
  function impurity(c0, c1, crit) {
    const n = c0 + c1; if (!n) return 0;
    const p0 = c0 / n, p1 = c1 / n;
    if (crit === 'entropy') return -(p0 ? p0 * Math.log2(p0) : 0) - (p1 ? p1 * Math.log2(p1) : 0);
    return 1 - p0 * p0 - p1 * p1;
  }
  function buildTree(X, y, idx, opts, depth, rnd, featIdx) {
    let c1 = 0; idx.forEach(i => { c1 += y[i]; });
    const c0 = idx.length - c1;
    const node = { n: idx.length, c0, c1, value: c1 / idx.length, imp: impurity(c0, c1, opts.criterion), depth };
    if ((opts.maxDepth !== null && depth >= opts.maxDepth) || c0 === 0 || c1 === 0 || idx.length < opts.minSplit) return node;
    const p = X[0].length;
    let feats = featIdx;
    if (opts.maxFeatures && opts.maxFeatures < p) {
      const all = Array.from({ length: p }, (_, j) => j);
      for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; }
      feats = all.slice(0, opts.maxFeatures);
    }
    let best = null;
    const N = idx.length;
    feats.forEach(f => {
      const order = idx.slice().sort((a, b) => X[a][f] - X[b][f]);
      let l1 = 0;
      for (let t = 0; t < N - 1; t++) {
        l1 += y[order[t]];
        const xv = X[order[t]][f], xn = X[order[t + 1]][f];
        if (xv === xn) continue;
        const nl = t + 1, nr = N - nl;
        if (nl < opts.minLeaf || nr < opts.minLeaf) continue;
        const l0 = nl - l1, r1 = c1 - l1, r0 = nr - r1;
        const imp = (nl * impurity(l0, l1, opts.criterion) + nr * impurity(r0, r1, opts.criterion)) / N;
        if (!best || imp < best.imp - 1e-12) best = { f, thr: (xv + xn) / 2, imp };
      }
    });
    if (!best || best.imp >= node.imp - 1e-12) return node;
    const L = [], R = [];
    idx.forEach(i => (X[i][best.f] <= best.thr ? L : R).push(i));
    node.feature = best.f; node.threshold = best.thr; node.gain = node.imp - best.imp;
    node.left = buildTree(X, y, L, opts, depth + 1, rnd, featIdx);
    node.right = buildTree(X, y, R, opts, depth + 1, rnd, featIdx);
    return node;
  }
  const leafOf = (node, x) => { while (node.left) node = x[node.feature] <= node.threshold ? node.left : node.right; return node; };
  function treeStats(root) {
    let leaves = 0, depth = 0;
    (function walk(n) { if (!n.left) { leaves++; depth = Math.max(depth, n.depth); return; } walk(n.left); walk(n.right); })(root);
    return { leaves, depth };
  }
  function importances(root, p) {
    const imp = new Float64Array(p);
    (function walk(n) { if (!n.left) return; imp[n.feature] += n.n * n.imp - n.left.n * n.left.imp - n.right.n * n.right.imp; walk(n.left); walk(n.right); })(root);
    const s = imp.reduce((a, b) => a + b, 0) || 1;
    return Array.from(imp, v => v / s);
  }

  ML.tree = (X, y, { maxDepth = 6, criterion = 'gini', minLeaf = 1, minSplit = 2, seed = 0 } = {}) => {
    const p = X[0].length;
    const root = buildTree(X, y, X.map((_, i) => i), { maxDepth, criterion, minLeaf, minSplit }, 0, ML.rng(seed), Array.from({ length: p }, (_, j) => j));
    const proba = x => leafOf(root, x).value;
    return { type: 'tree', root, proba, score: proba, ...treeStats(root), importances: importances(root, p) };
  };

  /* ---------- Случайна гора ---------- */
  ML.forest = (X, y, { nTrees = 100, maxDepth = null, maxFeatures = 'sqrt', seed = 0, criterion = 'gini' } = {}) => {
    const n = X.length, p = X[0].length, rnd = ML.rng(seed + 7);
    const mf = maxFeatures === 'sqrt' ? Math.max(1, Math.round(Math.sqrt(p))) : p;
    const trees = [];
    const imp = new Float64Array(p);
    for (let t = 0; t < nTrees; t++) {
      const idx = Array.from({ length: n }, () => Math.floor(rnd() * n));
      const root = buildTree(X, y, idx, { maxDepth, criterion, minLeaf: 1, minSplit: 2, maxFeatures: mf }, 0, rnd, null);
      trees.push(root);
      importances(root, p).forEach((v, j) => { imp[j] += v / nTrees; });
    }
    const proba = x => { let s = 0; trees.forEach(r => { s += leafOf(r, x).value; }); return s / trees.length; };
    return { type: 'forest', trees, proba, score: proba, nTrees, maxFeatures: mf, importances: Array.from(imp), treeProba: (t, x) => leafOf(trees[t], x).value };
  };

  /* ---------- Метод на опорните вектори: SMO с избор на двойка от втори ред (като LIBSVM) ---------- */
  ML.svm = (X, y01, { C = 1, kernel = 'rbf', gamma = 'scale', tol = 1e-3, maxIter = 200000 } = {}) => {
    const n = X.length, p = X[0].length;
    const y = y01.map(v => (v ? 1 : -1));
    let g = gamma;
    if (gamma === 'scale') {
      let s = 0, s2 = 0, m = n * p;
      X.forEach(x => { for (let j = 0; j < p; j++) { s += x[j]; s2 += x[j] * x[j]; } });
      const variance = s2 / m - (s / m) ** 2;
      g = variance > 0 ? 1 / (p * variance) : 1;
    }
    const sq = X.map(x => { let s = 0; for (let j = 0; j < p; j++) s += x[j] * x[j]; return s; });
    const K = kernel === 'linear'
      ? (a, b) => { let s = 0; for (let j = 0; j < p; j++) s += a[j] * b[j]; return s; }
      : (a, b, na, nb) => { let s = 0; for (let j = 0; j < p; j++) s += a[j] * b[j]; return Math.exp(-g * (na + nb - 2 * s)); };
    const cache = new Map(), CMAX = Math.max(200, Math.min(n, Math.floor(3e7 / (8 * n))));
    const row = i => {
      let r = cache.get(i);
      if (r) { cache.delete(i); cache.set(i, r); return r; }
      r = new Float64Array(n);
      const xi = X[i], ni = sq[i];
      for (let t = 0; t < n; t++) r[t] = K(xi, X[t], ni, sq[t]);
      cache.set(i, r);
      if (cache.size > CMAX) cache.delete(cache.keys().next().value);
      return r;
    };
    const diag = X.map((x, i) => K(x, x, sq[i], sq[i]));
    const alpha = new Float64Array(n), G = new Float64Array(n).fill(-1);
    const TAU = 1e-12;
    let iter = 0;
    for (; iter < maxIter; iter++) {
      // избор на i: максимално нарушение
      let Gmax = -Infinity, Gmax2 = -Infinity, i = -1;
      for (let t = 0; t < n; t++) {
        if ((y[t] === 1 && alpha[t] < C) || (y[t] === -1 && alpha[t] > 0)) { const v = -y[t] * G[t]; if (v >= Gmax) { Gmax = v; i = t; } }
      }
      if (i < 0) break;
      const Qi = row(i);
      let j = -1, objMin = Infinity;
      for (let t = 0; t < n; t++) {
        if ((y[t] === 1 && alpha[t] > 0) || (y[t] === -1 && alpha[t] < C)) {
          const v = y[t] * G[t];
          if (v >= Gmax2) Gmax2 = v;
          const b = Gmax + v;
          if (b > 0) {
            const a = diag[i] + diag[t] - 2 * y[i] * y[t] * Qi[t] * y[i] * y[t];
            const aa = a > 0 ? a : TAU;
            const o = -(b * b) / aa;
            if (o <= objMin) { objMin = o; j = t; }
          }
        }
      }
      if (Gmax + Gmax2 < tol || j < 0) break;
      const Qj = row(j);
      const yi = y[i], yj = y[j];
      const Kij = Qi[j];
      const oldAi = alpha[i], oldAj = alpha[j];
      if (yi !== yj) {
        let quad = diag[i] + diag[j] - 2 * Kij; if (quad <= 0) quad = TAU;
        const delta = (-G[i] - G[j]) / quad, diff = alpha[i] - alpha[j];
        alpha[i] += delta; alpha[j] += delta;
        if (diff > 0) { if (alpha[j] < 0) { alpha[j] = 0; alpha[i] = diff; } } else if (alpha[i] < 0) { alpha[i] = 0; alpha[j] = -diff; }
        if (diff > 0) { if (alpha[i] > C) { alpha[i] = C; alpha[j] = C - diff; } } else if (alpha[j] > C) { alpha[j] = C; alpha[i] = C + diff; }
      } else {
        let quad = diag[i] + diag[j] - 2 * Kij; if (quad <= 0) quad = TAU;
        const delta = (G[i] - G[j]) / quad, sum = alpha[i] + alpha[j];
        alpha[i] -= delta; alpha[j] += delta;
        if (sum > C) { if (alpha[i] > C) { alpha[i] = C; alpha[j] = sum - C; } } else if (alpha[j] < 0) { alpha[j] = 0; alpha[i] = sum; }
        if (sum > C) { if (alpha[j] > C) { alpha[j] = C; alpha[i] = sum - C; } } else if (alpha[i] < 0) { alpha[i] = 0; alpha[j] = sum; }
      }
      const dAi = alpha[i] - oldAi, dAj = alpha[j] - oldAj;
      for (let t = 0; t < n; t++) G[t] += y[t] * (yi * Qi[t] * dAi + yj * Qj[t] * dAj);
    }
    // свободен член
    let ub = Infinity, lb = -Infinity, sumFree = 0, nFree = 0;
    for (let t = 0; t < n; t++) {
      const yG = y[t] * G[t];
      if (alpha[t] >= C) { if (y[t] === -1) ub = Math.min(ub, yG); else lb = Math.max(lb, yG); }
      else if (alpha[t] <= 0) { if (y[t] === 1) ub = Math.min(ub, yG); else lb = Math.max(lb, yG); }
      else { nFree++; sumFree += yG; }
    }
    const rho = nFree ? sumFree / nFree : (ub + lb) / 2;
    const sv = [];
    for (let t = 0; t < n; t++) if (alpha[t] > 1e-10) sv.push(t);
    const coefSV = sv.map(t => alpha[t] * y[t]);
    const score = x => { let nx = 0; for (let j = 0; j < p; j++) nx += x[j] * x[j]; let s = -rho; sv.forEach((t, k) => { s += coefSV[k] * K(x, X[t], nx, sq[t]); }); return s; };
    let w = null;
    if (kernel === 'linear') { w = new Float64Array(p); sv.forEach((t, k) => { for (let j = 0; j < p; j++) w[j] += coefSV[k] * X[t][j]; }); w = Array.from(w); }
    return { type: 'svm', score, sv, nSV: sv.length, gamma: g, rho, iter, w, b: -rho, alpha, atBound: sv.filter(t => alpha[t] >= C - 1e-9).length };
  };

  /* ---------- Метрики ---------- */
  ML.confusion = (y, pred) => {
    let tp = 0, tn = 0, fp = 0, fn = 0;
    y.forEach((t, i) => { if (t && pred[i]) tp++; else if (!t && !pred[i]) tn++; else if (!t && pred[i]) fp++; else fn++; });
    const div = (a, b) => (b ? a / b : 0);
    const precision = div(tp, tp + fp), recall = div(tp, tp + fn);
    return {
      tp, tn, fp, fn, n: y.length,
      accuracy: div(tp + tn, y.length), precision, recall, specificity: div(tn, tn + fp),
      f1: div(2 * precision * recall, precision + recall), fpr: div(fp, fp + tn), fnr: div(fn, fn + tp),
      mcc: div(tp * tn - fp * fn, Math.sqrt((tp + fp) * (tp + fn) * (tn + fp) * (tn + fn)))
    };
  };
  // ROC крива и площ под нея (AUC) – с отчитане на равни оценки
  ML.roc = (y, scores) => {
    const idx = scores.map((s, i) => i).sort((a, b) => scores[b] - scores[a]);
    const P = y.reduce((a, b) => a + b, 0), N = y.length - P;
    const pts = [[0, 0, Infinity]];
    let tp = 0, fp = 0, auc = 0, prevF = 0, prevT = 0;
    for (let k = 0; k < idx.length; k++) {
      const i = idx[k];
      if (y[i]) tp++; else fp++;
      if (k === idx.length - 1 || scores[idx[k + 1]] !== scores[i]) {
        const F = fp / N, T = tp / P;
        auc += (F - prevF) * (T + prevT) / 2;
        pts.push([F, T, scores[i]]);
        prevF = F; prevT = T;
      }
    }
    return { points: pts, auc };
  };

  ML.fit = (algo, X, y, params) => {
    const t0 = performance.now();
    const m = ML[algo](X, y, params || {});
    m.trainMs = performance.now() - t0;
    m.algo = algo;
    m.threshold0 = algo === 'svm' ? 0 : 0.5;
    return m;
  };
  ML.evaluate = (m, X, y, thr) => {
    const t0 = performance.now();
    const scores = X.map(x => m.score(x));
    const t = thr === undefined ? m.threshold0 : thr;
    const pred = scores.map(s => (m.algo === 'svm' ? s > t : s > t) ? 1 : 0);
    const cm = ML.confusion(y, pred);
    cm.predictMs = performance.now() - t0;
    return { scores, pred, cm, roc: ML.roc(y, scores) };
  };

  C.ML = ML;
})(window.CLS);
