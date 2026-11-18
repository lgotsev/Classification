/* III. Експерименти: мащабиране, изтичане на информация, прекомерно обучение */
(function (E) {
  const C = window.CLS, ML = C.ML, ui = E.ui, f = E.fmt, S = E.state, H = E.cls;
  const pct = v => E.pct(v, 1);

  /* ================= 3.1 Мащабиране ================= */
  E.page('x-scaling', {
    title: 'Мащабиране', st: {},
    render(st) {
      const SC = [['none', 'Без мащабиране'], ['minmax', 'Min-max'], ['z', 'Z-оценка']];
      const AL = ['logreg', 'knn', 'svm', 'tree'];
      const res = st.res;
      return `
      ${ui.head('III · 3.1', 'Експеримент: мащабиране', 'Едни и същи алгоритми, едни и същи данни, три начина на мащабиране на числовите признаци. Кои алгоритми се влияят и защо?')}
      <div class="card"><div class="row"><button class="btn gold" data-act="run">Изпълни експеримента</button><span class="small muted">12 обучения, около 10–20 s.</span></div></div>
      ${res ? `<div class="card">
        <h3>Точност върху тестовите данни</h3>
        ${ui.table(['Алгоритъм'].concat(SC.map(s => ({ l: s[1], num: true }))), AL.map(a => [`<i class="pill-dot" style="background:${E.ALGO_COLOR[a]}"></i><b>${C.ALGOS[a].name}</b>`].concat(SC.map(([s]) => { const v = res[a][s]; const best = Math.max(...SC.map(([t]) => res[a][t].acc)); return `<span class="${v.acc === best && a !== 'tree' ? 'counter' : ''}">${pct(v.acc)}</span>${v.note ? ` <span class="small muted">${v.note}</span>` : ''}`; }))))}
        <div class="grid-2" style="margin-top:16px">
          ${ui.chart('Точност по метод на мащабиране', E.chart.bar({ labels: AL.map(a => C.ALGOS[a].short), series: SC.map(([s, l], i) => ({ values: AL.map(a => res[a][s].acc), color: [E.C.axis, E.C.gold, E.C.navy2][i], label: l })), yFmt: v => E.fmt(v * 100, 0) + '%', valueFmt: v => E.fmt(v * 100, 0), h: 320 }))}
          <div class="note">
            <b>Какво се вижда</b>
            <ul class="tight">
              <li><b>Логистична регресия:</b> scikit-learn по подразбиране (метод lbfgs) не успява да се сходи без мащабиране: дава около 85% и предупреждение <code>ConvergenceWarning</code>. Методът на Нютон в приложението се сходи и достига почти същата точност като със z-оценка. Изводът: при логистичната регресия мащабирането е преди всичко условие за стабилно и бързо обучение.</li>
              <li><b>k-NN и SVM</b> сравняват записите по разстояние. Без мащабиране разстоянието се определя от признаците с огромни стойности (натоварване до милиарди бита в секунда, байтове до милиони), а останалите практически не участват.</li>
              <li><b>Min-max</b> помага, но няколко гигантски потока „свиват“ всички останали стойности близо до 0.</li>
              <li><b>Z-оценката</b> дава най-добри резултати за алгоритмите, базирани на разстояния и тегла.</li>
              <li><b>Дървото не се влияе изобщо:</b> то само сравнява „по-голямо или по-малко от прага“, а мащабирането не променя реда на стойностите.</li>
            </ul>
          </div>
        </div>
      </div>` : ''}
      <div class="card">${E.code(`from sklearn.preprocessing import MinMaxScaler, StandardScaler
for name, scaler in [("без", None), ("min-max", MinMaxScaler()), ("z-оценка", StandardScaler())]:
    Xtr, Xte = X_train.copy(), X_test.copy()
    if scaler is not None:
        Xtr[num] = scaler.fit_transform(Xtr[num]); Xte[num] = scaler.transform(Xte[num])
    for mname, model in models.items():
        print(name, mname, model.fit(Xtr, y_train).score(Xte, y_test))`)}</div>`;
    },
    actions: {
      run(el, st) {
        const res = {};
        const steps = [];
        ['logreg', 'knn', 'svm', 'tree'].forEach(a => {
          res[a] = {};
          ['none', 'minmax', 'z'].forEach(s => steps.push([`${C.ALGOS[a].name}, ${s === 'none' ? 'без мащабиране' : s === 'minmax' ? 'min-max' : 'z-оценка'}…`, () => {
            const params = { ...C.DEFAULTS[a] };
            if (a === 'svm' && s === 'none') params.maxIter = 20000;
            const T = H.train(a, params, { ...S.prep, id: false, ttl: false, split: 'split', scaling: s });
            res[a][s] = { acc: T.test.cm.accuracy, note: a === 'svm' && s === 'none' && T.model.iter >= 20000 ? '(не се сходи)' : '' };
          }]));
        });
        E.busySteps(steps, () => { st.res = res; });
      }
    }
  });

  /* ================= 3.2 Изтичане на информация ================= */
  E.page('x-leakage', {
    title: 'Изтичане на информация', st: {},
    render(st) {
      const CF = [
        ['Коректно: без id и TTL, групово разделяне', { id: false, ttl: false, split: 'split' }],
        ['+ TTL признаците', { id: false, ttl: true, split: 'split' }],
        ['+ id', { id: true, ttl: false, split: 'split' }],
        ['+ id + TTL', { id: true, ttl: true, split: 'split' }],
        ['Случайно разделяне (повторенията и в двете части)', { id: false, ttl: false, split: 'rsplit' }],
        ['Всички грешки заедно: id + TTL + случайно разделяне', { id: true, ttl: true, split: 'rsplit' }]
      ];
      const AL = ['tree', 'knn', 'forest'];
      const res = st.res;
      return `
      ${ui.head('III · 3.2', 'Експеримент: изтичане на информация', 'Какво се случва с оценката, ако оставим признаците, които „издават“ класа, или разделим данните случайно? Резултатът изглежда по-добър, но е <b>илюзия</b>: в реална мрежа моделът ще се справя по-зле.')}
      <div class="card"><div class="row"><button class="btn gold" data-act="run">Изпълни експеримента</button><span class="small muted">18 обучения, около 20–30 s. Случайната гора е с 50 дървета.</span></div></div>
      ${res ? `<div class="card">
        <h3>Точност върху тестовите данни</h3>
        ${ui.table(['Настройка'].concat(AL.map(a => ({ l: C.ALGOS[a].short, num: true }))), CF.map(([l], i) => [i === 0 ? `<b>${l}</b>` : l].concat(AL.map(a => { const v = res[i][a], b = res[0][a]; const d = (v - b) * 100; return `${pct(v)}${i ? ` <span class="small" style="color:${d > 0 ? 'var(--c-missing)' : 'var(--muted)'}">${d > 0 ? '+' : ''}${f(d, 1)}</span>` : ''}`; }))))}
        <div class="note warn" style="margin-top:14px"><b>Червените „подобрения“ не са истински.</b> Те идват от информация, която моделът няма да има при реална работа: поредния номер на записа, особеностите на тестовата мрежа (TTL) или вече видени копия на тестовите записи. Затова в 1.3 тези признаци се премахват, а разделянето е групово.</div>
        <p class="small"><b>Защо случайното разделяне тук почти не променя резултата?</b> В извадката от 5000 записа повторенията са малко: само ${f(E.pages.pitfalls.st.overlap ? E.pages.pitfalls.st.overlap.random * 100 : 15, 0)}% от тестовите записи имат копие сред обучаващите. В пълния набор повторенията са 42% и при случайно разделяне 37% от тестовите записи са „вече видени“; там k-NN и случайната гора губят около 2,5 пункта, когато разделянето стане коректно.</p>
      </div>` : ''}`;
    },
    actions: {
      run(el, st) {
        const CF = [{ id: false, ttl: false, split: 'split' }, { id: false, ttl: true, split: 'split' }, { id: true, ttl: false, split: 'split' }, { id: true, ttl: true, split: 'split' }, { id: false, ttl: false, split: 'rsplit' }, { id: true, ttl: true, split: 'rsplit' }];
        const res = CF.map(() => ({}));
        const steps = [];
        CF.forEach((cf, i) => ['tree', 'knn', 'forest'].forEach(a => steps.push([`Настройка ${i + 1} от 6: ${C.ALGOS[a].name}…`, () => {
          const params = a === 'forest' ? { nTrees: 50, maxDepth: null } : { ...C.DEFAULTS[a] };
          res[i][a] = H.train(a, params, { ...cf, scaling: 'z' }).test.cm.accuracy;
        }])));
        E.busySteps(steps, () => { st.res = res; });
      }
    }
  });

  /* ================= 3.3 Прекомерно обучение ================= */
  E.page('x-overfit', {
    title: 'Прекомерно обучение', st: {},
    render(st) {
      const res = st.res;
      let body = '';
      if (res) {
        const bestD = res.depth.reduce((b, d, i) => (res.dTe[i] > res.dTe[b] ? i : b), 0);
        const plateau = res.depth.findIndex(d => res.dTe[d - 1] >= res.dTe[bestD] - 0.005);
        const bestK = res.ks.reduce((b, d, i) => (res.kTe[i] > res.kTe[b] ? i : b), 0);
        body = `<div class="grid-2">
          <div class="card"><h3>Дърво на решенията: точност според дълбочината</h3>${E.chart.line({ x: res.depth, series: [{ label: 'Обучаващи', color: E.C.navy2, values: res.dTr }, { label: 'Тестови', color: E.C.gold, values: res.dTe }], xLabel: 'Максимална дълбочина', yLabel: 'Точност', yFmt: v => E.fmt(v * 100, 0) + '%', mark: res.depth[plateau] })}
            <p class="small">Тестовата точност спира да расте след дълбочина около <b>${res.depth[plateau]}</b> (${pct(res.dTe[plateau])}; най-високата е ${pct(res.dTe[bestD])} при дълбочина ${res.depth[bestD]}). Обучаващата продължава към 100% и разликата между двете расте: дървото започва да запомня отделни записи. По-дълбокото дърво не носи реална полза, а е по-сложно и по-трудно за обяснение.</p></div>
          <div class="card"><h3>k-NN: точност според k</h3>${E.chart.line({ x: res.ks, series: [{ label: 'Обучаващи', color: E.C.navy2, values: res.kTr }, { label: 'Тестови', color: E.C.gold, values: res.kTe }], xLabel: 'Брой съседи k', yLabel: 'Точност', yFmt: v => E.fmt(v * 100, 0) + '%', mark: res.ks[bestK] })}
            <p class="small">При k = 1 моделът е най-сложен: обучаващата точност е почти 100%, защото всеки запис е най-близък до себе си. Голямо k изглажда границата, докато моделът стане твърде прост. Най-добро k = <b>${res.ks[bestK]}</b>.</p></div>
        </div>
        <div class="card"><div class="note"><b>Правилото:</b> сложността на модела се избира по <b>тестовите</b> (по-добре: по валидационните) резултати, никога по обучаващите. На практика параметрите се подбират с кръстосана проверка, например <code>GridSearchCV</code>, а тестовите данни се ползват само веднъж, накрая.</div>
        ${E.code(`from sklearn.model_selection import GridSearchCV, StratifiedGroupKFold
search = GridSearchCV(DecisionTreeClassifier(random_state=0), {"max_depth": range(1, 17)},
                      cv=StratifiedGroupKFold(5, shuffle=True, random_state=42), scoring="f1")
search.fit(X_train, y_train, groups=groups_train)
search.best_params_`)}</div>`;
      }
      return `
      ${ui.head('III · 3.3', 'Експеримент: прекомерно обучение', 'Как се променят обучаващата и тестовата точност, когато моделът става по-сложен? Прекомерното обучение (нагаждане, overfitting) е, когато моделът запомня обучаващите данни, вместо да научи общото правило. Всички признаци, подготовка от 1.3.')}
      <div class="card"><div class="row"><button class="btn gold" data-act="run">Изпълни експеримента</button><span class="small muted">16 дървета на решенията и 13 стойности на k, около 5–10 s.</span></div></div>
      ${body}`;
    },
    actions: {
      run(el, st) {
        const res = { depth: [], dTr: [], dTe: [], ks: [1, 3, 5, 7, 9, 15, 21, 31, 41, 51, 71, 101, 151], kTr: [], kTe: [] };
        const M = C.matrices(S.prep);
        const steps = [];
        for (let d = 1; d <= 16; d++) steps.push([`Дърво на решенията с дълбочина ${d}…`, () => {
          const m = ML.tree(M.Xtr, M.ytr, { maxDepth: d });
          const acc = (X, y) => X.reduce((s, x, i) => s + ((m.proba(x) > 0.5 ? 1 : 0) === y[i] ? 1 : 0), 0) / X.length;
          res.depth.push(d); res.dTr.push(acc(M.Xtr, M.ytr)); res.dTe.push(acc(M.Xte, M.yte));
        }]);
        steps.push(['k-NN: търсене на съседите на тестовите записи…', () => {
          const K = Math.max(...res.ks);
          const m = ML.knn(M.Xtr, M.ytr, { k: K });
          const sub = 800;
          const nbTe = M.Xte.map(x => m.neighbors(x).map(([, i]) => M.ytr[i]));
          const nbTr = M.Xtr.slice(0, sub).map(x => m.neighbors(x).map(([, i]) => M.ytr[i]));
          const acc = (nb, y, k) => nb.reduce((s, l, i) => { const a = l.slice(0, k).reduce((u, v) => u + v, 0); return s + ((a / k > 0.5 ? 1 : 0) === y[i] ? 1 : 0); }, 0) / nb.length;
          res.ks.forEach(k => { res.kTe.push(acc(nbTe, M.yte, k)); res.kTr.push(acc(nbTr, M.ytr, k)); });
        }]);
        E.busySteps(steps, () => { st.res = res; });
      }
    }
  });
})(window.EDA);
