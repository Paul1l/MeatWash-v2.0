import {readFile,readdir,stat} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),dist=resolve(root,'dist');
const html=await readFile(resolve(dist,'index.html'),'utf8');
const ids=new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]));
const failures=[];
// Локальные адреса страницы: src, href, srcset и постер статичного режима.
const urls=[...html.matchAll(/(?:src|href|data-static-src)="([^"]+)"/g)].map(m=>m[1]);
for(const [,set] of html.matchAll(/srcset="([^"]+)"/g))urls.push(...set.split(',').map(part=>part.trim().split(/\s+/)[0]));
for(const url of urls){
 if(/^(https?:|tel:|data:)/.test(url))continue;
 if(url.startsWith('#')){if(!ids.has(url.slice(1)))failures.push(`Missing anchor: ${url}`);continue;}
 try{await stat(resolve(dist,url));}catch{failures.push(`Missing file: ${url}`);}
}
for(const filename of await readdir(resolve(dist,'js'))){
 if(!filename.endsWith('.js'))continue;
 const text=await readFile(resolve(dist,'js',filename),'utf8');
 const result=spawnSync(process.execPath,['--check','--input-type=module'],{input:text,encoding:'utf8'});
 if(result.status!==0)failures.push(`${filename}: ${result.stderr}`);
 for(const [,url] of text.matchAll(/(?:from\s*|import\()['"](\.[^'"]+)['"]/g)){
  try{await stat(resolve(dist,'js',url));}catch{failures.push(`Missing module: ${url}`);}
 }
}
// url() во всех таблицах стилей, которые подключает страница.
const stylesheets=[...html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*href="css\/([^"]+)"/g)].map(m=>m[1]);
assert(stylesheets.length>=6,'Stylesheets not found in index.html');
for(const name of stylesheets){
 const css=await readFile(resolve(dist,'css',name),'utf8');
 for(const [,url] of css.matchAll(/url\(['"]?([^)'"\s]+)['"]?\)/g)){
  try{await stat(resolve(dist,'css',url));}catch{failures.push(`Missing CSS asset: ${name}: ${url}`);}
 }
}
const content=JSON.parse(await readFile(resolve(dist,'assets/meatwash-content.json')));
assert.equal(content.programs.length,5);
assert.equal(content.bodyTypes.length,4);
assert.equal(content.groups.flatMap(group=>group.items).length,39);
assert.deepEqual(content.programPrices,[[2150,2250,2450,2650],[2850,3150,3450,4250],[4950,5450,5950,6450],[6450,7450,8450,9450],[13950,14950,15950,16950]]);
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
for(const group of content.groups){
 assert(ids.has('price-'+group.id),'Missing price group '+group.id);
 for(const [name,price] of group.items)assert(html.includes(`<dt>${escape(name)}</dt><dd>${price.toLocaleString('ru-RU')} ₽</dd>`),'Missing or stale service '+name);
}
for(const prices of content.programPrices)assert(html.includes(`data-prices="${prices.join(',')}"`),'Stale body-type prices');
assert.equal([...html.matchAll(/data-price-item/g)].length,39);
const config=await import('data:text/javascript;base64,'+Buffer.from(await readFile(resolve(dist,'js/config.js'),'utf8')).toString('base64'));
assert.deepEqual(Object.values(config.STOPS),[0,.2,.4,.6,.8,1]);
assert.equal(Object.keys(config.SERVICES).length,4);
const sourcePrices=new Set([...content.programs.map(x=>x[1]),...content.groups.flatMap(g=>g.items.map(x=>x[1]))]);
for(const service of Object.values(config.SERVICES))for(const [,price] of service.prices)assert(sourcePrices.has(price),'Unsupported price '+price);
// Гараж услуг: цены «от» — только из JSON.
for(const zone of config.ZONES)assert(sourcePrices.has(zone.from),'Unsupported garage price '+zone.id+' '+zone.from);

// Витрина на фотографиях: каждый кадр из config.js есть в двух размерах.
const shots=new Set([...config.LADDER.map(step=>step.shot),config.SHOT_BASE,config.FILM_OPEN,...Object.keys(config.SHOT_FOCUS)]);
for(const spec of Object.values(config.ZONE_SHOTS)){shots.add(spec.shot);if(spec.pair){shots.add(spec.pair.before);shots.add(spec.pair.after);}}
for(const id of shots)for(const file of [`assets/shots/${id}.webp`,`assets/shots/${id}-s.webp`]){
 try{await stat(resolve(dist,file));}catch{failures.push('Missing stage shot: '+file);}
}
assert.equal(config.LADDER.length,6);

// Модули, которые реально грузит страница: скрипты из index.html и всё, что они импортируют.
const modules=new Set([...html.matchAll(/<script\b[^>]*\bsrc="js\/([^"]+)"/g)].map(m=>m[1]));
for(const name of modules){
 const text=await readFile(resolve(dist,'js',name),'utf8');
 for(const [,url] of text.matchAll(/(?:from\s*|import\()['"]\.\/([^'"]+)['"]/g))modules.add(url);
}
const pageCode=[html,...await Promise.all([...modules].map(name=>readFile(resolve(dist,'js',name),'utf8')))].join('\n');
// 3D-сцены нет: страница работает на фото-витрине. Если кто-то вернёт
// модули сцены, three или модель — проверка это поймает.
assert(modules.has('stage.js'),'Page must load the photo stage (stage.js)');
for(const name of ['scene.bundle.js','scene.js','garage.js','interior.js','water.js'])assert(!modules.has(name),'3D module is loaded by the page: '+name);
assert(!/porsche-930|\.glb\b|importmap|vendor\/build|vendor\/examples/.test(pageCode),'Page still references the 3D scene');

// У площадок разные компании в yclients: общий адрес открывает только одну из них.
const bookings=new Set();
for(const location of content.locations){
 assert(/^https:\/\/n\d+\.yclients\.com\/company\/\d+\//.test(location.booking||''),'Missing yclients link for '+location.id);
 assert(html.includes(`href="${location.booking}"`),'Booking link for '+location.id+' missing on the page');
 bookings.add(location.booking);
}
assert.equal(bookings.size,content.locations.length,'Branches must have different booking links');
// Любая другая ссылка на yclients (например, общая n975571.yclients.com) — ошибка.
for(const [url] of pageCode.matchAll(/https?:\/\/[\w.-]*yclients\.com[^"'\s<)]*/g))assert(bookings.has(url),'Unexpected yclients link on the page: '+url);

assert.equal(failures.length,0,failures.join('\n'));
console.log(`PASS: JS syntax, module paths, local assets (src, srcset, CSS url), anchors, six scroll stops, four services, supplied and garage prices, ${shots.size} stage shots, no 3D on the page, both branch booking destinations, no shared yclients link.`);
