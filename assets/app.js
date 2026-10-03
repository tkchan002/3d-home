const ROOMS=[{"id":"sYViEn1u","name":"廚房","stem":"20260831115329","pos":{"x":235.6989,"z":117.24},"rotY":175.7044},{"id":"FJSP67Ne","name":"飯廳","stem":"20260831115357","pos":{"x":115.5456,"z":38.0159},"rotY":87.1674},{"id":"3Y4gX3kb","name":"客廳","stem":"20260831115425","pos":{"x":103.985,"z":-41.8635},"rotY":73.1122},{"id":"2E3jFWDH","name":"客廳 1","stem":"20260831115451","pos":{"x":101.8133,"z":-97.8306},"rotY":50.4588},{"id":"LapR9ksK","name":"走廊","stem":"20260831115522","pos":{"x":-1.3285,"z":30.4586},"rotY":83.2455},{"id":"mi7E6o8Q","name":"睡房","stem":"20260831115549","pos":{"x":3.3298,"z":-32.1705},"rotY":356.0891},{"id":"633ttJ0A","name":"浴室","stem":"20260831115618","pos":{"x":-15.0016,"z":87.8095},"rotY":169.4515},{"id":"8S6m9osy","name":"走廊1","stem":"20260831115712","pos":{"x":-75.5114,"z":31.2567},"rotY":83.4808},{"id":"Pjucsg2w","name":"睡房 1","stem":"20260831115738","pos":{"x":-98.7824,"z":-33.305},"rotY":23.7393},{"id":"6aPNoH3B","name":"主人房","stem":"20260831115803","pos":{"x":-107.7342,"z":36.979},"rotY":88.7212},{"id":"vpzFhpNt","name":"主人浴室","stem":"20260831115832","pos":{"x":-101.8342,"z":92.7838},"rotY":178.3351},{"id":"GWOyVSw1","name":"主人房 1","stem":"20260831115858","pos":{"x":-187.6141,"z":37.2287},"rotY":94.7242},{"id":"Q8biUi98","name":"主人房2","stem":"20260831115931","pos":{"x":-256.1324,"z":25.5147},"rotY":88.8156}];
const ADJ={"sYViEn1u":["FJSP67Ne"],"FJSP67Ne":["sYViEn1u","3Y4gX3kb","LapR9ksK"],"3Y4gX3kb":["FJSP67Ne","2E3jFWDH"],"2E3jFWDH":["3Y4gX3kb"],"LapR9ksK":["FJSP67Ne","mi7E6o8Q","633ttJ0A","8S6m9osy"],"mi7E6o8Q":["LapR9ksK","633ttJ0A"],"633ttJ0A":["LapR9ksK","mi7E6o8Q"],"8S6m9osy":["LapR9ksK","Pjucsg2w","6aPNoH3B"],"Pjucsg2w":["8S6m9osy"],"6aPNoH3B":["8S6m9osy","vpzFhpNt","GWOyVSw1"],"vpzFhpNt":["6aPNoH3B"],"GWOyVSw1":["6aPNoH3B","Q8biUi98"],"Q8biUi98":["GWOyVSw1"]};
const FACE_IDS=['f','l','b','r','u','d'];
const FACE_LABELS={f:'前方 / Front',l:'左側 / Left',b:'後方 / Back',r:'右側 / Right',u:'天花 / Ceiling',d:'地面 / Floor'};
const MOBILE=matchMedia('(max-width:900px),(pointer:coarse)').matches;
const DEBUG=new URLSearchParams(location.search).has('debug');
const DEG=Math.PI/180;

const $=id=>document.getElementById(id);
const canvas=$('glcanvas'),viewerEl=$('viewer'),roomsEl=$('rooms'),mobileRooms=$('mobileRooms'),titleEl=$('title'),walkDock=$('walkDock'),walkMsg=$('walkMsg'),hotspots=$('hotspots'),shade=$('transitionShade'),loading=$('loading'),loadingText=$('loadingText'),fatal=$('fatal'),fatalText=$('fatalText'),debugPanel=$('debugPanel');

