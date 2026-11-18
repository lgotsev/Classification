(function (E) {
  const C = window.CLS, F = C.FACTS, f = E.fmt;
  E.page('', {
    title: 'Начало',
    render() {
      const n = C.ROWS.length, att = C.ROWS.filter(r => r.label).length;
      return `
      ${E.ui.head('Учебно приложение', 'Класификация: откриване на атаки в мрежовия трафик', 'Пет типични алгоритъма за класификация, приложени към реален набор от данни за мрежова сигурност. Приложението показва както целия процес (от задачата до избора на модел), така и как „мисли“ всеки алгоритъм.')}
      <div class="card">${E.chart.clsProcess()}</div>
      <div class="grid-3 home-cards">
        <a href="#/task"><div class="card home-card"><div class="tag">I · ПРОЦЕСЪТ</div><h3>От задачата до избора на модел</h3><ul class="tight"><li>Задачата и данните</li><li>Капаните: изтичане на информация, повторения</li><li>Подготовка и групово разделяне</li><li>Обучение, оценка, сравнение</li></ul></div></a>
        <a href="#/theory"><div class="card home-card"><div class="tag">II · АЛГОРИТМИТЕ</div><h3>Как „мисли“ всеки алгоритъм</h3><ul class="tight"><li>Логистична регресия (Logistic Regression)</li><li>k най-близки съседи (k-Nearest Neighbors, k-NN)</li><li>Дърво на решенията (Decision Tree)</li><li>Метод на опорните вектори (Support Vector Machine, SVM)</li><li>Случайна гора (Random Forest)</li></ul></div></a>
        <a href="#/x-scaling"><div class="card home-card"><div class="tag">III · ЕКСПЕРИМЕНТИ</div><h3>Какво се случва, ако…</h3><ul class="tight"><li>…не мащабираме признаците</li><li>…оставим признаци, които издават класа</li><li>…моделът стане твърде сложен (прекомерно обучение)</li><li>Тетрадка за Google Colab</li></ul></div></a>
      </div>
      <div class="card">
        <h3>Данните</h3>
        <p><b>UNSW-NB15</b> е набор от записи на мрежови потоци, създаден през 2015 г. в лабораторията Cyber Range на UNSW Canberra. Съдържа нормален трафик и девет вида атаки. Пълният обучаващ набор има ${f(F.n)} записа (${E.pct(F.attacks / F.n)} атаки).</p>
        <p>В браузъра работим със <b>стратифицирана извадка от ${f(n)} записа</b> (${E.pct(att / n)} атаки), за да се обучават моделите за секунди. Тетрадката за Colab може да работи и с целия набор.</p>
        <div class="note navy small"><b>Източник и цитиране:</b> Moustafa, N., & Slay, J. (2015). UNSW-NB15: a comprehensive data set for network intrusion detection systems (UNSW-NB15 network data set). <i>Military Communications and Information Systems Conference (MilCIS)</i>, IEEE.</div>
      </div>`;
    }
  });
})(window.EDA);
