import {STOPS,clamp,smooth,LADDER} from './config.js';
import {setupUI} from './ui.js';
import {setupConfigurator} from './configurator.js';
import {setupProof} from './proof.js';

const $=s=>document.querySelector(s);
const section=$('#scene'),poster=$('.scene__poster'),posterImage=$('.scene__poster img');
const hero=$('.hero'),bar=$('.hero-bar'),header=$('#header'),finale=$('.finale');
const chapters=[...document.querySelectorAll('[data-chapter]')],chapterNav=$('.chapter-nav'),skip=$('.scene__skip');
const motion=matchMedia('(prefers-reduced-motion: reduce)'),controller=new AbortController();
const forceStatic=new URLSearchParams(location.search).get('motion')==='reduce';
const state={progress:0};let scene=null,trigger=null,tween=null,staticMode=false,active=-1,destroyed=false;
document.documentElement.dataset.viewport=String(innerWidth);
let lcpObserver;
if('PerformanceObserver' in window&&PerformanceObserver.supportedEntryTypes.includes('largest-contentful-paint')){
 lcpObserver=new PerformanceObserver(list=>{const last=list.getEntries().at(-1);if(last)document.documentElement.dataset.lcpMs=String(Math.round(last.startTime));});
 lcpObserver.observe({type:'largest-contentful-paint',buffered:true});
}
const isMobile=()=>innerWidth<=800&&innerHeight>innerWidth;
const range=()=>Math.max(1,section.offsetHeight-innerHeight);
// Первый экран считается пройденным, когда hero ушёл с экрана или начались главы.
const HERO_EXIT=.7;
// Столько ждём первый кадр витрины, прежде чем уйти в статичную версию.
const STAGE_TIMEOUT_MS=25000;
const scrollBehavior=()=>motion.matches?'instant':'smooth';

// Куда встанет блок после перехода к нему: с учётом отступа под шапку.
function landing(el){
 const pad=parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop)||0;
 return el.getBoundingClientRect().top+scrollY-pad-(parseFloat(getComputedStyle(el).scrollMarginTop)||0);
}
// «Следующий раздел» ниже сцены и в статичном режиме: первый блок, который
// начинается ниже текущего места. По progress здесь выбирать нельзя — он
// заморожен, и кнопка вела назад, к главам или к прайсу.
function nextBlock(){
 const blocks=[...(staticMode?[...chapters,finale]:[]),...document.querySelectorAll('main > section:not(#scene), body > footer')];
 const next=blocks.find(el=>el.offsetHeight&&landing(el)>scrollY+8);
 if(next)scrollTo({top:landing(next),behavior:scrollBehavior()});
}
function goToStop(key){
 if(key==='next'){
  if(staticMode||state.progress>.97||scrollY>=section.offsetTop+range()-4)return nextBlock();
  key=Object.keys(STOPS).find(k=>STOPS[k]>state.progress+.06)||'final';
 }
 if(staticMode){const el=key==='hero'?hero:key==='final'?finale:document.querySelector(`[data-chapter="${key}"]`);el?.scrollIntoView({behavior:scrollBehavior()});return;}
 if(!(key in STOPS))return;
 scrollTo({top:section.offsetTop+range()*STOPS[key],behavior:scrollBehavior()});
}
// Гараж услуг живёт поверх витрины и на время работы забирает у прокрутки
// выбор кадра: ScrollTrigger при этом остаётся живым, просто мы не даём ему
// менять кадр, пока открыта панель.
const cfgMount=document.createElement('div');
cfgMount.className='cfg-mount';
section.firstElementChild.append(cfgMount);
const configurator=setupConfigurator({
 mount:cfgMount,
 getScene:()=>scene,
 onOpen:()=>{document.querySelector('[data-cfg-open]')?.setAttribute('aria-expanded','true');},
 // После закрытия состояние слоёв восстанавливаем явно: иначе скрытые главы
 // остаются без inert и ловят фокус.
 onClose:()=>{document.querySelector('[data-cfg-open]')?.setAttribute('aria-expanded','false');apply(state.progress,true);},
});
document.addEventListener('click',e=>{
 const open=e.target.closest('[data-cfg-open]');
 if(open){e.preventDefault();configurator.isOpen?configurator.close():configurator.open(open);}
},{signal:controller.signal});
// Esc обрабатывает сам гараж: сначала выход из ролика или кинорежима и только
// потом закрытие панели. Здесь дубля быть не должно — он закрывал всё разом.
const cleanupUI=setupUI(goToStop);
// Шторки «до/после» живут отдельно от витрины: они работают и в статическом режиме.
const cleanupProof=setupProof();