function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function normDeg(a){while(a>180)a-=360;while(a<=-180)a+=360;return a}
function bearing(a,b){return Math.atan2(b.pos.x-a.pos.x,b.pos.z-a.pos.z)/DEG}
function distance(a,b){return Math.hypot(b.pos.x-a.pos.x,b.pos.z-a.pos.z)}
function roomIndexById(id){return ROOMS.findIndex(r=>r.id===id)}
function neighborIndexes(i=current){return (ADJ[ROOMS[i].id]||[]).map(roomIndexById).filter(x=>x>=0)}
function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
function lerp(a,b,t){return a+(b-a)*t}
function ease(t){return t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2}
function vecNorm(v){const d=Math.hypot(v[0],v[1],v[2])||1;return[v[0]/d,v[1]/d,v[2]/d]}
function dot(a,b){return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]}
function cross(a,b){return[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]}

function perspective(fovy,aspect,near=.05,far=10){
  const f=1/Math.tan(fovy/2),nf=1/(near-far);
  return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)*nf,-1,0,0,2*far*near*nf,0]);
}
function cameraView(yawDeg,pitchDeg){
  const y=yawDeg*DEG,p=pitchDeg*DEG,cp=Math.cos(p);
  const forward=vecNorm([Math.sin(y)*cp,Math.sin(p),-Math.cos(y)*cp]);
  const right=vecNorm(cross(forward,[0,1,0]));
  const up=cross(right,forward);
  return {forward,right,up,matrix:new Float32Array([
    right[0],up[0],-forward[0],0,
    right[1],up[1],-forward[1],0,
    right[2],up[2],-forward[2],0,
    0,0,0,1
  ])};
}
function mul4(a,b){
  const o=new Float32Array(16);
  for(let c=0;c<4;c++)for(let r=0;r<4;r++)o[c*4+r]=a[0*4+r]*b[c*4+0]+a[1*4+r]*b[c*4+1]+a[2*4+r]*b[c*4+2]+a[3*4+r]*b[c*4+3];
  return o;
}

