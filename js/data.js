/* Данните: разчитане на извадката и описание на признаците */
(function (C) {
  const lines = window.CLS_CSV.trim().split('\n');
  const head = lines[0].split(',');
  const STR = ['proto', 'service', 'state', 'attack_cat'];
  C.ROWS = lines.slice(1).map(line => {
    const v = line.split(',');
    const r = {};
    head.forEach((h, i) => { r[h] = STR.includes(h) ? v[i] : Number(v[i]); });
    return r;
  });
  C.FACTS = window.CLS_FACTS;
  C.CAT = ['proto', 'service', 'state'];
  C.LEAK_ID = ['id'];
  C.LEAK_TTL = ['sttl', 'dttl', 'ct_state_ttl'];
  C.ALL_NUM = head.filter(h => !STR.includes(h) && !['id', 'label', 'grp', 'split', 'fold', 'rsplit'].includes(h));
  C.NUM = C.ALL_NUM.filter(h => !C.LEAK_TTL.includes(h));

  // Описание на признаците (по документацията на UNSW-NB15)
  C.FEATURES = {
    id: ['Номер на записа', 'идентификатор'],
    dur: ['Продължителност на потока (s)', 'основни'],
    proto: ['Протокол (tcp, udp, …)', 'основни'],
    service: ['Услуга (http, dns, ftp, …; „-“ = неопределена)', 'основни'],
    state: ['Състояние на връзката (FIN, INT, CON, …)', 'основни'],
    spkts: ['Пакети от източника към получателя', 'основни'],
    dpkts: ['Пакети от получателя към източника', 'основни'],
    sbytes: ['Байтове от източника към получателя', 'основни'],
    dbytes: ['Байтове от получателя към източника', 'основни'],
    rate: ['Пакети в секунда', 'основни'],
    sttl: ['Време на живот (TTL) от източника', 'основни'],
    dttl: ['Време на живот (TTL) от получателя', 'основни'],
    sload: ['Натоварване от източника (бита/s)', 'основни'],
    dload: ['Натоварване от получателя (бита/s)', 'основни'],
    sloss: ['Повторно изпратени или загубени пакети от източника', 'основни'],
    dloss: ['Повторно изпратени или загубени пакети от получателя', 'основни'],
    sinpkt: ['Средно време между пакетите от източника (ms)', 'време'],
    dinpkt: ['Средно време между пакетите от получателя (ms)', 'време'],
    sjit: ['Колебание на закъснението (jitter) от източника (ms)', 'време'],
    djit: ['Колебание на закъснението (jitter) от получателя (ms)', 'време'],
    swin: ['TCP прозорец на източника', 'съдържание'],
    dwin: ['TCP прозорец на получателя', 'съдържание'],
    stcpb: ['Начален TCP пореден номер на източника', 'съдържание'],
    dtcpb: ['Начален TCP пореден номер на получателя', 'съдържание'],
    tcprtt: ['Време за установяване на TCP връзка (s)', 'време'],
    synack: ['Време между SYN и SYN-ACK (s)', 'време'],
    ackdat: ['Време между SYN-ACK и ACK (s)', 'време'],
    smean: ['Средна големина на пакет от източника (байта)', 'съдържание'],
    dmean: ['Средна големина на пакет от получателя (байта)', 'съдържание'],
    trans_depth: ['Дълбочина на HTTP заявките във връзката', 'съдържание'],
    response_body_len: ['Големина на HTTP отговора (байта)', 'съдържание'],
    ct_srv_src: ['Връзки със същата услуга и източник (последни 100)', 'броячи'],
    ct_state_ttl: ['Брояч по състояние и диапазон на TTL', 'броячи'],
    ct_dst_ltm: ['Връзки към същия получател (последни 100)', 'броячи'],
    ct_src_dport_ltm: ['Връзки от същия източник към същия порт', 'броячи'],
    ct_dst_sport_ltm: ['Връзки към същия получател от същия порт', 'броячи'],
    ct_dst_src_ltm: ['Връзки между същия източник и получател', 'броячи'],
    is_ftp_login: ['FTP сесия с потребител и парола (0/1)', 'броячи'],
    ct_ftp_cmd: ['Брой FTP команди в сесията', 'броячи'],
    ct_flw_http_mthd: ['Брой HTTP заявки GET/POST', 'броячи'],
    ct_src_ltm: ['Връзки от същия източник (последни 100)', 'броячи'],
    ct_srv_dst: ['Връзки със същата услуга и получател (последни 100)', 'броячи'],
    is_sm_ips_ports: ['Еднакви IP адреси и портове на двете страни (0/1)', 'броячи'],
    attack_cat: ['Категория на атаката', 'цел'],
    label: ['Клас: 0 = нормален трафик, 1 = подозрителен (зловреден) трафик', 'цел']
  };
  C.ALGOS = {
    logreg: { name: 'Логистична регресия', short: 'Лог. регресия' },
    knn: { name: 'k най-близки съседи (k-NN)', short: 'k-NN' },
    tree: { name: 'Дърво на решенията', short: 'Дърво на решенията' },
    svm: { name: 'Метод на опорните вектори (SVM)', short: 'SVM' },
    forest: { name: 'Случайна гора', short: 'Случайна гора' }
  };
  C.DEFAULTS = {
    logreg: { C: 1 },
    knn: { k: 5 },
    tree: { maxDepth: 6, criterion: 'gini' },
    svm: { C: 1, kernel: 'rbf', gamma: 'scale' },
    forest: { nTrees: 100, maxDepth: null }
  };

  // Подготвени матрици според избраните настройки (кеш)
  const cache = new Map();
  C.matrices = (opts = {}) => {
    const o = { split: 'split', scaling: 'z', id: false, ttl: false, testFold: null, ...opts };
    const key = JSON.stringify(o);
    if (cache.has(key)) return cache.get(key);
    const num = C.NUM.concat(o.ttl ? C.LEAK_TTL : []).concat(o.id ? ['id'] : []);
    const isTest = o.testFold !== null ? r => r.fold === o.testFold : r => r[o.split] === 1;
    const train = C.ROWS.filter(r => !isTest(r)), test = C.ROWS.filter(isTest);
    const P = C.ML.prep(train, { num, cat: C.CAT, scaling: o.scaling, minFreq: 20 });
    const res = { opts: o, train, test, names: P.names, prep: P, Xtr: P.transform(train), Xte: P.transform(test), ytr: train.map(r => r.label), yte: test.map(r => r.label) };
    cache.set(key, res);
    return res;
  };
})(window.CLS);

