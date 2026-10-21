(function () {
  const $ = (id) => document.getElementById(id);
  const e = WV.esc;
  const VOTED_KEY = 'wv_voted_v2';
  const byOrder = (a, b) => (Number(a.order) || 0) - (Number(b.order) || 0);

  let d = null;
  let timer = null;

  // Сетка подстраивается под количество карточек: 1–5 — один ровный ряд
  // (карточки плавно уменьшаются), больше 5 — обычная сетка в несколько рядов.
  function applyCols(el, n) {
    if (!el) return;
    if (n >= 1 && n <= 5) el.dataset.cols = String(n);
    else el.removeAttribute('data-cols');
  }

  function renderHeader() {
    document.title = `${d.settings.title} ${d.settings.subtitle}`;
    $('subtitle').textContent = `${d.settings.city} · ${d.settings.subtitle}`;
  }

  function renderCountdown() {
    clearInterval(timer);
    const cd = $('countdown');
    const target = new Date(d.settings.eventDate);
    if (!d.settings.showCountdown || isNaN(target)) {
      cd.hidden = true;
      return;
    }
    cd.hidden = false;
    const pad = (n) => String(n).padStart(2, '0');
    const box = (v, l) => `<div class="cd-box"><b>${v}</b><span>${l}</span></div>`;
    const tick = () => {
      const diff = target - new Date();
      if (diff <= 0) {
        cd.innerHTML = '<div class="cd-box"><b>🎤</b><span>Шоу идёт!</span></div>';
        clearInterval(timer);
        return;
      }
      cd.innerHTML =
        box(Math.floor(diff / 864e5), 'дней') +
        box(pad(Math.floor((diff % 864e5) / 36e5)), 'часов') +
        box(pad(Math.floor((diff % 36e5) / 6e4)), 'минут') +
        box(pad(Math.floor((diff % 6e4) / 1e3)), 'секунд');
    };
    tick();
    timer = setInterval(tick, 1000);
  }

  function renderNews() {
    const news = d.news
      .filter((n) => n.published)
      .sort((a, b) => (b.pinned - a.pinned) || String(b.date).localeCompare(String(a.date)));
    $('news-list').innerHTML = news.length
      ? news.map((n) => `
          <article class="card news-card">
            ${n.image ? `<img src="${e(n.image)}" alt="">` : ''}
            <div class="date">${n.pinned ? '<span class="pin">📌 ЗАКРЕПЛЕНО</span> · ' : ''}${e(n.date)}</div>
            <h3 style="font-size:1.05rem">${e(n.title)}</h3>
            <p>${e(n.text)}</p>
          </article>`).join('')
      : '<div class="empty">Новостей пока нет</div>';
  }

  function renderArtists() {
    const parts = [...d.participants].sort(byOrder);
    applyCols($('participants-list'), parts.length);
    $('participants-list').innerHTML = parts.length
      ? parts.map((p) => `
          <div class="artist-card">
            <div class="artist-inner">
              <div class="face front">
                ${p.photo ? `<img src="${e(p.photo)}" alt="${e(p.artist)}" style="width:100px;height:100px;object-fit:cover;border-radius:50%;margin-bottom:12px;border:3px solid var(--yellow)">` : `<div class="flag">${e(p.flag)}</div>`}
                <div class="artist-name">${e(p.artist)}</div>
                <div class="song">${e(p.song)}</div>
              </div>
              <div class="face back">
                <div class="flag" style="font-size:2rem">${e(p.country)}</div>
                <div class="artist-name">${e(p.artist)}</div>
                <div>${e(p.song)}</div>
              </div>
            </div>
          </div>`).join('')
      : '<div class="empty">Участники скоро будут объявлены</div>';
  }

  function renderVoting() {
    const parts = [...d.participants].sort(byOrder);
    const open = d.settings.votingOpen;
    const hasVoted = localStorage.getItem(VOTED_KEY) === '1';
    const total = Object.values(d.votes).reduce((a, b) => a + b, 0);

    applyCols($('vote-list'), parts.length);

    const status = $('vote-status');
    status.textContent = open ? 'Голосование открыто' : 'Голосование закрыто';
    status.className = 'vote-status ' + (open ? 'open' : 'closed');
    $('voted-note').hidden = !hasVoted;

    $('vote-list').innerHTML = parts.length
      ? parts.map((p) => {
          const v = d.votes[p.id] || 0;
          const pct = total ? Math.round((v * 100) / total) : 0;
          return `
            <div class="card vote-card">
              <div class="vote-top">
                ${p.photo ? `<img src="${e(p.photo)}" style="width:48px;height:48px;object-fit:cover;border-radius:50%;border:2px solid var(--yellow)">` : `<div class="flag">${e(p.flag)}</div>`}
                <div><b>${e(p.artist)}</b><span class="muted small">${e(p.song)}</span></div>
              </div>
              ${d.settings.showResults ? `
                <div class="bar"><span style="width:${pct}%"></span></div>
                <div class="vote-meta"><span>${v} гол.</span><span>${pct}%</span></div>` : ''}
              <button data-vote="${e(p.id)}" ${!open || hasVoted ? 'disabled' : ''}>
                ${hasVoted ? 'Голос отдан' : open ? 'Голосовать' : 'Закрыто'}
              </button>
            </div>`;
        }).join('')
      : '<div class="empty">Варианты для голосования появятся позже</div>';

    $('vote-list').querySelectorAll('[data-vote]').forEach((btn) => {
      btn.onclick = () => vote(btn.dataset.vote, btn);
    });
  }

  async function vote(id, btn) {
    if (localStorage.getItem(VOTED_KEY) === '1') return;
    btn.disabled = true;
    try {
      await WV.vote(id);
      localStorage.setItem(VOTED_KEY, '1');
      await refresh();
    } catch (err) {
      alert('Голос не засчитан: ' + (err.message || err));
      btn.disabled = false;
    }
  }

  function renderSchedule() {
    const items = [...d.schedule].sort((a, b) =>
      (Number(a.order) || 0) - (Number(b.order) || 0) || String(a.time).localeCompare(String(b.time)));
    $('schedule-list').innerHTML = items.length
      ? items.map((s) => `
          <div class="tl-item">
            <div class="tl-time">${e(s.time)}</div>
            <div>
              <div class="tl-title">${e(s.title)}</div>
              <div class="tl-place">${e(s.place)}</div>
            </div>
          </div>`).join('')
      : '<div class="empty">Программа будет опубликована позже</div>';
  }

  function renderAll() {
    renderHeader();
    renderCountdown();
    renderNews();
    renderArtists();
    renderVoting();
    renderSchedule();
    $('rules-text').textContent = d.rules;
  }

  // Фоновая синхронизация: раз в REFRESH_MS тихо проверяем данные.
  // Если админ остановил/возобновил голосование (или что-то ещё поменялось) —
  // сайт обновится сам, без перезагрузки страницы.
  const REFRESH_MS = Number(window.WV_REFRESH_MS) || 30000;
  let lastJson = null;

  function applyData(nd) {
    const nj = JSON.stringify(nd);
    if (nj === lastJson) return;
    d = nd;
    lastJson = nj;
    renderAll();
  }

  async function refresh() {
    try {
      applyData(await WV.load());
    } catch (err) {
      console.error(err);
      if (!document.getElementById('load-error')) {
        document.querySelector('.hero').insertAdjacentHTML('afterend',
          `<p id="load-error" class="empty" style="margin:20px auto;max-width:700px">
            Не удалось загрузить данные: ${e(err.message || err)}</p>`);
      }
    }
  }

  refresh();
  setInterval(() => {
    WV.load().then(applyData).catch(() => {}); // фоновый сбой молча, ждём следующего тика
  }, REFRESH_MS);
})();