class TiledCubemapRenderer{
  constructor(canvas){
    this.canvas=canvas;
    this.gl=canvas.getContext('webgl2',{alpha:false,antialias:true,depth:true,preserveDrawingBuffer:false,powerPreference:'high-performance'})||canvas.getContext('webgl',{alpha:false,antialias:true,depth:true,preserveDrawingBuffer:false,powerPreference:'high-performance'});
    if(!this.gl)throw new Error('WebGL is not available');
    this.mobile=MOBILE;this.dprCap=2;this.yaw=0;this.pitch=0;this.fov=72;this.stem=null;this.base=new Map();this.med=new Map();this.high=new Map();
    this.maxMed=this.mobile?12:20;this.maxHigh=this.mobile?32:64;this.concurrency=this.mobile?4:6;this.pending=new Map();this.queue=[];this.queued=new Set();this.desiredMed=new Set();this.desiredHigh=new Set();this.generation=1;this.paused=false;this.renderQueued=false;this.needTimer=0;this.statsCb=null;
    this._initGL();this.resize();
    window.addEventListener('resize',()=>this.resize(),{passive:true});
    canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();showFatal('瀏覽器因記憶體壓力暫停了 WebGL。請重新整理頁面；這個版本會限制同時存在的高清貼圖數量。')});
    canvas.addEventListener('webglcontextrestored',()=>location.reload());
  }
  _initGL(){
    const gl=this.gl;
    const vs=`attribute vec3 aPos;attribute vec2 aUv;uniform mat4 uMvp;varying vec2 vUv;void main(){gl_Position=uMvp*vec4(aPos,1.0);vUv=aUv;}`;
    const fs=`precision mediump float;varying vec2 vUv;uniform sampler2D uTex;void main(){gl_FragColor=texture2D(uTex,vUv);}`;
    const compile=(type,src)=>{const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s)||'shader compile failed');return s};
    const p=gl.createProgram(),v=compile(gl.VERTEX_SHADER,vs),f=compile(gl.FRAGMENT_SHADER,fs);gl.attachShader(p,v);gl.attachShader(p,f);gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p)||'program link failed');gl.deleteShader(v);gl.deleteShader(f);
    this.program=p;this.aPos=gl.getAttribLocation(p,'aPos');this.aUv=gl.getAttribLocation(p,'aUv');this.uMvp=gl.getUniformLocation(p,'uMvp');this.uTex=gl.getUniformLocation(p,'uTex');
    this.vbo=gl.createBuffer();this.ibo=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,this.ibo);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array([0,1,2,0,2,3]),gl.STATIC_DRAW);
    this.aniso=gl.getExtension('EXT_texture_filter_anisotropic')||gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic')||gl.getExtension('MOZ_EXT_texture_filter_anisotropic');
    gl.clearColor(0,0,0,1);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.CULL_FACE);
  }
  resize(){
    const r=this.canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,this.dprCap),w=Math.max(1,Math.round(r.width*dpr)),h=Math.max(1,Math.round(r.height*dpr));
    if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;this.gl.viewport(0,0,w,h);this.requestRender();this.scheduleNeeds()}
    this.emitStats();
  }
  setCamera({yaw=this.yaw,pitch=this.pitch,fov=this.fov},needs=true){this.yaw=normDeg(yaw);this.pitch=clamp(pitch,-82,82);this.fov=clamp(fov,34,92);this.requestRender();if(needs)this.scheduleNeeds()}
  getCamera(){return{yaw:this.yaw,pitch:this.pitch,fov:this.fov}}
  facePoint(face,x,y,scale=1){let p;switch(face){case'f':p=[x,-y,-1];break;case'l':p=[1,-y,x];break;case'b':p=[-x,-y,1];break;case'r':p=[-1,-y,-x];break;case'u':p=[x,1,-y];break;case'd':p=[x,-1,y];break;default:p=[x,-y,-1]}return[p[0]*scale,p[1]*scale,p[2]*scale]}
  quad(face,row=0,col=0,n=1,scale=1){const x0=-1+2*col/n,x1=-1+2*(col+1)/n,y0=-1+2*row/n,y1=-1+2*(row+1)/n;return[this.facePoint(face,x0,y0,scale),this.facePoint(face,x1,y0,scale),this.facePoint(face,x1,y1,scale),this.facePoint(face,x0,y1,scale)]}
  tileCenter(face,row,col,n){const x=-1+2*(col+.5)/n,y=-1+2*(row+.5)/n;return vecNorm(this.facePoint(face,x,y,1))}
  requestRender(){if(this.renderQueued)return;this.renderQueued=true;requestAnimationFrame(()=>{this.renderQueued=false;this.render()})}
  render(){
    const gl=this.gl;if(!this.program)return;gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);if(!this.stem||this.base.size<6)return;
    const aspect=this.canvas.width/this.canvas.height,proj=perspective(this.fov*DEG,aspect),view=cameraView(this.yaw,this.pitch),mvp=mul4(proj,view.matrix);
    gl.useProgram(this.program);gl.uniformMatrix4fv(this.uMvp,false,mvp);gl.uniform1i(this.uTex,0);gl.activeTexture(gl.TEXTURE0);
    for(const face of FACE_IDS){const t=this.base.get(face);if(t)this.drawQuad(this.quad(face,0,0,1,1),t)}
    for(const e of this.med.values())this.drawQuad(this.quad(e.face,e.row,e.col,2,.9996),e.tex);
    for(const e of this.high.values())this.drawQuad(this.quad(e.face,e.row,e.col,4,.9992),e.tex);
  }
  drawQuad(points,tex){
    const gl=this.gl;const v=new Float32Array(20);const uv=[[0,1],[1,1],[1,0],[0,0]];for(let i=0;i<4;i++){const o=i*5;v[o]=points[i][0];v[o+1]=points[i][1];v[o+2]=points[i][2];v[o+3]=uv[i][0];v[o+4]=uv[i][1]}
    gl.bindBuffer(gl.ARRAY_BUFFER,this.vbo);gl.bufferData(gl.ARRAY_BUFFER,v,gl.STREAM_DRAW);gl.enableVertexAttribArray(this.aPos);gl.vertexAttribPointer(this.aPos,3,gl.FLOAT,false,20,0);gl.enableVertexAttribArray(this.aUv);gl.vertexAttribPointer(this.aUv,2,gl.FLOAT,false,20,12);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,this.ibo);gl.bindTexture(gl.TEXTURE_2D,tex);gl.drawElements(gl.TRIANGLES,6,gl.UNSIGNED_SHORT,0)
  }
  async bitmapFromBlob(blob){
    if('createImageBitmap'in window){try{return{img:await createImageBitmap(blob,{imageOrientation:'flipY',premultiplyAlpha:'none'}),bitmap:true}}catch(_){}}
    return new Promise((resolve,reject)=>{const url=URL.createObjectURL(blob),im=new Image();im.onload=()=>{URL.revokeObjectURL(url);resolve({img:im,bitmap:false})};im.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('image decode failed'))};im.src=url})
  }
  async textureFromUrl(url,signal){
    const res=await fetch(url,{cache:'force-cache',signal});if(!res.ok)throw new Error(`${res.status} ${url}`);const blob=await res.blob();const decoded=await this.bitmapFromBlob(blob);if(signal?.aborted){decoded.img.close?.();throw new DOMException('Aborted','AbortError')}
    const gl=this.gl,tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    if(this.aniso){const max=Math.min(4,gl.getParameter(this.aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)||1);gl.texParameterf(gl.TEXTURE_2D,this.aniso.TEXTURE_MAX_ANISOTROPY_EXT,max)}
    if(!decoded.bitmap){gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true)}else{gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false)}
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,decoded.img);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);decoded.img.close?.();return{tex,unflipped:!!decoded.unflipped}
  }
  baseUrl(stem,face){return`assets/pano/${stem}/base/${face}.jpg`}
  tileUrl(stem,level,face,row,col){return`assets/pano/${stem}/${level}/${face}/${row}_${col}.jpg`}
  async prepareBase(stem,onProgress){
    const map=new Map(),controller=new AbortController();let done=0;try{
      // Three-at-a-time keeps decode memory bounded while still giving quick transitions.
      for(let offset=0;offset<FACE_IDS.length;offset+=3){await Promise.all(FACE_IDS.slice(offset,offset+3).map(async face=>{const {tex}=await this.textureFromUrl(this.baseUrl(stem,face),controller.signal);map.set(face,tex);done++;onProgress?.(done,6)}))}
      return{stem,map,controller}
    }catch(err){for(const t of map.values())this.gl.deleteTexture(t);controller.abort();throw err}
  }
  activatePrepared(prepared){
    this.abortTiles();this.generation++;this.deleteMap(this.base);this.deleteMapEntries(this.med);this.deleteMapEntries(this.high);this.base=prepared.map;this.med.clear();this.high.clear();this.stem=prepared.stem;this.queue=[];this.queued.clear();this.requestRender();this.scheduleNeeds(true);this.emitStats()
  }
  deleteMap(map){for(const t of map.values())this.gl.deleteTexture(t);map.clear()}
  deleteMapEntries(map){for(const e of map.values())this.gl.deleteTexture(e.tex);map.clear()}
  dropDetail(){this.abortTiles();this.deleteMapEntries(this.med);this.deleteMapEntries(this.high);this.queue=[];this.queued.clear();this.requestRender();this.emitStats()}
  setPaused(v,drop=false){this.paused=v;if(v){this.abortTiles();if(drop)this.dropDetail()}else this.scheduleNeeds(true)}
  abortTiles(){for(const p of this.pending.values())p.controller.abort();this.pending.clear()}
  scheduleNeeds(immediate=false){clearTimeout(this.needTimer);if(this.paused||!this.stem)return;this.needTimer=setTimeout(()=>this.updateNeeds(),immediate?0:70)}
  updateNeeds(){
    if(this.paused||!this.stem)return;const cam=cameraView(this.yaw,this.pitch),aspect=this.canvas.width/this.canvas.height;const halfV=this.fov*DEG/2,halfDiag=Math.atan(Math.tan(halfV)*Math.sqrt(1+aspect*aspect));const medCut=Math.cos(Math.min(Math.PI,halfDiag+36*DEG)),highCut=Math.cos(Math.min(Math.PI,halfDiag+20*DEG));
    let med=[],high=[];
    for(const face of FACE_IDS){for(let r=0;r<2;r++)for(let c=0;c<2;c++){const d=dot(this.tileCenter(face,r,c,2),cam.forward);if(d>medCut&&!this.mediumCovered(face,r,c)){const key=`m:${face}:${r}:${c}`;med.push({key,level:'l1',face,row:r,col:c,score:d})}}
      for(let r=0;r<4;r++)for(let c=0;c<4;c++){const d=dot(this.tileCenter(face,r,c,4),cam.forward);if(d>highCut){const key=`h:${face}:${r}:${c}`;high.push({key,level:'l2',face,row:r,col:c,score:d})}}}
    med.sort((a,b)=>b.score-a.score);high.sort((a,b)=>b.score-a.score);
    // Keep only the tiles closest to the camera centre when a very wide landscape
    // view would otherwise exceed the GPU budget. The surrounding area remains
    // covered by the 1024/base levels, so there is no blank region or load thrash.
    med=med.slice(0,this.maxMed);high=high.slice(0,this.maxHigh);
    this.desiredMed=new Set(med.map(t=>t.key));this.desiredHigh=new Set(high.map(t=>t.key));
    const now=performance.now();for(const k of this.desiredMed){const e=this.med.get(k);if(e)e.lastUsed=now}for(const k of this.desiredHigh){const e=this.high.get(k);if(e)e.lastUsed=now}
    const desiredAll=new Set([...this.desiredMed,...this.desiredHigh]);for(const [k,p] of this.pending){if(!desiredAll.has(k)){p.controller.abort();this.pending.delete(k)}}
    this.queue=[];this.queued.clear();
    // Medium tiles establish a sharp 1024-level view first; full 2048 tiles then refine the center.
    for(const t of [...med,...high]){const map=t.level==='l1'?this.med:this.high;if(!map.has(t.key)&&!this.pending.has(t.key)){this.queue.push(t);this.queued.add(t.key)}}
    this.evict();this.pump();this.requestRender();this.emitStats()
  }
  pump(){
    if(this.paused)return;while(this.pending.size<this.concurrency&&this.queue.length){const task=this.queue.shift();this.queued.delete(task.key);const map=task.level==='l1'?this.med:this.high;if(map.has(task.key))continue;const controller=new AbortController(),gen=this.generation,stem=this.stem;this.pending.set(task.key,{controller,task});
      this.textureFromUrl(this.tileUrl(stem,task.level,task.face,task.row,task.col),controller.signal).then(({tex})=>{
        if(controller.signal.aborted||gen!==this.generation||stem!==this.stem){this.gl.deleteTexture(tex);return}
        map.set(task.key,{...task,tex,lastUsed:performance.now()});if(task.level==='l2')this.dropCoveredMedium(task);this.evict();this.requestRender();this.emitStats()
      }).catch(err=>{if(err?.name!=='AbortError')console.warn('tile load failed',task,err)}).finally(()=>{this.pending.delete(task.key);this.pump()})
    }
  }
  dropCoveredMedium(highTask){
    const mr=Math.floor(highTask.row/2),mc=Math.floor(highTask.col/2),mkey=`m:${highTask.face}:${mr}:${mc}`;if(!this.med.has(mkey))return;let all=true;for(let rr=mr*2;rr<mr*2+2;rr++)for(let cc=mc*2;cc<mc*2+2;cc++)if(!this.high.has(`h:${highTask.face}:${rr}:${cc}`))all=false;if(all){this.gl.deleteTexture(this.med.get(mkey).tex);this.med.delete(mkey)}
  }
  mediumCovered(face,row,col){
    for(let rr=row*2;rr<row*2+2;rr++)for(let cc=col*2;cc<col*2+2;cc++)if(!this.high.has(`h:${face}:${rr}:${cc}`))return false;return true
  }
  evict(){this.evictMap(this.med,this.maxMed,this.desiredMed);this.evictMap(this.high,this.maxHigh,this.desiredHigh)}
  evictMap(map,max,desired){if(map.size<=max)return;const entries=[...map.entries()].sort((a,b)=>{const ad=desired.has(a[0])?1:0,bd=desired.has(b[0])?1:0;return ad-bd||a[1].lastUsed-b[1].lastUsed});while(map.size>max&&entries.length){const[k,e]=entries.shift();if(map.delete(k))this.gl.deleteTexture(e.tex)}}
  setStatsCallback(cb){this.statsCb=cb;this.emitStats()}
  emitStats(){if(!this.statsCb)return;const pixels=this.canvas.width*this.canvas.height;this.statsCb({base:this.base.size,medium:this.med.size,high:this.high.size,pending:this.pending.size,queued:this.queue.length,canvas:[this.canvas.width,this.canvas.height],approxMB:Math.round((this.base.size+this.med.size+this.high.size)*512*512*4/1048576+pixels*8/1048576)})}
  projectDirection(yawDeg,pitchDeg=-9){
    const y=yawDeg*DEG,p=pitchDeg*DEG,cp=Math.cos(p),v=[Math.sin(y)*cp,Math.sin(p),-Math.cos(y)*cp],cam=cameraView(this.yaw,this.pitch);const x=dot(v,cam.right),yy=dot(v,cam.up),z=-dot(v,cam.forward);if(z>=-.02)return null;const aspect=this.canvas.clientWidth/this.canvas.clientHeight,f=1/Math.tan(this.fov*DEG/2),nx=(x*f/aspect)/(-z),ny=(yy*f)/(-z);if(Math.abs(nx)>1.25||Math.abs(ny)>1.3)return null;return{x:(nx*.5+.5)*this.canvas.clientWidth,y:(-.5*ny+.5)*this.canvas.clientHeight,depth:-z}
  }
}

