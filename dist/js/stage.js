// Витрина на фотографиях: заменяет 3D-сцену.
//
// Два слоя картинки крест-накрест: новый проявляется поверх старого, поэтому
// переход между состояниями и услугами всегда плавный — рывка не бывает
// по построению, в отличие от переключения видео.
//
// Три режима:
//   ladder(id)     — состояние машины по прокрутке (приехала → мойка → лак → салон → защита → готова)
//   shot(id)       — кадр выбранной услуги
//   showPair(b, a) — шторка «до/после» для работ, где есть честная пара
//   sweep(ms)      — шторка сама проезжает кадр, когда идёт показ

import { SHOT_FOCUS } from './config.js';
import { splitText, gripShift } from './proof.js';

const SRC = (id, small) => `assets/shots/${id}${small ? '-s' : ''}.webp`;
const SMALL = () => innerWidth <= 900;
const FOCUS = (id) => SHOT_FOCUS[id] || '50% 50%';

export function createStage(mount) {
  // Скрыты от чтения с экрана только картинки и метки: сама ручка-слайдер
  // должна оставаться доступной, поэтому aria-hidden не на контейнере.
  mount.innerHTML = `
    <div class="stage">
      <div class="stage__layer is-on" data-layer aria-hidden="true"></div>
      <div class="stage__layer" data-layer aria-hidden="true"></div>
      <div class="stage__pair" hidden>
        <img class="stage__pairimg" data-after alt="">
        <div class="stage__clip" aria-hidden="true"><img class="stage__pairimg" data-before alt=""></div>
        <div class="stage__handle" role="slider" tabindex="0"
             aria-label="Сравнение до и после" aria-valuemin="0" aria-valuemax="100" aria-valuenow="50"
             aria-valuetext="${splitText(50)}">
          <span class="stage__grip" aria-hidden="true"></span>
        </div>
        <span class="stage__tag stage__tag--b" aria-hidden="true">до</span>
        <span class="stage__tag stage__tag--a" aria-hidden="true">после</span>
      </div>
    </div>`;

  const root = mount.querySelector('.stage');
  const layers = [...mount.querySelectorAll('[data-layer]')];
  const pair = mount.querySelector('.stage__pair');
  const imgB = mount.querySelector('[data-before]');
  const imgA = mount.querySelector('[data-after]');
  const clip = mount.querySelector('.stage__clip');
  const handle = mount.querySelector('.stage__handle');
  const grip = mount.querySelector('.stage__grip');

  let onLayer = layers[0];  // слой, который сейчас виден
  let current = null;     // что на нём показано
  let split = 50;         // положение шторки, %
  let sweepRaf = 0;       // автопроезд шторки в режиме показа
  const seen = new Map(); // кадр → обещание его загрузки

  // Возвращает обещание: main.js по нему понимает, что витрина готова,
  // а при ошибке загрузки уходит в статичную версию.
  const preload = (id) => {
    if (!id) return Promise.resolve();
    if (seen.has(id)) return seen.get(id);
    const i = new Image();
    i.decoding = 'async';
    const loaded = new Promise((resolve, reject) => {
      i.onload = resolve;
      i.onerror = () => reject(new Error(`Кадр витрины не загрузился: ${id}`));
    });
    loaded.catch(() => {});   // ошибку разбирает тот, кто ждёт; фоновая подгрузка молчит
    i.src = SRC(id, SMALL());
    seen.set(id, loaded);
    return loaded;
  };

  // Кадр меняется на «спящем» слое, и только потом слои меняются местами.
  // Состояние переключается сразу, а не в колбэке: во время прокрутки paint
  // вызывается по несколько раз за кадр, и отложенное переключение приводило
  // к тому, что оба слоя оставались погашенными и витрина чернела.
  function paint(id) {
    if (!id || id === current) return;
    current = id;
    const prev = onLayer;
    const next = prev === layers[0] ? layers[1] : layers[0];
    onLayer = next;
    next.style.backgroundImage = `url("${SRC(id, SMALL())}")`;
    next.style.backgroundPosition = FOCUS(id);
    // даём браузеру кадр на раскладку, иначе фейд стартует с пустого слоя
    requestAnimationFrame(() => {
      if (onLayer !== next) return;   // пока ждали, кадр успел смениться
      next.classList.add('is-on');
      prev.classList.remove('is-on');
    });
  }

  function setSplit(v) {
    split = Math.max(0, Math.min(100, v));
    clip.style.clipPath = `inset(0 ${100 - split}% 0 0)`;
    handle.style.left = `${split}%`;
    grip.style.translate = `${gripShift(split, pair.clientWidth)}px 0`;
    handle.setAttribute('aria-valuenow', Math.round(split));
    handle.setAttribute('aria-valuetext', splitText(split));
  }

  // ── шторка ────────────────────────────────────────────────────────────────
  // Мышь тянет сразу. Палец — только когда жест явно горизонтальный: у кадра
  // touch-action: pan-y, и вертикальный свайп остаётся прокруткой страницы.
  const TOUCH_SLOP = 8;
  let dragging = false;
  let touch = null;   // касание, по которому ещё не ясно: шторка или прокрутка
  const fromEvent = (e) => {
    const r = pair.getBoundingClientRect();
    return ((e.clientX - r.left) / r.width) * 100;
  };
  const grab = (e) => { cancelAnimationFrame(sweepRaf); dragging = true; root.classList.add('is-dragging'); setSplit(fromEvent(e)); };
  const onMove = (e) => {
    if (dragging) { setSplit(fromEvent(e)); e.preventDefault(); return; }
    if (!touch || e.pointerId !== touch.id) return;
    const dx = Math.abs(e.clientX - touch.x), dy = Math.abs(e.clientY - touch.y);
    if (dx > TOUCH_SLOP && dx > dy) { touch = null; grab(e); e.preventDefault(); }
    else if (dy > TOUCH_SLOP) touch = null;
  };
  const onUp = (e) => {
    // Короткое касание без сдвига — как щелчок: шторка встаёт в точку.
    if (touch && e.type === 'pointerup' && e.pointerId === touch.id && !pair.hidden) { cancelAnimationFrame(sweepRaf); setSplit(fromEvent(e)); }
    touch = null; dragging = false; root.classList.remove('is-dragging');
  };
  const onDown = (e) => {
    if (e.pointerType !== 'touch') { grab(e); return; }
    touch = { id: e.pointerId, x: e.clientX, y: e.clientY };
  };
  const onResize = () => { if (!pair.hidden) setSplit(split); };

  pair.addEventListener('pointerdown', onDown);
  addEventListener('pointermove', onMove, { passive: false });
  addEventListener('pointerup', onUp);
  addEventListener('pointercancel', onUp);
  addEventListener('resize', onResize);
  handle.addEventListener('keydown', (e) => {
    const step = e.shiftKey ? 10 : 3;
    if (e.key === 'ArrowLeft') { setSplit(split - step); e.preventDefault(); }
    if (e.key === 'ArrowRight') { setSplit(split + step); e.preventDefault(); }
  });

  return {
    preload,

    // один кадр
    shot(id) {
      if (!id) return;
      pair.hidden = true;
      root.classList.remove('has-pair');
      paint(id);
    },

    // «до/после» шторкой
    showPair(before, after) {
      if (!before || !after) return;
      cancelAnimationFrame(sweepRaf);
      imgB.src = SRC(before, SMALL());
      imgB.style.objectPosition = FOCUS(before);
      imgA.src = SRC(after, SMALL());
      imgA.style.objectPosition = FOCUS(after);
      pair.hidden = false;
      root.classList.add('has-pair');
      setSplit(50);
      current = null;      // чтобы следующий одиночный кадр точно перерисовался
    },

    // Шторка проезжает кадр сама — в режиме показа зритель видит разницу,
    // ничего не трогая. Ручное перетаскивание в любой момент перебивает проезд.
    sweep(ms = 2400) {
      if (pair.hidden) return;
      cancelAnimationFrame(sweepRaf);
      const started = performance.now();
      setSplit(90);
      const ease = (x) => (x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
      const tick = () => {
        if (dragging || pair.hidden) return;
        const t = Math.min(1, (performance.now() - started) / ms);
        setSplit(90 - ease(t) * 80);
        if (t < 1) sweepRaf = requestAnimationFrame(tick);
      };
      sweepRaf = requestAnimationFrame(tick);
    },

    // состояние по прокрутке
    ladder(shotId) { this.shot(shotId); },

    get showing() { return current; },
    destroy() {
      cancelAnimationFrame(sweepRaf);
      removeEventListener('pointermove', onMove);
      removeEventListener('pointerup', onUp);
      removeEventListener('pointercancel', onUp);
      removeEventListener('resize', onResize);
    },
  };
}
