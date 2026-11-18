/* I. Процесът: задача, капани, подготовка, обучение, оценка, сравнение */
(function (E) {
  const C = window.CLS, ML = C.ML, F = C.FACTS, ui = E.ui, f = E.fmt, S = E.state;
  const pct = v => E.pct(v, 1);
  const ALGO_ORDER = ['logreg', 'knn', 'tree', 'svm', 'forest'];
  const ALGO_COLOR = { logreg: '#14284b', knn: '#3f7cac', tree: '#4f8a5b', svm: '#a4502e', forest: '#c9a227' };
  E.ALGO_COLOR = ALGO_COLOR; E.ALGO_ORDER = ALGO_ORDER;

  /* ---------- Общи помощни функции (ползват се и от другите страници) ---------- */
  const H = E.cls = {};
  H.prepKey = () => JSON.stringify(S.prep);
  H.paramsText = (algo, p) => ({
    logreg: `C = ${p.C}`,
    knn: `k = ${p.k}`,
    tree: `дълбочина ≤ ${p.maxDepth === null ? '∞' : p.maxDepth}, ${p.criterion === 'entropy' ? 'ентропия' : 'Джини'}`,
    svm: `ядро ${p.kernel === 'linear' ? 'линейно' : 'RBF'}, C = ${p.C}`,
    forest: `${p.nTrees} дървета, дълбочина ≤ ${p.maxDepth === null ? '∞' : p.maxDepth}`
  }[algo]);
  H.train = (algo, params, prepOpts) => {
    const M = C.matrices(prepOpts || S.prep);
    const model = ML.fit(algo, M.Xtr, M.ytr, params);
    const test = ML.evaluate(model, M.Xte, M.yte);
    const nTr = algo === 'knn' ? 1000 : M.Xtr.length; // за k-NN точността върху обучаващите се оценява на 1000 записа
    const train = ML.evaluate(model, M.Xtr.slice(0, nTr), M.ytr.slice(0, nTr));
    return { algo, params: { ...params }, model, test, train, names: M.names, prep: { ...(prepOpts || S.prep) }, prepKey: JSON.stringify(prepOpts || S.prep), M };
  };
  H.cmHTML = cm => `<div class="cm">
      <div class="h"></div><div class="h">Прогноза: нормален</div><div class="h">Прогноза: атака</div>
      <div class="h">Реално: нормален</div><div class="c tn"><b>${cm.tn}</b><span>Вярно отрицателни (TN)<br>нормален, разпознат като нормален</span></div><div class="c fp"><b>${cm.fp}</b><span>Фалшиви тревоги (FP)<br>нормален, обявен за атака</span></div>
      <div class="h">Реално: атака</div><div class="c fn"><b>${cm.fn}</b><span>Пропуснати атаки (FN)<br>атака, обявена за нормален</span></div><div class="c tp"><b>${cm.tp}</b><span>Открити атаки (TP)<br>атака, разпозната като атака</span></div>
    </div>`;
  H.metrics = cm => `<div class="grid-3">
      ${ui.stat('Обща точност (accuracy)', pct(cm.accuracy), '(TP + TN) / всички', 'Дял на верните прогнози. Подвежда при дисбаланс на класовете.')}
      ${ui.stat('Прецизност (precision)', pct(cm.precision), 'TP / (TP + FP)', 'От тревогите, колко са истински атаки.')}
      ${ui.stat('Чувствителност (recall)', pct(cm.recall), 'TP / (TP + FN)', 'От атаките, колко са открити. При откриване на атаки обикновено е най-важната.', 'gold')}
      ${ui.stat('F1', pct(cm.f1), '2·P·R / (P + R)', 'Хармонично средно на прецизност и чувствителност.')}
      ${ui.stat('Дял фалшиви тревоги (FPR)', pct(cm.fpr), 'FP / (FP + TN)', 'Колко от нормалния трафик се обявява за атака. Високият дял „изморява“ операторите.')}
      ${ui.stat('Коефициент на Матюс (MCC)', f(cm.mcc, 3), 'от −1 до 1', 'Обобщена мярка, устойчива на дисбаланс. 0 = като случайно отгатване.')}
    </div>`;
  H.paramControls = (algo, p, prefix = '') => {
    const b = k => prefix + k;
    if (algo === 'logreg') return ui.select(b('C'), [0.01, 0.1, 1, 10, 100].map(v => ({ v, l: String(v) })), p.C, 'Регуляризация C');
    if (algo === 'knn') return ui.range(b('k'), 1, 51, 2, p.k, 'Брой съседи k');
    if (algo === 'tree') return ui.range(b('maxDepth'), 1, 20, 1, p.maxDepth === null ? 20 : p.maxDepth, 'Максимална дълбочина') + ui.select(b('criterion'), [{ v: 'gini', l: 'Индекс на Джини' }, { v: 'entropy', l: 'Ентропия' }], p.criterion, 'Критерий');
    if (algo === 'svm') return ui.select(b('kernel'), [{ v: 'rbf', l: 'RBF (радиално)' }, { v: 'linear', l: 'Линейно' }], p.kernel, 'Ядро') + ui.select(b('C'), [0.1, 1, 10, 100].map(v => ({ v, l: String(v) })), p.C, 'Регуляризация C');
    if (algo === 'forest') return ui.select(b('nTrees'), [10, 50, 100, 200].map(v => ({ v, l: String(v) })), p.nTrees, 'Брой дървета') + ui.select(b('maxDepth'), [{ v: 'null', l: 'без ограничение' }, { v: 5, l: '5' }, { v: 10, l: '10' }, { v: 15, l: '15' }], p.maxDepth === null ? 'null' : p.maxDepth, 'Максимална дълбочина');
    return '';
  };
  H.readParams = (algo, st, prefix = '') => {
    const d = { ...C.DEFAULTS[algo] };
    Object.keys(d).forEach(k => { const v = st[prefix + k]; if (v !== undefined) d[k] = v; });
    ['C', 'k', 'nTrees'].forEach(k => { if (d[k] !== undefined) d[k] = Number(d[k]); });
    if (d.maxDepth === 'null' || d.maxDepth === null) d.maxDepth = null; else if (d.maxDepth !== undefined) d.maxDepth = Number(d.maxDepth);
    return d;
  };
  H.prepNote = () => `<span class="badge">мащабиране: ${{ z: 'z-оценка', minmax: 'min-max', none: 'без' }[S.prep.scaling]}</span> <span class="badge">${S.prep.split === 'split' ? 'групово разделяне' : 'случайно разделяне'}</span>${S.prep.id ? ' <span class="badge gold">с id</span>' : ''}${S.prep.ttl ? ' <span class="badge gold">с TTL</span>' : ''}`;

  /* ================= 1.1 Задачата и данните ================= */
  E.page('task', {
    title: 'Задачата и данните',
    render() {
      const rows = C.ROWS, n = rows.length, att = rows.filter(r => r.label).length;
      const cats = Object.entries(F.attack_cat);
      const groups = {};
      Object.entries(C.FEATURES).forEach(([k, [d, g]]) => { (groups[g] = groups[g] || []).push([k, d]); });
      const GN = { идентификатор: 'Идентификатор', основни: 'Основни характеристики на потока', време: 'Времеви характеристики', съдържание: 'Съдържание на пакетите', броячи: 'Броячи на връзки (последните 100 връзки)', цел: 'Целеви променливи' };
      const preview = rows.slice(0, 8);
      const cols = ['id', 'proto', 'service', 'state', 'dur', 'spkts', 'sbytes', 'dbytes', 'smean', 'dmean', 'attack_cat', 'label'];
      return `
      ${ui.head('I · 1.1', 'Задачата и данните', 'Система за откриване на прониквания (Intrusion Detection System, IDS) следи мрежовия трафик и подава тревога, когато трафикът изглежда аномален (необичаен, зловреден). Задачата е <b>бинарна класификация</b>: по характеристиките на мрежов поток да се прогнозира дали е нормален или подозрителен (зловреден) трафик.')}
      <div class="grid-4">
        ${ui.stat('Записи в извадката', f(n), `от ${f(F.n)} в пълния набор`)}
        ${ui.stat('Признаци', '42', '39 числови + 3 категорийни')}
        ${ui.stat('Атаки', pct(att / n), `${f(att)} записа`, '', 'gold')}
        ${ui.stat('Нормален трафик', pct(1 - att / n), `${f(n - att)} записа`)}
      </div>
      <div class="grid-2" style="margin-top:20px">
        <div class="card">
          <h3>Целева променлива</h3>
          <p><code>label</code>: <b>0</b> = нормален трафик, <b>1</b> = подозрителен (зловреден) трафик. Това е задачата, която решаваме. По-нататък за краткост клас 1 се нарича „атака“.</p>
          <p><code>attack_cat</code> уточнява вида на атаката. Тя <b>не се подава на модела</b>: съдържа отговора и би било измама. Ползва се само за описание.</p>
          <div class="note small">В обучаващия набор атаките са мнозинство (68%), а в реална мрежа са малка част от трафика. Затова общата точност сама не е достатъчна; гледаме и чувствителността, прецизността и дела на фалшивите тревоги.</div>
        </div>
        <div class="card"><h3>Видове атаки (пълен набор)</h3>${E.chart.bar({ labels: cats.map(c => c[0]), values: cats.map(c => c[1]), color: cats.map(c => (c[0] === 'Normal' ? E.CLR.normal : E.CLR.attack)), rotate: true, h: 300, valueFmt: v => f(v) })}</div>
      </div>
      <div class="card">
        <h3>Признаци</h3>
        <p class="small muted">Всеки запис е мрежов поток: обмен на пакети между източник и получател. IP адресите и времената не са включени във версията на набора, с която работим.</p>
        ${Object.entries(groups).map(([g, list]) => `<h4 style="margin:14px 0 6px">${GN[g] || g} <span class="muted small">(${list.length})</span></h4>${ui.table(['Признак', 'Описание'], list.map(([k, d]) => [`<code>${k}</code>`, d]), { cls: 'compact' })}`).join('')}
      </div>
      <div class="card">
        <h3>Първите записи</h3>
        ${ui.table(cols.map(c => ({ l: c, num: !['proto', 'service', 'state', 'attack_cat'].includes(c) })), preview.map(r => cols.map(c => E.esc(typeof r[c] === 'number' ? f(r[c], 4) : r[c]))), { cls: 'compact' })}
        ${E.code(`import pandas as pd
df = pd.read_csv("UNSW_NB15_training-set.csv")
df.shape                         # (175341, 45)
df["label"].value_counts()       # 1: 119341, 0: 56000
df["attack_cat"].value_counts()`)}
      </div>`;
    }
  });

  /* ================= 1.2 Капаните ================= */
  E.page('pitfalls', {
    title: 'Капаните в данните',
    st: {},
    render(st) {
      const q = F.id_quintiles;
      if (!st.single) {
        // Точност на дърво с дълбочина 3, обучено само върху един признак
        const one = feat => {
          const tr = C.ROWS.filter(r => r.split === 0), te = C.ROWS.filter(r => r.split === 1);
          const m = ML.tree(tr.map(r => [r[feat]]), tr.map(r => r.label), { maxDepth: 3 });
          return ML.confusion(te.map(r => r.label), te.map(r => (m.proba([r[feat]]) > 0.5 ? 1 : 0))).accuracy;
        };
        const share = C.ROWS.filter(r => r.label).length / C.ROWS.length;
        st.single = { id: one('id'), sttl: one('sttl'), ct_state_ttl: one('ct_state_ttl'), base: Math.max(share, 1 - share) };
        const rs = C.ROWS.filter(r => r.rsplit === 1), rtr = new Set(C.ROWS.filter(r => r.rsplit === 0).map(r => r.grp));
        const gs = C.ROWS.filter(r => r.split === 1), gtr = new Set(C.ROWS.filter(r => r.split === 0).map(r => r.grp));
        st.overlap = { random: rs.filter(r => rtr.has(r.grp)).length / rs.length, group: gs.filter(r => gtr.has(r.grp)).length / gs.length };
        const seen = new Map(); let rep = 0; C.ROWS.forEach(r => { const k = r.grp + '|' + r.label; if (seen.has(k)) rep++; else seen.set(k, 1); });
        st.rep = rep;
      }
      const s1 = st.single, tt = F.sttl_by_class;
      const ttlVals = ['0', '31', '62', '64', '254', '255'];
      return `
      ${ui.head('I · 1.2', 'Капаните в данните', 'Преди да обучаваме модели, трябва да проверим дали някой признак не „издава“ отговора по начин, който няма да се повтори в реална мрежа. Това се нарича <b>изтичане на информация</b> (data leakage). При UNSW-NB15 има три такива капана.')}
      <div class="card">
        <h2>1. Номерът на записа (<code>id</code>)</h2>
        <p>Записите във файла са подредени: първо нормалният трафик, после атаките. Затова номерът на реда носи информация за класа, макар да е просто пореден номер.</p>
        <div class="grid-2">
          ${ui.chart('Дял на атаките по петини на id (пълен набор)', E.chart.bar({ labels: ['1-ва петина', '2-ра', '3-та', '4-та', '5-та'], values: q, color: E.CLR.attack, yFmt: v => E.fmt(v * 100, 0) + '%', valueFmt: v => E.fmt(v * 100, 0) + '%', h: 260 }))}
          <div>
            ${ui.stat('Дърво, обучено САМО върху id', pct(s1.id), 'тестови данни', `Без никаква информация за трафика. За сравнение: ако винаги казваме „атака“, точността е ${pct(s1.base)}.`, 'gold')}
            <div class="note small" style="margin-top:12px"><b>Решение:</b> <code>id</code> се премахва. Той е само идентификатор (виж „нерелевантни признаци“ в EDA). В реална мрежа номерът на потока не казва нищо за атаката.</div>
          </div>
        </div>
      </div>
      <div class="card">
        <h2>2. Време на живот на пакетите (TTL)</h2>
        <p><code>sttl</code> е броят „скокове“, които пакетът може да направи. В тестовата мрежа нормалният трафик и атаките са генерирани от различни машини с различни настройки на операционната система. Затова някои стойности се срещат само при единия клас.</p>
        <div class="grid-2">
          <div>${ui.table(['sttl', { l: 'Нормален', num: true }, { l: 'Атака', num: true }], ttlVals.map(v => [`<b>${v}</b>`, f(tt['0'][v] || 0), f(tt['1'][v] || 0)]), { cls: 'compact' })}
          <p class="small muted" style="margin-top:6px">Пълен набор. <b>sttl = 31</b> се среща само при нормален трафик (39 455 пъти, при атаките нито веднъж).</p></div>
          <div>
            ${ui.stat('Дърво само върху sttl', pct(s1.sttl), 'тестови данни', '', 'gold')}
            <div style="margin-top:12px">${ui.stat('Дърво само върху ct_state_ttl', pct(s1.ct_state_ttl), 'тестови данни', 'Броячът е изчислен от TTL и носи същия артефакт.')}</div>
          </div>
        </div>
        <div class="note small"><b>Решение:</b> <code>sttl</code>, <code>dttl</code> и <code>ct_state_ttl</code> се изключват. В друга мрежа стойностите на TTL ще са различни и моделът, научил „31 = нормален“, ще греши. Ефектът им се вижда в <a href="#/x-leakage">3.2 Изтичане на информация</a>.</div>
      </div>
      <div class="card">
        <h2>3. Повторени записи</h2>
        <p>В пълния набор <b>${f(F.repeats)} записа (${pct(F.repeats / F.n)})</b> имат точно същите признаци и същия клас като друг запис. Това не са грешки при въвеждане: атакуващите инструменти изпращат едни и същи пакети многократно, например стотици еднакви DNS заявки. В извадката повторенията са ${f(st.rep)}.</p>
        <p>Проблемът е при разделянето на обучаващи и тестови данни. Ако разделим <b>случайно</b>, един запис може да е в обучаващите, а точното му копие в тестовите. Тогава моделът не прогнозира, а „разпознава“ вече видян запис.</p>
        <div class="grid-3">
          ${ui.stat('Случайно разделяне', pct(st.overlap.random), 'от тестовите записи са и в обучаващите', 'Резултатът е надценен.')}
          ${ui.stat('Групово разделяне', pct(st.overlap.group), 'от тестовите записи са и в обучаващите', 'Еднаквите записи са изцяло от едната страна.', 'gold')}
          ${ui.stat('Противоречиви групи (пълен набор)', f(F.conflict_groups), 'еднакви признаци, различен клас', 'Нито един модел не може да ги различи, затова 100% точност е невъзможна.')}
        </div>
        <div class="note small"><b>Решение: групово разделяне.</b> Всички еднакви записи образуват група, а групата отива <b>цялата</b> или в обучаващите, или в тестовите данни. Повторенията остават (те са част от реалния трафик), но не изкривяват оценката. Сравнението с числа е в <a href="#/x-leakage">3.2</a>.</div>
        ${E.code(`from sklearn.model_selection import GroupShuffleSplit
features = df.columns.drop(["id", "label", "attack_cat"])
groups = pd.util.hash_pandas_object(df[features], index=False)   # еднакви записи = една група
train_idx, test_idx = next(GroupShuffleSplit(n_splits=1, test_size=0.3, random_state=42).split(df, df["label"], groups))`)}
      </div>`;
    }
  });

  /* ================= 1.3 Подготовка ================= */
  E.page('prep', {
    title: 'Подготовка', st: S.prep,
    render(st) {
      const M = C.matrices(S.prep);
      const P = M.prep;
      const show = ['dur', 'sbytes', 'dbytes', 'smean', 'dmean', 'ct_srv_src'];
      const ex = M.train.slice(0, 3);
      const trA = M.ytr.filter(Boolean).length / M.ytr.length, teA = M.yte.filter(Boolean).length / M.yte.length;
      const sc = S.prep.scaling;
      return `
      ${ui.head('I · 1.3', 'Подготовка на данните', 'Четири стъпки, които превръщат таблицата в числова матрица, подходяща за всички алгоритми. Настройките тук важат за обучението, оценката и сравнението.')}
      <div class="card">
        <div class="controls">
          ${ui.select('scaling', [{ v: 'z', l: 'Стандартизация (z-оценка)' }, { v: 'minmax', l: 'Нормализация min-max' }, { v: 'none', l: 'Без мащабиране' }], st.scaling, 'Мащабиране')}
          ${ui.select('split', [{ v: 'split', l: 'Групово (препоръчано)' }, { v: 'rsplit', l: 'Случайно' }], st.split, 'Разделяне')}
          ${ui.check('id', st.id, 'Включи id')}
          ${ui.check('ttl', st.ttl, 'Включи TTL признаците')}
        </div>
        ${st.id || st.ttl || st.split !== 'split' || st.scaling !== 'z' ? '<div class="note warn small">Избрани са настройки, различни от препоръчаните. Използвайте ги съзнателно, за експеримент.</div>' : '<div class="note navy small">Използват се препоръчаните настройки.</div>'}
      </div>
      <div class="card">
        <div class="step"><div class="step-num">1</div><div>
          <h2>Избор на признаци</h2>
          <p>Премахват се <code>id</code> и TTL признаците (виж 1.2), както и <code>attack_cat</code>, която съдържа отговора. Остават <b>${C.NUM.length + (st.ttl ? 3 : 0) + (st.id ? 1 : 0)} числови</b> и <b>3 категорийни</b> признака.</p>
        </div></div>
      </div>
      <div class="card">
        <div class="step"><div class="step-num">2</div><div>
          <h2>Разделяне на обучаващи и тестови данни</h2>
          <p>Моделът се обучава върху едната част и се оценява върху другата, която не е виждал. ${st.split === 'split' ? 'Разделянето е <b>групово</b>: еднаквите записи са изцяло в едната част.' : '<b>Случайно разделяне:</b> повторените записи може да са и в двете части.'}</p>
          <div class="grid-3">
            ${ui.stat('Обучаващи', f(M.train.length), pct(M.train.length / C.ROWS.length), `атаки: ${pct(trA)}`)}
            ${ui.stat('Тестови', f(M.test.length), pct(M.test.length / C.ROWS.length), `атаки: ${pct(teA)}`, 'gold')}
            ${ui.stat('Защо е важно', 'без „надникване“', '', 'Всички параметри на подготовката (средни, категории) се изчисляват само от обучаващите данни. Иначе информация от теста „изтича“ в модела.')}
          </div>
        </div></div>
      </div>
      <div class="card">
        <div class="step"><div class="step-num">3</div><div>
          <h2>Кодиране на категорийните признаци (one-hot)</h2>
          <p>Всяка честа стойност става отделна колона 0/1. Стойностите, срещани под 20 пъти в обучаващите данни, се обединяват в „друг“. Иначе <code>proto</code> би дал над 100 колони, повечето почти празни.</p>
          ${ui.table(['Признак', 'Колони след кодирането'], C.CAT.map(c => [`<code>${c}</code>`, P.levels[c].keep.map(v => `<code>${E.esc(v)}</code>`).join(' ') + (P.levels[c].rare ? ' <code>друг</code>' : '')]), { cls: 'compact' })}
          <p class="small muted" style="margin-top:8px">Общо признаци след кодирането: <b>${M.names.length}</b>.</p>
        </div></div>
      </div>
      <div class="card">
        <div class="step"><div class="step-num">4</div><div>
          <h2>Мащабиране</h2>
          <p>${sc === 'z' ? 'Стандартизация: <code>z = (x − средно) / стандартно отклонение</code>. След нея всеки признак има средно 0 и стандартно отклонение 1, така че байтовете (до милиони) и броячите (до 60) стават сравними.' : sc === 'minmax' ? 'Нормализация min-max: <code>x′ = (x − min) / (max − min)</code>, в интервала [0; 1]. Чувствителна е към екстремни стойности: няколко огромни потока свиват всички останали към 0.' : 'Без мащабиране: признаците остават в оригиналните си единици. Признаците с големи стойности (байтове) ще доминират разстоянията.'}</p>
          ${ui.table(['Признак', { l: 'Средно', num: true }, { l: 'Ст. отклонение', num: true }, { l: 'Мин.', num: true }, { l: 'Макс.', num: true }].concat(ex.map((_, i) => ({ l: `Запис ${i + 1}: преди → след`, num: true }))),
            show.map(k => { const j = C.NUM.indexOf(k); const s = P.stats[j]; return [`<code>${k}</code>`, f(s.mean), f(s.std), f(s.min), f(s.max)].concat(ex.map((r, i) => `${f(r[k], 3)} → <b>${f(M.Xtr[i][j], 3)}</b>`)); }), { cls: 'compact' })}
          <p class="small muted" style="margin-top:8px">Дървото и случайната гора не се влияят от мащабирането. Логистичната регресия, k-NN и SVM зависят силно от него → <a href="#/x-scaling">3.1</a>.</p>
        </div></div>
        ${E.code(`num = [c for c in df.select_dtypes("number").columns if c not in ("id", "label", "sttl", "dttl", "ct_state_ttl")]
cat = ["proto", "service", "state"]
train, test = df.iloc[train_idx], df.iloc[test_idx]

# One-hot: редките стойности (под 20 в обучаващите) → „друг“
for c in cat:
    keep = train[c].value_counts()[lambda s: s >= 20].index
    train[c] = train[c].where(train[c].isin(keep), "друг")
    test[c] = test[c].where(test[c].isin(keep), "друг")
X_train = pd.get_dummies(train[num + cat], columns=cat)
X_test = pd.get_dummies(test[num + cat], columns=cat).reindex(columns=X_train.columns, fill_value=0)

from sklearn.preprocessing import StandardScaler
scaler = StandardScaler().fit(X_train[num])        # параметрите – само от обучаващите
X_train[num] = scaler.transform(X_train[num])
X_test[num] = scaler.transform(X_test[num])`)}
      </div>`;
    }
  });

  /* ================= 1.4 Обучение ================= */
  E.page('train', {
    title: 'Обучение', st: { algo: 'logreg' },
    render(st) {
      const algo = st.algo;
      const p = H.readParams(algo, st, algo + '.');
      const T = S.trained[algo];
      const stale = T && (T.prepKey !== H.prepKey() || JSON.stringify(T.params) !== JSON.stringify(p));
      let result = '<p class="muted">Изберете алгоритъм и параметри и натиснете „Обучи“.</p>';
      if (T) {
        const m = T.model, nm = T.names;
        let info = '';
        if (algo === 'logreg') {
          const idx = m.coef.map((v, i) => i).sort((a, b) => Math.abs(m.coef[b]) - Math.abs(m.coef[a])).slice(0, 15);
          info = `<h3>Най-влиятелни признаци (коефициенти)</h3><p class="small muted">Положителен коефициент: признакът увеличава вероятността за атака. Отрицателен: я намалява. Признаците са стандартизирани, затова коефициентите са сравними. Свободен член b = ${f(m.intercept, 3)}.</p>${E.chart.hbar({ labels: idx.map(i => nm[i]), values: idx.map(i => m.coef[i]) })}`;
        } else if (algo === 'tree' || algo === 'forest') {
          const imp = m.importances, idx = imp.map((v, i) => i).sort((a, b) => imp[b] - imp[a]).slice(0, 15);
          info = `<h3>Важност на признаците</h3><p class="small muted">Колко общо намалява неопределеността (индекса на Джини) при разделянията по признака, нормирано до 1.</p>${E.chart.hbar({ labels: idx.map(i => nm[i]), values: idx.map(i => imp[i]), pos: algo === 'forest' ? E.C.gold : '#4f8a5b', fmt: v => E.pct(v, 1) })}`;
          if (algo === 'tree') info = `<div class="grid-3">${ui.stat('Дълбочина', m.depth)}${ui.stat('Листа (правила)', m.leaves)}${ui.stat('Записи в корена', f(m.root.n))}</div>` + info + `<p class="small"><a href="#/tree">→ Дървото, нарисувано, в 2.3</a></p>`;
        } else if (algo === 'svm') {
          info = `<div class="grid-3">${ui.stat('Опорни вектори', f(m.nSV), pct(m.nSV / T.M.Xtr.length) + ' от обучаващите', 'Само тези записи определят границата.')}${ui.stat('На границата C', f(m.atBound), 'грешно класифицирани или в отстъпа')}${ui.stat('γ (gamma = scale)', f(m.gamma, 4), '1 / (брой признаци · дисперсия)')}</div>`;
        } else if (algo === 'knn') {
          info = `<div class="note navy small">k-NN е „мързелив“ алгоритъм: при обучението само запомня ${f(T.M.Xtr.length)} обучаващи записа. Цялата работа е при прогнозата: за всеки нов запис се изчисляват разстоянията до всички обучаващи. Затова прогнозата е бавна (${f(T.test.cm.predictMs / 1000, 2)} s за ${f(T.M.Xte.length)} записа). Точността върху обучаващите е оценена върху първите 1000 от тях.</div>`;
        }
        result = `
          <div class="row" style="justify-content:space-between"><h2 style="margin:0">${C.ALGOS[algo].name}</h2><span>${H.prepNote()} <span class="badge">${E.esc(H.paramsText(algo, T.params))}</span></span></div>
          ${stale ? '<div class="note warn small">Параметрите или подготовката са променени след обучението. Натиснете „Обучи“ отново.</div>' : ''}
          <div class="grid-4" style="margin-top:12px">
            ${ui.stat('Точност върху обучаващите', pct(T.train.cm.accuracy))}
            ${ui.stat('Точност върху тестовите', pct(T.test.cm.accuracy), '', '', 'gold')}
            ${ui.stat('Време за обучение', f(m.trainMs / 1000, 2) + ' s')}
            ${ui.stat('Време за прогноза', f(T.test.cm.predictMs / 1000, 2) + ' s', `${f(T.M.Xte.length)} записа`)}
          </div>
          ${T.train.cm.accuracy - T.test.cm.accuracy > 0.04 ? `<div class="note small">Точността върху обучаващите е с ${f((T.train.cm.accuracy - T.test.cm.accuracy) * 100, 1)} пункта по-висока от тестовата: моделът е запомнил част от обучаващите данни: прекомерно обучение (нагаждане, overfitting). Виж <a href="#/x-overfit">3.3</a>.</div>` : ''}
          ${info}
          <div class="row" style="margin-top:14px"><a class="btn" href="#/eval">Към оценката →</a></div>`;
      }
      return `
      ${ui.head('I · 1.4', 'Обучение', 'Алгоритъмът търси правило, което по признаците на потока отличава атаките от нормалния трафик. Различните алгоритми търсят различни видове правила. Теорията е в Част II.')}
      <div class="card">
        <div class="controls">
          ${ui.select('algo', ALGO_ORDER.map(a => ({ v: a, l: C.ALGOS[a].name })), algo, 'Алгоритъм')}
          ${H.paramControls(algo, p, algo + '.')}
          <button class="btn gold" data-act="train">Обучи</button>
        </div>
        <p class="small muted">Подготовка: ${H.prepNote()} · <a href="#/prep">промени</a></p>
      </div>
      <div class="card">${result}</div>
      <div class="card">${E.code(`from sklearn.linear_model import LogisticRegression
from sklearn.neighbors import KNeighborsClassifier
from sklearn.tree import DecisionTreeClassifier
from sklearn.svm import SVC
from sklearn.ensemble import RandomForestClassifier

model = ${{ logreg: `LogisticRegression(C=${p.C})`, knn: `KNeighborsClassifier(n_neighbors=${p.k})`, tree: `DecisionTreeClassifier(max_depth=${p.maxDepth}, criterion="${p.criterion}")`, svm: `SVC(kernel="${p.kernel}", C=${p.C}, gamma="scale")`, forest: `RandomForestClassifier(n_estimators=${p.nTrees}, max_depth=${p.maxDepth === null ? 'None' : p.maxDepth})` }[algo]}
model.fit(X_train, y_train)
print("обучаващи:", model.score(X_train, y_train), "тестови:", model.score(X_test, y_test))`)}</div>`;
    },
    actions: {
      train(el, st) {
        const algo = st.algo, p = H.readParams(algo, st, algo + '.');
        E.busy(`Обучава се: ${C.ALGOS[algo].name}…`, () => { S.trained[algo] = H.train(algo, p); S.last = algo; });
      }
    }
  });

  /* ================= 1.5 Оценка ================= */
  E.page('eval', {
    title: 'Оценка', st: { thr: {} },
    render(st) {
      if (!S.last) { S.trained.logreg = H.train('logreg', C.DEFAULTS.logreg); S.last = 'logreg'; }
      const algos = ALGO_ORDER.filter(a => S.trained[a]);
      if (!st.algo || !S.trained[st.algo]) st.algo = S.last;
      const T = S.trained[st.algo];
      const isSvm = st.algo === 'svm';
      const thr = st.thr[st.algo] !== undefined ? st.thr[st.algo] : T.model.threshold0;
      const pred = T.test.scores.map(s => (s > thr ? 1 : 0));
      const cm = ML.confusion(T.M.yte, pred);
      const marker = { fpr: cm.fpr, tpr: cm.recall };
      const rng = isSvm ? [-3, 3, 0.1] : [0.05, 0.95, 0.05];
      return `
      ${ui.head('I · 1.5', 'Оценка на модела', 'Колко добре моделът се справя с тестовите данни, които не е виждал при обучението. Една метрика не е достатъчна: важно е и <b>какви</b> грешки прави.')}
      <div class="card">
        <div class="controls">
          ${ui.select('algo', algos.map(a => ({ v: a, l: C.ALGOS[a].name })), st.algo, 'Обучен модел')}
          <label class="control">${isSvm ? 'Праг върху решаващата функция' : 'Праг на вероятността за „атака“'}: <span class="counter" data-out="thrv">${f(thr, 2)}</span><input type="range" data-act-range="thr" min="${rng[0]}" max="${rng[1]}" step="${rng[2]}" value="${thr}"></label>
          <button class="btn ghost" data-act="reset">Праг по подразбиране (${isSvm ? '0' : '0,5'})</button>
        </div>
        <p class="small muted">${E.esc(C.ALGOS[st.algo].name)} · ${E.esc(H.paramsText(st.algo, T.params))} · ${H.prepNote()} · ${algos.length < 5 ? '<a href="#/train">обучете и други модели</a>' : 'обучени са всички модели'}</p>
      </div>
      <div class="grid-2">
        <div class="card"><h3>Матрица на объркване</h3>${H.cmHTML(cm)}<p class="small muted" style="margin-top:10px">${f(cm.n)} тестови записа.</p></div>
        <div class="card"><h3>ROC крива</h3>${E.chart.roc({ curves: [{ label: C.ALGOS[st.algo].short, color: ALGO_COLOR[st.algo], points: T.test.roc.points, auc: T.test.roc.auc }], marker })}
          <p class="small muted">Всяка точка е един праг. Златната точка е текущият праг. AUC е площта под кривата: 1 = съвършено разделяне, 0,5 = случайно отгатване.</p></div>
      </div>
      <div class="card"><h3>Метрики при текущия праг</h3>${H.metrics(cm)}
        <div class="note small" style="margin-top:14px"><b>Компромисът.</b> По-нисък праг → моделът вдига тревога по-лесно: <b>открива повече атаки</b> (чувствителността расте), но дава <b>повече фалшиви тревоги</b>. По-висок праг → обратното. В системите за сигурност пропусната атака обикновено струва повече от фалшива тревога, затова прагът често се избира под 0,5. Плъзнете прага и наблюдавайте матрицата.</div>
        ${E.code(`from sklearn.metrics import confusion_matrix, classification_report, roc_auc_score, RocCurveDisplay
proba = model.${isSvm ? 'decision_function(X_test)' : 'predict_proba(X_test)[:, 1]'}
y_pred = (proba > ${f(thr, 2).replace(',', '.')}).astype(int)
print(confusion_matrix(y_test, y_pred))
print(classification_report(y_test, y_pred, target_names=["нормален", "атака"]))
print("AUC:", roc_auc_score(y_test, proba))
RocCurveDisplay.from_predictions(y_test, proba)`)}
      </div>`;
    },
    after(main, st) {
      const r = main.querySelector('[data-act-range="thr"]');
      if (!r) return;
      r.addEventListener('input', () => { main.querySelector('[data-out="thrv"]').textContent = f(Number(r.value), 2); });
      r.addEventListener('change', () => { st.thr[st.algo] = Number(r.value); E.refresh(); });
    },
    actions: { reset(el, st) { delete st.thr[st.algo]; E.refresh(); } }
  });

  /* ================= 1.6 Сравнение ================= */
  E.page('compare', {
    title: 'Сравнение', st: {},
    render(st) {
      const done = ALGO_ORDER.filter(a => S.trained[a] && S.trained[a].prepKey === H.prepKey());
      const rows = done.map(a => { const T = S.trained[a], cm = T.test.cm; return { a, cm, auc: T.test.roc.auc, tr: T.model.trainMs, pr: cm.predictMs, trainAcc: T.train.cm.accuracy }; });
      const best = k => Math.max(...rows.map(r => (k === 'auc' ? r.auc : r.cm[k])));
      const cell = (r, k, v) => `<td class="num ${rows.length > 1 && v === best(k) ? 'best' : ''}">${k === 'auc' ? f(v, 3) : pct(v)}</td>`;
      const cv = st.cv && st.cv.key === H.prepKey() ? st.cv : null;
      return `
      ${ui.head('I · 1.6', 'Сравнение на алгоритмите', 'Петте алгоритъма върху едни и същи данни и едно и също разделяне. Моделите се обучават с параметрите, избрани в 1.4 (или с тези по подразбиране).')}
      <div class="card">
        <div class="row"><button class="btn gold" data-act="all">Обучи всички пет</button><button class="btn ghost" data-act="cv">Кръстосана проверка (5 части)</button><span class="small muted">${H.prepNote()}</span></div>
        <p class="small muted" style="margin-top:8px">Обучението на всички отнема няколко секунди; кръстосаната проверка около 20–30 s.</p>
      </div>
      ${rows.length ? `<div class="card">
        <h3>Резултати върху тестовите данни (${f(C.matrices(S.prep).Xte.length)} записа)</h3>
        <div class="table-wrap"><table class="data compact"><thead><tr><th>Алгоритъм</th><th>Параметри</th><th class="num">Точност</th><th class="num">Прецизност</th><th class="num">Чувствителност</th><th class="num">F1</th><th class="num">AUC</th><th class="num">Обучаващи</th><th class="num">Обучение</th><th class="num">Прогноза</th></tr></thead><tbody>
        ${rows.map(r => `<tr><td><i class="pill-dot" style="background:${ALGO_COLOR[r.a]}"></i><b>${C.ALGOS[r.a].name}</b></td><td class="small">${E.esc(H.paramsText(r.a, S.trained[r.a].params))}</td>${cell(r, 'accuracy', r.cm.accuracy)}${cell(r, 'precision', r.cm.precision)}${cell(r, 'recall', r.cm.recall)}${cell(r, 'f1', r.cm.f1)}${cell(r, 'auc', r.auc)}<td class="num">${pct(r.trainAcc)}</td><td class="num">${f(r.tr / 1000, 2)} s</td><td class="num">${f(r.pr / 1000, 2)} s</td></tr>`).join('')}
        </tbody></table></div>
        <p class="small muted" style="margin-top:6px">Златно: най-добрият резултат в колоната. „Обучаващи“ е точността върху обучаващите данни; голяма разлика спрямо тестовата означава прекомерно обучение (нагаждане, overfitting).</p>
      </div>
      <div class="grid-2">
        <div class="card"><h3>ROC криви</h3>${E.chart.roc({ curves: rows.map(r => ({ label: C.ALGOS[r.a].short, color: ALGO_COLOR[r.a], points: S.trained[r.a].test.roc.points, auc: r.auc })) })}</div>
        <div class="card"><h3>F1 и чувствителност</h3>${E.chart.bar({ labels: rows.map(r => C.ALGOS[r.a].short), series: [{ values: rows.map(r => r.cm.f1), color: E.C.navy2, label: 'F1' }, { values: rows.map(r => r.cm.recall), color: E.C.gold, label: 'Чувствителност' }], yFmt: v => E.fmt(v * 100, 0) + '%', valueFmt: v => E.fmt(v * 100, 1), h: 320 })}</div>
      </div>` : '<div class="card"><p class="muted">Натиснете „Обучи всички пет“.</p></div>'}
      ${cv ? `<div class="card">
        <h3>Кръстосана проверка: 5 части, групово разделяне</h3>
        <p class="small">Данните се делят на 5 части (без еднакви записи в различни части). Всеки модел се обучава 5 пъти: всеки път върху 4 части и се проверява върху петата. Резултатът е средното и разсейването. Така оценката не зависи от едно случайно разделяне.</p>
        ${ui.table(['Алгоритъм', { l: 'Точност: средно ± ст. откл.', num: true }, { l: 'F1', num: true }, { l: 'AUC', num: true }, { l: 'По части (точност)', num: true }], ALGO_ORDER.map(a => { const v = cv.res[a]; const ms = k => `${pct(E.S.mean(v[k]))} ± ${f(E.S.std(v[k]) * 100, 1)}`; return [`<i class="pill-dot" style="background:${ALGO_COLOR[a]}"></i><b>${C.ALGOS[a].name}</b>`, ms('acc'), ms('f1'), `${f(E.S.mean(v.auc), 3)} ± ${f(E.S.std(v.auc), 3)}`, v.acc.map(x => f(x * 100, 1)).join(' · ')]; }), { cls: 'compact' })}
        <div class="note small">Ако разликата между два алгоритъма е по-малка от разсейването им, не можем уверено да кажем, че единият е по-добър.</div>
      </div>` : ''}
      <div class="card">
        <h3>Как да изберем модел</h3>
        <ul class="tight">
          <li><b>Качество:</b> F1 и чувствителността са по-важни от общата точност, когато пропусната атака е скъпа.</li>
          <li><b>Скорост:</b> системата за откриване трябва да оценява хиляди потоци в секунда. k-NN е бавен при прогнозата, дървото е най-бързо.</li>
          <li><b>Обяснимост:</b> дървото и логистичната регресия показват защо е взето решението. Случайната гора и SVM са по-трудни за обяснение.</li>
          <li><b>Устойчивост:</b> проверете с кръстосана проверка, преди да изберете.</li>
        </ul>
        ${E.code(`from sklearn.model_selection import StratifiedGroupKFold, cross_validate
cv = StratifiedGroupKFold(n_splits=5, shuffle=True, random_state=42)
for name, model in models.items():
    r = cross_validate(model, X, y, groups=groups, cv=cv, scoring=["accuracy", "f1", "roc_auc"])
    print(name, r["test_accuracy"].mean(), r["test_accuracy"].std())`)}
      </div>`;
    },
    actions: {
      all() {
        const tp = E.pages.train.st;
        E.busySteps(ALGO_ORDER.map(a => [`Обучава се: ${C.ALGOS[a].name}…`, () => { S.trained[a] = H.train(a, H.readParams(a, tp, a + '.')); S.last = a; }]));
      },
      cv(el, st) {
        const tp = E.pages.train.st;
        const res = {};
        const steps = [];
        ALGO_ORDER.forEach(a => {
          res[a] = { acc: [], f1: [], auc: [] };
          for (let k = 0; k < 5; k++) steps.push([`Кръстосана проверка: ${C.ALGOS[a].name}, част ${k + 1} от 5…`, () => {
            const T = H.train(a, H.readParams(a, tp, a + '.'), { ...S.prep, testFold: k });
            res[a].acc.push(T.test.cm.accuracy); res[a].f1.push(T.test.cm.f1); res[a].auc.push(T.test.roc.auc);
          }]);
        });
        E.busySteps(steps, () => { st.cv = { key: H.prepKey(), res }; });
      }
    }
  });
})(window.EDA);