let renderer,current=2,switching=false,walkMode=true,photoOpen=false,photoFace='f',prefetchToken=0;
let pointers=new Map(),dragging=false,lastX=0,lastY=0,pinchStart=0,pinchFov=72;

function showFatal(message){fatalText.textContent=message;fatal.style.display='grid'}
function showMsg(t,ms=1400){walkMsg.textContent=t;walkMsg.classList.add('show');clearTimeout(showMsg._t);showMsg._t=setTimeout(()=>walkMsg.classList.remove('show'),ms)}
function setLoading(show,text='正在載入全景…'){loadingText.textContent=text;loading.classList.toggle('show',show)}
function setActiveRoomUI(){titleEl.textContent=`${current+1}. ${ROOMS[current].name}`;[...roomsEl.querySelectorAll('.room')].forEach((b,i)=>b.classList.toggle('active',i===current));mobileRooms.value=String(current);buildWalkDock();buildHotspots()}

function buildRoomUI(){
  ROOMS.forEach((r,i)=>{const b=document.createElement('button');b.className='room';b.type='button';b.innerHTML=`<img src="assets/thumbs/${r.stem}.jpg" loading="lazy" decoding="async" alt=""><div><div class="name">${i+1}. ${r.name}</div><div class="note">2048 原畫質 · 動態分塊</div></div>`;b.onclick=()=>switchRoom(i,{walk:false});roomsEl.appendChild(b);const o=document.createElement('option');o.value=i;o.textContent=`${i+1}. ${r.name}`;mobileRooms.appendChild(o)});mobileRooms.onchange=()=>switchRoom(+mobileRooms.value,{walk:false})
}
function buildWalkDock(){walkDock.innerHTML='';for(const i of neighborIndexes()){const b=document.createElement('button');b.className='walkBtn';b.type='button';b.innerHTML=`<strong>🚪 ${ROOMS[i].name}</strong><small>點擊前往</small>`;b.onclick=()=>switchRoom(i,{walk:true});walkDock.appendChild(b)}walkDock.style.display=walkMode&&!photoOpen?'flex':'none'}
function buildHotspots(){hotspots.innerHTML='';if(!walkMode||photoOpen)return;const a=ROOMS[current];for(const i of neighborIndexes()){const b=ROOMS[i],btn=document.createElement('button');btn.className='doorHotspot';btn.type='button';btn.dataset.target=i;btn.setAttribute('aria-label',`進入 ${b.name}`);btn.innerHTML=`<span class="doorRing">🚪</span><span class="doorLabel">進入 ${b.name}</span>`;btn.addEventListener('pointerdown',e=>e.stopPropagation());btn.onclick=e=>{e.stopPropagation();switchRoom(i,{walk:true})};hotspots.appendChild(btn)}updateHotspots()}
function updateHotspots(){if(!renderer||!walkMode||photoOpen)return;const a=ROOMS[current];for(const el of hotspots.children){const i=+el.dataset.target,b=ROOMS[i],markerYaw=normDeg(bearing(a,b)-a.rotY),p=renderer.projectDirection(markerYaw,-10);if(!p){el.style.opacity='0';el.style.pointerEvents='none';continue}const d=distance(a,b),scale=clamp(1.16-d/430,.76,1.1)*clamp(1.2/p.depth,.76,1.16);el.style.left=`${p.x}px`;el.style.top=`${p.y}px`;el.style.opacity='1';el.style.pointerEvents='auto';el.style.setProperty('--hsScale',scale.toFixed(3))}}

