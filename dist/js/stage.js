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

const SRC = (id, small) => `assets/shots/${id}${small ? '-s' : ''}.webp`;
const SMALL = () => innerWidth <= 900;
const FOCUS = (id) => SHOT_FOCUS[id] || '50% 50%';

export function createStage(mount) {
  mount.innerHTML = `
    <div class="stage">
      <div class="stage__layer is-on" data-layer></div>
      <div class="stage__layer" data-layer></div>
      <div class="stage__pair" hidden>
        <img class="stage__pairimg" data-after alt="">
        <div class="stage__clip"><img class="stage__pairimg" data-before alt=""></div>
        <div class="stage__handle" role="slider" tabindex="0"
             aria-label="Сравнение до и после" aria-valuemin="0" aria-valuemax="100" aria-valuenow="50">
          <span class="stage__grip" aria-hidden="true"></span>
        </div>
        <span class="stage__tag stage__tag--b">до</span>
        <span class="stage__tag stage__tag--a">после</span>
      </div>
    </div>`;

  const root = mount.querySelector('.stage');
  const layers = [...mount.querySelectorAll('[data-layer]')];
  const pair = mount.querySelector('.stage__pair');
  const imgB = mount.querySelector('[data-before]');
  const imgA = mount.querySelector('[data-after]');
  const clip = mount.querySelector('.stage__clip');
  const handle = mount.querySelector('.stage__handle');

  let onLayer = layers[0];  // слой, который сейчас виден
  let current = null;     // что на нём показано
  let split = 50;         // положение шторки, %
  let sweepRaf = 0;       // автопроезд шторки в режиме показа
  const seen = new Set(); // уже загруженные кадры

  const preload = (id) => {
    if (!id || seen.has(id)) return;
    seen.add(id);
    const i = new Image();
    i.decoding = 'async';
    i.src = SRC(id, SMALL());
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
    handle.setAttribute('aria-valuenow', Math.round(split));
  }

  // ── шторка ────────────────────────────────────────────────────────────────
  let dragging = false;
  const fromEvent = (e) => {
    const r = pair.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
    return (x / r.width) * 100;
  };
  const onMove = (e) => { if (dragging) { setSplit(fromEvent(e)); e.preventDefault(); } };
  const onUp = () => { dragging = false; root.classList.remove('is-dragging'); };
  const onDown = (e) => { cancelAnimationFrame(sweepRaf); dragging = true; root.classList.add('is-dragging'); setSplit(fromEvent(e)); };

  pair.addEventListener('pointerdown', onDown);
  addEventListener('pointermove', onMove, { passive: false });
  addEventListener('pointerup', onUp);
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
    },
  };
}
