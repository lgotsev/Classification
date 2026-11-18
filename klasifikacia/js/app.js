/* Обвивка на приложението: състояние, навигация, свързване на контролите, страничен панел */
(function (E) {
  const state = E.state = { prep: { scaling: 'z', id: false, ttl: false, split: 'split' }, trained: {}, last: null };
  E.label = k => k;

  /* ---------- Навигация ---------- */
  E.pages = {};
  E.page = (route, def) => { def.st = def.st || {}; E.pages[route] = def; };
  const NAV = [
    { group: null, items: [{ r: '', n: '', t: 'Начало' }] },
    {
      group: 'I. Процесът', items: [
        { r: 'task', n: '1.1', t: 'Задачата и данните' },
        { r: 'pitfalls', n: '1.2', t: 'Капаните в данните' },
        { r: 'prep', n: '1.3', t: 'Подготовка' },
        { r: 'train', n: '1.4', t: 'Обучение' },
        { r: 'eval', n: '1.5', t: 'Оценка' },
        { r: 'compare', n: '1.6', t: 'Сравнение' }
      ]
    },
    {
      group: 'II. Алгоритмите', items: [
        { r: 'theory', n: '2.0', t: 'Обща рамка' },
        { r: 'logreg', n: '2.1', t: 'Логистична регресия' },
        { r: 'knn', n: '2.2', t: 'k най-близки съседи' },
        { r: 'tree', n: '2.3', t: 'Дърво на решенията' },
        { r: 'svm', n: '2.4', t: 'Метод на опорните вектори' },
        { r: 'forest', n: '2.5', t: 'Случайна гора' }
      ]
    },
    {
      group: 'III. Експерименти', items: [
        { r: 'x-scaling', n: '3.1', t: 'Мащабиране' },
        { r: 'x-leakage', n: '3.2', t: 'Изтичане на информация' },
        { r: 'x-overfit', n: '3.3', t: 'Прекомерно обучение' },
        { r: 'colab', n: '3.4', t: 'Тетрадка за Colab' }
      ]
    }
  ];
  E.NAV = NAV;

  function renderNav(route) {
    const html = NAV.map(g => `<div class="nav-group">${g.group ? `<div class="nav-title">${g.group}</div>` : ''}<div class="nav">${g.items.map(it => {
      const active = !it.head && it.r === route;
      return `<a href="#/${it.r}" class="${it.sub ? 'sub' : ''} ${active ? 'active' : ''}"><span class="num">${it.n}</span><span>${it.t}</span></a>`;
    }).join('')}</div></div>`).join('');
    document.getElementById('sidebar').innerHTML = html + '<div class="footer" style="margin:24px 10px 0">Данни: UNSW-NB15, извадка от 5000 записа. Moustafa & Slay (2015).</div>';
  }

  let currentRoute = null;
  function render(resetScroll) {
    const route = location.hash.replace(/^#\/?/, '');
    const page = E.pages[route] || E.pages[''];
    const main = document.getElementById('main');
    const y = window.scrollY;
    renderNav(E.pages[route] ? route : '');
    const sw = document.getElementById('sourceSwitch');
    sw.hidden = !page.source;
    document.querySelectorAll('#sourceSeg button').forEach(b => b.classList.toggle('on', b.dataset.source === state.source));
    try {
      main.innerHTML = page.render(page.st) + '<div class="footer">Класификация · учебно приложение · данни: UNSW-NB15 (Moustafa & Slay, 2015)</div>';
      if (page.after) page.after(main, page.st);
    } catch (err) {
      console.error(err);
      main.innerHTML = `<div class="card note warn"><b>Грешка при показване на страницата.</b><br>${E.esc(err.message)}</div>`;
    }
    document.title = (page.title ? page.title + ' · ' : '') + 'Класификация';
    if (resetScroll) { window.scrollTo(0, 0); main.focus({ preventScroll: true }); } else window.scrollTo(0, y);
    currentRoute = route;
  }
  E.refresh = () => render(false);
  E.currentPage = () => E.pages[currentRoute] || E.pages[''];

  /* ---------- Свързване на контролите ---------- */
  function valueOf(el) {
    if (el.type === 'checkbox') return el.checked;
    if (el.dataset.type === 'num' || el.type === 'range' || el.type === 'number') return Number(el.value);
    return el.value;
  }
  function onChange(e) {
    const el = e.target;
    const page = E.currentPage();
    if (el.dataset.bind) { page.st[el.dataset.bind] = valueOf(el); E.refresh(); }
    else if (el.dataset.cfg) { state.cfg[el.dataset.cfg] = el.value; E.refresh(); }
  }
  function onInput(e) {
    const el = e.target;
    if (el.type === 'range' && el.dataset.bind) {
      const out = document.querySelector(`[data-out="${el.dataset.bind}"]`);
      if (out) out.textContent = el.value;
    }
  }
  function onClick(e) {
    const t = e.target.closest('[data-set],[data-act],[data-cfgset],[data-source]');
    if (!t) return;
    const page = E.currentPage();
    if (t.dataset.source) { state.source = t.dataset.source; E.refresh(); return; }
    if (t.dataset.set) { const v = t.dataset.value; page.st[t.dataset.set] = t.dataset.type === 'num' ? Number(v) : v; E.refresh(); return; }
    if (t.dataset.cfgset) { state.cfg[t.dataset.cfgset] = t.dataset.value; E.refresh(); return; }
    if (t.dataset.act && page.actions && page.actions[t.dataset.act]) page.actions[t.dataset.act](t, page.st, e);
  }

  /* ---------- Страничен панел ---------- */
  E.openDrawer = (title, html) => {
    document.getElementById('drawerTitle').textContent = title;
    document.getElementById('drawerBody').innerHTML = html;
    document.getElementById('drawerBody').scrollTop = 0;
    document.getElementById('drawer').classList.add('open');
    document.getElementById('drawer').setAttribute('aria-hidden', 'false');
    document.getElementById('backdrop').classList.add('open');
    document.body.classList.add('drawer-open');
  };
  E.closeDrawer = () => {
    document.getElementById('drawer').classList.remove('open');
    document.getElementById('drawer').setAttribute('aria-hidden', 'true');
    document.getElementById('backdrop').classList.remove('open');
    document.body.classList.remove('drawer-open');
    document.querySelectorAll('td.selected').forEach(td => td.classList.remove('selected'));
  };

  /* ---------- Помощни елементи ---------- */
  E.ui = {
    select(bind, options, value, label) {
      const opts = options.map(o => (typeof o === 'string' ? { v: o, l: o } : o));
      return `<label class="control">${label || ''}<select data-bind="${bind}">${opts.map(o => `<option value="${E.esc(o.v)}" ${String(o.v) === String(value) ? 'selected' : ''}>${E.esc(o.l)}</option>`).join('')}</select></label>`;
    },
    seg(bind, options, value, opts = {}) {
      return `<div class="seg">${options.map(o => `<button data-${opts.cfg ? 'cfgset' : 'set'}="${bind}" data-value="${E.esc(o.v)}" ${opts.num ? 'data-type="num"' : ''} class="${String(o.v) === String(value) ? 'on' : ''}">${E.esc(o.l)}</button>`).join('')}</div>`;
    },
    range(bind, min, max, step, value, label) {
      return `<label class="control">${label}: <span data-out="${bind}" class="counter">${value}</span><input type="range" data-bind="${bind}" min="${min}" max="${max}" step="${step}" value="${value}"></label>`;
    },
    check(bind, value, label) {
      return `<label class="check"><input type="checkbox" data-bind="${bind}" ${value ? 'checked' : ''}> ${label}</label>`;
    },
    numOptions: (keys = E.NUMERIC) => keys.map(k => ({ v: k, l: E.label(k) })),
    catOptions: (keys = E.CATEGORICAL) => keys.map(k => ({ v: k, l: E.COL[k].label })),
    stat(label, value, formula, hint, cls) {
      return `<div class="stat ${cls || ''}"><div class="label">${label}</div><div class="value">${value}</div>${formula ? `<div class="formula">${formula}</div>` : ''}${hint ? `<div class="hint">${hint}</div>` : ''}</div>`;
    },
    head(eyebrow, title, lead) {
      return `<div class="page-head"><div class="eyebrow">${eyebrow}</div><h1>${title}</h1>${lead ? `<p class="lead">${lead}</p>` : ''}</div>`;
    },
    chart(title, svg) { return `<div class="chart-box">${title ? `<div class="chart-title">${title}</div>` : ''}${svg}</div>`; },
    table(headers, rows, opts = {}) {
      return `<div class="table-wrap"${opts.maxh ? ` style="max-height:${opts.maxh}px"` : ''}><table class="data ${opts.cls || ''}"><thead><tr>${headers.map(h => `<th class="${h.num ? 'num' : ''}">${h.l !== undefined ? h.l : h}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map((c, i) => `<td class="${headers[i] && headers[i].num ? 'num' : ''}">${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    }
  };

  // Блок с код на Python; коментарите (#) се оцветяват
  E.code = (py, title) => `<details class="code"><summary>${title || 'Код на Python'}</summary><pre>${E.esc(py.trim()).split('\n').map(l => l.replace(/(^|\s)(#.*)$/, '$1<span class="c">$2</span>')).join('\n')}</pre></details>`;

  // Изпълнение на тежко изчисление след показване на съобщение „Изчислява се…“
  E.busy = (msg, fn) => {
    const ov = document.getElementById('busy');
    document.getElementById('busyMsg').textContent = msg;
    ov.classList.add('on');
    setTimeout(() => {
      try { fn(); } catch (err) { console.error(err); alert('Грешка: ' + err.message); }
      ov.classList.remove('on');
      E.refresh();
    }, 40);
  };
  // Последователни стъпки с обновяване на съобщението между тях
  E.busySteps = (steps, done) => {
    const ov = document.getElementById('busy');
    ov.classList.add('on');
    let i = 0;
    const next = () => {
      if (i >= steps.length) { ov.classList.remove('on'); if (done) done(); E.refresh(); return; }
      document.getElementById('busyMsg').textContent = steps[i][0];
      setTimeout(() => {
        try { steps[i][1](); } catch (err) { console.error(err); }
        i++; next();
      }, 30);
    };
    next();
  };

  E.start = () => {
    document.addEventListener('change', onChange);
    document.addEventListener('input', onInput);
    document.addEventListener('click', onClick);
    document.getElementById('drawerClose').addEventListener('click', E.closeDrawer);
    document.getElementById('backdrop').addEventListener('click', E.closeDrawer);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') E.closeDrawer(); });
    document.getElementById('menuBtn').addEventListener('click', () => document.getElementById('sidebar').classList.toggle('open'));
    document.getElementById('sidebar').addEventListener('click', e => { if (e.target.closest('a')) document.getElementById('sidebar').classList.remove('open'); });
    window.addEventListener('hashchange', () => { E.closeDrawer(); render(true); });
    render(true);
  };
})(window.EDA);