async function animateCamera(target,duration=300){const start=renderer.getCamera(),dy=normDeg(target.yaw-start.yaw),t0=performance.now();return new Promise(resolve=>{const step=now=>{const t=clamp((now-t0)/duration,0,1),q=ease(t);renderer.setCamera({yaw:start.yaw+dy*q,pitch:lerp(start.pitch,target.pitch??start.pitch,q),fov:lerp(start.fov,target.fov??start.fov,q)},false);updateHotspots();if(t<1)requestAnimationFrame(step);else{renderer.scheduleNeeds(true);resolve()}};requestAnimationFrame(step)})}

async function switchRoom(i,{walk=false}={}){
  if(switching||i===current||i<0||i>=ROOMS.length)return;switching=true;if(photoOpen)closePhoto();renderer.setPaused(true,false);const from=ROOMS[current],to=ROOMS[i],startFov=renderer.fov,travel=bearing(from,to);let prep;
  try{
    const prepPromise=renderer.prepareBase(to.stem,(n,total)=>{if(n===1)showMsg('正在準備下一位置…',900)});
    if(walk){const doorYaw=normDeg(travel-from.rotY);await animateCamera({yaw:doorYaw,pitch:clamp(renderer.pitch,-5,5),fov:Math.max(42,startFov-10)},260);shade.classList.add('active')}
    else shade.classList.add('active');
    prep=await prepPromise;await sleep(walk?120:150);
    current=i;renderer.activatePrepared(prep);renderer.setPaused(false);const destYaw=walk?normDeg(travel-to.rotY):0;renderer.setCamera({yaw:destYaw,pitch:0,fov:walk?Math.max(42,startFov-7):72},false);setActiveRoomUI();updateHotspots();await sleep(80);shade.classList.remove('active');
    if(walk)await animateCamera({yaw:destYaw,pitch:0,fov:startFov},420);else renderer.scheduleNeeds(true);
    showMsg(`已到 ${to.name}`);scheduleNeighborPrefetch();
  }catch(err){console.error(err);shade.classList.remove('active');showMsg('載入失敗，請檢查網絡後再試',2200);if(prep?.map)renderer.deleteMap(prep.map)}finally{if(!photoOpen)renderer.setPaused(false);switching=false}
}