// Единственный писатель состояния шапки: и прокрутка, и главы сцены идут сюда.
// В статичном режиме progress не движется, поэтому считается только прокрутка.
function updateChrome(){
 const past=scrollY>innerHeight*HERO_EXIT||(!staticMode&&state.progress>.05);
 header.classList.toggle('is-solid',past);
 document.body.classList.toggle('is-past-hero',past);
 // Панель гаража открыта, а витрина ушла с экрана: закрываем, иначе ниже
 // сцены пропадают кнопки записи, а панель уезжает вместе со сценой.
 if(configurator.isOpen&&section.getBoundingClientRect().bottom<innerHeight*.5)configurator.close();
}
function setVisibility(el,amount,interactive=true,force=false){
 el.style.opacity=amount.toFixed(3);
 const hidden=amount<.15;
 if(force||el.getAttribute('aria-hidden')!==String(hidden)){
  el.setAttribute('aria-hidden',String(hidden));
  // Пока открыт гараж, слои сцены заморожены: inert с них не снимаем.
  el.inert=hidden||!interactive||configurator.isOpen;
 }
}
function apply(progress,force=false){
 const p=clamp(progress);state.progress=p;
 const intro=1-smooth(p,.008,.07);
 setVisibility(hero,intro,true,force);setVisibility(bar,1-smooth(p,.015,.09),true,force);
 // Номер главы 1–4: на 0.90–0.91 (финал, навигация ещё видна) активной остаётся последняя.
 const index=Math.min(4,Math.floor(p*5+.5));
 section.firstElementChild.style.setProperty('--shade',String(smooth(p,.06,.15)*(1-smooth(p,.90,.97))));
 for(let i=0;i<chapters.length;i++){
  const center=(i+1)/5,d=Math.abs(p-center);
  const alpha=(1-smooth(d,.06,.10));setVisibility(chapters[i],alpha,true,force);
  chapters[i].style.transform=isMobile()?`translateY(${(1-alpha)*16}px)`:`translateY(calc(-50% + ${(1-alpha)*20}px))`;
 }
 setVisibility(finale,smooth(p,.91,.98),true,force);
 chapterNav.hidden=p<.10||p>.91;skip.classList.toggle('is-visible',p>.09&&p<.94);
 chapterNav.querySelector('i').style.width=`${p*100}%`;
 if(index!==active){
  active=index;
  chapterNav.querySelectorAll('button').forEach((button,i)=>{if(i+1===index)button.setAttribute('aria-current','step');else button.removeAttribute('aria-current');});
 }
 updateChrome();
 if(scene&&!configurator.isOpen&&scrollY<section.offsetTop+section.offsetHeight)scene.update(p);
 section.dataset.progress=p.toFixed(4);
}
function staticExperience(){
 if(staticMode)return;
 // Если человек уже ниже сцены, её высота меняется над ним: держим на месте
 // первый блок после сцены, чтобы текст не прыгал на экран вверх.
 const anchor=section.nextElementSibling,below=anchor&&section.getBoundingClientRect().bottom<=0;
 const anchorTop=below?anchor.getBoundingClientRect().top:0;
 staticMode=true;document.documentElement.classList.add('static-experience');
 // Гараж работает только поверх живой витрины: в статичном режиме его нет.
 configurator.close();document.body.classList.remove('cfg-ready');
 tween?.kill();trigger?.kill();scene?.dispose();scene=null;
 // progress больше не движется: иначе шапка остаётся «после hero» и на первом
 // экране видны две кнопки записи.
 state.progress=0;
 for(const el of [...chapters,hero,finale]){el.style.opacity='1';el.style.transform='';el.inert=false;el.setAttribute('aria-hidden','false');}
 poster.hidden=false;poster.style.opacity='1';posterImage.style.transform='';
 // До 900px — кадр 900 px, как у витрины (stage.js) и статичных глав (cinematic.css).
 posterImage.src=innerWidth<=900?posterImage.dataset.staticSrc.replace(/\.webp$/,'-s.webp'):posterImage.dataset.staticSrc;
 section.dataset.mode=(motion.matches||forceStatic)?'reduced-motion':'static-fallback';
 if(below)scrollBy(0,anchor.getBoundingClientRect().top-anchorTop);
 updateChrome();
}
async function start(){
 if(motion.matches||forceStatic||navigator.connection?.saveData){staticExperience();return;}
 if(!window.gsap||!window.ScrollTrigger){staticExperience();return;}
 const {gsap,ScrollTrigger}=window;gsap.registerPlugin(ScrollTrigger);
 tween=gsap.to(state,{progress:1,ease:'none',onUpdate:()=>apply(state.progress),scrollTrigger:{trigger:section,start:'top top',end:'bottom bottom',scrub:1.35,invalidateOnRefresh:true}});
 trigger=tween.scrollTrigger;apply(clamp(scrollY/range()));
 let st=null,timer=0;
 const mount=document.querySelector('.stage-mount');
 try{
  // Витрина на фотографиях вместо 3D: та же машина в четырёх состояниях.
  // Кадры перекрёстно проявляются, поэтому переход всегда плавный.
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  const started=performance.now();
  const {createStage}=await import('./stage.js');
  st=createStage(mount);
  const shotAt=p=>LADDER[Math.min(LADDER.length-1,Math.floor(clamp(p)*LADDER.length))].shot;
  // Витрина готова, когда загрузился кадр текущего места прокрутки. Не
  // загрузился (ошибка или лимит времени) — статичная версия.
  const first=st.preload(shotAt(state.progress));
  LADDER.forEach(step=>st.preload(step.shot));
  await Promise.race([first,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(`Первый кадр витрины не загрузился за ${STAGE_TIMEOUT_MS} мс`)),STAGE_TIMEOUT_MS);})]);
  clearTimeout(timer);
  const loaded={
   stage:st,
   // прокрутка ведёт машину по состояниям
   update(p){st.ladder(shotAt(p));},
   // гараж услуг подменяет кадр напрямую
   setManual(spec){
    if(!spec){this.update(state.progress);return;}
    if(spec.pair)st.showPair(spec.pair.before,spec.pair.after);
    else st.shot(spec.shot);
   },
   resize(){},dispose(){st.destroy();mount.replaceChildren();},
  };
  section.dataset.loadMs=String(Math.round(performance.now()-started));
  if(destroyed||staticMode){loaded.dispose();return;}
  scene=loaded;section.dataset.mode='photo';
  document.body.classList.add('cfg-ready');apply(state.progress);
 }catch(error){
  clearTimeout(timer);
  console.warn('Витрина не поднялась, остаётся статический вариант.',error);
  if(st&&!scene){st.destroy();mount.replaceChildren();}
  staticExperience();
 }
}

