/* II. Алгоритмите: теория и граница на решение в равнината на два признака */
(function (E) {
  const C = window.CLS, ML = C.ML, ui = E.ui, f = E.fmt;
  const pct = v => E.pct(v, 1);
  const XL = 'Средна големина на пакет от източника, smean (байта)', YL = 'Средна големина на пакет от получателя, dmean (байта)';

  // Обучение в равнината и прогноза за всяка точка от решетката
  const cache = new Map();
  function fit2d(algo, params) {
    const key = algo + JSON.stringify(params);
    if (cache.has(key)) return cache.get(key);
    const sp = C.space2d();
    const model = ML.fit(algo, sp.Xtr, sp.ytr, params);
    const thr = algo === 'svm' ? 0 : 0.5;
    const acc = (X, y) => { let ok = 0; X.forEach((x, i) => { if ((model.score(x) > thr ? 1 : 0) === y[i]) ok++; }); return ok / X.length; };
    const res = { model, trainAcc: acc(sp.Xtr, sp.ytr), testAcc: acc(sp.Xte, sp.yte) };
    res.predict = (px, py) => {
      const s = model.score(sp.toZ(px, py));
      return algo === 'svm' ? { cls: s > 0 ? 1 : 0, conf: Math.min(1, Math.abs(s)) } : { cls: s > 0.5 ? 1 : 0, conf: Math.abs(s - 0.5) * 2 };
    };
    if (cache.size > 30) cache.delete(cache.keys().next().value);
    cache.set(key, res);
    return res;
  }
  const points = (which, extra) => {
    const sp = C.space2d();
    const rows = which === 'train' ? sp.train : sp.test;
    return rows.map((r, i) => ({ x: r[sp.fx], y: r[sp.fy], label: r.label, sv: extra ? extra(i) : false }));
  };
  const accCards = (r, simple) => `<div class="grid-2">${ui.stat('Точност върху обучаващите', pct(r.trainAcc))}${ui.stat('Точност върху тестовите', pct(r.testAcc), '', '', 'gold')}</div>${!simple && r.trainAcc - r.testAcc > 0.05 ? '<div class="note small" style="margin-top:10px">Обучаващата точност е значително по-висока от тестовата: моделът е запомнил шума в обучаващите данни: прекомерно обучение (нагаждане, overfitting).</div>' : ''}`;
  const pc = (pros, cons) => `<div class="pc"><div class="pro"><h4>Предимства</h4><ul>${pros.map(x => `<li>${x}</li>`).join('')}</ul></div><div class="con"><h4>Недостатъци</h4><ul>${cons.map(x => `<li>${x}</li>`).join('')}</ul></div></div>`;
  const showSel = st => ui.seg('show', [{ v: 'test', l: 'Тестови записи' }, { v: 'train', l: 'Обучаващи записи' }], st.show);
  const spaceNote = '<p class="small muted">Само два признака, за да се вижда границата. Цветът на фона е прогнозата на модела за всяка точка от равнината (по-наситен = по-уверен). Осите са в <b>логаритмична скала</b>: разстоянието от 10 до 100 байта е колкото от 100 до 1000. Това е само начин на изобразяване; моделите работят със стандартизираните стойности. Пълните резултати с всички признаци са в Част I.</p>';
  // Права w1·z1 + w2·z2 + b = c, изразена в байтове (в логаритмична скала изглежда като крива)
  function lineRaw(w, b, c) {
    const sp = C.space2d(), [s0, s1] = sp.st;
    const lg = (lo, hi, k) => Math.pow(10, Math.log10(1 + lo) + (k / 300) * (Math.log10(1 + hi) - Math.log10(1 + lo))) - 1;
    const byX = [], byY = [];
    for (let k = 0; k <= 300; k++) {
      if (Math.abs(w[1]) > 1e-12) { const xr = lg(sp.xd[0], sp.xd[1], k), z2 = (c - b - w[0] * (xr - s0.m) / s0.s) / w[1], yr = z2 * s1.s + s1.m; if (yr >= sp.yd[0] && yr <= sp.yd[1]) byX.push([xr, yr]); }
      if (Math.abs(w[0]) > 1e-12) { const yr = lg(sp.yd[0], sp.yd[1], k), z1 = (c - b - w[1] * (yr - s1.m) / s1.s) / w[0], xr = z1 * s0.s + s0.m; if (xr >= sp.xd[0] && xr <= sp.xd[1]) byY.push([xr, yr]); }
    }
    const pts = byX.length >= byY.length ? byX : byY;
    return pts.length > 1 ? { pts } : null;
  }

  /* ================= 2.0 Обща рамка ================= */
  E.page('theory', {
    title: 'Обща рамка',
    render() {
      const sp = C.space2d();
      const pts = sp.test.map(r => ({ x: r.smean, y: r.dmean, label: r.label }));
      const rows = [
        ['Логистична регресия (Logistic Regression)', 'линеен, вероятностен', 'права (хиперравнина)', 'да', 'висока', 'бързо / много бързо', 'C'],
        ['k най-близки съседи (k-NN)', 'по сходство („мързелив“)', 'произволна, накъсана', 'да', 'средна', 'няма / бавно', 'k, разстояние'],
        ['Дърво на решенията (Decision Tree)', 'правила „ако… то…“', 'стъпаловидна, успоредна на осите', 'не', 'много висока', 'бързо / много бързо', 'дълбочина, критерий'],
        ['Метод на опорните вектори (SVM)', 'максимален отстъп', 'права или крива (с ядро)', 'да', 'ниска', 'бавно / средно', 'C, ядро, γ'],
        ['Случайна гора (Random Forest)', 'ансамбъл от дървета', 'стъпаловидна, изгладена', 'не', 'ниска', 'средно / бързо', 'брой дървета, дълбочина']
      ];
      return `
      ${ui.head('II · 2.0', 'Обща рамка', 'Всички алгоритми решават една задача: да разделят пространството на признаците на област „нормален трафик“ и област „атака“. Различават се по формата на границата, която могат да построят.')}
      <div class="card">
        <h3>Равнината, в която ще гледаме алгоритмите</h3>
        <p>За да се вижда границата, в Част II използваме само два признака: <b>средната големина на пакетите</b> от източника (<code>smean</code>) и от получателя (<code>dmean</code>). Например DNS заявките са малки пакети, а изтеглянето на файл дава големи пакети от получателя. Признаците се стандартизират, а осите са в байтове, в логаритмична скала: повечето пакети са малки и без нея почти всички точки биха се събрали в долния ляв ъгъл.</p>
        ${ui.chart('Тестовите записи в равнината smean × dmean', E.chart.boundary({ predict: () => ({ cls: 0, conf: 0 }), points: pts, xd: sp.xd, yd: sp.yd, xLabel: XL, yLabel: YL, grid: 1 }))}
        <p class="small muted">Двата класа се припокриват силно. Затова и най-добрият модел с тези два признака греши в около 10% от случаите. С всички признаци грешките намаляват.</p>
      </div>
      <div class="card">
        <h3>Петте алгоритъма накратко</h3>
        ${ui.table(['Алгоритъм', 'Подход', 'Форма на границата', 'Нужно мащабиране', 'Обяснимост', 'Обучение / прогноза', 'Основни параметри'], rows.map(r => [`<b>${r[0]}</b>`].concat(r.slice(1))), { cls: 'compact' })}
      </div>
      <div class="card">
        <h3>Обобщаване: недообучение и прекомерно обучение</h3>
        <p>Целта е модел, който работи добре върху <b>нови</b> данни, а не само върху обучаващите.</p>
        <ul class="tight">
          <li><b>Недообучение (underfitting):</b> моделът е твърде прост, например права при извита граница. Греши и върху обучаващите, и върху тестовите.</li>
          <li><b>Прекомерно обучение (нагаждане, overfitting):</b> моделът е твърде сложен и „запомня“ шума. Почти не греши върху обучаващите, но греши повече върху тестовите.</li>
        </ul>
        <p>Всеки алгоритъм има параметър, който управлява сложността: k при k-NN, дълбочината при дървото, C и γ при SVM. В следващите страници ги променяйте и сравнявайте двете точности.</p>
      </div>`;
    }
  });

  /* ================= 2.1 Логистична регресия ================= */
  E.page('logreg', {
    title: 'Логистична регресия', st: { C: 1, show: 'test' },
    render(st) {
      const r = fit2d('logreg', { C: Number(st.C) });
      const m = r.model, sp = C.space2d();
      const L = lineRaw(m.coef, m.intercept, 0);
      const ex = [sp.test.find(t => !t.label && t.dmean > 300), sp.test.find(t => t.label && t.smean < 100 && t.dmean === 0)].filter(Boolean);
      const marks = ex.map(t => { const z = m.logit(sp.toZ(t.smean, t.dmean)); return { z, color: t.label ? E.CLR.attack : E.CLR.normal, label: `${t.label ? 'атака' : 'нормален'}: p = ${f(1 / (1 + Math.exp(-z)), 2)}` }; });
      return `
      ${ui.head('II · 2.1', 'Логистична регресия (Logistic Regression)', 'Изчислява претеглена сума от признаците и я превръща във вероятност чрез сигмоидната функция. Въпреки името си е алгоритъм за <b>класификация</b>.')}
      <div class="card">
        <div class="controls">${ui.select('C', [0.001, 0.01, 0.1, 1, 10, 100].map(v => ({ v, l: String(v) })), st.C, 'Регуляризация C')}${showSel(st)}</div>
        <div class="grid-2" style="grid-template-columns:3fr 2fr">
          <div>${ui.chart('Граница на решение', E.chart.boundary({ predict: r.predict, points: points(st.show), xd: sp.xd, yd: sp.yd, xLabel: XL, yLabel: YL, lines: L ? [{ ...L, color: E.C.navy, width: 2.5 }] : [] }))}${spaceNote}</div>
          <div>
            ${accCards(r, true)}
            <p class="small muted" style="margin-top:8px">Разликата между двете точности тук не е прекомерно обучение: моделът има само три параметъра. Тя идва от различния състав на обучаващите и тестовите записи.</p>
            <h3 style="margin-top:16px">Научен модел</h3>
            <div class="formula-box">z = ${f(m.coef[0], 3)}·z(smean) ${m.coef[1] < 0 ? '−' : '+'} ${f(Math.abs(m.coef[1]), 3)}·z(dmean) ${m.intercept < 0 ? '−' : '+'} ${f(Math.abs(m.intercept), 3)}<br>p(атака) = 1 / (1 + e<sup>−z</sup>)</div>
            <p class="small">Границата е там, където p = 0,5, тоест z = 0. Това винаги е <b>права</b> линия (в повече измерения: равнина, хиперравнина). Затова тук моделът не може да отдели атаките с малки пакети, които са и в двата края.</p>
          </div>
        </div>
      </div>
      <div class="card">
        <h3>Как работи</h3>
        <div class="grid-2">
          <div>
            <ol class="tight">
              <li>Претеглена сума: <code>z = w₁x₁ + w₂x₂ + … + b</code>. Теглото w показва колко и в каква посока признакът влияе.</li>
              <li>Сигмоида: <code>p = 1 / (1 + e⁻ᶻ)</code> превръща z (от −∞ до +∞) във вероятност между 0 и 1.</li>
              <li>Решение: атака, ако p > 0,5 (прагът може да се промени, виж 1.5).</li>
              <li>Обучение: теглата се подбират така, че да се минимизира <b>логаритмичната загуба</b> (log-loss), тоест да се дава висока вероятност на верния клас.</li>
            </ol>
          </div>
          <div>${E.chart.sigmoid({ marks })}</div>
        </div>
        <h3 style="margin-top:18px">Регуляризация: защо и как</h3>
        <div class="grid-2">
          <div>
            <p class="small">Без ограничения обучението може да подбере огромни тегла, които обясняват и случайните особености на обучаващите записи. Моделът става „свръхуверен“ и греши върху нови данни. <b>Регуляризацията</b> добавя към целта на обучението наказание за големите тегла. Така моделът предпочита по-прости решения, освен ако данните ясно не изискват друго.</p>
            <div class="formula-box">минимизира се: C · Σ log-загуба(xᵢ, yᵢ)  +  ½ · (w₁² + w₂² + … + wₚ²)<br>                 └ грешки върху данните ┘   └ наказание за големи тегла ┘</div>
            <p class="small" style="margin-top:8px">Това е L2 регуляризация (ridge), използвана по подразбиране в scikit-learn. Свободният член b не се наказва.</p>
          </div>
          <div>
            <ul class="tight small">
              <li><b>C е обратно на силата на регуляризацията</b> (C = 1/λ). Малко C → силно наказание → малки тегла, по-проста граница, по-предпазливи вероятности. Голямо C → слабо наказание → моделът следва обучаващите данни по-точно.</li>
              <li><b>Аналогия:</b> студент, който се готви за изпит. Без регуляризация той наизустява отговорите на задачите от сборника, включително грешките в него. С регуляризация е „принуден“ да запомни само общите правила, които работят и за нови задачи.</li>
              <li><b>Опитайте:</b> C = 0,001 → теглата намаляват и вероятностите се събират около средното. C = 100 → почти няма наказание.</li>
              <li>Регуляризация има и при другите алгоритми: параметърът C при метода на опорните вектори, ограничението на дълбочината при дървото на решенията.</li>
            </ul>
          </div>
        </div>
        ${pc(['Бърза и проста', 'Дава вероятности, а не само клас', 'Теглата се тълкуват: кои признаци „говорят“ за атака', 'Добра отправна точка (baseline)'], ['Само права граница; сложните зависимости изискват ръчно създадени признаци', 'Изисква мащабиране за стабилно обучение', 'Чувствителна към силно корелирани признаци'])}
        ${E.code(`from sklearn.linear_model import LogisticRegression
model = LogisticRegression(C=${st.C})
model.fit(X_train, y_train)
model.coef_, model.intercept_          # теглата w и свободният член b
model.predict_proba(X_test)[:, 1]      # вероятност за атака`)}
      </div>`;
    }
  });

  /* ================= 2.2 k-NN ================= */
  E.page('knn', {
    title: 'k най-близки съседи', st: { k: 15, metric: 'euclidean', show: 'test', query: null },
    render(st) {
      const p = { k: Number(st.k), metric: st.metric };
      const r = fit2d('knn', p), sp = C.space2d();
      let q = null, vote = '';
      if (st.query) {
        const z = sp.toZ(st.query.x, st.query.y);
        const nb = r.model.neighbors(z).map(([, i]) => ({ x: sp.train[i].smean, y: sp.train[i].dmean, label: sp.train[i].label }));
        const a = nb.filter(n => n.label).length;
        q = { x: st.query.x, y: st.query.y, nb, cls: a / nb.length > 0.5 ? 1 : 0 };
        vote = `<div class="note ${q.cls ? '' : 'navy'}" style="margin-top:12px"><b>Избрана точка:</b> smean = ${f(st.query.x, 0)}, dmean = ${f(st.query.y, 0)} байта.<br>От ${nb.length} най-близки съседи <b>${a}</b> са атаки и <b>${nb.length - a}</b> нормален трафик → прогноза: <b>${q.cls ? 'АТАКА' : 'НОРМАЛЕН'}</b> (вероятност за атака ${f(a / nb.length, 2)}).</div>`;
      }
      return `
      ${ui.head('II · 2.2', 'k най-близки съседи (k-Nearest Neighbors, k-NN)', '„Кажи ми кои са съседите ти и ще ти кажа кой си.“ За нов запис се намират k-те най-близки обучаващи записа и класът се решава с гласуване.')}
      <div class="card">
        <div class="controls">${ui.range('k', 1, 51, 2, st.k, 'Брой съседи k')}${ui.select('metric', [{ v: 'euclidean', l: 'Евклидово' }, { v: 'manhattan', l: 'Манхатън' }], st.metric, 'Разстояние')}${showSel(st)}${st.query ? '<button class="btn ghost" data-act="clear">Изчисти точката</button>' : ''}</div>
        <div class="grid-2" style="grid-template-columns:3fr 2fr">
          <div class="chart-click">${ui.chart('Граница на решение · кликнете в диаграмата, за да видите съседите на точка', E.chart.boundary({ predict: r.predict, points: points(st.show), xd: sp.xd, yd: sp.yd, xLabel: XL, yLabel: YL, query: q }))}${spaceNote}</div>
          <div>${accCards(r)}${vote || '<div class="note navy small" style="margin-top:12px">Кликнете в диаграмата: ще се покажат k-те най-близки обучаващи записа и как гласуват.</div>'}
            <p class="small" style="margin-top:12px"><b>Опитайте:</b> k = 1 → границата е накъсана, обучаващата точност е почти 100% (всяка точка е най-близка до себе си), но тестовата пада. Голямо k → границата се изглажда.</p>
          </div>
        </div>
      </div>
      <div class="card">
        <h3>Как работи</h3>
        <ol class="tight">
          <li>„Обучение“: алгоритъмът само <b>запомня</b> обучаващите записи. Затова се нарича „мързелив“ (lazy learning).</li>
          <li>За нов запис се изчисляват разстоянията до всички обучаващи записи.</li>
          <li>Взимат се k-те най-близки и класът се определя с мнозинство. Вероятността е делът на атаките сред съседите.</li>
        </ol>
        <div class="formula-box">Евклидово разстояние: d(a, b) = √( Σ (aⱼ − bⱼ)² )<br>Манхатън: d(a, b) = Σ |aⱼ − bⱼ|</div>
        <p class="small" style="margin-top:10px"><b>Защо е задължително мащабирането:</b> ако един признак е в милиони (байтове), а друг в единици (брояч), разстоянието се определя почти само от първия. Виж <a href="#/x-scaling">3.1</a>.</p>
        ${pc(['Прост, без предположения за формата на границата', 'Естествено се справя с много класове', 'Добавянето на нови данни не изисква повторно обучение'], ['Бавна прогноза: разстояние до всеки обучаващ запис', 'Силно зависи от мащабирането', 'Влошава се при много признаци („проклятието на размерността“)'])}
        ${E.code(`from sklearn.neighbors import KNeighborsClassifier
model = KNeighborsClassifier(n_neighbors=${st.k}, metric="${st.metric}")
model.fit(X_train, y_train)                  # само запомня данните
dist, idx = model.kneighbors(X_test[:1])     # съседите на първия тестов запис`)}
      </div>`;
    },
    after(main, st) {
      const svg = main.querySelector('.chart-click svg');
      if (!svg) return;
      svg.addEventListener('click', ev => {
        const map = JSON.parse(svg.getAttribute('data-map'));
        const rect = svg.getBoundingClientRect();
        const vx = ((ev.clientX - rect.left) * map.w) / rect.width, vy = ((ev.clientY - rect.top) * map.h) / rect.height;
        if (vx < map.l || vx > map.r || vy < map.t || vy > map.b) return;
        const u = map.ud[0] + ((vx - map.l) / (map.r - map.l)) * (map.ud[1] - map.ud[0]);
        const v = map.vd[0] + ((map.b - vy) / (map.b - map.t)) * (map.vd[1] - map.vd[0]);
        st.query = { x: Math.pow(10, u) - 1, y: Math.pow(10, v) - 1 };
        E.refresh();
      });
    },
    actions: { clear(el, st) { st.query = null; E.refresh(); } }
  });

  /* ================= 2.3 Дърво на решенията ================= */
  E.page('tree', {
    title: 'Дърво на решенията', st: { maxDepth: 3, criterion: 'gini', show: 'test' },
    render(st) {
      const r = fit2d('tree', { maxDepth: Number(st.maxDepth), criterion: st.criterion }), sp = C.space2d();
      const root = r.model.root;
      const names = ['smean', 'dmean'];
      const raw = (fi, t) => t * sp.st[fi].s + sp.st[fi].m;
      const label = n => `${names[n.feature]} ≤ ${f(raw(n.feature, n.threshold), 1)}?`;
      const crit = st.criterion === 'entropy' ? 'Ентропия' : 'Джини';
      let rootCalc = '';
      if (root.left) {
        const L = root.left, R = root.right;
        rootCalc = `<div class="formula-box">${crit}(корен) = ${f(root.imp, 4)}; ${root.n} записа (${root.c1} атаки, ${root.c0} нормални)<br>
          ляво (${names[root.feature]} ≤ ${f(raw(root.feature, root.threshold), 1)}): ${L.n} записа, ${crit} = ${f(L.imp, 4)}<br>
          дясно: ${R.n} записа, ${crit} = ${f(R.imp, 4)}<br>
          претеглено след разделянето = ${L.n}/${root.n}·${f(L.imp, 4)} + ${R.n}/${root.n}·${f(R.imp, 4)} = ${f((L.n * L.imp + R.n * R.imp) / root.n, 4)}<br>
          <b>прираст = ${f(root.gain, 4)}</b> — най-големият измежду всички възможни разделяния</div>`;
      }
      return `
      ${ui.head('II · 2.3', 'Дърво на решенията (Decision Tree)', 'Поредица от въпроси „да / не“ за признаците, подредени като дърво. Всеки път от корена до лист е едно правило „ако… и… то…“.')}
      <div class="card">
        <div class="controls">${ui.range('maxDepth', 1, 12, 1, st.maxDepth, 'Максимална дълбочина')}${ui.select('criterion', [{ v: 'gini', l: 'Индекс на Джини' }, { v: 'entropy', l: 'Ентропия' }], st.criterion, 'Критерий')}${showSel(st)}</div>
        <div class="grid-2" style="grid-template-columns:3fr 2fr">
          <div>${ui.chart('Граница на решение', E.chart.boundary({ predict: r.predict, points: points(st.show), xd: sp.xd, yd: sp.yd, xLabel: XL, yLabel: YL }))}${spaceNote}</div>
          <div>${accCards(r)}<div class="grid-2" style="margin-top:12px">${ui.stat('Листа (правила)', r.model.leaves)}${ui.stat('Реална дълбочина', r.model.depth)}</div>
            <p class="small" style="margin-top:12px">Всяко разделяне е по един признак, затова границата е съставена от <b>правоъгълници</b>, успоредни на осите. Увеличете дълбочината: правоъгълниците стават все по-малки и в един момент започват да обграждат отделни точки: прекомерно обучение (нагаждане, overfitting).</p></div>
        </div>
      </div>
      <div class="card">
        <h3>Дървото${r.model.depth > 3 ? ' (първите 3 нива)' : ''}</h3>
        <div style="overflow-x:auto">${E.chart.treeDiagram(root, { maxDepth: Math.min(3, r.model.depth), label, critLabel: crit })}</div>
        <p class="small muted">„да“ води наляво, „не“ надясно. Цветът на възела показва преобладаващия клас.</p>
      </div>
      <div class="card">
        <h3>Как се избира въпросът</h3>
        <p>Във всеки възел алгоритъмът пробва всички признаци и всички прагове и избира разделянето, което прави двете части <b>най-чисти</b> (с най-малко смесени класове).</p>
        <div class="formula-box">Индекс на Джини: G = 1 − p₀² − p₁²   (0 = чист възел, 0,5 = смесен 50/50)<br>Ентропия: H = −p₀·log₂p₀ − p₁·log₂p₁   (0 = чист, 1 = смесен 50/50)<br>Прираст = неопределеност(родител) − претеглена неопределеност(деца)</div>
        <h4 style="margin-top:14px">Изчислението в корена</h4>
        ${rootCalc}
        ${pc(['Лесно за разбиране и обяснение: правилата се четат', 'Не изисква мащабиране', 'Работи с числови и категорийни признаци', 'Много бърза прогноза'], ['Склонно към прекомерно обучение при голяма дълбочина', 'Нестабилно: малка промяна в данните може да даде съвсем различно дърво', 'Стъпаловидна граница'])}
        ${E.code(`from sklearn.tree import DecisionTreeClassifier, plot_tree, export_text
model = DecisionTreeClassifier(max_depth=${st.maxDepth}, criterion="${st.criterion}", random_state=0)
model.fit(X_train, y_train)
print(export_text(model, feature_names=list(X_train.columns)))   # правилата като текст
plot_tree(model, feature_names=X_train.columns, class_names=["нормален", "атака"], filled=True, max_depth=3)`)}
      </div>`;
    }
  });

  /* ================= 2.4 SVM ================= */
  E.page('svm', {
    title: 'Метод на опорните вектори', st: { kernel: 'rbf', C: 1, gm: 1 },
    render(st) {
      const sp = C.space2d();
      // γ = scale за двата стандартизирани признака е 1 / (2 · дисперсия) ≈ 0,5
      let s = 0, s2 = 0; sp.Xtr.forEach(x => { s += x[0] + x[1]; s2 += x[0] * x[0] + x[1] * x[1]; });
      const nn = sp.Xtr.length * 2, gScale = 1 / (2 * (s2 / nn - (s / nn) ** 2));
      const p = { kernel: st.kernel, C: Number(st.C), gamma: gScale * Number(st.gm), maxIter: 150000 };
      const r = fit2d('svm', p), m = r.model;
      const svSet = new Set(m.sv);
      const lines = [];
      if (st.kernel === 'linear' && m.w) {
        [[0, 2.5, null], [1, 1.5, '6 4'], [-1, 1.5, '6 4']].forEach(([c, wd, dash]) => { const L = lineRaw(m.w, m.b, c); if (L) lines.push({ ...L, color: E.C.navy, width: wd, dash }); });
      }
      return `
      ${ui.head('II · 2.4', 'Метод на опорните вектори (Support Vector Machine, SVM)', 'Търси границата с <b>най-голям отстъп</b> (margin): възможно най-широката „улица“ между двата класа. Границата се определя само от записите най-близо до нея, наречени опорни вектори.')}
      <div class="card">
        <div class="controls">${ui.select('kernel', [{ v: 'rbf', l: 'RBF (радиално ядро)' }, { v: 'linear', l: 'Линейно' }], st.kernel, 'Ядро')}${ui.select('C', [0.01, 0.1, 1, 10, 100].map(v => ({ v, l: String(v) })), st.C, 'Регуляризация C')}${st.kernel === 'rbf' ? ui.select('gm', [0.1, 0.3, 1, 3, 10, 30].map(v => ({ v, l: `${v} × scale (γ = ${f(gScale * v, 2)})` })), st.gm, 'γ (gamma)') : ''}</div>
        <div class="grid-2" style="grid-template-columns:3fr 2fr">
          <div>${ui.chart('Граница на решение · показани са обучаващите записи; кръгчетата са опорните вектори', E.chart.boundary({ predict: r.predict, points: points('train', i => svSet.has(i)), xd: sp.xd, yd: sp.yd, xLabel: XL, yLabel: YL, lines }))}${spaceNote}</div>
          <div>${accCards(r)}<div class="grid-2" style="margin-top:12px">${ui.stat('Опорни вектори', f(m.nSV), pct(m.nSV / sp.Xtr.length) + ' от обучаващите')}${ui.stat('В грешна страна или в отстъпа', f(m.atBound), 'α = C')}</div>
            <p class="small" style="margin-top:12px">${st.kernel === 'linear' ? 'Плътната линия е границата, пунктираните са краищата на отстъпа.' : 'Ядрото RBF позволява извита граница. Голямо γ → всяка точка влияе само на най-близката околност → „острови“ около отделни точки: прекомерно обучение (нагаждане, overfitting).'}</p></div>
        </div>
      </div>
      <div class="card">
        <h3>Аналогия: най-широкият път между два квартала</h3>
        <div class="grid-2">
          <div>
            <p>Методът на опорните вектори е по-труден за разбиране от останалите, затова започваме с пример. Представете си карта с два квартала: в единия живеят „нормалните“ потоци, в другия „атаките“. Трябва да прокараме път, който ги разделя.</p>
            <ul class="tight">
              <li>Пътища, които разделят кварталите, има много. Методът избира <b>най-широкия</b>: така и нова къща, построена близо до края на квартала, остава от правилната страна.</li>
              <li>Къщите, които опират в края на пътя, са <b>опорните вектори</b>. Само те определят къде минава пътят. Ако преместим къща навътре в квартала, пътят не се променя.</li>
              <li><b>C</b> показва колко строго забраняваме къщи върху пътя. Малко C: допускаме няколко къщи по средата на пътя, но пътят е широк и спокоен. Голямо C: пътят се извива и стеснява, за да заобиколи всяка къща.</li>
              <li><b>Ядрото</b>: ако кварталите са преплетени и права линия не може да ги раздели, си представете, че картата е лист с точки, а „атаките“ повдигаме нагоре. В три измерения равна плоскост вече ги разделя. Погледната отгоре, тази плоскост изглежда като крива граница върху картата.</li>
            </ul>
          </div>
          <div class="note navy small" style="align-self:start"><b>Връзка с диаграмата горе.</b><br>Опорните вектори са точките с кръгчета. Сменете ядрото на „Линейно“: пунктираните линии са краищата на „пътя“. Намалете C: пътят се разширява и опорните вектори стават повече. Увеличете γ при RBF ядро: границата започва да заобикаля отделни точки.</div>
        </div>
      </div>
      <div class="card">
        <h3>Как работи</h3>
        <ol class="tight">
          <li><b>Отстъп:</b> от всички прави, които разделят класовете, SVM избира тази с най-голямо разстояние до най-близките точки.</li>
          <li><b>Мек отстъп и C:</b> когато класовете се припокриват, някои точки са допуснати в грешната страна срещу „наказание“. Малко C → широк отстъп, повече допуснати грешки, по-прост модел. Голямо C → тесен отстъп, по-малко грешки върху обучаващите, риск от прекомерно обучение. Както при логистичната регресия, C е обратно на силата на регуляризацията (виж 2.1).</li>
          <li><b>Ядро (kernel trick):</b> данните се „повдигат“ в пространство с повече измерения, където може да се разделят с права. В оригиналната равнина това изглежда като крива граница. Ядрото RBF: <code>K(a, b) = e^(−γ‖a − b‖²)</code>.</li>
        </ol>
        <div class="formula-box">Решаваща функция: f(x) = Σ αᵢ·yᵢ·K(xᵢ, x) + b   (сумата е само по опорните вектори, αᵢ > 0)<br>Прогноза: атака, ако f(x) > 0</div>
        ${pc(['Много добра точност при ясно отделени класове', 'Гъвкава граница чрез ядрото', 'Решението зависи само от опорните вектори'], ['Бавно обучение при много записи (времето расте приблизително с квадрата на броя)', 'Изисква мащабиране и подбор на C и γ', 'Не дава директно вероятности; трудна за обяснение'])}
        ${E.code(`from sklearn.svm import SVC
model = SVC(kernel="${st.kernel}", C=${st.C}${st.kernel === 'rbf' ? `, gamma=${st.gm === 1 || st.gm === '1' ? '"scale"' : f(gScale * st.gm, 3).replace(',', '.')}` : ''})
model.fit(X_train, y_train)
model.support_vectors_.shape          # опорните вектори
model.decision_function(X_test)        # f(x); > 0 → атака`)}
      </div>`;
    }
  });

  /* ================= 2.5 Случайна гора ================= */
  E.page('forest', {
    title: 'Случайна гора', st: { nTrees: 25, maxDepth: 'null', show: 'test' },
    render(st) {
      const md = st.maxDepth === 'null' ? null : Number(st.maxDepth);
      const r = fit2d('forest', { nTrees: Number(st.nTrees), maxDepth: md }), sp = C.space2d();
      const m = r.model;
      const mini = [0, 1, 2].filter(t => t < m.nTrees).map(t => ui.chart(`Дърво ${t + 1}`, E.chart.boundary({ predict: (px, py) => { const v = m.treeProba(t, sp.toZ(px, py)); return { cls: v > 0.5 ? 1 : 0, conf: Math.abs(v - 0.5) * 2 }; }, points: [], xd: sp.xd, yd: sp.yd, grid: 45, w: 380, h: 320 })));
      return `
      ${ui.head('II · 2.5', 'Случайна гора (Random Forest)', 'Много дървета, всяко обучено върху малко по-различни данни, гласуват заедно. Отделното дърво греши по свой начин; средното от много дървета е по-стабилно и по-точно.')}
      <div class="card">
        <div class="controls">${ui.select('nTrees', [1, 5, 25, 100].map(v => ({ v, l: String(v) })), st.nTrees, 'Брой дървета')}${ui.select('maxDepth', [{ v: 'null', l: 'без ограничение' }, { v: 3, l: '3' }, { v: 6, l: '6' }, { v: 10, l: '10' }], st.maxDepth, 'Максимална дълбочина')}${showSel(st)}</div>
        <div class="grid-2" style="grid-template-columns:3fr 2fr">
          <div>${ui.chart(`Граница на решение: гласуване на ${m.nTrees} ${m.nTrees === 1 ? 'дърво' : 'дървета'}`, E.chart.boundary({ predict: r.predict, points: points(st.show), xd: sp.xd, yd: sp.yd, xLabel: XL, yLabel: YL }))}${spaceNote}</div>
          <div>${accCards(r)}<p class="small" style="margin-top:12px">Сравнете 1 дърво и 100 дървета: границата на гората е по-гладка и тестовата точност обикновено расте. Обучаващата точност остава много висока, защото всяко дърво е дълбоко.</p></div>
        </div>
      </div>
      <div class="card">
        <h3>Отделните дървета се различават</h3>
        <div class="grid-3">${mini.join('')}</div>
        <p class="small muted">Всяко дърво е обучено върху различна случайна извадка с връщане и при всяко разделяне избира само от случаен подбор на признаците.</p>
      </div>
      <div class="card">
        <h3>Как работи</h3>
        <ol class="tight">
          <li><b>Bootstrap (bagging):</b> за всяко дърво се тегли случайна извадка с връщане от обучаващите записи; някои записи се повтарят, други липсват.</li>
          <li><b>Случаен подбор на признаци:</b> при всяко разделяне дървото избира най-добрия въпрос само измежду случайни √p признака (при p признака). Така дърветата стават различни.</li>
          <li><b>Гласуване:</b> вероятността за атака е средното от вероятностите на всички дървета.</li>
        </ol>
        <div class="formula-box">p(атака | x) = (1/T) · Σₜ pₜ(атака | x)   (T дървета)</div>
        ${pc(['Обикновено най-висока точност „без настройване“', 'Устойчива към прекомерно обучение и шум', 'Не изисква мащабиране', 'Дава важност на признаците'], ['По-бавна от едно дърво и заема повече памет', 'Губи се обяснимостта на отделното дърво', 'При много дървета прогнозата е по-бавна'])}
        ${E.code(`from sklearn.ensemble import RandomForestClassifier
model = RandomForestClassifier(n_estimators=${st.nTrees}, max_depth=${md === null ? 'None' : md}, max_features="sqrt", random_state=0)
model.fit(X_train, y_train)
pd.Series(model.feature_importances_, index=X_train.columns).sort_values(ascending=False).head(10)`)}
      </div>`;
    }
  });
})(window.EDA);
