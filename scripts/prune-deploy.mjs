// Отсев файлов, которые опубликованная страница не запрашивает. Работает
// только на копии dist у раннера перед upload-pages-artifact: в репозитории
// файлы остаются — это исходники (ttf, логобук в PNG и других цветах) и
// картинки прошлых версий макета. Удалять их из репозитория решает владелец.
//
// Удаляются только пути из списка ниже и только если ни одной ссылки на имя
// файла нет в HTML, CSS, JS и credits.html выкладки. Сами кандидаты на отсев
// в этой проверке не участвуют.
//
// Запуск: node scripts/prune-deploy.mjs [папка]   (по умолчанию dist)
import {readdir, readFile, stat, rm} from 'node:fs/promises';
import {resolve, dirname, join, relative, basename} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(process.argv[2] || join(root, 'dist'));

// Исходники и варианты, которые страница не грузит.
const FILES = [
  'assets/img/hero-hq.webp',                // постер прошлой версии; теперь постер из assets/shots
  // Кадры глав и карта клуба прошлой версии: статичный режим берёт assets/shots, клуб — club-card.webp.
  'assets/img/body.webp',
  'assets/img/card-ceramic.webp',
  'assets/img/card-interior.webp',
  'assets/img/card-polish.webp',
  'assets/img/member-card.webp',
  // Логобук: на странице используются Horizontal_Logo.svg, Main_Logo_black.svg и Bull_Logo.svg (ролик гаража).
  'assets/brand/Bull_Logo.png',
  'assets/brand/Bull_Logo.svg',
  'assets/brand/Bull_Logo_black.png',
  'assets/brand/Bull_Logo_black.svg',
  'assets/brand/Bull_Logo_red.png',
  'assets/brand/Bull_Logo_red.svg',
  'assets/brand/Horizontal_Logo.png',
  'assets/brand/Horizontal_Logo_black.png',
  'assets/brand/Horizontal_Logo_black.svg',
  'assets/brand/Horizontal_Logo_red.png',
  'assets/brand/Horizontal_Logo_red.svg',
  'assets/brand/Main_Logo.png',
  'assets/brand/Main_Logo.svg',
  'assets/brand/Main_Logo_black.png',
  'assets/brand/Main_Logo_red.png',
  'assets/brand/Main_Logo_red.svg',
  // Шрифты подключаются в WOFF2; ttf — только исходники.
  'assets/fonts/arsenal-sc-bold.ttf',
  'assets/fonts/arsenal-sc-regular.ttf',
  'assets/fonts/manrope.ttf',
  // Текст набран Arsenal: Manrope и прежний файл Arsenal SC Regular не подключены.
  'assets/fonts/manrope.woff2',
  'assets/fonts/arsenal-sc-regular.woff2',
  'assets/favicon.png',                     // иконка теперь favicon-bull.png
  // Картинки, оставшиеся от прошлых версий макета.
  'assets/img/hero.webp',
  'assets/img/loc-myasnitskaya.webp',
  'assets/img/loc-technopark.webp',
  'assets/img/thumb-body.webp',
  'assets/img/thumb-interior.webp',
  'assets/img/thumb-polish.webp',
  'assets/img/thumb-ceramic.webp',
];

async function collect(dir) {
  const out = [];
  for (const entry of await readdir(dir, {withFileTypes: true})) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await collect(full));
    else out.push(full);
  }
  return out;
}

const all = await collect(dist);
const candidates = new Set(FILES.map(entry => resolve(dist, entry)));
const readable = all.filter(file => /\.(html|css|js|mjs|txt|xml)$/i.test(file) && !candidates.has(file));
const sources = await Promise.all(readable.map(file => readFile(file, 'utf8')));
const text = sources.join('\n');
const mentioned = name => text.includes(name);

let removed = 0, bytes = 0;

for (const entry of FILES) {
  const file = resolve(dist, entry);
  let size;
  try { size = (await stat(file)).size; } catch { continue; }
  if (mentioned(basename(entry))) { console.log(`оставлен (есть ссылка): ${entry}`); continue; }
  await rm(file);
  removed++; bytes += size;
  console.log(`удалён ${entry} — ${size} байт`);
}

console.log(`Из выкладки ${relative(root, dist) || dist} убрано ${removed} файлов, ${bytes} байт.`);