function walkForward(){const ns=neighborIndexes();if(!ns.length)return showMsg('這個位置沒有下一個步行點');const a=ROOMS[current],view=renderer.yaw;let best=ns[0],bestDiff=999;for(const i of ns){const markerYaw=normDeg(bearing(a,ROOMS[i])-a.rotY),d=Math.abs(normDeg(markerYaw-view));if(d<bestDiff){bestDiff=d;best=i}}switchRoom(best,{walk:true})}

async function scheduleNeighborPrefetch(){
  const token=++prefetchToken,urls=[];for(const i of neighborIndexes())for(const f of FACE_IDS)urls.push(`assets/pano/${ROOMS[i].stem}/base/${f}.jpg`);
  const run=async()=>{for(const url of urls){if(token!==prefetchToken||switching)break;try{const r=await fetch(url,{cache:'force-cache'});if(r.ok)await r.arrayBuffer()}catch(_){}await sleep(20)}};
  if('requestIdleCallback'in window)requestIdleCallback(()=>run(),{timeout:1800});else setTimeout(run,900)
}

function openPhoto(face='f'){
  photoOpen=true;photoFace=face;renderer.setPaused(true,true);$('photoPanel').classList.add('open');$('photoPanel').setAttribute('aria-hidden','false');walkDock.style.display='none';hotspots.innerHTML='';$('photoTitle').textContent=`${current+1}. ${ROOMS[current].name}`;buildPhotoTabs();setPhotoFace(face)
}
function closePhoto(){if(!photoOpen)return;photoOpen=false;const im=$('photoImage');im.removeAttribute('src');im.alt='';$('photoPanel').classList.remove('open');$('photoPanel').setAttribute('aria-hidden','true');renderer.setPaused(false);buildWalkDock();buildHotspots()}
function buildPhotoTabs(){const tabs=$('photoTabs');tabs.innerHTML='';for(const face of FACE_IDS){const b=document.createElement('button');b.type='button';b.className='photoTab';b.dataset.face=face;b.textContent=FACE_LABELS[face];b.onclick=()=>setPhotoFace(face);tabs.appendChild(b)}}
function setPhotoFace(face){photoFace=face;for(const b of $('photoTabs').children)b.classList.toggle('active',b.dataset.face===face);const im=$('photoImage');im.removeAttribute('src');im.alt=`${ROOMS[current].name} ${FACE_LABELS[face]}`;requestAnimationFrame(()=>{im.src=`assets/faces/${ROOMS[current].stem}_${face}.jpg`})}

