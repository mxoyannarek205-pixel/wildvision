// Слой данных: всё общение с Supabase идёт через этот файл.
(function () {
  const DEFAULTS = {
    settings: {
      title: 'Wildvision',
      subtitle: 'Tiraspol 2026',
      city: 'Тирасполь',
      eventDate: '2026-12-31T20:00',
      showCountdown: true,
      votingOpen: true,
      showResults: true
    },
    news: [],
    participants: [],
    schedule: [],
    rules: 'Правила будут опубликованы позже.'
  };

  const clone = (o) => JSON.parse(JSON.stringify(o));
  let sb = null;

  function client() {
    if (!sb) {
      if (!window.supabase) throw new Error('Не загрузилась библиотека Supabase (проверь интернет)');
      if (WV_CONFIG.supabaseUrl.includes('YOUR-PROJECT')) {
        throw new Error('Не заполнен js/config.js (Project URL и anon key)');
      }
      sb = window.supabase.createClient(WV_CONFIG.supabaseUrl, WV_CONFIG.supabaseAnonKey);
    }
    return sb;
  }

  window.WV = {
    defaults() {
      return clone(DEFAULTS);
    },

    // Загрузка всех данных: контент + голоса
    async load() {
      const [site, votes] = await Promise.all([
        client().from('site_data').select('data').eq('id', 1).single(),
        client().from('votes').select('participant_id, count')
      ]);
      if (site.error) throw site.error;
      if (votes.error) throw votes.error;

      const data = Object.assign(clone(DEFAULTS), site.data.data || {});
      data.settings = Object.assign(clone(DEFAULTS.settings), data.settings || {});
      data.votes = Object.fromEntries(votes.data.map((v) => [v.participant_id, v.count]));
      return data;
    },

    // Сохранение контента (голоса сюда не пишутся)
    async saveData(data) {
      const { votes, ...content } = data;
      const { error } = await client().from('site_data').update({ data: content }).eq('id', 1);
      if (error) throw error;
    },

    // Зритель голосует
    async vote(participantId) {
      const { error } = await client().rpc('cast_vote', { pid: participantId });
      if (error) throw error;
    },

    // Админ обнуляет голоса
    async resetVotes() {
      const { error } = await client().rpc('reset_votes');
      if (error) throw error;
    },

    // Админ вручную меняет голоса участника
    async setVotes(participantId, count) {
      const { error } = await client()
        .from('votes')
        .upsert({ participant_id: participantId, count: Math.max(0, count) });
      if (error) throw error;
    },

    // Вход админа
    async signIn(email, password) {
      const { error } = await client().auth.signInWithPassword({ email, password });
      if (error) throw error;
    },
    async signOut() {
      await client().auth.signOut();
    },
    async isAdmin() {
      const { data } = await client().auth.getSession();
      return !!data.session;
    },

    uid() {
      return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    },
    esc(v) {
      return String(v ?? '').replace(/[&<>"']/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
      }[c]));
    }
  };
})();