// Поворот телефона: высота трека сцены меняется (780svh ↔ 690svh, и сами svh),
// а scrollY остаётся прежним — человек оказывался в другой главе. Помним, где
// он был в прошлой раскладке, и после смены высоты трека возвращаем его туда же:
// внутри сцены — на ту же долю прогресса, ниже сцены — в то же место своего блока
// (ScrollTrigger.refresh() восстанавливает прежний scrollY, и без этого человек,
// читавший прайс, уезжал на тысячи пикселей).
const afterScene=[...document.querySelectorAll('main > section:not(#scene), body > footer')];
let track=null;
function remember(){
 if(staticMode){track=null;return;}
 const y=scrollY,top=section.offsetTop,h=section.offsetHeight;
 track={y,top,h,vh:innerHeight,block:null,px:0,share:0};
 if(y<=top+h-innerHeight)return;
 const block=afterScene.find(el=>el.offsetTop+el.offsetHeight>y);
 if(block){track.block=block;track.px=y-block.offsetTop;track.share=track.px/Math.max(1,block.offsetHeight);}
}
function keepSceneProgress(){
 if(staticMode||!track)return;
 const h=section.offsetHeight;
 if(h===track.h)return;
 const was=Math.max(1,track.h-track.vh),share=(track.y-track.top)/was,{block}=track;
 let target=null;
 if(share>=0&&share<=1)target=section.offsetTop+share*range();
 else if(block)target=block.offsetTop+(track.px<0?track.px:track.share*block.offsetHeight);
 if(target!==null){
  // Сначала пересчёт ScrollTrigger, потом прокрутка: refresh() возвращает
  // позицию, запомненную до поворота, и перебил бы нашу.
  window.ScrollTrigger?.refresh();
  scrollTo({top:Math.round(target),behavior:'instant'});
 }
 remember();
}
let resizeFrame=0;
addEventListener('resize',keepSceneProgress,{signal:controller.signal});
addEventListener('resize',()=>{cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(()=>{document.documentElement.dataset.viewport=String(innerWidth);scene?.resize();if(!staticMode)apply(state.progress);});},{signal:controller.signal});
addEventListener('scroll',()=>{updateChrome();remember();},{passive:true,signal:controller.signal});
motion.addEventListener('change',()=>{if(motion.matches)staticExperience();else location.reload();},{signal:controller.signal});
addEventListener('pagehide',event=>{if(event.persisted)return;destroyed=true;cancelAnimationFrame(resizeFrame);tween?.kill();trigger?.kill();scene?.dispose();lcpObserver?.disconnect();cleanupUI();cleanupProof();configurator.destroy();controller.abort();},{once:true});
document.fonts.ready.then(()=>window.ScrollTrigger?.refresh());
updateChrome();remember();
if(document.readyState==='loading')addEventListener('DOMContentLoaded',start,{once:true});else start();