function bindControls(){
  viewerEl.addEventListener('pointerdown',e=>{if(photoOpen||switching||e.button>0)return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});viewerEl.setPointerCapture?.(e.pointerId);if(pointers.size===1){dragging=true;viewerEl.classList.add('dragging');lastX=e.clientX;lastY=e.clientY}else if(pointers.size===2){const a=[...pointers.values()];pinchStart=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);pinchFov=renderer.fov}e.preventDefault()});
  viewerEl.addEventListener('pointermove',e=>{if(!pointers.has(e.pointerId)||photoOpen||switching)return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size>=2){const a=[...pointers.values()],d=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);if(pinchStart>0)renderer.setCamera({fov:clamp(pinchFov*pinchStart/d,34,92)});updateHotspots();e.preventDefault();return}if(dragging){const dx=e.clientX-lastX,dy=e.clientY-lastY;lastX=e.clientX;lastY=e.clientY;renderer.setCamera({yaw:renderer.yaw-dx*.13,pitch:renderer.pitch+dy*.11});updateHotspots();e.preventDefault()}});
  const end=e=>{pointers.delete(e.pointerId);if(pointers.size===0){dragging=false;viewerEl.classList.remove('dragging');pinchStart=0}else if(pointers.size===1){const p=[...pointers.values()][0];lastX=p.x;lastY=p.y;dragging=true;pinchStart=0}};viewerEl.addEventListener('pointerup',end);viewerEl.addEventListener('pointercancel',end);
  viewerEl.addEventListener('wheel',e=>{if(photoOpen)return;e.preventDefault();renderer.setCamera({fov:renderer.fov+e.deltaY*.025});updateHotspots()},{passive:false});viewerEl.addEventListener('dblclick',e=>{if(walkMode&&!photoOpen){e.preventDefault();walkForward()}});
  $('zoomIn').onclick=()=>{renderer.setCamera({fov:renderer.fov-6});updateHotspots()};$('zoomOut').onclick=()=>{renderer.setCamera({fov:renderer.fov+6});updateHotspots()};$('reset').onclick=()=>{renderer.setCamera({yaw:0,pitch:0,fov:72});updateHotspots()};
  $('walkMode').onclick=()=>{walkMode=!walkMode;$('walkMode').classList.toggle('active',walkMode);$('walkMode').textContent=walkMode?'門口導航':'顯示門口';buildWalkDock();buildHotspots()};$('photoMode').onclick=()=>openPhoto();$('photoClose').onclick=()=>closePhoto();$('fatalPhotos').onclick=()=>{fatal.style.display='none';openPhoto()};
  const full=$('full');if(!document.documentElement.requestFullscreen&&!document.documentElement.webkitRequestFullscreen)full.style.display='none';full.onclick=()=>{const root=document.documentElement;if(!document.fullscreenElement&&!document.webkitFullscreenElement)(root.requestFullscreen||root.webkitRequestFullscreen)?.call(root);else(document.exitFullscreen||document.webkitExitFullscreen)?.call(document)};
  window.addEventListener('keydown',e=>{if(photoOpen){if(e.key==='Escape')closePhoto();return}const k=e.key.toLowerCase();if((k==='w'||e.key===' ')&&walkMode){e.preventDefault();walkForward();return}if(k==='a'||e.key==='ArrowLeft')renderer.setCamera({yaw:renderer.yaw-7});if(k==='d'||e.key==='ArrowRight')renderer.setCamera({yaw:renderer.yaw+7});if(e.key==='ArrowUp')renderer.setCamera({pitch:renderer.pitch+5});if(e.key==='ArrowDown')renderer.setCamera({pitch:renderer.pitch-5});updateHotspots()});
  window.addEventListener('resize',()=>requestAnimationFrame(updateHotspots));
}

