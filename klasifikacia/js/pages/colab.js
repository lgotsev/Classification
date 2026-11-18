/* 3.4 Тетрадка за Google Colab: повтаря процеса със scikit-learn върху същата извадка и същото разделяне */
(function (E) {
  const C = window.CLS, ui = E.ui, f = E.fmt, S = E.state, H = E.cls;
  const DEF = { scaling: 'z', id: false, ttl: false, split: 'split' };

  function dataUrl() {
    const o = location.origin;
    return o && o.startsWith('http') ? `${o}${location.pathname.replace(/[^/]*$/, '')}data/unsw_sample.csv` : '';
  }

  const PY = {
    setup: `import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from sklearn.linear_model import LogisticRegression
from sklearn.neighbors import KNeighborsClassifier
from sklearn.tree import DecisionTreeClassifier
from sklearn.svm import SVC
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (accuracy_score, precision_score, recall_score, f1_score,
                             roc_auc_score, confusion_matrix, RocCurveDisplay)`,
    load: url => `URL = "${url}"
try:
    df = pd.read_csv(URL)
    print("Данните са заредени от сайта.")
except Exception as err:
    print("Неуспешно зареждане от сайта:", err)
    print("Качете файла unsw_sample.csv (папка data на приложението).")
    from google.colab import files
    uploaded = files.upload()
    df = pd.read_csv(next(iter(uploaded)))

print(df.shape)
print(df["label"].value_counts())
# Колони, добавени от приложението:
#   grp    – номер на групата от еднакви записи
#   split  – групово разделяне: 0 = обучаващи, 1 = тестови
#   fold   – част (0–4) за кръстосана проверка, също по групи
#   rsplit – случайно разделяне (за експеримента с изтичане на информация)
df.head()`,
    prep: `TTL = ["sttl", "dttl", "ct_state_ttl"]
EXTRA = ["id", "label", "grp", "split", "fold", "rsplit"]
CAT = ["proto", "service", "state"]
NUM = [c for c in df.select_dtypes("number").columns if c not in EXTRA + TTL]

def prepare(train, test, num=NUM, scaling="z", min_freq=20):
    """Кодиране и мащабиране; всички параметри се изчисляват само от обучаващите данни."""
    def encode(frame, levels):
        out = frame[num].astype(float).copy()
        for c in CAT:
            for v in levels[c]["keep"]:
                out[f"{c}={v}"] = (frame[c] == v).astype(float)
            if levels[c]["rare"]:
                out[f"{c}=друг"] = (~frame[c].isin(levels[c]["keep"])).astype(float)
        return out
    levels = {}
    for c in CAT:
        vc = train[c].value_counts()
        levels[c] = {"keep": sorted(vc[vc >= min_freq].index), "rare": bool((vc < min_freq).any())}
    Xtr, Xte = encode(train, levels), encode(test, levels)
    if scaling == "z":
        mean, std = Xtr[num].mean(), Xtr[num].std(ddof=0).replace(0, 1)
        Xtr[num], Xte[num] = (Xtr[num] - mean) / std, (Xte[num] - mean) / std
    elif scaling == "minmax":
        lo, hi = Xtr[num].min(), Xtr[num].max()
        rng = (hi - lo).replace(0, 1)
        Xtr[num], Xte[num] = (Xtr[num] - lo) / rng, (Xte[num] - lo) / rng
    return Xtr, Xte

train, test = df[df["split"] == 0], df[df["split"] == 1]
X_train, X_test = prepare(train, test)
y_train, y_test = train["label"], test["label"]
print("обучаващи:", X_train.shape, "| тестови:", X_test.shape)`,
    models: `models = {
    "Логистична регресия": LogisticRegression(C=1, max_iter=5000),
    "k-NN": KNeighborsClassifier(n_neighbors=5),
    "Дърво на решенията": DecisionTreeClassifier(max_depth=6, random_state=0),
    "SVM": SVC(C=1, kernel="rbf", gamma="scale"),
    "Случайна гора": RandomForestClassifier(n_estimators=100, random_state=0),
}

def scores(model, X):
    return model.decision_function(X) if isinstance(model, SVC) else model.predict_proba(X)[:, 1]

rows = []
for name, model in models.items():
    model.fit(X_train, y_train)
    pred = model.predict(X_test)
    rows.append({"алгоритъм": name, "точност": accuracy_score(y_test, pred), "прецизност": precision_score(y_test, pred),
                 "чувствителност": recall_score(y_test, pred), "F1": f1_score(y_test, pred), "AUC": roc_auc_score(y_test, scores(model, X_test))})
results = pd.DataFrame(rows).set_index("алгоритъм").round(4)
results`,
    confusion: `best = "Случайна гора"
pred = models[best].predict(X_test)
tn, fp, fn, tp = confusion_matrix(y_test, pred).ravel()
print(f"{best}: открити атаки (TP) {tp} | пропуснати атаки (FN) {fn} | фалшиви тревоги (FP) {fp} | вярно нормални (TN) {tn}")

fig, ax = plt.subplots(figsize=(6, 6))
for name, model in models.items():
    RocCurveDisplay.from_predictions(y_test, scores(model, X_test), name=name, ax=ax)
ax.plot([0, 1], [0, 1], "k--", lw=1)
ax.set_xlabel("Дял фалшиви тревоги (FPR)")
ax.set_ylabel("Дял открити атаки (TPR)")
plt.show()`,
    cv: `cv_rows = []
for name, model in models.items():
    acc = []
    for k in range(5):
        tr, te = df[df["fold"] != k], df[df["fold"] == k]
        Xtr, Xte = prepare(tr, te)
        acc.append(accuracy_score(te["label"], model.fit(Xtr, tr["label"]).predict(Xte)))
    cv_rows.append({"алгоритъм": name, "средно": np.mean(acc), "ст. отклонение": np.std(acc, ddof=1), "по части": np.round(acc, 3)})
pd.DataFrame(cv_rows).set_index("алгоритъм")`,
    scaling: `rows = []
for scaling in ["none", "minmax", "z"]:
    Xtr, Xte = prepare(train, test, scaling=scaling)
    for name in ["Логистична регресия", "k-NN", "SVM", "Дърво на решенията"]:
        rows.append({"мащабиране": scaling, "алгоритъм": name, "точност": models[name].fit(Xtr, y_train).score(Xte, y_test)})
pd.DataFrame(rows).pivot(index="алгоритъм", columns="мащабиране", values="точност").round(3)`,
    leakage: `configs = {
    "коректно": (NUM, "split"),
    "+ TTL": (NUM + TTL, "split"),
    "+ id": (NUM + ["id"], "split"),
    "+ id + TTL": (NUM + TTL + ["id"], "split"),
    "случайно разделяне": (NUM, "rsplit"),
    "всичко грешно": (NUM + TTL + ["id"], "rsplit"),
}
rows = []
for label, (num, split_col) in configs.items():
    tr, te = df[df[split_col] == 0], df[df[split_col] == 1]
    Xtr, Xte = prepare(tr, te, num=num)
    tree = DecisionTreeClassifier(max_depth=6, random_state=0).fit(Xtr, tr["label"])
    knn = KNeighborsClassifier(5).fit(Xtr, tr["label"])
    rows.append({"настройка": label, "дърво на решенията": tree.score(Xte, te["label"]), "k-NN": knn.score(Xte, te["label"])})
pd.DataFrame(rows).set_index("настройка").round(3)`,
    overfit: `depths = range(1, 17)
tr_acc, te_acc = [], []
for d in depths:
    m = DecisionTreeClassifier(max_depth=d, random_state=0).fit(X_train, y_train)
    tr_acc.append(m.score(X_train, y_train)); te_acc.append(m.score(X_test, y_test))
plt.plot(depths, tr_acc, "o-", label="обучаващи")
plt.plot(depths, te_acc, "o-", label="тестови")
plt.xlabel("максимална дълбочина"); plt.ylabel("точност"); plt.legend(); plt.grid(alpha=.3)
plt.show()`,
    full: `# По желание: целият обучаващ набор (175 341 записа). Качете UNSW_NB15_training-set.csv.
# Внимание: SVM е много бавен при толкова записи и е изключен.
from sklearn.model_selection import GroupShuffleSplit
from google.colab import files
up = files.upload()
full = pd.read_csv(next(iter(up)))
features = full.columns.drop(["id", "label", "attack_cat"])
groups = pd.util.hash_pandas_object(full[features], index=False)
tr_idx, te_idx = next(GroupShuffleSplit(n_splits=1, test_size=0.3, random_state=42).split(full, full["label"], groups))
ftr, fte = full.iloc[tr_idx], full.iloc[te_idx]
Xtr, Xte = prepare(ftr, fte)
for name in ["Логистична регресия", "Дърво на решенията", "Случайна гора"]:
    print(name, models[name].fit(Xtr, ftr["label"]).score(Xte, fte["label"]))`
  };

  function notebook(url, expected) {
    const md = t => ({ cell_type: 'markdown', metadata: {}, source: t });
    const code = t => ({ cell_type: 'code', execution_count: null, metadata: {}, outputs: [], source: t });
    const exp = Object.entries(expected).map(([k, v]) => `    "${k}": ${v.toFixed(4)},`).join('\n');
    const cells = [
      md('# Класификация: откриване на мрежови атаки (UNSW-NB15)\n\nТетрадката повтаря процеса от приложението **Класификация** със scikit-learn: същата извадка от 5000 записа, същото групово разделяне и същата подготовка.\n\nИзпълнявайте клетките една по една отгоре надолу (Shift + Enter).\n\n*Данни: Moustafa, N., & Slay, J. (2015). UNSW-NB15: a comprehensive data set for network intrusion detection systems. MilCIS, IEEE.*'),
      code(PY.setup),
      md('## 1. Данните\n\nИзвадката се чете директно от сайта на приложението.'),
      code(PY.load(url || 'https://ВАШИЯТ-САЙТ.vercel.app/data/unsw_sample.csv')),
      md('## 2. Подготовка\n\n* премахват се `id` и TTL признаците (изтичане на информация);\n* категорийните признаци се кодират one-hot, а редките стойности (под 20) стават „друг“;\n* числовите се стандартизират (z-оценка) с параметри **само от обучаващите** данни;\n* разделянето е **групово**: еднаквите записи са изцяло от едната страна.'),
      code(PY.prep),
      md('## 3. Обучение и оценка на петте алгоритъма'),
      code(PY.models),
      md('### Сравнение с приложението\n\nЛогистичната регресия, k-NN, дървото и SVM трябва да дадат същата точност като в браузъра. Случайната гора може да се различава с част от процента, защото случайността се генерира различно.'),
      code(`expected = pd.Series({\n${exp}\n})\ncomparison = pd.DataFrame({"тетрадка": results["точност"], "приложение": expected})\ncomparison["разлика"] = (comparison["тетрадка"] - comparison["приложение"]).round(4)\ncomparison`),
      md('## 4. Матрица на объркване и ROC криви'),
      code(PY.confusion),
      md('## 5. Кръстосана проверка (5 части, по групи)'),
      code(PY.cv),
      md('## 6. Експеримент: мащабиране\n\nk-NN и SVM зависят от мащаба; дървото не се влияе.'),
      code(PY.scaling),
      md('## 7. Експеримент: изтичане на информация\n\n„Подобренията“ при включен `id`, TTL или при случайно разделяне са илюзия.'),
      code(PY.leakage),
      md('## 8. Експеримент: прекомерно обучение (нагаждане, overfitting)'),
      code(PY.overfit),
      md('## 9. По желание: целият набор'),
      code(PY.full)
    ].map(c => ({ ...c, source: c.source.split('\n').map((l, i, a) => (i < a.length - 1 ? l + '\n' : l)) }));
    return JSON.stringify({ cells, metadata: { colab: { provenance: [], name: 'klasifikacia_unsw_nb15.ipynb' }, kernelspec: { name: 'python3', display_name: 'Python 3' }, language_info: { name: 'python' } }, nbformat: 4, nbformat_minor: 0 }, null, 1);
  }
  E.clsNotebook = notebook;

  function download(name, text, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  E.page('colab', {
    title: 'Тетрадка за Colab',
    render() {
      const url = dataUrl();
      return `
      ${ui.head('III · 3.4', 'Тетрадка за Google Colab', 'Същият процес на Python със scikit-learn. Студентите повтарят обученията, сравняват числата с приложението и могат да продължат с целия набор от 175 341 записа.')}
      <div class="card">
        <div class="row"><button class="btn gold" data-act="nb">Свали тетрадката (.ipynb)</button><button class="btn ghost" data-act="csv">Свали извадката (CSV)</button></div>
        <p class="small muted" style="margin-top:10px">Преди свалянето приложението обучава петте модела с настройките по подразбиране (няколко секунди), за да запише очакваните резултати в тетрадката.</p>
        <div class="note navy small"><b>Отваряне в Colab:</b> colab.research.google.com → File → Upload notebook → изберете свалената тетрадка. Изпълнявайте клетките с Shift + Enter.</div>
        ${url ? `<p class="small">Тетрадката ще чете данните от: <code>${E.esc(url)}</code></p>` : '<div class="note warn small">Приложението е отворено от диска, а не от сайт. Тетрадката ще поиска ръчно качване на CSV файла.</div>'}
      </div>
      <div class="card">
        <h3>Съдържание на тетрадката</h3>
        <ol class="tight"><li>Зареждане на извадката</li><li>Подготовка (същата като в 1.3)</li><li>Обучение и оценка на петте алгоритъма + сравнение с приложението</li><li>Матрица на объркване и ROC криви</li><li>Кръстосана проверка</li><li>Експеримент: мащабиране</li><li>Експеримент: изтичане на информация</li><li>Експеримент: прекомерно обучение</li><li>По желание: целият набор</li></ol>
      </div>`;
    },
    actions: {
      nb() {
        const exp = {};
        const names = { logreg: 'Логистична регресия', knn: 'k-NN', tree: 'Дърво на решенията', svm: 'SVM', forest: 'Случайна гора' };
        E.busySteps(E.ALGO_ORDER.map(a => [`Обучава се: ${C.ALGOS[a].name}…`, () => { exp[names[a]] = H.train(a, C.DEFAULTS[a], DEF).test.cm.accuracy; }]),
          () => download('klasifikacia_unsw_nb15.ipynb', notebook(dataUrl(), exp), 'application/x-ipynb+json;charset=utf-8'));
      },
      csv() { download('unsw_sample.csv', window.CLS_CSV, 'text/csv;charset=utf-8'); }
    }
  });
})(window.EDA);
