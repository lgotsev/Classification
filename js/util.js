/* Общи помощни функции: форматиране и екраниране */
window.EDA = window.EDA || {};
(function (E) {
  const nf = {};
  E.fmt = (v, d) => {
    if (v === null || v === undefined || (typeof v === 'number' && Number.isNaN(v))) return '—';
    if (typeof v !== 'number') return String(v);
    if (!Number.isFinite(v)) return v > 0 ? '∞' : '−∞';
    if (d === undefined) d = Math.abs(v) >= 1000 ? 0 : Math.abs(v) >= 100 ? 1 : 2;
    const key = d;
    nf[key] = nf[key] || new Intl.NumberFormat('bg-BG', { minimumFractionDigits: 0, maximumFractionDigits: d });
    const out = nf[key].format(v).replace('-', '−');
    return /^−0([,.]0+)?$/.test(out) ? '0' : out;
  };
  E.pct = (v, d = 1) => E.fmt(v * 100, d) + '%';
  E.esc = s => String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // Показване на стойност от таблица: NULL се вижда като такъв, интервалите – като ␣
  E.cellText = v => {
    if (v === null || v === undefined) return 'NULL';
    if (typeof v === 'string' && v !== v.trim()) return v.replace(/ /g, '␣');
    return typeof v === 'number' ? E.fmt(v, 2) : v;
  };
})(window.EDA);
