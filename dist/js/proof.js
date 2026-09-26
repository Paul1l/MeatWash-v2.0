// «До и после» на странице: шторка между двумя кадрами одной и той же детали.
//
// Компонент самостоятельный — не зависит от витрины в шапке. Первый раз, когда
// карточка появляется в окне, шторка сама проезжает кадр: так видно, что её
// можно тянуть, и подсказка не нужна.

const clamp = (v) => Math.max(0, Math.min(100, v));
// Палец сдвинулся на столько — жест распознан: по горизонтали тянем шторку,
// по вертикали отдаём прокрутке страницы (touch-action: pan-y у кадра).
const TOUCH_SLOP = 8;
// Круг ручки (22 px) и рамка фокуса (3 + 2 px) целиком внутри кадра.
const GRIP_REACH = 28;

// Для чтения с экрана: сколько кадра занимает «до» и сколько «после».
export const splitText = (v) => `до ${Math.round(v)} %, после ${100 - Math.round(v)} %`;

// Сдвиг круга ручки у края кадра: линия стоит точно на значении,
// а круг не обрезается краем. Значение шторки при этом не меняется.
export const gripShift = (split, width) => {
  if (!width) return 0;
  const x = (split / 100) * width;
  return Math.max(0, GRIP_REACH - x) - Math.max(0, x - (width - GRIP_REACH));
};

function wire(fig) {
  const frame = fig.querySelector('.ba__frame');
  const clip = fig.querySelector('.ba__clip');
  const handle = fig.querySelector('.ba__handle');
  const grip = fig.querySelector('.ba__grip');
  const home = Number(fig.dataset.split) || 50;   // где шторка стоит по умолчанию
  let split = home;
  let raf = 0;
  let dragging = false;
  let taught = false;
  let touch = null;   // касание, по которому ещё не ясно: шторка или прокрутка

  const set = (v) => {
    split = clamp(v);
    const width = frame.clientWidth;
    clip.style.clipPath = `inset(0 ${100 - split}% 0 0)`;
    handle.style.left = `${split}%`;
    if (grip) grip.style.translate = `${gripShift(split, width)}px 0`;
    handle.setAttribute('aria-valuenow', String(Math.round(split)));
    handle.setAttribute('aria-valuetext', splitText(split));
  };

  const at = (e) => {
    const r = frame.getBoundingClientRect();
    return ((e.clientX - r.left) / r.width) * 100;
  };

  const grab = (e) => {
    cancelAnimationFrame(raf);
    dragging = true;
    taught = true;
    fig.classList.add('is-dragging');
    frame.setPointerCapture?.(e.pointerId);
    set(at(e));
  };

  frame.addEventListener('pointerdown', (e) => {
    // Мышь и перо — как раньше: шторка сразу встаёт под курсор.
    if (e.pointerType !== 'touch') { grab(e); return; }
    // Палец: ждём, куда он пойдёт. Вертикальный свайп — это прокрутка.
    touch = { id: e.pointerId, x: e.clientX, y: e.clientY };
  });
  frame.addEventListener('pointermove', (e) => {
    if (dragging) { set(at(e)); e.preventDefault(); return; }
    if (!touch || e.pointerId !== touch.id) return;
    const dx = Math.abs(e.clientX - touch.x), dy = Math.abs(e.clientY - touch.y);
    if (dx > TOUCH_SLOP && dx > dy) { touch = null; grab(e); e.preventDefault(); }
    else if (dy > TOUCH_SLOP) touch = null;
  });
  const release = () => { touch = null; dragging = false; fig.classList.remove('is-dragging'); };
  frame.addEventListener('pointerup', (e) => {
    // Короткое касание без сдвига — как щелчок мышью: шторка встаёт в точку.
    if (touch && e.pointerId === touch.id) { cancelAnimationFrame(raf); taught = true; set(at(e)); }
    release();
  });
  frame.addEventListener('pointercancel', release);
  // Касание сначала неявно захвачено элементом под пальцем; когда захват
  // переходит к кадру, тот элемент получает lostpointercapture — это не конец жеста.
  frame.addEventListener('lostpointercapture', (e) => { if (e.target === frame) release(); });

  handle.addEventListener('keydown', (e) => {
    const step = e.shiftKey ? 10 : 3;
    if (e.key === 'ArrowLeft') { taught = true; cancelAnimationFrame(raf); set(split - step); e.preventDefault(); }
    if (e.key === 'ArrowRight') { taught = true; cancelAnimationFrame(raf); set(split + step); e.preventDefault(); }
    if (e.key === 'Home') { taught = true; cancelAnimationFrame(raf); set(0); e.preventDefault(); }
    if (e.key === 'End') { taught = true; cancelAnimationFrame(raf); set(100); e.preventDefault(); }
  });

  // Показательный проезд: туда и обратно при каждом появлении карточки,
  // пока человек сам не тронул шторку. Один раз за загрузку легко пролистать.
  let playing = false;
  function teach() {
    if (taught || playing) return;
    playing = true;
    const started = performance.now();
    const span = 2600;
    const ease = (x) => (x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
    const tick = () => {
      if (dragging) return;
      const t = Math.min(1, (performance.now() - started) / span);
      // сначала «до» во весь кадр, потом «после», потом назад в исходное
      const k = t < .3 ? home + ease(t / .3) * (88 - home)
        : t < .72 ? 88 - ease((t - .3) / .42) * 76
          : 12 + ease((t - .72) / .28) * (home - 12);
      set(k);
      if (t < 1) raf = requestAnimationFrame(tick);
      else playing = false;
    };
    raf = requestAnimationFrame(tick);
  }
  // Карточка ушла с экрана посреди проезда — шторка возвращается на место.
  function rest() {
    if (!playing) return;
    cancelAnimationFrame(raf);
    playing = false;
    if (!taught) set(home);
  }

  set(home);
  // Ширина кадра поменялась — круг ручки у края пересчитывается.
  const refit = () => set(split);
  return { fig, teach, rest, refit, stop: () => cancelAnimationFrame(raf) };
}

export function setupProof(root = document) {
  const items = [...root.querySelectorAll('[data-ba]')].map(wire);
  if (!items.length) return () => {};

  const quiet = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let observer;
  if (!quiet && 'IntersectionObserver' in window) {
    observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const item = items.find((i) => i.fig === entry.target);
        if (!item) continue;
        clearTimeout(item.wait);
        if (entry.isIntersecting) item.wait = setTimeout(item.teach, 420);
        else item.rest();
      }
    }, { threshold: .45 });
    items.forEach((i) => observer.observe(i.fig));
  }
  let frame = 0;
  const onResize = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => items.forEach((i) => i.refit())); };
  addEventListener('resize', onResize);

  return () => { observer?.disconnect(); removeEventListener('resize', onResize); cancelAnimationFrame(frame); items.forEach((i) => { clearTimeout(i.wait); i.stop(); }); };
}