/* Равнина на два признака за теорията: средна големина на пакет от източника и от получателя */
(function (C) {
  let sp = null;
  C.space2d = () => {
    if (sp) return sp;
    const fx = 'smean', fy = 'dmean';
    const train = C.ROWS.filter(r => r.split === 0), test = C.ROWS.filter(r => r.split === 1);
    const st = [fx, fy].map(k => { const v = train.map(r => r[k]); const m = v.reduce((a, b) => a + b, 0) / v.length; const s = Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length); return { m, s }; });
    const toZ = (x, y) => [(x - st[0].m) / st[0].s, (y - st[1].m) / st[1].s];
    const fromZ = (a, b) => [a * st[0].s + st[0].m, b * st[1].s + st[1].m];
    const maxX = Math.max(...C.ROWS.map(r => r[fx])), maxY = Math.max(...C.ROWS.map(r => r[fy]));
    sp = {
      fx, fy, st, toZ, fromZ, train, test,
      Xtr: train.map(r => toZ(r[fx], r[fy])), ytr: train.map(r => r.label),
      Xte: test.map(r => toZ(r[fx], r[fy])), yte: test.map(r => r.label),
      xd: [0, Math.ceil(maxX / 100) * 100 + 20], yd: [0, Math.ceil(maxY / 100) * 100 + 20]
    };
    return sp;
  };
})(window.CLS);
