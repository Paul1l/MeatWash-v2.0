import { SERVICES } from './config.js';

export function setupUI(goToStop) {
 const abort=new AbortController(), options={signal:abort.signal};
 const $=s=>document.querySelector(s);
 const menu=$('#mobile-menu'), burger=$('#burger'), booking=$('#booking'), details=$('#service-dialog');
 // Открытое меню держит фокус: всё, что под ним (страница, подвал, нижняя кнопка,
 // ссылка «к услугам»), на это время inert — Tab после последнего пункта не уходит
 // под меню, а чтение с экрана не видит закрытое им содержимое.
 const behindMenu=()=>document.querySelectorAll('.skip-link, main, body > footer, .mobile-cta');
 const setMenu=open=>{
   menu.hidden=!open; burger.setAttribute('aria-expanded',String(open)); burger.setAttribute('aria-label',open?'Закрыть меню':'Открыть меню');
   document.body.classList.toggle('menu-open',open);
   behindMenu().forEach(el=>{el.inert=open;});
 };
 const closeMenu=()=>{ if(menu.hidden) return; const inside=menu.contains(document.activeElement); setMenu(false); if(inside) burger.focus({preventScroll:true}); };
 // Окно открыто только что: второй клик двойного клика (или двойного тапа)
 // приходится в ту же точку — по фону он закрывал окно, по ссылке филиала
 // сам открывал запись. Такие клики по окну игнорируем.
 let openedAt=0;
 const show=dialog=>{ if(dialog.open) return; dialog.showModal(); openedAt=performance.now(); };
 const settling=e=>e.detail>1||performance.now()-openedAt<400;
 const context=$('#booking-context'), lead=$('#booking-lead'), hint=$('#booking-hint'), branches=booking.querySelector('.dialog__branches');
 // Что именно выбрал человек — только текстом, без разметки.
 const setContext=note=>{ context.textContent=note?'Вы выбрали: '+note:''; context.hidden=!note; };
 // Запись: филиал выбирается здесь, потому что у площадок разные компании в yclients.
 const openBooking=(note='')=>{
   closeMenu(); details.close();
   $('#booking-title').textContent='Записаться';
   setContext(note); lead.hidden=true; hint.hidden=false; branches.hidden=false;
   show(booking);
   // Фокус на заголовке, а не на Мясницкой: иначе она выглядела выбранной по умолчанию.
   $('#booking-title').focus({preventScroll:true});
 };
 // Разговор с администратором: телефоны без онлайн-записи.
 const openMembership=(title='')=>{
   closeMenu(); details.close();
   $('#booking-title').textContent=title||'Meatwash Car Care Club';
   setContext(''); lead.hidden=false; hint.hidden=true; branches.hidden=true;
   show(booking);
 };
 burger.addEventListener('click',()=>{ if(menu.hidden) setMenu(true); else closeMenu(); },options);
 document.querySelector('.body-types')?.addEventListener('change',event=>{
  const input=event.target;if(input.name!=='body-type')return;
  const index=Number(input.value);
  document.querySelectorAll('[data-program-price]').forEach(price=>{price.textContent=Number(price.dataset.prices.split(',')[index]).toLocaleString('ru-RU')+' ₽';});
  $('#body-price-label').textContent='Цены для типа кузова: '+input.closest('label').querySelector('span').textContent;
 },options);
 document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenu();},options);
 // Бургер есть только до 900px. Меню открыли на планшете и повернули его —
 // шапка стала десктопной, а меню и блокировка прокрутки остались.
 const narrow=matchMedia('(max-width: 900px)');
 narrow.addEventListener('change',()=>{ if(!narrow.matches&&!menu.hidden) closeMenu(); },options);
 document.addEventListener('pointerdown',function closeOnOutside(e){ if(menu.hidden) return; if(menu.contains(e.target)||burger.contains(e.target)) return; closeMenu(); },options);
 document.addEventListener('click',e=>{
  const control=e.target.closest('a,button'); if(!control)return;
  if(control.hasAttribute('data-book')) return openBooking(control.dataset.bookContext||'');
  if(control.hasAttribute('data-membership')) return openMembership(control.dataset.membership);
  if(control.dataset.service){
   e.preventDefault();
   const service=SERVICES[control.dataset.service]; if(!service)return;
   // «Записаться» из окна услуги уносит её название в выбор филиала.
   details.querySelector('[data-book]').dataset.bookContext=service.title;
   $('#service-all-prices').href='#'+({body:'programs',interior:'price-interior',polish:'price-polish',ceramic:'price-protection'}[control.dataset.service]||'services');
   $('#service-label').textContent=service.label; $('#service-title').textContent=service.title;
   $('#service-description').textContent=service.description;
   $('#service-prices').replaceChildren(...service.prices.map(([name,price])=>{
    const row=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');
    dt.textContent=name;dd.textContent=`от ${price.toLocaleString('ru-RU')} ₽`;row.append(dt,dd);return row;
   }));show(details);return;
  }
  if(control.dataset.sceneStop){e.preventDefault();closeMenu();goToStop(control.dataset.sceneStop);return;}
  if(control.hasAttribute('data-scroll-next')){goToStop('next');return;}
  const hash=control.getAttribute('href');
  if(hash?.startsWith('#')){const target=document.getElementById(hash.slice(1));if(target){e.preventDefault();closeMenu();details.close();booking.close();if(target.tagName==='DETAILS')target.open=true;target.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});if(!target.matches('a[href],button,input,select,textarea,summary,[tabindex]'))target.setAttribute('tabindex','-1');target.focus({preventScroll:true});history.replaceState(null,'',hash);}}
 },options);
 const outside=(dialog,e)=>{const r=dialog.getBoundingClientRect();return e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom;};
 for(const dialog of [booking,details]){
  // Закрываем по фону, только если и нажатие, и отпускание были вне окна:
  // выделение текста, отпущенное за краем окна, его больше не закрывает.
  let downOutside=false;
  dialog.addEventListener('pointerdown',e=>{downOutside=e.target===dialog&&outside(dialog,e);},options);
  dialog.addEventListener('click',e=>{
   if(settling(e)){ if(e.target.closest('a[href]')) e.preventDefault(); return; }
   if(e.target===dialog&&downOutside&&outside(dialog,e)) dialog.close();
  },options);
 }
 const observer=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){entry.target.classList.add('is-in');observer.unobserve(entry.target);}},{threshold:.1});
 document.querySelectorAll('[data-reveal]').forEach(el=>observer.observe(el));
 return ()=>{abort.abort();observer.disconnect();};
}