async function init(){
  try{renderer=new TiledCubemapRenderer(canvas)}catch(err){console.error(err);showFatal('這個瀏覽器未能建立 WebGL 圖像環境。請更新 Chrome / Safari，並確認硬件加速已啟用。');return}
  buildRoomUI();bindControls();if(DEBUG){debugPanel.hidden=false;renderer.setStatsCallback(s=>{debugPanel.textContent=`room: ${ROOMS[current].name}\nbase: ${s.base}/6\nmedium: ${s.medium}/${renderer.maxMed}\nhigh: ${s.high}/${renderer.maxHigh}\npending: ${s.pending}\nqueue: ${s.queued}\ncanvas: ${s.canvas[0]}×${s.canvas[1]}\napprox GPU*: ${s.approxMB} MB\n*conservative texture+framebuffer estimate`})}
  try{setLoading(true,'正在載入客廳全景…');const prep=await renderer.prepareBase(ROOMS[current].stem,(n,total)=>setLoading(true,`正在載入客廳全景… ${n}/${total}`));renderer.activatePrepared(prep);renderer.setCamera({yaw:0,pitch:0,fov:72});setActiveRoomUI();setLoading(false);scheduleNeighborPrefetch();setTimeout(()=>{$('hint').style.opacity='.25'},5200)}catch(err){console.error(err);setLoading(false);showFatal('全景圖片載入失敗。請確認所有 assets/pano 檔案已完整上載到 GitHub Pages。')}
}

init();
