import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// A fitted, separate cockpit: upholstered seats, instruments and physical trim.
export function buildInterior(scene, car){
 const shell=car.getObjectByName('Object_55');
 const g=shell.geometry,position=g.attributes.position,old=g.index,keep=[],a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
 for(let i=0;i<(old?old.count:position.count);i+=3){const ids=[0,1,2].map(k=>old?old.getX(i+k):i+k);a.fromBufferAttribute(position,ids[0]).applyMatrix4(shell.matrixWorld);b.fromBufferAttribute(position,ids[1]).applyMatrix4(shell.matrixWorld);c.fromBufferAttribute(position,ids[2]).applyMatrix4(shell.matrixWorld);const center=a.clone().add(b).add(c).multiplyScalar(1/3);const inCabin=Math.abs(center.x)<.81&&center.z> -1.48&&center.z<.90&&center.y>.65;if(!inCabin)keep.push(...ids);}
 shell.geometry=g.clone();shell.geometry.setIndex(keep);shell.geometry.deleteAttribute('color');shell.material=new THREE.MeshStandardMaterial({color:'#171713',roughness:.76,metalness:.05});
 // Исходная геометрия шелла в сцене больше не участвует: клон держит свои копии
 // атрибутов. Освобождаем её, только если её не делит другой меш модели.
 let shared=false;car.traverse(o=>{if(o!==shell&&o.isMesh&&o.geometry===g)shared=true;});
 if(!shared)g.dispose();
 const cockpit=new THREE.Group();cockpit.name='Detailed atelier interior';scene.add(cockpit);
 const texture=(type)=>{const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const ctx=canvas.getContext('2d');let seed=931;const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};ctx.fillStyle=type==='cloth'?'#746957':'#808080';ctx.fillRect(0,0,256,256);for(let y=0;y<256;y+=2)for(let x=0;x<256;x+=2){const n=rnd();if(type==='cloth'){const warp=((Math.floor(x/8)+Math.floor(y/8))%4)<2;ctx.fillStyle=warp?`rgba(29,27,22,${.25+n*.4})`:`rgba(205,183,147,${.15+n*.3})`;}else ctx.fillStyle=`rgba(${n>.5?'255,255,255':'0,0,0'},${.1+n*.27})`;ctx.fillRect(x,y,1+rnd(),1+rnd());}const tex=new THREE.CanvasTexture(canvas);tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.repeat.set(type==='cloth'?3:5,type==='cloth'?4:5);tex.anisotropy=8;return tex;};
 const grain=texture('leather'),weave=texture('cloth');weave.colorSpace=THREE.SRGBColorSpace;
 const leather=new THREE.MeshPhysicalMaterial({color:'#362319',roughness:.82,metalness:0,bumpMap:grain,bumpScale:.0013,clearcoat:0});
 const edging=new THREE.MeshStandardMaterial({color:'#3c291c',roughness:.61});const cloth=new THREE.MeshStandardMaterial({color:'#594736',map:weave,roughness:.95,bumpMap:grain,bumpScale:.0006});
 const black=new THREE.MeshStandardMaterial({color:'#181814',roughness:.66,bumpMap:grain,bumpScale:.001});const metal=new THREE.MeshStandardMaterial({color:'#bcb09a',metalness:.84,roughness:.3});const thread=new THREE.MeshStandardMaterial({color:'#856b50',roughness:.9});
 function upholstery(parent,w,h,d,x,y,z,mat){
  const positions=[],uvs=[],indices=[],rows=26,columns=40;
  for(let j=0;j<=rows;j++){
   const t=j/rows,cap=Math.pow(Math.sin(Math.PI*t),.22),taper=1-.10*t;
   for(let i=0;i<=columns;i++){
    const a=i/columns*Math.PI*2,c=Math.cos(a),s=Math.sin(a);
    positions.push(Math.sign(c)*Math.pow(Math.abs(c),.65)*w*.5*cap*taper,(t-.5)*h,Math.sign(s)*Math.pow(Math.abs(s),.7)*d*.5*cap-.015*t*t);
    uvs.push(i/columns,t);
   }
  }
  for(let j=0;j<rows;j++)for(let i=0;i<columns;i++){const a=j*(columns+1)+i,b=a+columns+1;indices.push(a,b,a+1,b,b+1,a+1);}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);geometry.computeVertexNormals();
  const mesh=new THREE.Mesh(geometry,mat);mesh.position.set(x,y,z);parent.add(mesh);return mesh;
 }
 function box(parent,w,h,d,r,x,y,z,mat){const mesh=new THREE.Mesh(new RoundedBoxGeometry(w,h,d,3,r),mat);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
 function tube(parent,points,r,mat){const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));const mesh=new THREE.Mesh(new THREE.TubeGeometry(curve,Math.max(8,points.length*5),r,5,false),mat);parent.add(mesh);return mesh;}
 function stitch(parent,x1,y1,z1,x2,y2,z2,count=26){const points=[];const a=new THREE.Vector3(x1,y1,z1),b=new THREE.Vector3(x2,y2,z2);for(let i=0;i<count;i++){points.push(a.clone().lerp(b,i/count),a.clone().lerp(b,(i+.43)/count));}const line=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:'#988069'}));parent.add(line);}
 box(cockpit,1.35,.065,1.95,.018,0,.39,-.32,black);
 for(const x of [-.36,.36]){
  const seat=new THREE.Group();seat.position.set(x,0,-.24);cockpit.add(seat);
  box(seat,.49,.12,.51,.045,0,.515,-.04,leather);box(seat,.315,.022,.38,.014,0,.583,-.015,cloth);
  for(const sx of [-.203,.203])box(seat,.085,.11,.45,.036,sx,.58,-.04,leather);
  const back=new THREE.Group();back.position.set(0,.59,-.30);back.rotation.x=-.14;seat.add(back);
  upholstery(back,.47,.58,.15,0,.235,0,leather);
  box(back,.285,.35,.014,.018,0,.232,.081,cloth);
  for(let rib=0;rib<9;rib++){const yy=.082+rib*.039;tube(back,[[-.138,yy,.093],[0,yy-.004,.097],[.138,yy,.093]],.0012,edging);}
  for(const sx of [-.19,.19])upholstery(back,.095,.49,.13,sx,.225,.067,leather);
  upholstery(back,.31,.165,.13,0,.525,-.014,leather);
  for(const sx of [-.155,.155])stitch(back,sx,.056,.096,sx,.414,.096,32);
  stitch(back,-.15,.422,.095,.15,.422,.095,26);
  for(const sx of [-.237,.237])tube(seat,[[sx,.57,.14],[sx,.584,-.04],[sx,.565,-.24]],.0022,thread);
  box(seat,.047,.073,.055,.009,-Math.sign(x)*.285,.548,-.035,black);box(seat,.026,.01,.025,.003,-Math.sign(x)*.285,.585,-.032,new THREE.MeshStandardMaterial({color:'#793122',roughness:.6}));
 }
 for(const x of [-.68,.68]){
  box(cockpit,.055,.37,1.24,.024,x,.70,-.21,leather);box(cockpit,.075,.08,1.29,.024,x,.907,-.21,black);
  box(cockpit,.09,.066,.43,.02,x-Math.sign(x)*.05,.71,-.16,edging);
  box(cockpit,.015,.028,.18,.007,x-Math.sign(x)*.086,.80,.14,metal);
  for(const y of [.60,.64,.68])tube(cockpit,[[x-Math.sign(x)*.034,y,-.66],[x-Math.sign(x)*.034,y,.32]],.0017,thread);
  const pin=new THREE.Mesh(new THREE.CylinderGeometry(.004,.004,.04,8),metal);pin.position.set(x,.96,-.58);cockpit.add(pin);
 }
 box(cockpit,1.27,.16,.235,.042,0,.954,.52,black);box(cockpit,1.23,.13,.075,.017,0,.827,.43,leather);
 box(cockpit,.46,.071,.013,.009,-.37,.826,.387,edging);box(cockpit,.055,.009,.015,.003,-.37,.846,.376,metal);
 const instruments=new THREE.Group();instruments.position.set(.25,.965,.389);cockpit.add(instruments);
 const gauge=(label,max,needle)=>{const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d');ctx.fillStyle='#141611';ctx.fillRect(0,0,256,256);ctx.translate(128,128);ctx.strokeStyle='#d5cfb9';ctx.lineWidth=3;for(let i=0;i<=40;i++){const a=(-220+i*7)*Math.PI/180;ctx.beginPath();ctx.moveTo(Math.cos(a)*(i%5===0?86:96),Math.sin(a)*(i%5===0?86:96));ctx.lineTo(Math.cos(a)*107,Math.sin(a)*107);ctx.stroke();}ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='17px Arial';ctx.fillStyle='#d5cfb9';for(let i=0;i<=8;i++){const a=(-220+i*35)*Math.PI/180;ctx.fillText(String(Math.round(i*max/8)),Math.cos(a)*70,Math.sin(a)*70);}ctx.font='12px Arial';ctx.fillText(label,0,44);ctx.rotate(needle);ctx.fillStyle='#d78956';ctx.beginPath();ctx.moveTo(-4,14);ctx.lineTo(0,-88);ctx.lineTo(4,14);ctx.fill();ctx.beginPath();ctx.arc(0,0,9,0,Math.PI*2);ctx.fillStyle='#4a493e';ctx.fill();const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;return new THREE.MeshBasicMaterial({map:tex,side:THREE.DoubleSide,toneMapped:false});};
 [-.285,-.14,0,.14,.265].forEach((x,i)=>{const r=i===2?.073:.060;const face=new THREE.Mesh(new THREE.CircleGeometry(r,48),gauge(i===2?'RPM x 1000':i===3?'km/h':'BAR',i===2?8:i===3?240:10,.22+i*.41));face.rotation.y=Math.PI;face.position.set(x,0,-.015);instruments.add(face);const ring=new THREE.Mesh(new THREE.TorusGeometry(r+.004,.004,6,48),metal);ring.position.set(x,0,-.017);instruments.add(ring);});
 const wheel=new THREE.Group();wheel.position.set(.34,.93,.205);wheel.rotation.x=-.22;cockpit.add(wheel);
 const rim=new THREE.Mesh(new THREE.TorusGeometry(.155,.014,10,64),black);wheel.add(rim);
 for(const angle of [Math.PI/2,Math.PI*7/6,Math.PI*11/6]){const spoke=box(wheel,.03,.13,.008,.005,Math.cos(angle)*.075,Math.sin(angle)*.075,0,metal);spoke.rotation.z=angle-Math.PI/2;}
 box(wheel,.072,.065,.038,.012,0,0,-.008,black);
 const emblem=new THREE.Mesh(new THREE.CircleGeometry(.017,24),new THREE.MeshStandardMaterial({color:'#aa8555',metalness:.6,roughness:.4,side:THREE.DoubleSide}));emblem.position.z=-.029;wheel.add(emblem);
 box(cockpit,.19,.11,.57,.025,0,.48,.10,edging);
 const boot=new THREE.Mesh(new THREE.CylinderGeometry(.025,.057,.075,16),black);boot.position.set(0,.56,.16);cockpit.add(boot);
 const lever=new THREE.Mesh(new THREE.CylinderGeometry(.006,.006,.115,12),metal);lever.position.set(0,.64,.16);lever.rotation.x=.16;cockpit.add(lever);
 const knob=new THREE.Mesh(new THREE.SphereGeometry(.027,20,12),black);knob.scale.set(1,1.2,1);knob.position.set(0,.702,.15);cockpit.add(knob);
 for(const x of [-.32,.32]){box(cockpit,.43,.10,.34,.04,x,.51,-.99,leather);box(cockpit,.43,.31,.08,.034,x,.68,-1.18,leather);}
 cockpit.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
 return cockpit;
}

