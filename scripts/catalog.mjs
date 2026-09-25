import {readFile,writeFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
const d=JSON.parse(await readFile(new URL('dist/assets/meatwash-content.json',root),'utf8'));
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>n.toLocaleString('ru-RU')+' ₽';
const number=n=>String(n+1).padStart(2,'0');
// Счётчики в подводках берутся из данных, а не пишутся руками: после правки
// программ или услуг в JSON текст обновляется сам.
const NOMINATIVE=['ноль','одна','две','три','четыре','пять','шесть','семь','восемь','девять','десять'];
const PREPOSITIONAL=['нуле','одном','двух','трёх','четырёх','пяти','шести','семи','восьми','девяти','десяти'];
const plural=(n,one,few,many)=>{const rest=Math.abs(n)%100,last=rest%10;return rest>10&&rest<20?many:last===1?one:last>1&&last<5?few:many;};
const word=(list,n)=>list[n]??String(n);
const capital=s=>s.charAt(0).toUpperCase()+s.slice(1);
export function renderCatalog(){
 const programCount=d.programs.length,groupCount=d.groups.length;
 const serviceCount=d.groups.reduce((sum,group)=>sum+group.items.length,0);
 const programsLine=`${capital(word(NOMINATIVE,programCount))} ${plural(programCount,'программа','программы','программ')} мойки`;
 const servicesLine=`${serviceCount} ${plural(serviceCount,'работа','работы','работ')} в ${word(PREPOSITIONAL,groupCount)} ${groupCount===1?'направлении':'направлениях'}`;
 return `
<section class="catalog" id="services" aria-labelledby="catalog-title">
 <div class="catalog__heading"><div><p class="eyebrow" lang="en">MEATWASH / CAR CARE</p><h2 id="catalog-title">Искусство ухода.<br>В деталях.</h2></div><p>${programsLine} и весь спектр детейлинга. Выберите уход под состояние автомобиля — от регулярной мойки до восстановления и защиты.</p></div>
 <div class="catalog__section" id="programs">
  <div class="catalog__aside"><span class="eyebrow" lang="en">01 / WASH</span><h3>Программы<br> мойки</h3><p>Каждая следующая программа включает предыдущую.</p></div>
  <div class="catalog__content"><fieldset class="body-types"><legend>Тип кузова</legend>${d.bodyTypes.map((type,i)=>`<label><input type="radio" name="body-type" value="${i}"${i===0?' checked':''}><span>${escape(type)}</span></label>`).join('')}</fieldset>
   <p class="catalog__selection" id="body-price-label" aria-live="polite">Цены для типа кузова: ${escape(d.bodyTypes[0])}</p>
   ${d.programs.map(([name,price,time,description],i)=>`<details class="catalog__entry program-entry" id="program-${i}"><summary><span class="catalog__number">${number(i)}</span><span class="catalog__name">${escape(name)}</span><span class="catalog__time">${escape(time)}</span><span class="catalog__price" data-program-price data-prices="${d.programPrices[i].join(',')}">${money(price)}</span><span class="catalog__toggle" aria-hidden="true">+</span></summary><div class="catalog__expanded"><p>${escape(description)}</p><ul class="program-includes">${d.programIncludes[i].map(item=>`<li>${escape(item)}</li>`).join('')}</ul><button class="btn btn--ghost" type="button" data-book data-book-context="${escape(name)}">Записаться <span aria-hidden="true">→</span></button></div></details>`).join('\n')}
   <p class="catalog__note">Состав программы уточняется на приёмке с учётом состояния автомобиля и выбранной площадки.</p>
  </div>
 </div>
 <div class="catalog__section" id="price-list">
  <div class="catalog__aside"><span class="eyebrow" lang="en">02 / DETAILING</span><h3>Услуги<br> и цены</h3><p>${servicesLine}. Дополните программу мойки или запишитесь на отдельную услугу.</p><a class="link-arrow" href="#locations">Выбрать локацию <span aria-hidden="true">↓</span></a></div>
  <div class="catalog__content">${d.groups.map((group,i)=>`<details class="catalog__entry service-group" id="price-${escape(group.id)}"><summary><span class="catalog__number">${number(i)}</span><span class="catalog__name">${escape(group.title)}</span><span class="catalog__count">${group.items.length} поз.</span><span class="catalog__toggle" aria-hidden="true">+</span></summary><div class="catalog__expanded"><p>${escape(group.desc)}</p><dl class="catalog__prices">${group.items.map(([name,price])=>`<div data-price-item><dt>${escape(name)}</dt><dd>${money(price)}</dd></div>`).join('')}</dl><button class="btn btn--ghost" type="button" data-book data-book-context="${escape(group.title)}">Записаться <span aria-hidden="true">→</span></button></div></details>`).join('\n')}
   <div class="catalog__extra"><span>Порошковая покраска дисков<small>Детейлинг-центр Технопарк</small></span><button type="button" class="link-arrow" data-membership="Покраска дисков">Уточнить стоимость <span aria-hidden="true">→</span></button></div>
   <p class="catalog__note">Стоимость зависит от типа кузова и состояния автомобиля. Итоговый объём и цену согласуем перед работой. Не является публичной офертой.</p>
  </div>
 </div>
 <div class="catalog__concierge"><div><p class="eyebrow" lang="en">INDIVIDUAL CARE</p><h3>Под вашу задачу.</h3><p>Комплекс перед продажей, защита нового автомобиля или регулярный уход за автопарком. Для корпоративных клиентов — индивидуальный расчёт, консьерж-сервис и единый счёт.</p></div><button class="btn btn--fill" type="button" data-membership="Индивидуальный уход">Обсудить уход <span aria-hidden="true">→</span></button></div>
</section>
`}
const page=new URL('dist/index.html',root),html=await readFile(page,'utf8');
const start='<!-- CATALOG:START -->',end='<!-- CATALOG:END -->';
if(!html.includes(start)||!html.includes(end))throw new Error('Catalog markers missing');
const output=html.slice(0,html.indexOf(start)+start.length)+renderCatalog()+html.slice(html.indexOf(end));
await writeFile(page,output);
console.log(`Rendered ${d.programs.length} wash programs, ${d.programs.length*d.bodyTypes.length} body prices and ${d.groups.reduce((sum,group)=>sum+group.items.length,0)} services.`);
