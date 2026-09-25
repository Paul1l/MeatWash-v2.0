import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'meshoptimizer/decoder';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {buildInterior} from './interior.js';
import {buildGarage} from './garage.js';
import {createWater} from './water.js';
import {CAMERA_STOPS,clamp,smooth} from './config.js';

export async function createScene(canvas){
 const loadingStarted=performance.now();
 const mobile=()=>innerWidth<=800&&innerHeight>innerWidth;
 const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
 renderer.setPixelRatio(Math.min(devicePixelRatio,mobile()?1:1.25));
 renderer.transmissionResolutionScale=.5;
 renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.98;
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 const scene=new THREE.Scene();scene.background=new THREE.Color('#080808');scene.fog=new THREE.FogExp2('#080808',.014);
 const camera=new THREE.PerspectiveCamera(35,1,.018,80);
 const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
 const [garage,gltf]=await Promise.all([buildGarage(scene,renderer),loader.loadAsync('./assets/porsche-930-optimized.glb')]);
 canvas.dataset.assetsMs=String(Math.round(performance.now()-loadingStarted));
 const car=gltf.scene;car.updateMatrixWorld(true);
 const body=car.getObjectByName('Object_113');
 const bounds=new THREE.Box3().setFromObject(body),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
 const bottom=new THREE.Box3().setFromObject(car.getObjectByName('Object_9')).min.y,scale=4.4/size.z;
 car.scale.setScalar(scale);car.position.set(-center.x*scale,-bottom*scale,-center.z*scale);scene.add(car);car.updateMatrixWorld(true);
 const paint=new THREE.MeshPhysicalMaterial({name:'Meatwash oxblood lacquer',color:'#44080f',roughness:.24,metalness:.22,clearcoat:1,clearcoatRoughness:.065,envMapIntensity:1.1});
 const finish={value:1},clean={value:1};
 // Fine concentric imperfections live on the surface and disappear with scroll polishing.
 paint.onBeforeCompile=shader=>{
  shader.uniforms.uFinish=finish;shader.uniforms.uClean=clean;
  shader.vertexShader='varying vec3 vSurface;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvSurface=position;');
  shader.fragmentShader='uniform float uFinish;uniform float uClean;varying vec3 vSurface;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
   float rings=pow(max(0.0,sin(length(vSurface.xz*1.7-vec2(.2,.9))*1650.0)),24.0);
   float grain=fract(sin(dot(vSurface.xz,vec2(127.1,311.7)))*43758.5453);
   roughnessFactor=clamp(roughnessFactor+(1.0-uFinish)*(.18+.13*rings)+(1.0-uClean)*.12,0.035,1.0);
   diffuseColor.rgb*=mix(.88,1.0,uClean)+(grain-.5)*.012;
  `);
 };
 paint.customProgramCacheKey=()=> 'meatwash-paint-v2';
 const glass=[],unused=new Set();
 car.traverse(o=>{
  if(!o.isMesh)return;o.castShadow=true;o.receiveShadow=true;const m=o.material;
  if(['material_0','930_wunderbaum'].includes(m.name)){o.visible=false;return;}
  if(m.name==='paint'){paint.aoMap=m.aoMap;paint.aoMapIntensity=.7;o.material=paint;unused.add(m);}
  else if(m.name==='coat'){o.visible=false;}
  else if(m.name==='glass'){
   o.material=new THREE.MeshPhysicalMaterial({color:'#d5d8d3',metalness:0,roughness:.055,transmission:.94,thickness:.004,ior:1.52,transparent:true,opacity:1,depthWrite:false,envMapIntensity:.7});glass.push(o);
  }else if(m.name==='black'){m.color.set('#0b0908');m.roughness=.82;m.metalness=0;}
  else if(m.name==='930_plastics'){m.color.set('#827265');m.roughness=.6;m.metalness=.03;}
  else if(m.name==='930_chromes'){m.color.set('#d6cec2');m.roughness=.18;m.metalness=1;m.envMapIntensity=1.2;}
  else if(m.name==='930_tire'){m.color.set('#38322d');m.roughness=.93;m.metalness=0;}
  else if(m.name==='930_rim'){m.roughness=.23;m.envMapIntensity=1.2;}
  else if(m.name==='930_lights'){m.color.setRGB(1.5,1.5,1.5);m.roughness=.16;m.metalness=.65;}
  else if(m.name==='930_lights_refraction'){o.material=new THREE.MeshPhysicalMaterial({color:'#ffffff',roughness:.13,metalness:.2,transmission:.45,thickness:.004,ior:1.52});}
  if(o.material.map)o.material.map.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());
 });
 const cabin=buildInterior(scene,car);cabin.name='Clean leather cockpit';batchInterior(cabin);
 const lens=car.getObjectByName('Object_130')?.material;
 car.traverse(o=>{if(o.isMesh&&o.material.ior===1.52&&!glass.includes(o)&&lens?.normalMap){o.material.normalMap=lens.normalMap;o.material.map=lens.map;o.material.color.setRGB(2.1,2.1,2.1);}});
 const water=createWater(scene,car.getObjectByName('Object_30'),mobile());
 canvas.dataset.setupMs=String(Math.round(performance.now()-loadingStarted));
 renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;
 let current=0,lastWidth=0,lastHeight=0,disposed=false,frameCount=0,lastFrame=0;
 // Режим примерочной: услуги выбираются вручную, эффекты складываются.
 // null — обычный режим, всё как раньше ведёт прокрутка.
 let manual=null;
 const renderSamples=[],intervalSamples=[];
 const median=samples=>samples.length?[...samples].sort((a,b)=>a-b)[Math.floor(samples.length/2)]:0;
 const cp=new THREE.Vector3(),look=new THREE.Vector3(),nextLook=new THREE.Vector3();
 function resize(){const {width,height}=canvas.parentElement.getBoundingClientRect();lastWidth=width;lastHeight=height;renderer.setSize(width,height,false);renderer.setPixelRatio(Math.min(devicePixelRatio,mobile()?1:1.25));camera.aspect=width/height;}
 function update(progress,force=false){
  if(disposed||document.hidden)return;current=progress;
  if(!lastWidth||force)resize();
  const camAt=manual?manual.cam:progress;
  const raw=clamp(camAt)*5,index=Math.min(4,Math.floor(raw));
  const t=smooth(raw-index,.13,.87),a=CAMERA_STOPS[index],b=CAMERA_STOPS[index+1];
  let angleA=Math.atan2(a.p[0],a.p[2]),delta=Math.atan2(b.p[0],b.p[2])-angleA;
  if(delta>Math.PI)delta-=Math.PI*2;if(delta< -Math.PI)delta+=Math.PI*2;
  const angle=angleA+delta*t,radius=THREE.MathUtils.lerp(Math.hypot(a.p[0],a.p[2]),Math.hypot(b.p[0],b.p[2]),t);
  cp.set(Math.sin(angle)*radius,THREE.MathUtils.lerp(a.p[1],b.p[1],t),Math.cos(angle)*radius);
  look.fromArray(a.t).lerp(nextLook.fromArray(b.t),t);camera.fov=THREE.MathUtils.lerp(a.f,b.f,t);
  if(mobile()){
   const detail=smooth(camAt,.04,.18)*(1-smooth(camAt,.88,.98));
   cp.sub(look).multiplyScalar(THREE.MathUtils.lerp(1.65,1.18,detail)).add(look);
   camera.fov=THREE.MathUtils.lerp(42,55,detail);camera.setViewOffset(lastWidth,lastHeight,0,lastHeight*.18,lastWidth,lastHeight);
  } else camera.setViewOffset(lastWidth,lastHeight,-lastWidth*.12,0,lastWidth,lastHeight);
  camera.position.copy(cp);camera.lookAt(look);camera.updateProjectionMatrix();
  const inside=manual?manual.interior:smooth(progress,.30,.37)*(1-smooth(progress,.44,.50));
  glass.forEach(o=>o.material.opacity=1-inside*.985);
  const polish=manual?manual.gloss:smooth(progress,.535,.653);
  const polishChapter=manual?1:smooth(progress,.47,.52)*(1-smooth(progress,.68,.70));
  finish.value=1-polishChapter*(1-polish);
  clean.value=manual?manual.wash:smooth(progress,.095,.245);
  paint.roughness=THREE.MathUtils.lerp(.21,.13,polish);paint.clearcoatRoughness=THREE.MathUtils.lerp(.065,.026,polish);
  garage.reflectionLight.position.set(THREE.MathUtils.lerp(-1,2.4,polish),2.5,-1.3);
  water.update(manual?manual.water:progress);
  const time=performance.now();renderer.render(scene,camera);
  const duration=performance.now()-time;renderSamples.push(duration);if(renderSamples.length>60)renderSamples.shift();
  if(lastFrame&&time-lastFrame<200){intervalSamples.push(time-lastFrame);if(intervalSamples.length>60)intervalSamples.shift();}
  lastFrame=time;
  if(++frameCount%30===0){canvas.dataset.renderMs=median(renderSamples).toFixed(1);canvas.dataset.frameMs=median(intervalSamples).toFixed(1);canvas.dataset.drawCalls=String(renderer.info.render.calls);canvas.dataset.textures=String(renderer.info.memory.textures);}
  canvas.dataset.ready='true';canvas.dataset.progress=progress.toFixed(4);
 }
 resize();
 camera.position.fromArray(CAMERA_STOPS[0].p);camera.lookAt(new THREE.Vector3(...CAMERA_STOPS[0].t));camera.updateProjectionMatrix();
 await renderer.compileAsync(scene,camera);
 canvas.dataset.compileMs=String(Math.round(performance.now()-loadingStarted));
 update(0,true);
 return {update,setManual(state){manual=state;update(current,true);},resize:()=>update(current,true),stats:()=>({drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,textures:renderer.info.memory.textures,geometries:renderer.info.memory.geometries}),dispose(){
  if(disposed)return;disposed=true;water.dispose();garage.dispose();
  const textures=new Set(),materials=new Set(),geometries=new Set();
  scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material]){materials.add(m);Object.values(m).forEach(v=>{if(v?.isTexture)textures.add(v);});}});
  textures.forEach(t=>t.dispose());materials.forEach(m=>m.dispose());geometries.forEach(g=>g.dispose());unused.forEach(m=>m.dispose());
  // Контекст WebGL освобождаем явно: браузер держит ограниченное число контекстов.
  renderer.forceContextLoss();renderer.dispose();
 }};
}

function batchInterior(group){
 group.updateMatrixWorld(true);const batches=new Map();
 group.traverse(o=>{if(!o.isMesh||Array.isArray(o.material))return;const key=o.material.uuid;if(!batches.has(key))batches.set(key,[]);batches.get(key).push(o);});
 for(const meshes of batches.values()){
  if(meshes.length<2)continue;
  const geometries=meshes.map(mesh=>{
   const geometry=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone();
   geometry.applyMatrix4(mesh.matrixWorld);
   for(const name of Object.keys(geometry.attributes))if(!['position','normal','uv'].includes(name))geometry.deleteAttribute(name);
   return geometry;
  });
  const merged=mergeGeometries(geometries);geometries.forEach(g=>g.dispose());
  if(!merged)continue;
  const mesh=new THREE.Mesh(merged,meshes[0].material);mesh.castShadow=mesh.receiveShadow=true;
  meshes.forEach(original=>{original.removeFromParent();original.geometry.dispose();});group.add(mesh);
 }
}
