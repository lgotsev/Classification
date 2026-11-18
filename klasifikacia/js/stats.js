/* Статистически функции. Формулите съвпадат с pandas/NumPy по подразбиране:
   дисперсия и стандартно отклонение с ddof=1, квантили с линейна интерполяция,
   скосеност и ексцес с корекция за извадка (като pandas .skew() и .kurt()). */
window.EDA = window.EDA || {};
(function (E) {
  const S = {};

  S.isNum = v => typeof v === 'number' && Number.isFinite(v);
  S.nums = arr => arr.filter(S.isNum);
  S.sum = a => a.reduce((s, v) => s + v, 0);
  S.mean = a => (a.length ? S.sum(a) / a.length : NaN);
  S.sorted = a => [...a].sort((x, y) => x - y);

  S.quantileSorted = (s, p) => {
    const n = s.length;
    if (!n) return NaN;
    const h = (n - 1) * p;
    const lo = Math.floor(h);
    const hi = Math.min(lo + 1, n - 1);
    return s[lo] + (h - lo) * (s[hi] - s[lo]);
  };
  S.quantile = (a, p) => S.quantileSorted(S.sorted(a), p);
  S.median = a => S.quantile(a, 0.5);

  S.mode = a => {
    const m = new Map();
    a.forEach(v => m.set(v, (m.get(v) || 0) + 1));
    let max = 0;
    m.forEach(c => { if (c > max) max = c; });
    const values = [];
    m.forEach((c, v) => { if (c === max) values.push(v); });
    return { values, count: max, unique: m.size };
  };

  S.variance = (a, ddof = 1) => {
    const n = a.length;
    if (n - ddof <= 0) return NaN;
    const m = S.mean(a);
    return a.reduce((s, v) => s + (v - m) ** 2, 0) / (n - ddof);
  };
  S.std = (a, ddof = 1) => Math.sqrt(S.variance(a, ddof));

  function moments(a) {
    const n = a.length, m = S.mean(a);
    let m2 = 0, m3 = 0, m4 = 0;
    a.forEach(v => { const d = v - m, d2 = d * d; m2 += d2; m3 += d2 * d; m4 += d2 * d2; });
    return { n, m2: m2 / n, m3: m3 / n, m4: m4 / n };
  }
  // Коригиран коефициент на Фишер–Пиърсън (pandas .skew())
  S.skew = a => {
    const { n, m2, m3 } = moments(a);
    if (n < 3 || m2 === 0) return n < 3 ? NaN : 0;
    const g1 = m3 / Math.pow(m2, 1.5);
    return (Math.sqrt(n * (n - 1)) / (n - 2)) * g1;
  };
  // Ексцес спрямо нормалното разпределение (excess kurtosis, pandas .kurt())
  S.kurt = a => {
    const { n, m2, m4 } = moments(a);
    if (n < 4 || m2 === 0) return n < 4 ? NaN : 0;
    const g2 = m4 / (m2 * m2) - 3;
    return (((n + 1) * g2 + 6) * (n - 1)) / ((n - 2) * (n - 3));
  };

  S.describe = arr => {
    const v = S.nums(arr);
    const n = v.length;
    const s = S.sorted(v);
    const mean = S.mean(v);
    const std = S.std(v);
    const q1 = S.quantileSorted(s, 0.25), q3 = S.quantileSorted(s, 0.75);
    return {
      n, missing: arr.length - n, mean, median: S.quantileSorted(s, 0.5), mode: S.mode(v),
      min: s[0], max: s[n - 1], range: s[n - 1] - s[0], q1, q3, iqr: q3 - q1,
      variance: S.variance(v), std, cv: mean !== 0 ? std / Math.abs(mean) : NaN,
      skew: S.skew(v), kurt: S.kurt(v)
    };
  };

  S.fences = (values, k = 1.5) => {
    const s = S.sorted(S.nums(values));
    const q1 = S.quantileSorted(s, 0.25), q3 = S.quantileSorted(s, 0.75), iqr = q3 - q1;
    return { q1, q3, iqr, lo: q1 - k * iqr, hi: q3 + k * iqr };
  };

  // Двойки валидни стойности за два признака
  S.pairs = (rows, kx, ky) => {
    const x = [], y = [], idx = [];
    rows.forEach((r, i) => { if (S.isNum(r[kx]) && S.isNum(r[ky])) { x.push(r[kx]); y.push(r[ky]); idx.push(i); } });
    return { x, y, idx };
  };

  S.pearson = (x, y) => {
    const n = x.length;
    if (n < 2) return NaN;
    const mx = S.mean(x), my = S.mean(y);
    let sxy = 0, sxx = 0, syy = 0;
    for (let i = 0; i < n; i++) { const dx = x[i] - mx, dy = y[i] - my; sxy += dx * dy; sxx += dx * dx; syy += dy * dy; }
    return sxx && syy ? sxy / Math.sqrt(sxx * syy) : NaN;
  };

  S.ranks = a => {
    const idx = a.map((v, i) => [v, i]).sort((p, q) => p[0] - q[0]);
    const r = new Array(a.length);
    let i = 0;
    while (i < idx.length) {
      let j = i;
      while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
      const avg = (i + j) / 2 + 1;
      for (let k = i; k <= j; k++) r[idx[k][1]] = avg;
      i = j + 1;
    }
    return r;
  };
  S.spearman = (x, y) => S.pearson(S.ranks(x), S.ranks(y));

  S.linreg = (x, y) => {
    const mx = S.mean(x), my = S.mean(y);
    let sxy = 0, sxx = 0;
    for (let i = 0; i < x.length; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; }
    const slope = sxx ? sxy / sxx : 0;
    return { slope, intercept: my - slope * mx };
  };

  S.normPdf = (x, m, s) => Math.exp(-0.5 * ((x - m) / s) ** 2) / (s * Math.sqrt(2 * Math.PI));

  // Обратна функция на стандартното нормално разпределение (алгоритъм на Acklam)
  S.normInv = p => {
    if (p <= 0) return -Infinity;
    if (p >= 1) return Infinity;
    const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
    const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01];
    const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
    const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00];
    const pl = 0.02425;
    let q, r;
    if (p < pl) {
      q = Math.sqrt(-2 * Math.log(p));
      return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    }
    if (p <= 1 - pl) {
      q = p - 0.5; r = q * q;
      return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
    }
    q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  };

  // Тест на Жарке–Бера: при χ² с 2 степени на свобода p = e^(−JB/2)
  S.jarqueBera = a => {
    const { n, m2, m3, m4 } = moments(a);
    const g1 = m3 / Math.pow(m2, 1.5), g2 = m4 / (m2 * m2) - 3;
    const jb = (n / 6) * (g1 * g1 + (g2 * g2) / 4);
    return { jb, p: Math.exp(-jb / 2) };
  };

  // Брой интервали за хистограма
  S.binCount = (values, rule) => {
    const n = values.length;
    if (n < 2) return 1;
    if (rule === 'sqrt') return Math.max(1, Math.ceil(Math.sqrt(n)));
    if (rule === 'fd') {
      const f = S.fences(values);
      const s = S.sorted(values);
      const w = (2 * f.iqr) / Math.cbrt(n);
      if (!w) return Math.ceil(Math.log2(n)) + 1;
      return Math.max(1, Math.min(80, Math.ceil((s[n - 1] - s[0]) / w)));
    }
    return Math.ceil(Math.log2(n)) + 1; // Стърджис
  };

  S.histogram = (values, k, lo, hi) => {
    const v = S.nums(values);
    if (lo === undefined) { lo = Math.min(...v); hi = Math.max(...v); }
    if (lo === hi) { lo -= 0.5; hi += 0.5; }
    const w = (hi - lo) / k;
    const counts = new Array(k).fill(0);
    v.forEach(x => {
      if (x < lo || x > hi) return;
      let i = Math.floor((x - lo) / w);
      if (i >= k) i = k - 1;
      counts[i]++;
    });
    return { counts, lo, hi, w, edges: counts.map((_, i) => lo + i * w).concat(hi) };
  };

  S.zscores = a => { const m = S.mean(a), s = S.std(a); return a.map(v => (v - m) / s); };

  // Собствени стойности и вектори на симетрична матрица (метод на Якоби)
  S.eigenSym = M => {
    const n = M.length;
    const A = M.map(r => r.slice());
    const V = A.map((_, i) => A.map((_, j) => (i === j ? 1 : 0)));
    for (let sweep = 0; sweep < 100; sweep++) {
      let off = 0;
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += A[i][j] * A[i][j];
      if (off < 1e-20) break;
      for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) {
        if (Math.abs(A[p][q]) < 1e-15) continue;
        const theta = (A[q][q] - A[p][p]) / (2 * A[p][q]);
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1), s = t * c;
        for (let k = 0; k < n; k++) {
          const akp = A[k][p], akq = A[k][q];
          A[k][p] = c * akp - s * akq; A[k][q] = s * akp + c * akq;
        }
        for (let k = 0; k < n; k++) {
          const apk = A[p][k], aqk = A[q][k];
          A[p][k] = c * apk - s * aqk; A[q][k] = s * apk + c * aqk;
        }
        for (let k = 0; k < n; k++) {
          const vkp = V[k][p], vkq = V[k][q];
          V[k][p] = c * vkp - s * vkq; V[k][q] = s * vkp + c * vkq;
        }
      }
    }
    const pairs = A.map((_, i) => ({ value: A[i][i], vector: V.map(r => r[i]) }));
    pairs.sort((x, y) => y.value - x.value);
    return pairs;
  };

  // Анализ на главните компоненти върху стандартизирани данни
  S.pca = X => {
    const n = X.length, p = X[0].length;
    const means = [], sds = [];
    for (let j = 0; j < p; j++) { const col = X.map(r => r[j]); means.push(S.mean(col)); sds.push(S.std(col)); }
    const Z = X.map(r => r.map((v, j) => (v - means[j]) / (sds[j] || 1)));
    const C = [];
    for (let i = 0; i < p; i++) {
      C.push([]);
      for (let j = 0; j < p; j++) {
        let s = 0;
        for (let k = 0; k < n; k++) s += Z[k][i] * Z[k][j];
        C[i].push(s / (n - 1));
      }
    }
    const eig = S.eigenSym(C);
    eig.forEach(e => { // еднозначна посока на вектора
      const big = e.vector.reduce((m, v) => (Math.abs(v) > Math.abs(m) ? v : m), 0);
      if (big < 0) e.vector = e.vector.map(v => -v);
    });
    const total = S.sum(eig.map(e => Math.max(e.value, 0)));
    const scores = Z.map(r => eig.map(e => S.sum(e.vector.map((w, j) => w * r[j]))));
    return { eig, explained: eig.map(e => Math.max(e.value, 0) / total), scores, corr: C };
  };

  S.levenshtein = (a, b) => {
    const m = a.length, n = b.length;
    const d = Array.from({ length: m + 1 }, (_, i) => [i, ...new Array(n).fill(0)]);
    for (let j = 1; j <= n; j++) d[0][j] = j;
    for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[m][n];
  };

  // Генератор на псевдослучайни числа с фиксирано начало (еднакви данни при всяко отваряне)
  S.rng = seed => {
    let a = seed >>> 0;
    const next = () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    next.normal = () => {
      let u = 0, v = 0;
      while (u === 0) u = next();
      while (v === 0) v = next();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    };
    return next;
  };

  E.S = S;
})(window.EDA);
