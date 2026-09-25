import {STOPS,clamp,smooth,LADDER} from './config.js';
import {setupUI} from './ui.js';
import {setupConfigurator} from './configurator.js';
import {setupProof} from './proof.js';

const $=s=>document.querySelector(s);
const section=$('#scene'),canvas=$('#porsche'),poster=$('.scene__poster'),posterImage=$('.scene__poster img');
const loading=$('.scene__loading');
const hero=$('.hero'),bar=$('.hero-bar'),dot=$('.hero__dot'),header=$('#header'),finale=$('.finale');
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

function goToStop(key){
 if(key==='next'){
  if(state.progress>.97)return $('#services').scrollIntoView({behavior:motion.matches?'instant':'smooth'});
  key=Object.keys(STOPS).find(k=>STOPS[k]>state.progress+.06)||'final';
 }
 if(staticMode){const el=key==='hero'?hero:key==='final'?finale:document.querySelector(`[data-chapter="${key}"]`);el?.scrollIntoView({behavior:motion.matches?'instant':'smooth'});return;}
 if(!(key in STOPS))return;
 scrollTo({top:section.offsetTop+range()*STOPS[key],behavior:motion.matches?'instant':'smooth'});
}
// Примерочная живёт поверх сцены и на время работы забирает управление моделью
// у прокрутки: ScrollTrigger при этом остаётся живым, просто мы не даём ему
// перерисовывать машину, пока открыт конфигуратор.
const cfgMount=document.createElement('div');
cfgMount.className='cfg-mount';
section.firstElementChild.append(cfgMount);
const configurator=setupConfigurator({
 mount:cfgMount,
 getScene:()=>scene,
 onOpen:()=>{document.querySelector('[data-cfg-open]')?.setAttribute('aria-expanded','true');},
 onClose:()=>{document.querySelector('[data-cfg-open]')?.setAttribute('aria-expanded','false');if(scene)scene.update(state.progress,true);},
});
document.addEventListener('click',e=>{
 const open=e.target.closest('[data-cfg-open]');
 if(open){e.preventDefault();configurator.isOpen?configurator.close():configurator.open();}
},{signal:controller.signal});
// Esc обрабатывает сам гараж: сначала выход из ролика или кинорежима и только
// потом закрытие панели. Здесь дубля быть не должно — он закрывал всё разом.
const cleanupUI=setupUI(goToStop);
// Шторки «до/после» живут отдельно от витрины: они работают и в статическом режиме.
const cleanupProof=setupProof();

