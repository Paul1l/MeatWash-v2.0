export const STOPS = { hero:0, body:.20, interior:.40, polish:.60, ceramic:.80, final:1 };
export const SERVICES = {
 body: { label:'01 / THE BODY', title:'Мойка кузова', description:'Трёхфазная мойка: предварительная очистка, ручная проработка и финишный уход.', prices:[['Трёхфазная · 30 минут',2150],['Комплексная с воском · 60 минут',2850],['Детейлинг-мойка от реагентов',4950]] },
 interior: { label:'02 / THE INTERIOR', title:'Химчистка салона', description:'Уход за кожей, тканью и алькантарой: от отдельной детали до полной химчистки.', prices:[['Химчистка руля',1000],['Химчистка сиденья',2000],['Детейлинг-химчистка салона',20000]] },
 polish: { label:'03 / THE REFLECTION', title:'Полировка кузова', description:'Восстановление глубины цвета и чистоты отражения. Состав работ подбирается после осмотра автомобиля.', prices:[['Полировка кузова + 2 слоя керамики',40000]] },
 ceramic: { label:'04 / THE PROTECTION', title:'Керамическая защита', description:'Защитное покрытие для лакокрасочной поверхности. Состав и количество слоёв подбираются под автомобиль.', prices:[['Керамическое покрытие кузова',15000]] }
};
export const CAMERA_STOPS = [
 { p:[3.7,1.6,4.4], t:[0,.75,0], f:35 },
 { p:[1.26,.99,2.15], t:[.52,.84,1.73], f:49 },
 { p:[1.12,1.21,-.02], t:[-.11,.85,-.24], f:62 },
 { p:[1.60,1.25,-1.91], t:[.39,.88,-1.23], f:48 },
 { p:[.20,1.12,1.90], t:[.03,.80,1.30], f:45 },
 { p:[3.7,1.6,4.4], t:[0,.75,0], f:35 }
];
export const clamp = (v,a=0,b=1) => Math.min(b,Math.max(a,v));
export const smooth = (v,a,b) => { const x=clamp((v-a)/(b-a)); return x*x*(3-2*x); };

// Примерочная: какая услуга что делает с моделью.
// cam — точка на пути камеры, откуда эффект лучше всего видно;
// остальные поля — доли эффектов, которые складываются при выборе нескольких услуг.
export const SERVICE_VIEW = {
  body:     { cam: .06, wash: 1, gloss: 0,  interior: 0, water: 0 },
  interior: { cam: .42, wash: 0, gloss: 0,  interior: 1, water: 0 },
  polish:   { cam: .62, wash: 0, gloss: 1,  interior: 0, water: 0 },
  ceramic:  { cam: .84, wash: 0, gloss: .6, interior: 0, water: .84 },
};

// Базовое состояние примерочной — грязная нетронутая машина.
export const SERVICE_BASE = { cam: .06, wash: 0, gloss: 0, interior: 0, water: 0 };

// ─────────────────────────────────────────────────────────────────────────────
// Гараж услуг: все работы показываются на одной машине.
//
// SERVICES выше — четыре главы сайта, их количество проверяет check.mjs.
// Здесь список шире: каждая зона — это ракурс плюс набор эффектов, которые
// сцена уже умеет (wash, gloss, interior, water). Камера идёт по той же
// траектории из CAMERA_STOPS, поэтому новый ракурс — это просто своя доля
// пути, а не ещё одна точка: добавлять стопы не нужно.
//
// cam    — где на траектории встать, 0…1
// hold   — сколько секунд держать кадр в режиме показа
// Цены — минимальные из каталога meatwash-content.json.
export const ZONE_GROUPS = [
  { id: 'wash',    title: 'Мойка' },
  { id: 'paint',   title: 'Кузов и лак' },
  { id: 'cabin',   title: 'Салон' },
  { id: 'protect', title: 'Защита' },
];

export const ZONES = [
  {
    id: 'three-phase', group: 'wash', title: 'Трёхфазная мойка', from: 2150,
    caption: 'Пена, выдержка, ручная проработка — без кругов на лаке.',
    hold: 3.2,
  },
  {
    id: 'complex', group: 'wash', title: 'Комплексная с воском', from: 2850,
    caption: 'Кузов, диски и салон за один визит. Финиш горячим воском.',
    hold: 3.2,
  },
  {
    id: 'reagents', group: 'wash', title: 'Детейлинг от реагентов', from: 4950,
    caption: 'Соль уходит из порогов и арок — туда, куда пена не достаёт.',
    hold: 3.6,
  },
  {
    id: 'wheels', group: 'wash', title: 'Диски и шины', from: 400,
    caption: 'Диск чистится с внутренней стороны, резина — в чернение.',
    hold: 3.4,
  },
  {
    id: 'polish', group: 'paint', title: 'Полировка кузова', from: 40000,
    caption: 'Снимаем паутинку — отражение становится ровным.',
    hold: 4.2,
  },
  {
    id: 'chips', group: 'paint', title: 'Сколы и подкраска', from: 5000,
    caption: 'Точечно по месту, без перекраса всего элемента.',
    hold: 3.2,
  },
  {
    id: 'headlights', group: 'paint', title: 'Полировка фар', from: 5000,
    caption: 'Мутный поликарбонат снова даёт чёткий пучок света.',
    hold: 3.4,
  },
  {
    id: 'interior', group: 'cabin', title: 'Химчистка салона', from: 1000,
    caption: 'Ткань, алькантара и кожа — от детали до полной химчистки.',
    hold: 4.0,
  },
  {
    id: 'leather', group: 'cabin', title: 'Кожа и пластик', from: 2000,
    caption: 'Чистка и питание кожи, восстановление выгоревшего пластика.',
    hold: 3.6,
  },
  {
    id: 'ceramic', group: 'protect', title: 'Керамическое покрытие', from: 15000,
    caption: 'Вода собирается в каплю и уходит, не оставляя следов.',
    hold: 4.4,
  },
  {
    id: 'rain', group: 'protect', title: 'Антидождь на стёкла', from: 3000,
    caption: 'На скорости вода срывается со стекла сама.',
    hold: 3.4,
  },
  {
    id: 'film', group: 'protect', title: 'Оклейка зон риска', from: 180000,
    caption: 'Плёнка туда, где кузов страдает первым: капот, фары, пороги.',
    hold: 3.8,
  },
];

