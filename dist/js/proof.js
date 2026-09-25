// «До и после» на странице: шторка между двумя кадрами одной и той же детали.
//
// Компонент самостоятельный — не зависит от витрины в шапке. Первый раз, когда
// карточка появляется в окне, шторка сама проезжает кадр: так видно, что её
// можно тянуть, и подсказка не нужна.

const clamp = (v) => Math.max(0, Math.min(100, v));

function wire(fig) {
  const frame = fig.querySelector('.ba__frame');
  const clip = fig.querySelector('.ba__clip');
  const handle = fig.querySelector('.ba__handle');
  const home = Number(fig.dataset.split) || 50;   // где шторка стоит по умолчанию
  let split = home;
  let raf = 0;
  let dragging = false;
  let taught = false;

  const set = (v) => {
    split = clamp(v);
    clip.style.clipPath = `inset(0 ${100 - split}% 0 0)`;
    handle.style.left = `${split}%`;
    handle.setAttribute('aria-valuenow', String(Math.round(split)));
  };

  const at = (e) => {
    const r = frame.getBoundingClientRect();
    return ((e.clientX - r.left) / r.width) * 100;
  };

  frame.addEventListener('pointerdown', (e) => {
    cancelAnimationFrame(raf);
    dragging = true;
    taught = true;
    fig.classList.add('is-dragging');
    frame.setPointerCapture?.(e.pointerId);
    set(at(e));
  });
  frame.addEventListener('pointermove', (e) => { if (dragging) { set(at(e)); e.preventDefault(); } });
  const release = () => { dragging = false; fig.classList.remove('is-dragging'); };
  frame.addEventListener('pointerup', release);
  frame.addEventListener('pointercancel', release);
  frame.addEventListener('lostpointercapture', release);

  handle.addEventListener('keydown', (e) => {
    const step = e.shiftKey ? 10 : 3;
    if (e.key === 'ArrowLeft') { taught = true; cancelAnimationFrame(raf); set(split - step); e.preventDefault(); }
    if (e.key === 'ArrowRight') { taught = true; cancelAnimationFrame(raf); set(split + step); e.preventDefault(); }
    if (e.key === 'Home') { taught = true; set(0); e.preventDefault(); }
    if (e.key === 'End') { taught = true; set(100); e.preventDefault(); }
  });

  // Показательный проезд: туда и обратно, один раз за появление.
  function teach() {
    if (taught) return;
    taught = true;
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
    };
    raf = requestAnimationFrame(tick);
  }

  set(home);
  return { fig, teach, stop: () => cancelAnimationFrame(raf) };
}

export function setupProof(root = document) {
  const items = [...root.querySelectorAll('[data-ba]')].map(wire);
  if (!items.length) return () => {};

  const quiet = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let observer;
  if (!quiet && 'IntersectionObserver' in window) {
    observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const item = items.find((i) => i.fig === entry.target);
        setTimeout(() => item?.teach(), 420);
        observer.unobserve(entry.target);
      }
    }, { threshold: .45 });
    items.forEach((i) => observer.observe(i.fig));
  }

  return () => { observer?.disconnect(); items.forEach((i) => i.stop()); };
}
