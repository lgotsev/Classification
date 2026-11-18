/* SVG диаграми с вградени атрибути (без външни библиотеки).
   Всяка функция връща низ със <svg>, мащабируем чрез viewBox. */
(function (E) {
  const S = E.S;
  const C = {
    navy: '#14284b', navy2: '#2c4a7c', navy3: '#6f86ad', gold: '#c9a227', goldDark: '#8a6d14', goldLight: '#e9d9a6',
    ink: '#1d2433', muted: '#5b6475', grid: '#e7e2d6', axis: '#9aa1ad', bg: '#ffffff', red: '#c4422f', orange: '#d0731c'
  };
  // Категорийна палитра: navy, gold и допълващи тонове с добър контраст на светъл фон
  const PALETTE = ['#14284b', '#c9a227', '#3f7cac', '#a4502e', '#4f8a5b', '#7a5c9e', '#8b8f98', '#2c9aa0'];
  E.C = C; E.PALETTE = PALETTE;
  const FONT = 'font-family="IBM Plex Sans, Segoe UI, Arial, sans-serif"';
  const esc = E.esc;

  const lin = (d0, d1, r0, r1) => { const k = (r1 - r0) / ((d1 - d0) || 1); return v => r0 + (v - d0) * k; };

  function ticks(min, max, n = 5) {
    if (!Number.isFinite(min) || !Number.isFinite(max)) return [];
    if (min === max) { min -= 1; max += 1; }
    const raw = (max - min) / n;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const nrm = raw / mag;
    const step = (nrm < 1.5 ? 1 : nrm < 3 ? 2 : nrm < 7 ? 5 : 10) * mag;
    const out = [];
    for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-9; v += step) out.push(+v.toFixed(10));
    return out;
  }
  function niceDomain(min, max, pad = 0.04) {
    if (min === max) return [min - 1, max + 1];
    const p = (max - min) * pad;
    return [min - p, max + p];
  }
  const tl = v => E.fmt(v, Math.abs(v) >= 100 ? 0 : Math.abs(v) >= 10 ? 1 : 2);

  function svgOpen(w, h, label) {
    return `<svg viewBox="0 0 ${w} ${h}" width="100%" role="img" aria-label="${esc(label || 'диаграма')}" xmlns="http://www.w3.org/2000/svg" ${FONT} font-size="12">`;
  }

  // Оси и мрежа
  function frame(o) {
    const { w, h, m, x, y, xd, yd, xLabel, yLabel, xTicks, yTicks, xFmt, yFmt } = o;
    let s = `<rect x="0" y="0" width="${w}" height="${h}" fill="${C.bg}"/>`;
    (yTicks || ticks(yd[0], yd[1])).forEach(t => {
      const yy = y(t);
      if (yy < m.t - 1 || yy > h - m.b + 1) return;
      s += `<line x1="${m.l}" x2="${w - m.r}" y1="${yy}" y2="${yy}" stroke="${C.grid}" stroke-width="1"/>`;
      s += `<text x="${m.l - 8}" y="${yy + 4}" text-anchor="end" fill="${C.muted}">${esc((yFmt || tl)(t))}</text>`;
    });
    (xTicks || ticks(xd[0], xd[1])).forEach(t => {
      const xx = x(t);
      if (xx < m.l - 1 || xx > w - m.r + 1) return;
      s += `<line x1="${xx}" x2="${xx}" y1="${h - m.b}" y2="${h - m.b + 5}" stroke="${C.axis}" stroke-width="1"/>`;
      s += `<text x="${xx}" y="${h - m.b + 18}" text-anchor="middle" fill="${C.muted}">${esc((xFmt || tl)(t))}</text>`;
    });
    s += `<line x1="${m.l}" x2="${w - m.r}" y1="${h - m.b}" y2="${h - m.b}" stroke="${C.axis}" stroke-width="1"/>`;
    if (xLabel) s += `<text x="${(m.l + w - m.r) / 2}" y="${h - 6}" text-anchor="middle" fill="${C.ink}" font-weight="600">${esc(xLabel)}</text>`;
    if (yLabel) s += `<text transform="translate(14 ${(m.t + h - m.b) / 2}) rotate(-90)" text-anchor="middle" fill="${C.ink}" font-weight="600">${esc(yLabel)}</text>`;
    return s;
  }

  function legend(items, x, y) {
    let s = '', cx = x;
    items.forEach(it => {
      if (it.line) s += `<line x1="${cx}" x2="${cx + 18}" y1="${y}" y2="${y}" stroke="${it.color}" stroke-width="2.5" ${it.dash ? `stroke-dasharray="${it.dash}"` : ''}/>`;
      else s += `<rect x="${cx}" y="${y - 6}" width="12" height="12" rx="2" fill="${it.color}" ${it.opacity ? `fill-opacity="${it.opacity}"` : ''}/>`;
      s += `<text x="${cx + (it.line ? 24 : 17)}" y="${y + 4}" fill="${C.ink}">${esc(it.label)}</text>`;
      cx += (it.line ? 30 : 22) + it.label.length * 6.6 + 14;
    });
    return s;
  }

  /* Хистограма: series = [{values, color, label, opacity}] (една или две серии), опционално нормална крива и маркери */
  E.chart = {};
  E.chart.histogram = o => {
    const w = o.w || 540, h = o.h || 300, m = { t: o.legend === false ? 18 : 40, r: 18, b: 46, l: 66 };
    const series = o.series || [{ values: o.values, color: C.navy2, label: 'Честота' }];
    const all = series.flatMap(s => S.nums(s.values));
    if (!all.length) return '<p class="muted">Няма валидни стойности.</p>';
    let lo = o.lo !== undefined ? o.lo : Math.min(...all), hi = o.hi !== undefined ? o.hi : Math.max(...all);
    const k = o.bins || S.binCount(S.nums(series[0].values), 'sturges');
    const hs = series.map(s => S.histogram(s.values, k, lo, hi));
    const bw = hs[0].w;
    let ymax = Math.max(...hs.flatMap(x => x.counts));
    let curve = null;
    if (o.normal) {
      const v = S.nums(series[0].values), mu = S.mean(v), sd = S.std(v);
      if (sd > 0) {
        curve = [];
        for (let i = 0; i <= 120; i++) { const xx = lo + ((hi - lo) * i) / 120; curve.push([xx, S.normPdf(xx, mu, sd) * v.length * bw]); }
        ymax = Math.max(ymax, ...curve.map(p => p[1]));
      }
    }
    if (hs[0].lo !== lo) { lo = hs[0].lo; hi = hs[0].hi; }
    const x = lin(lo, hi, m.l, w - m.r), y = lin(0, ymax * 1.08, h - m.b, m.t);
    let s = svgOpen(w, h, o.label) + frame({ w, h, m, x, y, xd: [lo, hi], yd: [0, ymax * 1.08], xLabel: o.xLabel, yLabel: o.yLabel || 'Брой' });
    hs.forEach((hh, si) => {
      const se = series[si];
      hh.counts.forEach((c, i) => {
        if (!c) return;
        const x0 = x(hh.edges[i]) + 0.5, x1 = x(hh.edges[i + 1]) - 0.5;
        s += `<rect x="${x0}" y="${y(c)}" width="${Math.max(1, x1 - x0)}" height="${h - m.b - y(c)}" fill="${se.color}" fill-opacity="${se.opacity || (series.length > 1 ? 0.55 : 0.85)}"><title>${esc(se.label || '')} [${tl(hh.edges[i])}; ${tl(hh.edges[i + 1])}): ${c}</title></rect>`;
      });
    });
    if (curve) s += `<polyline points="${curve.map(p => `${x(p[0]).toFixed(1)},${y(p[1]).toFixed(1)}`).join(' ')}" fill="none" stroke="${C.red}" stroke-width="2"/>`;
    const leg = series.map(se => ({ label: se.label || 'Честота', color: se.color, opacity: se.opacity || (series.length > 1 ? 0.55 : 0.85) }));
    if (curve) leg.push({ label: 'Нормално разпределение', color: C.red, line: true });
    (o.markers || []).forEach(mk => {
      if (!Number.isFinite(mk.x) || mk.x < lo || mk.x > hi) return;
      s += `<line x1="${x(mk.x)}" x2="${x(mk.x)}" y1="${m.t}" y2="${h - m.b}" stroke="${mk.color}" stroke-width="2.5" ${mk.dash ? `stroke-dasharray="${mk.dash}"` : ''}/>`;
      leg.push({ label: `${mk.label} = ${tl(mk.x)}`, color: mk.color, line: true, dash: mk.dash });
    });
    if (o.legend !== false) s += legend(leg, m.l, 18);
    return s + '</svg>';
  };

  /* Кутийна диаграма (box plot) по групи: groups = [{label, values, color}] */
  E.chart.boxplot = o => {
    const groups = o.groups.filter(g => S.nums(g.values).length);
    const w = o.w || 540, h = o.h || 300, m = { t: 20, r: 18, b: o.rotate ? 70 : 46, l: 74 };
    if (!groups.length) return '<p class="muted">Няма валидни стойности.</p>';
    const all = groups.flatMap(g => S.nums(g.values));
    const yd = niceDomain(Math.min(...all), Math.max(...all), 0.06);
    const y = lin(yd[0], yd[1], h - m.b, m.t);
    const band = (w - m.l - m.r) / groups.length;
    let s = svgOpen(w, h, o.label) + frame({ w, h, m, x: v => v, y, xd: [0, 0], yd, xTicks: [], yLabel: o.yLabel });
    groups.forEach((g, i) => {
      const v = S.sorted(S.nums(g.values));
      const f = S.fences(v), med = S.quantileSorted(v, 0.5), mean = S.mean(v);
      const inl = v.filter(t => t >= f.lo && t <= f.hi);
      const wlo = inl.length ? inl[0] : f.q1, whi = inl.length ? inl[inl.length - 1] : f.q3;
      const cx = m.l + band * (i + 0.5), bw = Math.min(70, band * 0.5);
      const col = g.color || C.navy2;
      const tip = `${g.label}: n = ${v.length}, Q1 = ${tl(f.q1)}, медиана = ${tl(med)}, Q3 = ${tl(f.q3)}, IQR = ${tl(f.iqr)}, граници [${tl(f.lo)}; ${tl(f.hi)}]`;
      s += `<line x1="${cx}" x2="${cx}" y1="${y(whi)}" y2="${y(f.q3)}" stroke="${C.ink}" stroke-width="1.5"/>`;
      s += `<line x1="${cx}" x2="${cx}" y1="${y(f.q1)}" y2="${y(wlo)}" stroke="${C.ink}" stroke-width="1.5"/>`;
      s += `<line x1="${cx - bw / 4}" x2="${cx + bw / 4}" y1="${y(whi)}" y2="${y(whi)}" stroke="${C.ink}" stroke-width="1.5"/>`;
      s += `<line x1="${cx - bw / 4}" x2="${cx + bw / 4}" y1="${y(wlo)}" y2="${y(wlo)}" stroke="${C.ink}" stroke-width="1.5"/>`;
      s += `<rect x="${cx - bw / 2}" y="${y(f.q3)}" width="${bw}" height="${Math.max(1, y(f.q1) - y(f.q3))}" fill="${col}" fill-opacity="0.22" stroke="${col}" stroke-width="1.8"><title>${esc(tip)}</title></rect>`;
      s += `<line x1="${cx - bw / 2}" x2="${cx + bw / 2}" y1="${y(med)}" y2="${y(med)}" stroke="${col}" stroke-width="3"/>`;
      s += `<path d="M ${cx} ${y(mean) - 6} L ${cx + 6} ${y(mean)} L ${cx} ${y(mean) + 6} L ${cx - 6} ${y(mean)} Z" fill="${C.gold}" stroke="${C.goldDark}" stroke-width="1"><title>Средно = ${esc(tl(mean))}</title></path>`;
      v.filter(t => t < f.lo || t > f.hi).forEach(t => {
        s += `<circle cx="${cx}" cy="${y(t)}" r="4.5" fill="${C.orange}" fill-opacity="0.85" stroke="#fff" stroke-width="1"><title>Екстремна стойност: ${esc(tl(t))}</title></circle>`;
      });
      const lx = cx, ly = h - m.b + 18;
      s += o.rotate
        ? `<text transform="translate(${lx} ${ly}) rotate(-30)" text-anchor="end" fill="${C.ink}">${esc(g.label)}</text>`
        : `<text x="${lx}" y="${ly}" text-anchor="middle" fill="${C.ink}">${esc(g.label)}</text>`;
    });
    return s + '</svg>';
  };

  /* Q-Q диаграма спрямо нормалното разпределение */
  E.chart.qq = o => {
    const v = S.sorted(S.nums(o.values));
    const n = v.length;
    if (n < 3) return '<p class="muted">Недостатъчно стойности.</p>';
    const w = o.w || 460, h = o.h || 320, m = { t: 18, r: 18, b: 46, l: 72 };
    const mu = S.mean(v), sd = S.std(v);
    const z = v.map((_, i) => S.normInv((i + 1 - 0.375) / (n + 0.25)));
    const xd = niceDomain(z[0], z[n - 1]), yd = niceDomain(Math.min(v[0], mu + sd * z[0]), Math.max(v[n - 1], mu + sd * z[n - 1]));
    const x = lin(xd[0], xd[1], m.l, w - m.r), y = lin(yd[0], yd[1], h - m.b, m.t);
    let s = svgOpen(w, h, o.label) + frame({ w, h, m, x, y, xd, yd, xLabel: 'Теоретични квантили (z)', yLabel: o.yLabel || 'Наблюдавани стойности' });
    s += `<line x1="${x(xd[0])}" y1="${y(mu + sd * xd[0])}" x2="${x(xd[1])}" y2="${y(mu + sd * xd[1])}" stroke="${C.red}" stroke-width="2"/>`;
    v.forEach((t, i) => { s += `<circle cx="${x(z[i]).toFixed(1)}" cy="${y(t).toFixed(1)}" r="3" fill="${C.navy2}" fill-opacity="0.7"><title>z = ${tl(z[i])}, стойност = ${esc(tl(t))}</title></circle>`; });
    return s + '</svg>';
  };

  /* Диаграма на разсейване: points = [{x, y, g, tip}], groups = [{key,label,color}] */
  E.chart.scatter = o => {
    const pts = o.points.filter(p => Number.isFinite(p.x) && Number.isFinite(p.y));
    const w = o.w || 580, h = o.h || 360, m = { t: o.groups ? 40 : 18, r: 18, b: 46, l: 70 };
    if (!pts.length) return '<p class="muted">Няма двойки валидни стойности.</p>';
    const xd = niceDomain(Math.min(...pts.map(p => p.x)), Math.max(...pts.map(p => p.x)));
    const yd = niceDomain(Math.min(...pts.map(p => p.y)), Math.max(...pts.map(p => p.y)));
    const x = lin(xd[0], xd[1], m.l, w - m.r), y = lin(yd[0], yd[1], h - m.b, m.t);
    let s = svgOpen(w, h, o.label) + frame({ w, h, m, x, y, xd, yd, xLabel: o.xLabel, yLabel: o.yLabel, xFmt: o.xFmt, yFmt: o.yFmt });
    const colorOf = {};
    (o.groups || []).forEach(g => { colorOf[g.key] = g.color; });
    pts.forEach(p => {
      const col = p.color || colorOf[p.g] || C.navy2;
      s += `<circle cx="${x(p.x).toFixed(1)}" cy="${y(p.y).toFixed(1)}" r="${o.r || 4}" fill="${col}" fill-opacity="0.7" stroke="#fff" stroke-width="0.8"><title>${esc(p.tip || `${tl(p.x)}; ${tl(p.y)}`)}</title></circle>`;
    });
    if (o.fit) {
      const { slope, intercept } = S.linreg(pts.map(p => p.x), pts.map(p => p.y));
      s += `<line x1="${x(xd[0])}" y1="${y(intercept + slope * xd[0])}" x2="${x(xd[1])}" y2="${y(intercept + slope * xd[1])}" stroke="${C.gold}" stroke-width="2.5"/>`;
    }
    if (o.groups) s += legend(o.groups.map(g => ({ label: g.label, color: g.color })).concat(o.fit ? [{ label: 'Регресионна права', color: C.gold, line: true }] : []), m.l, 18);
    return s + '</svg>';
  };

  /* Топлинна карта на корелациите: дивергентна скала злато (−) – бяло – navy (+) */
  E.chart.heatmap = o => {
    const n = o.labels.length, cell = o.cell || 72, m = { t: 20, r: 20, b: 20, l: 110 };
    const w = m.l + n * cell + m.r, h = m.t + n * cell + 50;
    const mix = (a, b, t) => { const p = q => [1, 3, 5].map(i => parseInt(q.slice(i, i + 2), 16)); const A = p(a), B = p(b); return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',')})`; };
    let s = svgOpen(w, h, o.label) + `<rect x="0" y="0" width="${w}" height="${h}" fill="#fff"/>`;
    for (let i = 0; i < n; i++) {
      s += `<text x="${m.l - 8}" y="${m.t + i * cell + cell / 2 + 4}" text-anchor="end" fill="${C.ink}">${esc(o.labels[i])}</text>`;
      s += `<text x="${m.l + i * cell + cell / 2}" y="${m.t + n * cell + 18}" text-anchor="middle" fill="${C.ink}">${esc(o.labels[i])}</text>`;
      for (let j = 0; j < n; j++) {
        const r = o.matrix[i][j];
        const fill = !Number.isFinite(r) ? '#eee' : r >= 0 ? mix('#ffffff', C.navy, r) : mix('#ffffff', '#b8860b', -r);
        s += `<rect x="${m.l + j * cell}" y="${m.t + i * cell}" width="${cell - 2}" height="${cell - 2}" rx="4" fill="${fill}"><title>${esc(o.labels[i])} × ${esc(o.labels[j])}: r = ${E.fmt(r, 3)}</title></rect>`;
        s += `<text x="${m.l + j * cell + cell / 2 - 1}" y="${m.t + i * cell + cell / 2 + 4}" text-anchor="middle" fill="${Math.abs(r) > 0.55 ? '#fff' : C.ink}" font-weight="600">${E.fmt(r, 2)}</text>`;
      }
    }
    const lx = m.l, ly = h - 14;
    s += `<text x="${lx}" y="${ly}" fill="${C.muted}">−1</text>`;
    for (let i = 0; i < 40; i++) { const t = -1 + i / 19.5; s += `<rect x="${lx + 18 + i * 5}" y="${ly - 10}" width="5" height="12" fill="${t >= 0 ? mix('#ffffff', C.navy, Math.min(1, t)) : mix('#ffffff', '#b8860b', Math.min(1, -t))}"/>`; }
    s += `<text x="${lx + 222}" y="${ly}" fill="${C.muted}">+1</text>`;
    return s + '</svg>';
  };

  /* Стълбчета: labels, series=[{values,color,label}] */
  E.chart.bar = o => {
    const series = o.series || [{ values: o.values, color: o.color || C.navy2, label: o.seriesLabel || '' }];
    const n = o.labels.length;
    const w = o.w || 540, h = o.h || 300, m = { t: series.length > 1 ? 40 : 20, r: 18, b: o.rotate ? 78 : 46, l: 66 };
    const vals = series.flatMap(s => s.values).filter(Number.isFinite);
    const ymin = Math.min(0, ...vals), ymax = Math.max(0, ...vals) * 1.12 || 1;
    const y = lin(ymin, ymax, h - m.b, m.t);
    const band = (w - m.l - m.r) / n, gap = band * 0.22, bw = (band - gap) / series.length;
    let s = svgOpen(w, h, o.label) + frame({ w, h, m, x: v => v, y, xd: [0, 0], yd: [ymin, ymax], xTicks: [], yLabel: o.yLabel, yFmt: o.yFmt });
    o.labels.forEach((lab, i) => {
      series.forEach((se, k) => {
        const v = se.values[i];
        if (!Number.isFinite(v)) return;
        const x0 = m.l + band * i + gap / 2 + k * bw;
        const col = Array.isArray(se.color) ? se.color[i] : se.color;
        s += `<rect x="${x0}" y="${Math.min(y(v), y(0))}" width="${bw - 2}" height="${Math.abs(y(0) - y(v))}" rx="2" fill="${col}"><title>${esc(lab)}${se.label ? ' – ' + esc(se.label) : ''}: ${esc((o.valueFmt || tl)(v))}</title></rect>`;
        if (o.showValues !== false && n * series.length <= 24) s += `<text x="${x0 + bw / 2 - 1}" y="${Math.min(y(v), y(0)) - 5}" text-anchor="middle" fill="${C.ink}" font-size="11">${esc((o.valueFmt || tl)(v))}</text>`;
      });
      const cx = m.l + band * (i + 0.5), ly = h - m.b + 18;
      s += o.rotate
        ? `<text transform="translate(${cx} ${ly}) rotate(-30)" text-anchor="end" fill="${C.ink}">${esc(lab)}</text>`
        : `<text x="${cx}" y="${ly}" text-anchor="middle" fill="${C.ink}">${esc(lab)}</text>`;
    });
    if (series.length > 1) s += legend(series.map(se => ({ label: se.label, color: Array.isArray(se.color) ? se.color[0] : se.color })), m.l, 18);
    return s + '</svg>';
  };

  /* Диаграма на обяснената дисперсия (scree plot) */
  E.chart.scree = o => {
    const n = o.explained.length, w = o.w || 560, h = o.h || 300, m = { t: 40, r: 50, b: 46, l: 54 };
    const y = lin(0, 1, h - m.b, m.t), band = (w - m.l - m.r) / n;
    let s = svgOpen(w, h, 'Обяснена дисперсия') + frame({ w, h, m, x: v => v, y, xd: [0, 0], yd: [0, 1], xTicks: [], yTicks: [0, 0.25, 0.5, 0.75, 1], yFmt: v => E.fmt(v * 100, 0) + '%', yLabel: 'Дял от дисперсията' });
    let cum = 0;
    const pts = [];
    o.explained.forEach((e, i) => {
      cum += e;
      const cx = m.l + band * (i + 0.5);
      s += `<rect x="${cx - band * 0.32}" y="${y(e)}" width="${band * 0.64}" height="${h - m.b - y(e)}" rx="2" fill="${C.navy2}"><title>PC${i + 1}: ${E.pct(e)}</title></rect>`;
      s += `<text x="${cx}" y="${y(e) - 5}" text-anchor="middle" fill="${C.ink}" font-size="11">${E.pct(e)}</text>`;
      s += `<text x="${cx}" y="${h - m.b + 18}" text-anchor="middle" fill="${C.ink}">PC${i + 1}</text>`;
      pts.push([cx, y(cum)]);
    });
    s += `<polyline points="${pts.map(p => p.join(',')).join(' ')}" fill="none" stroke="${C.gold}" stroke-width="2.5"/>`;
    pts.forEach((p, i) => { s += `<circle cx="${p[0]}" cy="${p[1]}" r="4" fill="${C.gold}"><title>Натрупано до PC${i + 1}</title></circle>`; });
    if (o.threshold) s += `<line x1="${m.l}" x2="${w - m.r}" y1="${y(o.threshold)}" y2="${y(o.threshold)}" stroke="${C.red}" stroke-dasharray="5 4" stroke-width="1.5"/><text x="${w - m.r + 4}" y="${y(o.threshold) + 4}" fill="${C.red}" font-size="11">${E.pct(o.threshold, 0)}</text>`;
    s += legend([{ label: 'Дял на компонентата', color: C.navy2 }, { label: 'Натрупан дял', color: C.gold, line: true }], m.l, 18);
    return s + '</svg>';
  };

  /* Матрица от диаграми на разсейване: хистограми по диагонала */
  E.chart.scatterMatrix = o => {
    const k = o.keys.length, cell = 118, pad = 10, m = { t: 10, l: 70, b: 40 };
    const w = m.l + k * cell + 10, h = m.t + k * cell + m.b;
    let s = svgOpen(w, h, 'Матрица от диаграми на разсейване') + `<rect width="${w}" height="${h}" fill="#fff"/>`;
    const dom = {};
    o.keys.forEach(key => { const v = S.nums(o.rows.map(r => r[key])); dom[key] = [Math.min(...v), Math.max(...v)]; });
    o.keys.forEach((ky, i) => {
      o.keys.forEach((kx, j) => {
        const x0 = m.l + j * cell, y0 = m.t + i * cell;
        s += `<rect x="${x0 + 2}" y="${y0 + 2}" width="${cell - 4}" height="${cell - 4}" fill="#fbfaf6" stroke="${C.grid}"/>`;
        const sx = lin(dom[kx][0], dom[kx][1], x0 + pad, x0 + cell - pad), sy = lin(dom[ky][0], dom[ky][1], y0 + cell - pad, y0 + pad);
        if (i === j) {
          const hh = S.histogram(o.rows.map(r => r[kx]), 12);
          const mx = Math.max(...hh.counts);
          hh.counts.forEach((c, b) => {
            const bx = sx(hh.edges[b]), bx2 = sx(hh.edges[b + 1]);
            const bh = (c / mx) * (cell - 2 * pad);
            s += `<rect x="${bx}" y="${y0 + cell - pad - bh}" width="${Math.max(1, bx2 - bx - 1)}" height="${bh}" fill="${C.gold}"/>`;
          });
        } else {
          const p = S.pairs(o.rows, kx, ky);
          p.x.forEach((xv, t) => { s += `<circle cx="${sx(xv).toFixed(1)}" cy="${sy(p.y[t]).toFixed(1)}" r="1.6" fill="${C.navy2}" fill-opacity="0.55"/>`; });
          s += `<text x="${x0 + cell - 8}" y="${y0 + 16}" text-anchor="end" fill="${C.ink}" font-size="11" font-weight="600">r = ${E.fmt(S.pearson(p.x, p.y), 2)}</text>`;
        }
      });
      s += `<text x="${m.l - 8}" y="${m.t + i * cell + cell / 2 + 4}" text-anchor="end" fill="${C.ink}">${esc(o.labels[i])}</text>`;
      s += `<text x="${m.l + i * cell + cell / 2}" y="${h - 16}" text-anchor="middle" fill="${C.ink}">${esc(o.labels[i])}</text>`;
    });
    return s + '</svg>';
  };

  /* Карта на липсващите стойности: редове × признаци */
  E.chart.missingMap = o => {
    const rows = o.rows, cols = o.cols, n = rows.length;
    const cw = 58, rh = Math.max(1.2, Math.min(3, 520 / n)), m = { t: 30, l: 46, r: 10, b: 10 };
    const w = m.l + cols.length * cw + m.r, h = m.t + n * rh + m.b;
    let s = svgOpen(w, h, 'Карта на липсващите стойности') + `<rect width="${w}" height="${h}" fill="#fff"/>`;
    cols.forEach((c, j) => {
      s += `<text x="${m.l + j * cw + cw / 2}" y="${m.t - 10}" text-anchor="middle" fill="${C.ink}" font-size="11">${esc(E.COL[c].label)}</text>`;
      s += `<rect x="${m.l + j * cw + 2}" y="${m.t}" width="${cw - 4}" height="${n * rh}" fill="#eef1f6"/>`;
    });
    rows.forEach((r, i) => {
      cols.forEach((c, j) => {
        if (r[c] === null || r[c] === undefined) s += `<rect x="${m.l + j * cw + 2}" y="${m.t + i * rh}" width="${cw - 4}" height="${Math.max(rh, 2)}" fill="${E.ISSUE.missing.color}"><title>Ред ${r._row}, ${esc(E.COL[c].label)}: NULL</title></rect>`;
      });
    });
    [1, Math.round(n / 2), n].forEach(t => { s += `<text x="${m.l - 6}" y="${m.t + (t - 0.5) * rh + 4}" text-anchor="end" fill="${C.muted}" font-size="10">${t}</text>`; });
    return s + '</svg>';
  };

  /* Диаграма на Вен за обединяване */
  E.chart.venn = o => {
    const w = 420, h = 210;
    let s = svgOpen(w, h, 'Обединяване') + `<rect width="${w}" height="${h}" fill="#fff"/>`;
    const hl = o.how;
    const fillL = hl === 'left' || hl === 'outer' ? C.navy2 : '#fff', fillR = hl === 'right' || hl === 'outer' ? C.gold : '#fff';
    s += `<defs><clipPath id="vc"><circle cx="160" cy="100" r="78"/></clipPath></defs>`;
    s += `<circle cx="160" cy="100" r="78" fill="${fillL}" fill-opacity="0.35" stroke="${C.navy}" stroke-width="2"/>`;
    s += `<circle cx="260" cy="100" r="78" fill="${fillR}" fill-opacity="0.45" stroke="${C.goldDark}" stroke-width="2"/>`;
    s += `<circle cx="260" cy="100" r="78" clip-path="url(#vc)" fill="${C.navy}" fill-opacity="0.55"/>`;
    s += `<text x="120" y="96" text-anchor="middle" fill="${C.ink}" font-weight="600">${o.left}</text><text x="120" y="112" text-anchor="middle" fill="${C.muted}" font-size="11">само вляво</text>`;
    s += `<text x="210" y="96" text-anchor="middle" fill="#fff" font-weight="700">${o.both}</text><text x="210" y="112" text-anchor="middle" fill="#fff" font-size="11">съвпадат</text>`;
    s += `<text x="300" y="96" text-anchor="middle" fill="${C.ink}" font-weight="600">${o.right}</text><text x="300" y="112" text-anchor="middle" fill="${C.muted}" font-size="11">само вдясно</text>`;
    s += `<text x="140" y="200" text-anchor="middle" fill="${C.navy}" font-weight="600">Анкети</text><text x="280" y="200" text-anchor="middle" fill="${C.goldDark}" font-weight="600">Градове</text>`;
    return s + '</svg>';
  };

  /* Позиция на стойност върху числова ос спрямо Q1, медиана, Q3 и границите */
  E.chart.position = o => {
    const w = 360, h = 74, m = { l: 14, r: 14 };
    const f = o.fences, v = o.value;
    const lo = Math.min(f.lo, v, o.min), hi = Math.max(f.hi, v, o.max);
    const x = lin(lo, hi, m.l, w - m.r);
    let s = svgOpen(w, h, 'Позиция на стойността') + `<rect width="${w}" height="${h}" fill="#fff"/>`;
    s += `<line x1="${m.l}" x2="${w - m.r}" y1="34" y2="34" stroke="${C.axis}"/>`;
    s += `<rect x="${x(f.lo)}" y="28" width="${x(f.hi) - x(f.lo)}" height="12" fill="${C.goldLight}" fill-opacity="0.6"/>`;
    s += `<rect x="${x(f.q1)}" y="24" width="${x(f.q3) - x(f.q1)}" height="20" fill="${C.navy2}" fill-opacity="0.3" stroke="${C.navy2}"/>`;
    s += `<line x1="${x(o.median)}" x2="${x(o.median)}" y1="24" y2="44" stroke="${C.navy}" stroke-width="2.5"/>`;
    s += `<circle cx="${x(v)}" cy="34" r="6.5" fill="${o.color || C.red}" stroke="#fff" stroke-width="1.5"/>`;
    s += `<text x="${x(v)}" y="16" text-anchor="middle" fill="${C.ink}" font-weight="700" font-size="11">${esc(tl(v))}</text>`;
    s += `<text x="${x(f.lo)}" y="62" text-anchor="middle" fill="${C.muted}" font-size="10">${esc(tl(f.lo))}</text><text x="${x(f.hi)}" y="62" text-anchor="middle" fill="${C.muted}" font-size="10">${esc(tl(f.hi))}</text>`;
    return s + '</svg>';
  };

  /* Точкова ос с маркери (средно, медиана, мода) */
  E.chart.strip = o => {
    const v = S.nums(o.values), w = o.w || 640, h = 120, m = { l: 20, r: 20 };
    if (!v.length) return '';
    const xd = niceDomain(Math.min(...v), Math.max(...v));
    const x = lin(xd[0], xd[1], m.l, w - m.r);
    const rnd = S.rng(7);
    let s = svgOpen(w, h, 'Разположение на стойностите') + `<rect width="${w}" height="${h}" fill="#fff"/>`;
    v.forEach(t => { s += `<circle cx="${x(t).toFixed(1)}" cy="${(50 + (rnd() - 0.5) * 34).toFixed(1)}" r="3.2" fill="${C.navy3}" fill-opacity="0.55"><title>${esc(tl(t))}</title></circle>`; });
    s += `<line x1="${m.l}" x2="${w - m.r}" y1="78" y2="78" stroke="${C.axis}"/>`;
    ticks(xd[0], xd[1], 6).forEach(t => { s += `<text x="${x(t)}" y="94" text-anchor="middle" fill="${C.muted}" font-size="11">${esc(tl(t))}</text>`; });
    let lx = m.l;
    (o.markers || []).forEach(mk => {
      if (!Number.isFinite(mk.x)) return;
      s += `<line x1="${x(mk.x)}" x2="${x(mk.x)}" y1="22" y2="80" stroke="${mk.color}" stroke-width="2.5" ${mk.dash ? `stroke-dasharray="${mk.dash}"` : ''}/>`;
      s += `<line x1="${lx}" x2="${lx + 18}" y1="112" y2="112" stroke="${mk.color}" stroke-width="2.5" ${mk.dash ? `stroke-dasharray="${mk.dash}"` : ''}/><text x="${lx + 24}" y="116" fill="${C.ink}" font-size="11">${esc(mk.label)}</text>`;
      lx += 40 + mk.label.length * 6.4;
    });
    return s + '</svg>';
  };

  /* Схема на процеса за началната страница */
  E.chart.process = () => {
    const w = 980, h = 210;
    const boxes = [
      { x: 10, label: 'Сурови данни', sub: 'както са събрани', fill: '#ffffff', stroke: C.axis, ink: C.ink },
      { x: 200, label: 'I. Предварителен', label2: 'анализ (EDA)', sub: 'диагноза', fill: C.navy, stroke: C.navy, ink: '#fff' },
      { x: 400, label: 'Протокол на', label2: 'констатациите', sub: 'какво открихме', fill: C.goldLight, stroke: C.gold, ink: C.ink },
      { x: 590, label: 'II. Подготовка', label2: 'на данните', sub: 'лечение', fill: C.navy2, stroke: C.navy2, ink: '#fff' },
      { x: 790, label: 'Данни, готови', label2: 'за анализ', sub: 'модели, отчети', fill: '#ffffff', stroke: C.gold, ink: C.ink }
    ];
    let s = svgOpen(w, h, 'Процес на подготовка на данните') + `<rect width="${w}" height="${h}" fill="#fff"/>`;
    s += `<defs><marker id="ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="${C.navy}"/></marker></defs>`;
    boxes.forEach((b, i) => {
      s += `<rect x="${b.x}" y="40" width="170" height="86" rx="12" fill="${b.fill}" stroke="${b.stroke}" stroke-width="2"/>`;
      s += `<text x="${b.x + 85}" y="${b.label2 ? 74 : 84}" text-anchor="middle" fill="${b.ink}" font-weight="700" font-size="15">${b.label}</text>`;
      if (b.label2) s += `<text x="${b.x + 85}" y="94" text-anchor="middle" fill="${b.ink}" font-weight="700" font-size="15">${b.label2}</text>`;
      s += `<text x="${b.x + 85}" y="${b.label2 ? 114 : 106}" text-anchor="middle" fill="${b.ink}" fill-opacity="0.8" font-size="12">${b.sub}</text>`;
      if (i < boxes.length - 1) s += `<line x1="${b.x + 172}" x2="${boxes[i + 1].x - 4}" y1="83" y2="83" stroke="${C.navy}" stroke-width="2.5" marker-end="url(#ar)"/>`;
    });
    s += `<path d="M 675 128 C 675 190, 285 190, 285 132" fill="none" stroke="${C.gold}" stroke-width="2.5" stroke-dasharray="7 5" marker-end="url(#ar)"/>`;
    s += `<text x="480" y="196" text-anchor="middle" fill="${C.goldDark}" font-weight="600">повторна проверка след почистването</text>`;
    return s + '</svg>';
  };
})(window.EDA);