function setVisibility(el,amount,interactive=true){
 el.style.opacity=amount.toFixed(3);
 const hidden=amount<.15;
 if(el.getAttribute('aria-hidden')!==String(hidden)){el.setAttribute('aria-hidden',String(hidden));el.inert=hidden||!interactive;}
}
function apply(progress){
 const p=clamp(progress);state.progress=p;
 const intro=1-smooth(p,.008,.07);
 setVisibility(hero,intro);setVisibility(bar,1-smooth(p,.015,.09));setVisibility(dot,intro);
 
 const index=Math.min(5,Math.floor(p*5+.5));
 section.firstElementChild.style.setProperty('--shade',String(smooth(p,.06,.15)*(1-smooth(p,.90,.97))));
 for(let i=0;i<chapters.length;i++){
  const center=(i+1)/5,d=Math.abs(p-center);
  const alpha=(1-smooth(d,.06,.10));setVisibility(chapters[i],alpha);
  chapters[i].style.transform=isMobile()?`translateY(${(1-alpha)*16}px)`:`translateY(calc(-50% + ${(1-alpha)*20}px))`;
 }
 setVisibility(finale,smooth(p,.91,.98));
 chapterNav.hidden=p<.10||p>.91;skip.classList.toggle('is-visible',p>.09&&p<.94);
 chapterNav.querySelector('i').style.width=`${p*100}%`;
 if(index!==active){
  active=index;
  chapterNav.querySelectorAll('button').forEach((button,i)=>{if(i+1===index)button.setAttribute('aria-current','step');else button.removeAttribute('aria-current');});
 }
 header.classList.toggle('is-solid',p>.09||scrollY>range());
 if(scene&&!configurator.isOpen&&scrollY<section.offsetTop+section.offsetHeight)scene.update(p);
 section.dataset.progress=p.toFixed(4);
}
function staticExperience(){
 staticMode=true;document.documentElement.classList.add('static-experience');
 tween?.kill();trigger?.kill();scene?.dispose();scene=null;
 for(const el of [...chapters,hero,finale]){el.style.opacity='1';el.style.transform='';el.inert=false;el.setAttribute('aria-hidden','false');}
 poster.hidden=false;poster.style.opacity='1';posterImage.style.transform='';
 posterImage.src=posterImage.dataset.staticSrc;
 section.dataset.mode=(motion.matches||forceStatic)?'reduced-motion':'static-fallback';
}
async function start(){
 if(motion.matches||forceStatic||navigator.connection?.saveData){staticExperience();return;}
 if(!window.gsap||!window.ScrollTrigger){staticExperience();return;}
 const {gsap,ScrollTrigger}=window;gsap.registerPlugin(ScrollTrigger);
 tween=gsap.to(state,{progress:1,ease:'none',onUpdate:()=>apply(state.progress),scrollTrigger:{trigger:section,start:'top top',end:'bottom bottom',scrub:1.35,invalidateOnRefresh:true}});
 trigger=tween.scrollTrigger;apply(clamp(scrollY/range()));
 try{
  // Витрина на фотографиях вместо 3D: та же машина в четырёх состояниях.
  // Кадры перекрёстно проявляются, поэтому переход всегда плавный.
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  const started=performance.now();
  const {createStage}=await import('./stage.js');
  const st=createStage(document.querySelector('.stage-mount'));
  LADDER.forEach(step=>st.preload(step.shot));
  const loaded={
   stage:st,
   // прокрутка ведёт машину по состояниям
   update(p){const i=Math.min(LADDER.length-1,Math.floor(clamp(p)*LADDER.length));st.ladder(LADDER[i].shot);},
   // гараж услуг подменяет кадр напрямую
   setManual(spec){
    if(!spec){this.update(state.progress);return;}
    if(spec.pair)st.showPair(spec.pair.before,spec.pair.after);
    else st.shot(spec.shot);
   },
   resize(){},dispose(){st.destroy();},
  };
  section.dataset.loadMs=String(Math.round(performance.now()-started));
  if(destroyed)return;
  scene=loaded;section.dataset.mode='photo';apply(state.progress);
 }catch(error){
  console.warn('Витрина не поднялась, остаётся статический вариант.',error);
  staticExperience();
 }
}

// Render on camera changes and bounded resize events, rather than a perpetual RAF.
let resizeFrame=0;
addEventListener('resize',()=>{cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(()=>{document.documentElement.dataset.viewport=String(innerWidth);scene?.resize();if(!staticMode)apply(state.progress);});},{signal:controller.signal});
addEventListener('scroll',()=>header.classList.toggle('is-solid',scrollY>90),{passive:true,signal:controller.signal});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)scene?.resize();},{signal:controller.signal});
motion.addEventListener('change',()=>{if(motion.matches)staticExperience();else location.reload();},{signal:controller.signal});
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();staticExperience();},{signal:controller.signal});
addEventListener('pagehide',event=>{if(event.persisted)return;destroyed=true;cancelAnimationFrame(resizeFrame);tween?.kill();trigger?.kill();scene?.dispose();lcpObserver?.disconnect();cleanupUI();cleanupProof();configurator.destroy();controller.abort();},{once:true});
document.fonts.ready.then(()=>window.ScrollTrigger?.refresh());
if(document.readyState==='loading')addEventListener('DOMContentLoaded',start,{once:true});else start();
