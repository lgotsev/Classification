/* Диаграми за класификацията: граница на решение, ROC крива, линейна диаграма, хоризонтални стълбчета, дърво */
(function (E) {
  const C = E.C, esc = E.esc, f = E.fmt;
  const FONT = 'font-family="IBM Plex Sans, Segoe UI, Arial, sans-serif"';
  const open = (w, h, label, extra) => `<svg viewBox="0 0 ${w} ${h}" width="100%" role="img" aria-label="${esc(label)}" xmlns="http://www.w3.org/2000/svg" ${FONT} font-size="12" ${extra || ''}>`;
  const lin = (d0, d1, r0, r1) => v => r0 + ((v - d0) * (r1 - r0)) / ((d1 - d0) || 1);
  const ticks = (min, max, n = 5) => {
    const raw = (max - min) / n, mag = Math.pow(10, Math.floor(Math.log10(raw))), nr = raw / mag;
    const step = (nr < 1.5 ? 1 : nr < 3 ? 2 : nr < 7 ? 5 : 10) * mag, out = [];
    for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-9; v += step) out.push(+v.toFixed(10));
    return out;
  };
  E.CLR = { normal: '#1f3a68', attack: '#c47a12', bgN: '#c3d1e8', bgA: '#f1d48f', sv: '#111827' };

  function axes(w, h, m, x, y, xd, yd, xLabel, yLabel, xf, yf) {
    let s = '';
    ticks(yd[0], yd[1]).forEach(t => { s += `<line x1="${m.l}" x2="${w - m.r}" y1="${y(t)}" y2="${y(t)}" stroke="${C.grid}" stroke-opacity="0.6"/><text x="${m.l - 8}" y="${y(t) + 4}" text-anchor="end" fill="${C.muted}">${esc((yf || f)(t))}</text>`; });
    ticks(xd[0], xd[1]).forEach(t => { s += `<line x1="${x(t)}" x2="${x(t)}" y1="${h - m.b}" y2="${h - m.b + 5}" stroke="${C.axis}"/><text x="${x(t)}" y="${h - m.b + 18}" text-anchor="middle" fill="${C.muted}">${esc((xf || f)(t))}</text>`; });
    s += `<line x1="${m.l}" x2="${w - m.r}" y1="${h - m.b}" y2="${h - m.b}" stroke="${C.axis}"/><line x1="${m.l}" x2="${m.l}" y1="${m.t}" y2="${h - m.b}" stroke="${C.axis}"/>`;
    if (xLabel) s += `<text x="${(m.l + w - m.r) / 2}" y="${h - 6}" text-anchor="middle" fill="${C.ink}" font-weight="600">${esc(xLabel)}</text>`;
    if (yLabel) s += `<text transform="translate(14 ${(m.t + h - m.b) / 2}) rotate(-90)" text-anchor="middle" fill="${C.ink}" font-weight="600">${esc(yLabel)}</text>`;
    return s;
  }
  const legendItems = (items, x, y, maxX) => {
    let s = '', cx = x;
    items.forEach(it => {
      const iw = 40 + it.label.length * 7.2;
      if (maxX && cx > x && cx + iw - 14 > maxX) { cx = x; y += 18; }
      if (it.ring) s += `<circle cx="${cx + 6}" cy="${y}" r="5" fill="none" stroke="${it.color}" stroke-width="1.8"/>`;
      else if (it.line) s += `<line x1="${cx}" x2="${cx + 18}" y1="${y}" y2="${y}" stroke="${it.color}" stroke-width="2.5" ${it.dash ? `stroke-dasharray="${it.dash}"` : ''}/>`;
      else if (it.box) s += `<rect x="${cx}" y="${y - 6}" width="14" height="12" rx="2" fill="${it.color}"/>`;
      else s += `<circle cx="${cx + 6}" cy="${y}" r="4.5" fill="${it.color}"/>`;
      s += `<text x="${cx + (it.line ? 24 : 18)}" y="${y + 4}" fill="${C.ink}">${esc(it.label)}</text>`;
      cx += iw;
    });
    return s;
  };

  /* Граница на решение в равнината на два признака.
     o.predict(xRaw, yRaw) → { cls: 0/1, conf: 0..1 } ; o.points = [{x, y, label, sv, train}] */
  E.chart.boundary = o => {
    const w = o.w || 600, h = o.h || 486, m = { t: 56, r: 16, b: 50, l: 62 };
    const G = o.grid || 70;
    // Логаритмична скала на осите (само за изобразяване): u = log10(1 + v)
    const fw = v => Math.log10(1 + Math.max(0, v)), inv = u => Math.pow(10, u) - 1;
    const ud = [fw(o.xd[0]), fw(o.xd[1])], vd = [fw(o.yd[0]), fw(o.yd[1])];
    const X = lin(ud[0], ud[1], m.l, w - m.r), Y = lin(vd[0], vd[1], h - m.b, m.t);
    const x = v => X(fw(v)), y = v => Y(fw(v));
    const cw = (w - m.l - m.r) / G, ch = (h - m.t - m.b) / G;
    let s = open(w, h, o.label || 'Граница на решение', `data-map='${JSON.stringify({ l: m.l, t: m.t, r: w - m.r, b: h - m.b, ud, vd, w, h, log: 1 })}'`);
    s += `<rect width="${w}" height="${h}" fill="#fff"/>`;
    for (let j = 0; j < G; j++) {
      let run = null;
      const flush = () => { if (run) { s += `<rect x="${(m.l + run.i0 * cw).toFixed(2)}" y="${(m.t + j * ch).toFixed(2)}" width="${((run.i1 - run.i0 + 1) * cw + 0.5).toFixed(2)}" height="${(ch + 0.5).toFixed(2)}" fill="${run.cls ? E.CLR.bgA : E.CLR.bgN}" fill-opacity="${0.25 + 0.22 * run.lv}"/>`; run = null; } };
      for (let i = 0; i < G; i++) {
        const px = inv(ud[0] + ((i + 0.5) / G) * (ud[1] - ud[0]));
        const py = inv(vd[1] - ((j + 0.5) / G) * (vd[1] - vd[0]));
        const r = o.predict(px, py);
        const lv = Math.min(3, Math.floor(r.conf * 4));
        if (run && run.cls === r.cls && run.lv === lv) run.i1 = i;
        else { flush(); run = { i0: i, i1: i, cls: r.cls, lv }; }
      }
      flush();
    }
    // Оси с черти в байтове
    const TK = [0, 3, 10, 30, 100, 300, 1000, 3000].filter(t => t <= o.xd[1]), TKy = [0, 3, 10, 30, 100, 300, 1000, 3000].filter(t => t <= o.yd[1]);
    TKy.forEach(t => { s += `<line x1="${m.l}" x2="${w - m.r}" y1="${y(t)}" y2="${y(t)}" stroke="#ffffff" stroke-opacity="0.7"/><text x="${m.l - 8}" y="${y(t) + 4}" text-anchor="end" fill="${C.muted}">${f(t)}</text>`; });
    TK.forEach(t => { s += `<line x1="${x(t)}" x2="${x(t)}" y1="${h - m.b}" y2="${h - m.b + 5}" stroke="${C.axis}"/><text x="${x(t)}" y="${h - m.b + 18}" text-anchor="middle" fill="${C.muted}">${f(t)}</text>`; });
    s += `<line x1="${m.l}" x2="${w - m.r}" y1="${h - m.b}" y2="${h - m.b}" stroke="${C.axis}"/><line x1="${m.l}" x2="${m.l}" y1="${m.t}" y2="${h - m.b}" stroke="${C.axis}"/>`;
    if (o.xLabel) s += `<text x="${(m.l + w - m.r) / 2}" y="${h - 8}" text-anchor="middle" fill="${C.ink}" font-weight="600">${esc(o.xLabel)}</text>`;
    if (o.yLabel) s += `<text transform="translate(14 ${(m.t + h - m.b) / 2}) rotate(-90)" text-anchor="middle" fill="${C.ink}" font-weight="600">${esc(o.yLabel)}</text>`;
    s += `<clipPath id="plotclip"><rect x="${m.l}" y="${m.t}" width="${w - m.l - m.r}" height="${h - m.t - m.b}"/></clipPath><g clip-path="url(#plotclip)">`;
    // Прави линии в оригиналните единици: в логаритмична скала изглеждат като криви
    (o.lines || []).forEach(L => {
      const pts = (L.pts || []).map(([px, py]) => `${x(px).toFixed(1)},${y(py).toFixed(1)}`);
      if (pts.length > 1) s += `<polyline points="${pts.join(' ')}" fill="none" stroke="${L.color || C.ink}" stroke-width="${L.width || 2}" ${L.dash ? `stroke-dasharray="${L.dash}"` : ''}/>`;
    });
    // Детерминирано разсейване на точките с еднакви стойности, за да не се покриват напълно
    const jit = (i, k) => (((Math.sin((i + 1) * (k ? 12.9898 : 78.233)) * 43758.5453) % 1) - 0.5) * 4;
    (o.points || []).forEach((p, i) => {
      if (p.x > o.xd[1] || p.y > o.yd[1]) return;
      const cx = x(p.x) + jit(i, 0), cy = y(p.y) + jit(i, 1);
      const col = p.label ? E.CLR.attack : E.CLR.normal;
      s += p.label
        ? `<path d="M ${cx.toFixed(1)} ${(cy - 3.6).toFixed(1)} l 3.4 6 l -6.8 0 z" fill="${col}" fill-opacity="0.85" stroke="#fff" stroke-width="0.5"/>`
        : `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="2.6" fill="${col}" fill-opacity="0.8" stroke="#fff" stroke-width="0.5"/>`;
      if (p.sv) s += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="5" fill="none" stroke="${E.CLR.sv}" stroke-width="1.1"/>`;
    });
    if (o.query) {
      (o.query.nb || []).forEach(p => { s += `<line x1="${x(o.query.x)}" y1="${y(o.query.y)}" x2="${x(p.x)}" y2="${y(p.y)}" stroke="${C.ink}" stroke-width="1.2"/><circle cx="${x(p.x)}" cy="${y(p.y)}" r="5" fill="none" stroke="${C.ink}" stroke-width="1.6"/>`; });
      s += `<circle cx="${x(o.query.x)}" cy="${y(o.query.y)}" r="8" fill="${o.query.cls ? E.CLR.attack : E.CLR.normal}" stroke="#fff" stroke-width="2.5"/><circle cx="${x(o.query.x)}" cy="${y(o.query.y)}" r="10" fill="none" stroke="${C.ink}" stroke-width="1.5"/>`;
    }
    s += '</g>';
    if (o.legend !== false) {
      const leg = [{ label: 'Нормален трафик', color: E.CLR.normal }, { label: 'Атака', color: E.CLR.attack }, { label: 'Област „нормален“', color: E.CLR.bgN, box: true }, { label: 'Област „атака“', color: E.CLR.bgA, box: true }];
      if ((o.points || []).some(p => p.sv)) leg.push({ label: 'Опорен вектор', color: E.CLR.sv, ring: true });
      s += legendItems(leg, m.l, 16, w - m.r);
    }
    return s + '</svg>';
  };

  /* ROC крива: curves = [{label, color, points:[[fpr,tpr,thr]], auc}], marker = {fpr,tpr} */
  E.chart.roc = o => {
    const w = o.w || 460, h = o.h || 420, m = { t: 20, r: 16, b: 50, l: 60 };
    const x = lin(0, 1, m.l, w - m.r), y = lin(0, 1, h - m.b, m.t);
    let s = open(w, h, 'ROC крива') + `<rect width="${w}" height="${h}" fill="#fff"/>`;
    s += axes(w, h, m, x, y, [0, 1], [0, 1], 'Дял фалшиви тревоги (FPR)', 'Дял открити атаки (TPR, чувствителност)', v => E.fmt(v, 1), v => E.fmt(v, 1));
    s += `<line x1="${x(0)}" y1="${y(0)}" x2="${x(1)}" y2="${y(1)}" stroke="${C.axis}" stroke-dasharray="5 4"/>`;
    s += `<text x="${x(0.62)}" y="${y(0.55)}" fill="${C.muted}" font-size="11" transform="rotate(-${Math.atan((h - m.t - m.b) / (w - m.l - m.r)) * 180 / Math.PI} ${x(0.62)} ${y(0.55)})">случайно отгатване (AUC = 0,5)</text>`;
    o.curves.forEach((c, k) => {
      s += `<polyline points="${c.points.map(p => `${x(p[0]).toFixed(1)},${y(p[1]).toFixed(1)}`).join(' ')}" fill="none" stroke="${c.color}" stroke-width="2.4"/>`;
      s += `<rect x="${x(0.42) - 6}" y="${y(0.32) + k * 18 - 9}" width="10" height="10" rx="2" fill="${c.color}"/><text x="${x(0.42) + 8}" y="${y(0.32) + k * 18}" fill="${C.ink}" font-size="11.5">${esc(c.label)}: AUC = ${E.fmt(c.auc, 3)}</text>`;
    });
    if (o.marker) s += `<circle cx="${x(o.marker.fpr)}" cy="${y(o.marker.tpr)}" r="7" fill="${C.gold}" stroke="${C.navy}" stroke-width="2"><title>Текущ праг</title></circle>`;
    return s + '</svg>';
  };

  /* Линейна диаграма: x = [числа], series = [{label,color,values,dash}] */
  E.chart.line = o => {
    const w = o.w || 600, h = o.h || 320, m = { t: 40, r: 18, b: 46, l: 60 };
    const all = o.series.flatMap(s => s.values).filter(Number.isFinite);
    const yd = o.yd || [Math.max(0, Math.min(...all) - 0.02), Math.min(1, Math.max(...all) + 0.02)];
    const xd = [Math.min(...o.x), Math.max(...o.x)];
    const x = lin(xd[0], xd[1], m.l, w - m.r), y = lin(yd[0], yd[1], h - m.b, m.t);
    let s = open(w, h, o.label || 'диаграма') + `<rect width="${w}" height="${h}" fill="#fff"/>` + axes(w, h, m, x, y, xd, yd, o.xLabel, o.yLabel, v => E.fmt(v, 0), o.yFmt);
    if (o.mark !== undefined) s += `<line x1="${x(o.mark)}" x2="${x(o.mark)}" y1="${m.t}" y2="${h - m.b}" stroke="${C.red}" stroke-dasharray="5 4" stroke-width="1.5"/>`;
    o.series.forEach(se => {
      s += `<polyline points="${se.values.map((v, i) => `${x(o.x[i]).toFixed(1)},${y(v).toFixed(1)}`).join(' ')}" fill="none" stroke="${se.color}" stroke-width="2.5" ${se.dash ? `stroke-dasharray="${se.dash}"` : ''}/>`;
      se.values.forEach((v, i) => { s += `<circle cx="${x(o.x[i]).toFixed(1)}" cy="${y(v).toFixed(1)}" r="3" fill="${se.color}"><title>${esc(se.label)}: ${o.x[i]} → ${E.fmt(v, 3)}</title></circle>`; });
    });
    s += legendItems(o.series.map(se => ({ label: se.label, color: se.color, line: true, dash: se.dash })), m.l, 18);
    return s + '</svg>';
  };

  /* Хоризонтални стълбчета (за коефициенти и важност на признаците) */
  E.chart.hbar = o => {
    const n = o.labels.length, rh = 22, m = { t: 10, r: 60, b: 10, l: o.left || 230 };
    const w = o.w || 640, h = m.t + n * rh + m.b;
    const vals = o.values, mx = Math.max(...vals.map(Math.abs)) || 1;
    const neg = vals.some(v => v < 0);
    const x0 = neg ? m.l + (w - m.l - m.r) / 2 : m.l, scale = (neg ? (w - m.l - m.r) / 2 : w - m.l - m.r) / mx;
    let s = open(w, h, o.label || 'стълбчета') + `<rect width="${w}" height="${h}" fill="#fff"/>`;
    vals.forEach((v, i) => {
      const yy = m.t + i * rh;
      const bw = Math.abs(v) * scale, bx = v >= 0 ? x0 : x0 - bw;
      s += `<text x="${m.l - 8}" y="${yy + 15}" text-anchor="end" fill="${C.ink}">${esc(o.labels[i])}</text>`;
      s += `<rect x="${bx}" y="${yy + 4}" width="${Math.max(1, bw)}" height="${rh - 8}" rx="2" fill="${v >= 0 ? (o.pos || C.navy2) : (o.neg || C.gold)}"/>`;
      s += `<text x="${v >= 0 ? bx + bw + 5 : bx - 5}" y="${yy + 15}" text-anchor="${v >= 0 ? 'start' : 'end'}" fill="${C.muted}" font-size="11">${esc((o.fmt || (t => E.fmt(t, 3)))(v))}</text>`;
    });
    if (neg) s += `<line x1="${x0}" x2="${x0}" y1="${m.t}" y2="${h - m.b}" stroke="${C.axis}"/>`;
    return s + '</svg>';
  };

  /* Дърво на решенията до дадена дълбочина. label(node) → текст на условието */
  E.chart.treeDiagram = (root, o) => {
    const maxD = o.maxDepth || 3;
    const nodes = [];
    let leafX = 0;
    (function layout(n, d) {
      const show = d < maxD && n.left;
      if (show) { layout(n.left, d + 1); layout(n.right, d + 1); n._x = (n.left._x + n.right._x) / 2; }
      else { n._x = leafX++; }
      n._d = d; n._cut = !show && !!n.left;
      nodes.push(n);
    })(root, 0);
    const bw = 150, bh = 62, gx = 14, gy = 46;
    const w = Math.max(560, leafX * (bw + gx) + 20), h = (maxD + 1) * (bh + gy) + 10;
    const X = n => 10 + n._x * (bw + gx), Y = n => 10 + n._d * (bh + gy);
    let s = open(w, h, 'Дърво на решенията') + `<rect width="${w}" height="${h}" fill="#fff"/>`;
    nodes.forEach(n => {
      if (n.left && !n._cut) [n.left, n.right].forEach((c, k) => {
        s += `<path d="M ${X(n) + bw / 2} ${Y(n) + bh} C ${X(n) + bw / 2} ${Y(n) + bh + gy / 2}, ${X(c) + bw / 2} ${Y(c) - gy / 2}, ${X(c) + bw / 2} ${Y(c)}" fill="none" stroke="${C.axis}" stroke-width="1.5"/>`;
        s += `<text x="${(X(n) + X(c)) / 2 + bw / 2 + (k ? 8 : -8)}" y="${Y(n) + bh + gy / 2 + 4}" text-anchor="${k ? 'start' : 'end'}" fill="${k ? C.goldDark : C.navy2}" font-size="11" font-weight="700">${k ? 'не' : 'да'}</text>`;
      });
    });
    nodes.forEach(n => {
      const atk = n.value, leaf = !n.left || n._cut;
      const fill = atk >= 0.5 ? E.CLR.bgA : E.CLR.bgN;
      s += `<rect x="${X(n)}" y="${Y(n)}" width="${bw}" height="${bh}" rx="8" fill="${fill}" fill-opacity="${0.35 + 0.6 * Math.abs(atk - 0.5) * 2}" stroke="${leaf ? C.axis : C.navy}" stroke-width="${leaf ? 1 : 1.6}"/>`;
      if (n.left && !n._cut) s += `<text x="${X(n) + bw / 2}" y="${Y(n) + 17}" text-anchor="middle" fill="${C.ink}" font-weight="700" font-size="11.5">${esc(o.label(n))}</text>`;
      else s += `<text x="${X(n) + bw / 2}" y="${Y(n) + 17}" text-anchor="middle" fill="${C.ink}" font-weight="700" font-size="11.5">${n._cut ? '… продължава' : (atk >= 0.5 ? 'Лист: АТАКА' : 'Лист: НОРМАЛЕН')}</text>`;
      s += `<text x="${X(n) + bw / 2}" y="${Y(n) + 34}" text-anchor="middle" fill="${C.muted}" font-size="11">записи: ${n.n} · атаки: ${E.fmt(atk * 100, 0)}%</text>`;
      s += `<text x="${X(n) + bw / 2}" y="${Y(n) + 50}" text-anchor="middle" fill="${C.muted}" font-size="11">${o.critLabel || 'Джини'} = ${E.fmt(n.imp, 3)}</text>`;
    });
    return s + '</svg>';
  };

  /* Сигмоида */
  E.chart.sigmoid = o => {
    const w = o.w || 520, h = 260, m = { t: 20, r: 16, b: 44, l: 52 };
    const x = lin(-6, 6, m.l, w - m.r), y = lin(0, 1, h - m.b, m.t);
    let s = open(w, h, 'Сигмоидна функция') + `<rect width="${w}" height="${h}" fill="#fff"/>` + axes(w, h, m, x, y, [-6, 6], [0, 1], 'z = w₁x₁ + w₂x₂ + b', 'p (атака)', v => E.fmt(v, 0), v => E.fmt(v, 1));
    s += `<line x1="${x(-6)}" x2="${x(6)}" y1="${y(0.5)}" y2="${y(0.5)}" stroke="${C.red}" stroke-dasharray="5 4"/><text x="${x(-5.8)}" y="${y(0.5) - 6}" fill="${C.red}" font-size="11">праг 0,5</text>`;
    const pts = []; for (let i = 0; i <= 120; i++) { const z = -6 + i / 10; pts.push(`${x(z).toFixed(1)},${y(1 / (1 + Math.exp(-z))).toFixed(1)}`); }
    s += `<polyline points="${pts.join(' ')}" fill="none" stroke="${C.navy}" stroke-width="3"/>`;
    (o.marks || []).forEach(mk => { const z = Math.max(-6, Math.min(6, mk.z)); s += `<circle cx="${x(z)}" cy="${y(1 / (1 + Math.exp(-mk.z)))}" r="6" fill="${mk.color}" stroke="#fff" stroke-width="1.5"/><text x="${x(z) + 9}" y="${y(1 / (1 + Math.exp(-mk.z))) + 4}" fill="${C.ink}" font-size="11">${esc(mk.label)}</text>`; });
    return s + '</svg>';
  };

  /* Схема на процеса */
  E.chart.clsProcess = () => {
    const steps = [['Задача', 'какво откриваме'], ['Данни', 'и капаните в тях'], ['Подготовка', 'кодиране, мащаб'], ['Обучение', '5 алгоритъма'], ['Оценка', 'метрики, ROC'], ['Сравнение', 'избор на модел']];
    const w = 980, h = 150, bw = 142, gap = (w - 20 - steps.length * bw) / (steps.length - 1);
    let s = open(w, h, 'Процес') + `<rect width="${w}" height="${h}" fill="#fff"/><defs><marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="${C.navy}"/></marker></defs>`;
    steps.forEach((st, i) => {
      const x0 = 10 + i * (bw + gap);
      const dark = i === 3 || i === 4;
      s += `<rect x="${x0}" y="30" width="${bw}" height="74" rx="12" fill="${dark ? C.navy : i === 5 ? C.goldLight : '#fff'}" stroke="${dark ? C.navy : C.gold}" stroke-width="2"/>`;
      s += `<text x="${x0 + bw / 2}" y="62" text-anchor="middle" fill="${dark ? '#fff' : C.ink}" font-weight="700" font-size="15">${st[0]}</text><text x="${x0 + bw / 2}" y="84" text-anchor="middle" fill="${dark ? '#dbe2ee' : C.muted}" font-size="12">${st[1]}</text>`;
      if (i < steps.length - 1) s += `<line x1="${x0 + bw + 3}" x2="${x0 + bw + gap - 4}" y1="67" y2="67" stroke="${C.navy}" stroke-width="2.5" marker-end="url(#arr)"/>`;
    });
    s += `<text x="${w / 2}" y="134" text-anchor="middle" fill="${C.goldDark}" font-weight="600">при слаб резултат: обратно към данните и подготовката</text>`;
    return s + '</svg>';
  };
})(window.EDA);
