// Гараж услуг: все работы показываются на одной машине.
//
// У каждой работы свой кадр съёмки. Отметили работу — витрина перешла на её
// кадр; у полировки, сколов и фар кадра два, до и после, и между ними ездит
// ползунок. Показ проигрывает выбранное по очереди, ролик — все работы подряд.

import { ZONES, ZONE_GROUPS, ZONE_PRESETS, ZONE_SHOTS, SHOT_BASE, FILM_OPEN } from './config.js';

const money = (n) => n.toLocaleString('ru-RU') + ' ₽';
const byId = (id) => ZONES.find((z) => z.id === id);
const HOLD = 3400;        // сколько кадр держится на одной работе
const CROSS = 700;         // перекрёстное затухание между кадрами
const FILM_LEAD = 900;     // чистая пауза в начале ролика под запись экрана

export function setupConfigurator({ mount, getScene, onOpen, onClose }) {
  const picked = new Set();
  let open = false;

  // Показ
  let show = null;       // { order:[id], index, until, timer }
  let cinema = false;    // панель убрана, остаётся только подпись
  let autoCinema = false; // панель убрал сам показ, а не пользователь
  let film = false;      // ролик: из кадра уходит весь интерфейс сайта
  let filmStartedAt = 0;

  mount.innerHTML = `
    <div class="cfg" hidden>
      <div class="cfg__head">
        <p class="cfg__eyebrow">Гараж услуг</p>
        <h3 class="cfg__title">Соберите уход и смотрите на машину</h3>
        <button class="cfg__close" type="button" data-cfg-close aria-label="Закрыть гараж услуг">×</button>
      </div>

      <div class="cfg__presets">
        ${ZONE_PRESETS.map((p) => `
          <button class="cfg__preset" type="button" data-preset="${p.id}">
            <b>${p.title}</b><i>${p.note}</i>
          </button>`).join('')}
      </div>

      <div class="cfg__tabs" role="tablist">
        ${ZONE_GROUPS.map((g, i) => `
          <button class="cfg__tab${i ? '' : ' is-on'}" type="button" role="tab" data-tab="${g.id}">${g.title}</button>`).join('')}
      </div>

      <div class="cfg__scroll">
        ${ZONE_GROUPS.map((g) => `
          <section class="cfg__group" data-group="${g.id}">
            <h4 class="cfg__grouptitle">${g.title}</h4>
            <ul class="cfg__list">
              ${ZONES.filter((z) => z.group === g.id).map((z) => `
                <li>
                  <label class="cfg__item" data-zone="${z.id}">
                    <input type="checkbox" value="${z.id}">
                    <span class="cfg__box" aria-hidden="true"></span>
                    <span class="cfg__text">
                      <b>${z.title}</b>
                      <i>от ${money(z.from)}</i>
                    </span>
                  </label>
                </li>`).join('')}
            </ul>
          </section>`).join('')}
      </div>

      <p class="cfg__pairhint">Потяните шторку на кадре — увидите, что меняет работа.</p>

      <p class="cfg__total"><span>Итого</span><b data-total>—</b></p>

      <div class="cfg__act">
        <button class="btn btn--fill" type="button" data-book>Записаться</button>
        <button class="btn btn--ghost" type="button" data-show>Показ</button>
        <button class="btn btn--ghost" type="button" data-film>Ролик</button>
        <button class="btn btn--ghost" type="button" data-cfg-reset>Сбросить</button>
      </div>

      <p class="cfg__note">Цены минимальные по каждой работе. Точную стоимость называет мастер после осмотра.</p>
    </div>

    <div class="cfg-stage" hidden aria-live="polite">
      <p class="cfg-stage__title"></p>
      <p class="cfg-stage__caption"></p>
      <p class="cfg-stage__price"></p>
      <div class="cfg-stage__bar"><i></i></div>
      <p class="cfg-stage__hint">Esc — выйти из ролика</p>
    </div>

    <button class="cfg-fold" type="button" data-cinema hidden>Скрыть панель</button>`;

  const panel = mount.querySelector('.cfg');
  panel.dataset.group = ZONE_GROUPS[0].id;
  const stage = mount.querySelector('.cfg-stage');
  const stageTitle = mount.querySelector('.cfg-stage__title');
  const stageCaption = mount.querySelector('.cfg-stage__caption');
  const stagePrice = mount.querySelector('.cfg-stage__price');
  const stageBar = mount.querySelector('.cfg-stage__bar i');
  const cinemaBtn = mount.querySelector('[data-cinema]');
  const total = mount.querySelector('[data-total]');
  const showBtn = mount.querySelector('[data-show]');
  const filmBtn = mount.querySelector('[data-film]');

  const OVERLAYS = '.hero, .hero-bar, .hero__dot, .chapter, .finale, .scene__skip';
  const freezeOverlays = (on) => {
    document.querySelectorAll(OVERLAYS).forEach((el) => { el.inert = on; });
  };

  // Что показать на витрине. Выбрали одну работу — её кадр; выбрали несколько —
  // кадр той, которую тронули последней. Ничего не выбрано — базовый кадр.
  let lastTouched = null;

  // force — кадр нужен для показа или ролика, где работа может быть и не
  // отмечена галочкой: без этого ролик всё время стоял на базовом кадре.
  function target(id, force) {
    const key = id || lastTouched;
    if (key && ZONE_SHOTS[key] && (force || picked.has(key))) return { id: key, ...ZONE_SHOTS[key] };
    for (let i = ZONES.length - 1; i >= 0; i--) {
      const z = ZONES[i];
      if (picked.has(z.id) && ZONE_SHOTS[z.id]) return { id: z.id, ...ZONE_SHOTS[z.id] };
    }
    return { id: null, shot: SHOT_BASE };
  }

  let shownPair = null;

  function retarget(id, force) {
    const scene = getScene();
    if (!scene) return;
    const spec = target(id, force);
    scene.setManual(spec);
    panel.classList.toggle('has-pair', Boolean(spec.pair));
    // Новую пару шторка проезжает сама: иначе разницу нужно искать вручную.
    if (spec.pair && spec.id !== shownPair) scene.stage?.sweep?.(1900);
    shownPair = spec.pair ? spec.id : null;
    return spec;
  }

  function refreshTotal() {
    total.textContent = picked.size
      ? 'от ' + money([...picked].reduce((s, id) => s + byId(id).from, 0))
      : '—';
    showBtn.disabled = picked.size < 1;
  }

  function syncInputs() {
    panel.querySelectorAll('input[type=checkbox]').forEach((i) => {
      i.checked = picked.has(i.value);
      i.closest('.cfg__item').classList.toggle('is-on', i.checked);
    });
  }

  // ── Показ ──────────────────────────────────────────────────────────────────
  // Одна зона за раз: камера подъезжает, эффекты этой зоны накладываются
  // поверх уже собранного набора, кадр держится, дальше следующая.

  function stopShow(silent) {
    if (!show) return;
    clearTimeout(show.timer);
    clearTimeout(show.beat);
    cancelAnimationFrame(show.raf);
    const wasFilm = show.film;
    show = null;
    stage.hidden = true;
    stage.classList.remove('is-film');
    showBtn.textContent = 'Показ';
    filmBtn.textContent = 'Ролик';
    panel.classList.remove('is-playing');
    if (autoCinema) { autoCinema = false; setCinema(false); }
    if (wasFilm) setFilm(false);
    if (!silent) retarget(null);
  }

  function stepShow() {
    if (!show) return;

    if (show.index >= show.order.length) {
      // Финал: общий план готовой машины, потом выход.
      retarget(null);
      stageTitle.textContent = 'Готова';
      stageCaption.textContent = 'Забирайте. Машина собрана, лак сухой, салон чистый.';
      stagePrice.textContent = show.sum ? 'от ' + money(show.sum) : '';
      runBar(show.film ? 2600 : 1400);
      show.timer = setTimeout(() => stopShow(true), show.film ? 2600 : 1400);
      return;
    }

    const zone = byId(show.order[show.index]);
    const hold = (zone.hold || HOLD / 1000) * 1000;

    stageTitle.textContent = zone.title;
    stageCaption.textContent = zone.caption;
    stagePrice.textContent = 'от ' + money(zone.from);
    stage.hidden = false;

    const spec = retarget(zone.id, true);

    // У работ с парой «до/после» шторка проезжает кадр под выдержку показа.
    if (spec && spec.pair) getScene()?.stage?.sweep?.(hold * 0.72);

    runBar(hold + CROSS);
    show.timer = setTimeout(() => { show.index += 1; stepShow(); }, hold + CROSS);
  }

  // Полоса времени под подписью: показывает, сколько кадр ещё держится.
  function runBar(span) {
    const startedStep = performance.now();
    const tick = () => {
      if (!show) return;
      const p = Math.min(1, (performance.now() - startedStep) / span);
      stageBar.style.transform = `scaleX(${p})`;
      if (p < 1) show.raf = requestAnimationFrame(tick);
    };
    cancelAnimationFrame(show.raf);
    show.raf = requestAnimationFrame(tick);
  }

  function startShow() {
    if (!picked.size) return;
    stopShow(true);
    const order = ZONES.filter((z) => picked.has(z.id)).map((z) => z.id);
    show = {
      order, index: 0, timer: 0, beat: 0, raf: 0, film: false,
      sum: order.reduce((s, id) => s + byId(id).from, 0),
    };
    showBtn.textContent = 'Стоп';
    panel.classList.add('is-playing');
    // На телефоне нижний лист занимает пол-экрана и накрывает подпись показа.
    // Показ смотрят, а не листают, поэтому панель на время уходит сама.
    if (innerWidth <= 720 && !cinema) { setCinema(true); autoCinema = true; }
    stepShow();
  }

  // ── Ролик ──────────────────────────────────────────────────────────────────
  // Все работы подряд на одной машине, от грязной до собранной: интерфейс
  // уходит из кадра, остаётся машина и подпись работы. Это и есть заготовка
  // для видео услуг — достаточно включить запись экрана.

  function startFilm() {
    stopShow(true);
    setCinema(false);
    setFilm(true);
    const order = ZONES.map((z) => z.id);
    show = {
      order, index: 0, timer: 0, beat: 0, raf: 0, film: true,
      sum: order.reduce((s, id) => s + byId(id).from, 0),
    };
    stage.classList.add('is-film');
    stage.hidden = false;
    filmBtn.textContent = 'Стоп';
    panel.classList.add('is-playing');
    // Ролик открывается грязной машиной: дальше по порядку идут работы.
    getScene()?.setManual({ id: null, shot: FILM_OPEN });
    stageTitle.textContent = 'Как приехала';
    stageCaption.textContent = 'Зимняя плёнка, соль по порогам, диски в пыли.';
    stagePrice.textContent = '';
    // Пауза перед первым тактом: запись экрана успевает начаться на чистом кадре.
    show.beat = setTimeout(() => show && stepShow(), FILM_LEAD);
  }

  // Во время ролика интерфейса в кадре нет, поэтому выход — Esc или щелчок
  // по кадру. Первые полсекунды щелчки не считаем: иначе ролик остановит
  // тот же клик, которым его запустили.
  const onFilmClick = () => { if (performance.now() - filmStartedAt > 600) stopShow(); };

  function setFilm(on) {
    film = on;
    document.body.classList.toggle('cfg-film', on);
    if (on) { filmStartedAt = performance.now(); document.addEventListener('click', onFilmClick); }
    else document.removeEventListener('click', onFilmClick);
  }

  function setCinema(on) {
    cinema = on;
    document.body.classList.toggle('cfg-cinema', on);
    cinemaBtn.textContent = on ? 'Показать панель' : 'Скрыть панель';
  }

  // ── События ────────────────────────────────────────────────────────────────

  panel.addEventListener('change', (e) => {
    const input = e.target;
    if (input.type !== 'checkbox') return;
    if (input.checked) { picked.add(input.value); lastTouched = input.value; }
    else { picked.delete(input.value); if (lastTouched === input.value) lastTouched = null; }
    input.closest('.cfg__item').classList.toggle('is-on', input.checked);
    refreshTotal();
    stopShow(true);
    retarget(input.checked ? input.value : null);
  });

  panel.addEventListener('click', (e) => {
    const tab = e.target.closest('[data-tab]');
    if (tab) {
      panel.dataset.group = tab.dataset.tab;
      panel.querySelectorAll('[data-tab]').forEach((t) => t.classList.toggle('is-on', t === tab));
      return;
    }

    const preset = e.target.closest('[data-preset]');
    if (preset) {
      const p = ZONE_PRESETS.find((x) => x.id === preset.dataset.preset);
      picked.clear();
      p.zones.forEach((id) => picked.add(id));
      syncInputs();
      refreshTotal();
      stopShow(true);
      retarget(p.zones[p.zones.length - 1]);
      return;
    }

    if (e.target.closest('[data-show]')) { show ? stopShow() : startShow(); return; }
    if (e.target.closest('[data-film]')) { show && show.film ? stopShow() : startFilm(); return; }
    if (e.target.closest('[data-cfg-close]')) return api.close();

    if (e.target.closest('[data-cfg-reset]')) {
      picked.clear();
      syncInputs();
      refreshTotal();
      stopShow(true);
      retarget(null);
      return;
    }

    if (e.target.closest('[data-book]') && picked.size) {
      const names = [...picked].map((id) => byId(id).title);
      const sum = [...picked].reduce((s, id) => s + byId(id).from, 0);
      setTimeout(() => {
        const line = document.querySelector('#booking p');
        if (line) line.textContent = 'Вы собрали: ' + names.join(', ') + '. Ориентир — от ' + money(sum) + '. Филиал и время выбираются в онлайн-записи.';
        api.close();
      }, 0);
    }
  });

  cinemaBtn.addEventListener('click', () => setCinema(!cinema));



  const onKey = (e) => {
    if (!open) return;
    if (e.key === 'Escape') {
      if (film) return stopShow();
      if (cinema) return setCinema(false);
      if (show) return stopShow();
      api.close();
    }
    if (e.key === ' ' && picked.size) { e.preventDefault(); show ? stopShow() : startShow(); }
  };

  const api = {
    open() {
      if (open || !getScene()) return;
      open = true;
      panel.hidden = false;
      cinemaBtn.hidden = false;
      document.body.classList.add('cfg-open');
      document.addEventListener('keydown', onKey);
      freezeOverlays(true);
      refreshTotal();
      retarget(null);
      onOpen?.();
    },
    close() {
      if (!open) return;
      open = false;
      stopShow(true);
      setCinema(false);
      setFilm(false);
      panel.hidden = true;
      cinemaBtn.hidden = true;
      stage.hidden = true;
      document.body.classList.remove('cfg-open');
      document.removeEventListener('keydown', onKey);
      freezeOverlays(false);
      getScene()?.setManual(null);
      onClose?.();
    },
    get isOpen() { return open; },
    film: () => { if (!open) api.open(); startFilm(); },
    selected: () => [...picked],
    destroy() { stopShow(true); document.removeEventListener('click', onFilmClick); document.removeEventListener('keydown', onKey); freezeOverlays(false); },
  };
  // ?film в адресе — страница сама открывает гараж и проигрывает все работы
  // без интерфейса. Так снимается ролик: открыл ссылку, включил запись.
  if (new URLSearchParams(location.search).has('film')) {
    const kick = () => { if (!getScene()) return setTimeout(kick, 200); api.film(); };
    setTimeout(kick, 600);
  }

  return api;
}
