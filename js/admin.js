(function () {
  const $ = (sel) => document.querySelector(sel);
  const e = WV.esc;
  let d = null;
  let current = 'news';

  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => t.classList.remove('show'), 1600);
  }

  async function save(msg = 'Сохранено') {
    try {
      await WV.saveData(d);
      toast(msg);
      return true;
    } catch (err) {
      alert('Ошибка сохранения: ' + (err.message || err));
      return false;
    }
  }

  // ---------- Универсальный список с формой ----------
  function crud(key, label, fields, sortFn, rowTitle) {
    return {
      html() {
        const items = [...d[key]].sort(sortFn);
        const inputs = fields.map((f) => {
          if (f.type === 'area') return `<textarea name="${f.name}" rows="4" placeholder="${f.ph}"></textarea>`;
          if (f.type === 'check') return `<label class="check"><input type="checkbox" name="${f.name}"> ${f.ph}</label>`;
          return `<input name="${f.name}" type="${f.type || 'text'}" placeholder="${f.ph}" ${f.req ? 'required' : ''}>`;
        }).join('');

        const rows = items.length
          ? items.map((it) => `
              <div class="item">
                <div>${rowTitle(it)}</div>
                <div class="btns">
                  <button class="sm" data-act="edit" data-id="${e(it.id)}">✏️</button>
                  <button class="sm danger" data-act="del" data-id="${e(it.id)}">🗑</button>
                </div>
              </div>`).join('')
          : '<p class="muted">Пока пусто</p>';

        return `
          <h2>${label}</h2>
          <form id="cf" class="card form">
            <input type="hidden" name="_id">
            ${inputs}
            <div class="row">
              <button type="submit">Сохранить</button>
              <button type="button" class="ghost" id="cClear">Очистить форму</button>
            </div>
          </form>
          <div class="list">${rows}</div>`;
      },
      bind() {
        const f = $('#cf');
        f.onsubmit = (ev) => {
          ev.preventDefault();
          const item = { id: f.elements._id.value || WV.uid() };
          fields.forEach((x) => {
            const el = f.elements[x.name];
            item[x.name] = x.type === 'check' ? el.checked
              : x.type === 'number' ? Number(el.value) || 0
              : el.value.trim();
          });
          const i = d[key].findIndex((x) => x.id === item.id);
          if (i >= 0) d[key][i] = item; else d[key].push(item);
          save();
          render(current);
        };
        $('#cClear').onclick = () => render(current);
      },
      act(a, id) {
        if (a === 'edit') {
          const it = d[key].find((x) => x.id === id);
          if (!it) return;
          const f = $('#cf');
          f.elements._id.value = it.id;
          fields.forEach((x) => {
            const el = f.elements[x.name];
            if (x.type === 'check') el.checked = !!it[x.name];
            else el.value = it[x.name] ?? '';
          });
          f.scrollIntoView({ behavior: 'smooth' });
        }
        if (a === 'del' && confirm('Удалить запись?')) {
          d[key] = d[key].filter((x) => x.id !== id);
          save('Удалено');
          render(current);
        }
      }
    };
  }

  const noAct = { act() {} };

  const panes = {
    news: crud(
      'news', 'Новости',
      [
        { name: 'title', ph: 'Заголовок', req: true },
        { name: 'date', type: 'date', req: true },
        { name: 'image', ph: 'Ссылка на картинку (необязательно)' },
        { name: 'text', type: 'area', ph: 'Текст новости' },
        { name: 'pinned', type: 'check', ph: '📌 Закрепить сверху' },
        { name: 'published', type: 'check', ph: 'Опубликовано' }
      ],
      (a, b) => (b.pinned - a.pinned) || String(b.date).localeCompare(String(a.date)),
      (n) => `${n.pinned ? '📌 ' : ''}<b>${e(n.title)}</b> <span class="muted small">${e(n.date)}${n.published ? '' : ' · скрыто'}</span>`
    ),

    participants: crud(
      'participants', 'Участники',
      [
        { name: 'order', type: 'number', ph: 'Порядок (число)' },
        { name: 'flag', ph: 'Флаг (эмодзи), например 🇦🇲' },
        { name: 'country', ph: 'Страна' },
        { name: 'artist', ph: 'Исполнитель', req: true },
        { name: 'song', ph: 'Название песни' },
        { name: 'photo', ph: 'URL фото участника (необязательно)' }
      ],
      (a, b) => (Number(a.order) || 0) - (Number(b.order) || 0),
      (p) => `${p.photo ? `<img src="${e(p.photo)}" style="width:40px;height:40px;object-fit:cover;border-radius:8px;vertical-align:middle;margin-right:8px">` : ''}${e(p.flag)} <b>${e(p.artist)}</b> — ${e(p.song)} <span class="muted small">${e(p.country)}</span>`
    ),

    schedule: crud(
      'schedule', 'Расписание',
      [
        { name: 'order', type: 'number', ph: 'Порядок (число)' },
        { name: 'time', ph: 'Время, например 20:00', req: true },
        { name: 'title', ph: 'Что происходит', req: true },
        { name: 'place', ph: 'Место / примечание' }
      ],
      (a, b) => (Number(a.order) || 0) - (Number(b.order) || 0),
      (s) => `<b>${e(s.time)}</b> — ${e(s.title)} <span class="muted small">${e(s.place)}</span>`
    ),

    voting: {
      html() {
        const total = Object.values(d.votes).reduce((a, b) => a + b, 0);
        const parts = [...d.participants];
        const sorted = [...parts].sort((a, b) => (d.votes[b.id] || 0) - (d.votes[a.id] || 0));
        const s = d.settings;
        return `
          <h2>Голосование</h2>
          <div class="stat-row">
            <div class="stat"><b>${total}</b><span>всего голосов</span></div>
            <div class="stat"><b>${parts.length}</b><span>участников</span></div>
            <div class="stat"><b style="color:${s.votingOpen ? '#3ddc84' : 'var(--danger)'}">${s.votingOpen ? 'Открыто' : 'Закрыто'}</b><span>статус</span></div>
          </div>
          <div class="card form" style="margin-bottom:14px">
            <div class="row" style="justify-content:space-between;flex-wrap:wrap;gap:12px">
              <div>
                <b>Приём голосов:</b>
                <span class="muted small">остановка/запуск в один клик, действует и на сервере</span>
              </div>
              <button id="toggleVoting" class="${s.votingOpen ? 'danger' : ''}" style="${s.votingOpen ? '' : 'background:#3ddc84;color:#000'}">
                ${s.votingOpen ? '⏸ Остановить голосование' : '▶ Возобновить голосование'}
              </button>
            </div>
          </div>
          <form id="vf" class="card form">
            <label class="check"><input type="checkbox" name="votingOpen" ${s.votingOpen ? 'checked' : ''}> Голосование открыто</label>
            <label class="check"><input type="checkbox" name="showResults" ${s.showResults ? 'checked' : ''}> Показывать результаты зрителям</label>
            <div class="row">
              <button type="submit">Сохранить</button>
              <button type="button" class="danger" id="resetVotes">Обнулить все голоса</button>
            </div>
          </form>
          <p class="muted small" style="margin-bottom:14px">💡 Используйте +/− для ручной корректировки голосов, или введите точное значение и нажмите ✓</p>
          <div class="list">
            ${sorted.length ? sorted.map((p, i) => {
              const v = d.votes[p.id] || 0;
              const pct = total ? Math.round((v * 100) / total) : 0;
              return `<div class="item" style="flex-wrap:wrap">
                <div style="flex:1;min-width:200px"><b>${i + 1}. ${e(p.flag)} ${e(p.artist)}</b>
                  <div class="bar" style="margin-top:8px"><span style="width:${pct}%"></span></div></div>
                <div class="vote-admin" style="display:flex;align-items:center;gap:8px;flex-shrink:0">
                  <button class="sm" data-vote-dec="${e(p.id)}" style="background:var(--danger);padding:6px 12px">−</button>
                  <input type="number" class="vote-input" data-vote-input="${e(p.id)}" value="${v}" min="0" style="width:70px;text-align:center;padding:6px 8px">
                  <button class="sm" data-vote-inc="${e(p.id)}" style="background:#3ddc84;padding:6px 12px">+</button>
                  <button class="sm" data-vote-set="${e(p.id)}" style="background:var(--yellow);color:#000;padding:6px 12px">✓</button>
                  <span class="muted small" style="min-width:70px;text-align:right">${v} гол. · ${pct}%</span>
                </div>
              </div>`;
            }).join('') : '<p class="muted">Сначала добавь участников</p>'}
          </div>`;
      },
      bind() {
        $('#toggleVoting').onclick = async () => {
          d.settings.votingOpen = !d.settings.votingOpen;
          const ok = await save(d.settings.votingOpen ? 'Голосование возобновлено' : 'Голосование остановлено');
          if (!ok) d.settings.votingOpen = !d.settings.votingOpen; // откат, если не сохранилось
          render('voting');
        };
        $('#vf').onsubmit = (ev) => {
          ev.preventDefault();
          const f = ev.target;
          d.settings.votingOpen = f.elements.votingOpen.checked;
          d.settings.showResults = f.elements.showResults.checked;
          save();
          render('voting');
        };
        $('#resetVotes').onclick = async () => {
          if (!confirm('Обнулить все голоса?')) return;
          try {
            await WV.resetVotes();
            d.votes = {};
            toast('Голоса обнулены');
            render('voting');
          } catch (err) {
            alert('Ошибка: ' + (err.message || err));
          }
        };

        // Ручное управление голосами
        document.querySelectorAll('[data-vote-inc]').forEach((btn) => {
          btn.onclick = async () => {
            const id = btn.dataset.voteInc;
            const newCount = (d.votes[id] || 0) + 1;
            try {
              await WV.setVotes(id, newCount);
              d.votes[id] = newCount;
              toast('+1 голос');
              render('voting');
            } catch (err) {
              alert('Ошибка: ' + (err.message || err));
            }
          };
        });

        document.querySelectorAll('[data-vote-dec]').forEach((btn) => {
          btn.onclick = async () => {
            const id = btn.dataset.voteDec;
            const newCount = Math.max(0, (d.votes[id] || 0) - 1);
            try {
              await WV.setVotes(id, newCount);
              d.votes[id] = newCount;
              toast('−1 голос');
              render('voting');
            } catch (err) {
              alert('Ошибка: ' + (err.message || err));
            }
          };
        });

        document.querySelectorAll('[data-vote-set]').forEach((btn) => {
          btn.onclick = async () => {
            const id = btn.dataset.voteSet;
            const input = document.querySelector(`[data-vote-input="${id}"]`);
            const newCount = Math.max(0, parseInt(input.value) || 0);
            try {
              await WV.setVotes(id, newCount);
              d.votes[id] = newCount;
              toast('Голоса обновлены');
              render('voting');
            } catch (err) {
              alert('Ошибка: ' + (err.message || err));
            }
          };
        });
      },
      ...noAct
    },

    rules: {
      html() {
        return `
          <h2>Правила</h2>
          <form id="rf" class="card form">
            <textarea name="rules" rows="16" placeholder="Текст правил">${e(d.rules)}</textarea>
            <div class="row"><button type="submit">Сохранить</button></div>
          </form>`;
      },
      bind() {
        $('#rf').onsubmit = (ev) => {
          ev.preventDefault();
          d.rules = ev.target.elements.rules.value;
          save();
        };
      },
      ...noAct
    },

    settings: {
      html() {
        const s = d.settings;
        return `
          <h2>Настройки</h2>
          <form id="sf" class="card form">
            <label>Название<input name="title" value="${e(s.title)}"></label>
            <label>Подзаголовок<input name="subtitle" value="${e(s.subtitle)}"></label>
            <label>Город<input name="city" value="${e(s.city)}"></label>
            <label>Дата и время шоу<input name="eventDate" type="datetime-local" value="${e((s.eventDate || '').slice(0, 16))}"></label>
            <label class="check"><input type="checkbox" name="showCountdown" ${s.showCountdown ? 'checked' : ''}> Показывать таймер</label>
            <div class="row"><button type="submit">Сохранить</button></div>
            <p class="muted small">Пароль админки меняется в Supabase: Authentication → Users.</p>
          </form>`;
      },
      bind() {
        $('#sf').onsubmit = (ev) => {
          ev.preventDefault();
          const f = ev.target;
          const s = d.settings;
          ['title', 'subtitle', 'city', 'eventDate'].forEach((k) => {
            s[k] = f.elements[k].value.trim();
          });
          s.showCountdown = f.elements.showCountdown.checked;
          save();
        };
      },
      ...noAct
    },

    data: {
      html() {
        return `
          <h2>Данные</h2>
          <div class="card form">
            <p class="muted">Резервная копия контента (без голосов). Импорт перезапишет новости, участников, расписание, правила и настройки.</p>
            <div class="row">
              <button id="exportBtn">Экспорт (JSON)</button>
              <label class="ghost" style="padding:12px 16px;border:1px solid var(--border);border-radius:12px;cursor:pointer;width:auto">
                Импорт (JSON)
                <input id="importFile" type="file" accept="application/json" hidden>
              </label>
            </div>
          </div>`;
      },
      bind() {
        $('#exportBtn').onclick = () => {
          const { votes, ...content } = d;
          const blob = new Blob([JSON.stringify(content, null, 2)], { type: 'application/json' });
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = 'wildvision-backup.json';
          a.click();
        };
        $('#importFile').onchange = (ev) => {
          const file = ev.target.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = () => {
            try {
              const parsed = JSON.parse(reader.result);
              d = Object.assign(d, WV.defaults(), parsed, { votes: d.votes });
              save('Импорт выполнен');
              render('data');
            } catch (err) {
              alert('Файл повреждён: ' + err.message);
            }
          };
          reader.readAsText(file);
        };
      },
      ...noAct
    }
  };

  function render(tab) {
    current = tab;
    document.querySelectorAll('.tabs button').forEach((b) => {
      b.classList.toggle('active', b.dataset.tab === tab);
    });
    $('#pane').innerHTML = panes[tab].html();
    panes[tab].bind();
  }

  // ---------- Вход и загрузка ----------
  async function show() {
    try {
      const ok = await WV.isAdmin();
      $('#login').hidden = ok;
      $('#panel').hidden = !ok;
      if (ok) {
        d = await WV.load();
        render(current);
      }
    } catch (err) {
      $('#loginErr').textContent = 'Ошибка подключения: ' + (err.message || err);
    }
  }

  async function login() {
    try {
      await WV.signIn($('#email').value.trim(), $('#pw').value);
      $('#loginErr').textContent = '';
      await show();
    } catch (err) {
      $('#loginErr').textContent = 'Вход не удался: ' + (err.message || 'проверь email и пароль');
    }
  }

  $('#loginBtn').onclick = login;
  $('#pw').onkeydown = (ev) => { if (ev.key === 'Enter') login(); };
  $('#logout').onclick = async () => {
    await WV.signOut();
    show();
  };
  document.querySelectorAll('.tabs button').forEach((b) => {
    b.onclick = () => render(b.dataset.tab);
  });

  $('#pane').addEventListener('click', (ev) => {
    const btn = ev.target.closest('[data-act]');
    if (!btn) return;
    panes[current].act(btn.dataset.act, btn.dataset.id);
  });

  show();
})();