// Готовые наборы — как ступени тюнинга: собраны из зон выше.
export const ZONE_PRESETS = [
  { id: 'base',    title: 'База',     note: 'Мойка и диски',            zones: ['complex', 'wheels'] },
  { id: 'winter',  title: 'Зима',     note: 'Реагенты и защита стёкол', zones: ['reagents', 'wheels', 'rain'] },
  { id: 'full',    title: 'Полный',   note: 'Кузов, салон, керамика',   zones: ['complex', 'polish', 'interior', 'ceramic'] },
];

// ─────────────────────────────────────────────────────────────────────────────
// Витрина на фотографиях. 3D-модель заменена съёмкой: одна и та же машина
// в четырёх состояниях плюс детальный кадр под каждую работу.
//
// shot  — кадр, который показывается при выборе услуги
// pair  — если у работы есть честная пара «до/после», её можно показать
//         шторкой; before — состояние до работы, after — после
// Файлы лежат в assets/shots/<id>.webp (широкий) и <id>-s.webp (мобильный).

// Лестница состояний: по одному кадру на экран прокрутки.
// Порядок совпадает с главами прокрутки: приехала → мойка → салон → полировка →
// керамика → выдача. Кадры перекрёстно проявляются, поэтому переход плавный.
export const LADDER = [
  { id: 'arrive',   shot: 'cf-hero-dirty',     title: 'Как приехала', note: 'Зимняя плёнка, соль по порогам, диски в пыли.' },
  { id: 'body',     shot: 'cf-foam-crop',      title: 'Мойка',        note: 'Пена работает, грязь сходит вместе с ней.' },
  { id: 'interior', shot: 'cf-interior-seat',  title: 'Салон',        note: 'Кожа и ткань вычищены до запаха нового.' },
  { id: 'polish',   shot: 'cf-rq-bay',         title: 'Полировка',    note: 'Лак снова держит отражение целиком.' },
  { id: 'ceramic',  shot: 'cf-bead-macro',     title: 'Керамика',     note: 'Вода собирается каплей и уходит сама.' },
  { id: 'final',    shot: 'cf-hero-rear-wide', title: 'Готова',       note: 'Забирайте. Машина собрана.' },
];

// Кадр, с которого начинается ролик: машина ещё грязная.
export const FILM_OPEN = 'cf-hero-dirty';

export const ZONE_SHOTS = {
  'three-phase': { shot: 'cf-foam-crop' },
  'complex':     { shot: 'cf-rq-wet' },
  'reagents':    { shot: 'cf-sill-low' },
  'wheels':      { shot: 'cf-wheel-macro' },
  'polish':      { shot: 'cf-rq-bay' },
  'chips':       { shot: 'cf-chip-macro-healed', pair: { before: 'cf-chip-macro',   after: 'cf-chip-macro-healed' } },
  'headlights':  { shot: 'cf-front-corner',    pair: { before: 'cf-headlight-hazy', after: 'cf-front-corner' } },
  'interior':    { shot: 'cf-interior-seat' },
  'leather':     { shot: 'cf-dash-macro' },
  'ceramic':     { shot: 'cf-bead-macro' },
  'rain':        { shot: 'cf-windscreen' },
  'film':        { shot: 'cf-hood-crop' },
};

// Кадр по умолчанию, когда в гараже ничего не выбрано.
export const SHOT_BASE = 'cf-hero-clean';

// Куда смотреть, когда кадр обрезается по высоте (телефон в портрете).
// Без этого у макро-кадров главное уезжает за край: фара сидит слева,
// арка — правее центра. Значение по умолчанию — центр.
export const SHOT_FOCUS = {
  'cf-front-corner':   '30% 56%',
  'cf-headlight-hazy': '32% 58%',
  'cf-rq-bay':         '56% 56%',
  'cf-rq-wet':         '56% 56%',
  'cf-rq-swirl':       '56% 56%',
  'cf-rear-quarter':   '56% 56%',
  'cf-wheel-macro':    '54% 56%',
  'cf-sill-low':       '50% 62%',
  'cf-bead-macro':     '50% 46%',
  'cf-interior-seat':  '56% 50%',
  'cf-dash-macro':     '38% 52%',
};
