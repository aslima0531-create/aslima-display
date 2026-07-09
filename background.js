
(() => {
  'use strict';
  const root = document.getElementById('aslimaAnimatedBg');
  const base = document.getElementById('aslimaBaseCanvas');
  const stars = document.getElementById('aslimaStarCanvas');
  const glowLayer = document.getElementById('aslimaWindowGlow');
  if (!root || !base || !stars || !glowLayer) return;

  const IMAGE_SRC = 'assets/mosque-background.jpeg';
  const WATER_START_RATIO = 0.675;
  const RIPPLE_CYCLE_MS = 14500;
  const RIPPLE_AMPLITUDE = 5.5;
  const SLICE_HEIGHT = 2;
  const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const bctx = base.getContext('2d', { alpha:false });
  const sctx = stars.getContext('2d');
  const img = new Image();
  img.decoding = 'async';
  img.src = IMAGE_SRC;

  let vw=0, vh=0, dpr=1;
  let draw={x:0,y:0,w:0,h:0,scale:1};
  let starList=[];
  let running=false;

  function seededRandom(seed){
    let t=seed+0x6D2B79F5;
    return function(){
      t += 0x6D2B79F5;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }
  function imageToScreen(ix,iy){return {x:draw.x+ix*draw.scale,y:draw.y+iy*draw.scale};}
  function sizeCanvas(c){
    c.width=Math.max(1,Math.round(vw*dpr));
    c.height=Math.max(1,Math.round(vh*dpr));
    c.style.width=vw+'px';
    c.style.height=vh+'px';
    const ctx=c.getContext('2d');
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  function resize(){
    const rect=root.getBoundingClientRect();
    vw=Math.max(1,Math.round(rect.width || window.innerWidth));
    vh=Math.max(1,Math.round(rect.height || window.innerHeight));
    dpr=Math.min(window.devicePixelRatio || 1, 2);
    sizeCanvas(base); sizeCanvas(stars);
    const scale=Math.max(vw/img.width, vh/img.height);
    draw.w=img.width*scale; draw.h=img.height*scale;
    draw.x=(vw-draw.w)/2; draw.y=(vh-draw.h)/2; draw.scale=scale;
    buildStars(); buildWindowGlows();
  }
  function buildStars(){
    const rnd=seededRandom(42); starList=[];
    for(let i=0;i<180;i++){
      const ix=70+rnd()*1390, iy=20+rnd()*430;
      if(ix>650 && ix<1180 && iy>250) continue;
      const p=imageToScreen(ix,iy);
      starList.push({x:p.x,y:p.y,r:.45+rnd()*1.25,phase:rnd()*Math.PI*2,speed:.00032+rnd()*.00028,active:rnd()<.12});
    }
  }
  function buildWindowGlows(){
    glowLayer.innerHTML='';
    const lights=[
      [706,665,70,120],[800,650,45,100],[895,665,52,100],[995,662,46,105],[1056,664,42,100],[1120,664,42,96],
      [684,579,24,70],[732,576,28,66],[846,511,26,54],[884,512,26,54],[1036,250,42,155],[1050,360,34,100],
      [651,715,40,50],[1168,700,36,60]
    ];
    const rnd=seededRandom(141);
    lights.forEach(([ix,iy,iw,ih])=>{
      const p=imageToScreen(ix,iy);
      const el=document.createElement('div');
      el.className='aslima-window-glow';
      el.style.setProperty('--x',(p.x-iw*draw.scale*.5)+'px');
      el.style.setProperty('--y',(p.y-ih*draw.scale*.5)+'px');
      el.style.setProperty('--w',(iw*draw.scale)+'px');
      el.style.setProperty('--h',(ih*draw.scale)+'px');
      el.style.setProperty('--blur',(8*draw.scale+2)+'px');
      el.style.setProperty('--dur',(6+rnd()*2).toFixed(2)+'s');
      el.style.setProperty('--delay',(-rnd()*7).toFixed(2)+'s');
      glowLayer.appendChild(el);
    });
  }
  function drawBaseFrame(now){
    bctx.clearRect(0,0,vw,vh);
    bctx.drawImage(img,draw.x,draw.y,draw.w,draw.h);
    if(prefersReducedMotion) return;
    const waterY=draw.y+draw.h*WATER_START_RATIO;
    const visibleWaterY=Math.max(0,waterY);
    const sourceWaterY=(visibleWaterY-draw.y)/draw.scale;
    const sourceSliceH=SLICE_HEIGHT/draw.scale;
    const t=(now%RIPPLE_CYCLE_MS)/RIPPLE_CYCLE_MS;
    bctx.save();
    bctx.beginPath(); bctx.rect(0,visibleWaterY,vw,vh-visibleWaterY); bctx.clip();
    for(let sy=sourceWaterY; sy<img.height; sy+=sourceSliceH){
      const screenY=draw.y+sy*draw.scale;
      const depth=Math.min(1,Math.max(0,(sy/img.height-WATER_START_RATIO)/(1-WATER_START_RATIO)));
      const waveA=Math.sin((sy*.052)+t*Math.PI*2);
      const waveB=Math.sin((sy*.017)-t*Math.PI*4);
      const dx=(waveA*.72+waveB*.28)*RIPPLE_AMPLITUDE*(.45+depth*.9);
      bctx.drawImage(img,0,sy,img.width,sourceSliceH+.9,draw.x+dx,screenY,draw.w,(sourceSliceH+.9)*draw.scale);
    }
    const shimmer=.045+Math.sin(t*Math.PI*2)*.012;
    const grad=bctx.createLinearGradient(0,visibleWaterY,0,vh);
    grad.addColorStop(0,'rgba(255,210,130,0)');
    grad.addColorStop(.45,`rgba(255,205,120,${shimmer})`);
    grad.addColorStop(1,'rgba(255,210,130,0)');
    bctx.fillStyle=grad; bctx.fillRect(0,visibleWaterY,vw,vh-visibleWaterY);
    bctx.restore();
  }
  function drawStars(now){
    sctx.clearRect(0,0,vw,vh);
    for(const st of starList){
      const tw=(!prefersReducedMotion && st.active) ? (.82+.18*Math.sin(now*st.speed+st.phase)) : .88;
      sctx.globalAlpha=tw;
      sctx.beginPath(); sctx.arc(st.x,st.y,st.r,0,Math.PI*2);
      sctx.fillStyle='rgba(255,255,255,.98)'; sctx.fill();
      if(!prefersReducedMotion && st.active && st.r>1){
        sctx.globalAlpha=Math.max(0,(tw-.82))*.45;
        sctx.beginPath(); sctx.arc(st.x,st.y,st.r*4,0,Math.PI*2);
        sctx.fillStyle='rgba(180,220,255,.35)'; sctx.fill();
      }
    }
    sctx.globalAlpha=1;
  }
  function frame(now){
    if(!running) return;
    drawBaseFrame(now); drawStars(now);
    requestAnimationFrame(frame);
  }
  img.onload=()=>{resize(); running=true; requestAnimationFrame(frame);};
  img.onerror=()=>{root.style.backgroundImage='url("'+IMAGE_SRC+'")'; root.style.backgroundSize='cover'; root.style.backgroundPosition='center';};
  window.addEventListener('resize',()=>{if(img.complete && img.naturalWidth) resize();},{passive:true});
})();
