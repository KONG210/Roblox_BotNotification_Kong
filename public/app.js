const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>Number(n||0).toLocaleString('en-US');
const compact=n=>new Intl.NumberFormat('en',{notation:'compact',maximumFractionDigits:1}).format(Number(n||0));
const dt=s=>s?new Date(s).toLocaleString('th-TH',{dateStyle:'short',timeStyle:'short'}):'—';
const hhmm=s=>new Date(s).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit',hour12:false});
const dayKey=s=>new Date(s).toDateString();
const dayLabel=s=>(dayKey(s)===new Date().toDateString()?'วันนี้ · ':'')+new Date(s).toLocaleDateString('th-TH',{day:'numeric',month:'short'});
const hue=s=>[...String(s)].reduce((a,c)=>(a*31+c.charCodeAt(0))%360,7);

let allRuns=[],allRewards=[],resultFilter='All',icons=[],mapIcons=[];
const HIDDEN=/holiday star/i; // removed from the game

// Fandom wiki icons (public/assets/items) matched by name; fan-made SVG as fallback.
const svgFallback=[['summer pearl','pearl'],['gem','gem'],['money','coin'],['ore','ore'],['remnant','shard'],['portal','portal'],['potion','potion'],['talisman','talisman'],['sprig','sprig'],['tome','tome'],['ring','ring']];
const norm=s=>String(s).toLowerCase().replace(/[^a-z0-9]/g,'').replace(/s$/,'');
fetch('/assets/items/manifest.json').then(r=>r.json()).then(m=>{icons=Object.entries(m).map(([n,f])=>[norm(n),f]);render()}).catch(()=>{});
function asset(name){
  const k=norm(name==='Money'?'Gold':name);
  const w=icons.find(([n])=>n===k)||icons.find(([n])=>k.length>=4&&((k.length>=5&&n.includes(k))||(n.length>=5&&k.includes(n))));
  if(w)return '/assets/items/'+w[1];
  const key=String(name).toLowerCase();
  return '/assets/'+(svgFallback.find(([t])=>key.includes(t))||['','chest'])[1]+'.svg';
}

const slots=[{re:/^gems?$/i,label:'เพชร',icon:'Gems'},{re:/^(gold|money|coins?)$/i,label:'ทอง',icon:'Gold'},{re:/summer ?pearl/i,label:'SummerPearls',icon:'Summer Pearls'},{re:/trait.*reroll/i,label:'Trait Reroll',icon:'Trait Reroll'}];
const slotOf=n=>slots.findIndex(s=>s.re.test(n));
const mnorm=s=>String(s).toLowerCase().replace(/[^a-z0-9]/g,'');
fetch('/assets/maps/manifest.json').then(r=>r.json()).then(m=>{mapIcons=Object.entries(m).map(([n,f])=>[mnorm(n),f]);render()}).catch(()=>{});
function mapImg(name){const full=mnorm(name),base=mnorm(String(name).split('(')[0]);const w=mapIcons.find(([n])=>n===full)||mapIcons.find(([n])=>n===base);return w?'/assets/maps/'+w[1]:''}
function renderTiles(){
  $('tiles').innerHTML=slots.map(s=>{const c=allRewards.filter(([n])=>s.re.test(n)).reduce((a,[,v])=>a+v,0);return `<div class="tile"><img src="${asset(s.icon)}" alt=""><div><b>${fmt(c)}</b><span>${s.label}</span></div></div>`}).join('');
}
function renderRewards(){
  const rest=allRewards.filter(([n])=>slotOf(n)<0);
  $('itemCount').textContent=allRewards.length+' ชนิด';
  $('rewards').innerHTML=rest.map(([n,c])=>`<div class="item" style="--c:hsl(${hue(n)} 70% 62%)"><strong>${compact(c)}</strong><img loading="lazy" src="${asset(n)}" alt=""><span title="${esc(n)}">${esc(n)}</span></div>`).join('')||'<div class="skeleton">ยังไม่มีไอเทม</div>';
}
function thumb(map){const img=mapImg(map);return `<div class="thumb" style="--h:${hue(map)};${img?`background-image:linear-gradient(#0000 35%,#000b),url('${img}')`:''}"><span>${esc(map||'Unknown')}</span></div>`}
function renderRuns(){
  const q=$('search').value.toLowerCase();
  const list=allRuns.filter(r=>(resultFilter==='All'||r.result===resultFilter)&&`${r.map} ${r.player}`.toLowerCase().includes(q));
  const wins=list.filter(r=>r.result==='Victory').length;
  $('runCount').textContent=`${list.length} แมตช์ · ชนะ ${wins} (โหลดล่าสุด 100 รายการ)`;
  let lastDay='';
  $('runs').innerHTML=list.map(r=>{
    const win=r.result==='Victory',k=dayKey(r.created_at);
    const head=k!==lastDay?`<div class="day"><span>${dayLabel(r.created_at)}</span></div>`:'';lastDay=k;
    const rw=(r.rewards||[]).filter(x=>!HIDDEN.test(x.item)).map(x=>`<span class="rw"><img src="${asset(x.item)}" alt=""><span>${esc(x.item)}</span><b>×${fmt(x.amount)}</b></span>`).join('')||'<span class="rw none">ไม่มีรางวัลที่บันทึก</span>';
    const meta=[r.difficulty,r.wave?'เวฟ '+esc(r.wave):'',r.duration].filter(Boolean).map(x=>`<span>${esc(x)}</span>`).join('');
    return head+`<div class="run ${win?'win':'loss'}"><div class="t">${hhmm(r.created_at)}</div><div class="line"><span class="node">${win?'✓':'✕'}</span></div><div class="rcard">${thumb(r.map)}<div class="rbody"><div class="rtop"><span class="res ${win?'w':'l'}">${win?'ชนะ':'แพ้'}</span><b title="${esc(r.map)}">${esc(r.map||'Unknown map')}</b>${r.mode?`<span class="tag">${esc(r.mode)}</span>`:''}<span class="rmeta">${meta}</span></div><div class="chipsr">${rw}</div></div></div></div>`;
  }).join('')||'<div class="skeleton">ไม่พบแมตช์</div>';
}
function renderChart(){
  const runs=allRuns.slice(0,40).reverse();
  if(!runs.length){$('chart').innerHTML='<div class="skeleton">ยังไม่มีข้อมูล</div>';return}
  const step=676/runs.length,bars=runs.map((r,i)=>{const h=r.result==='Victory'?60:30;return `<rect x="${12+i*step}" y="${70-h}" width="${Math.max(4,step-3)}" height="${h}" rx="2" fill="${r.result==='Victory'?'#4ade80':'#f87171'}" opacity=".9"/>`}).join('');
  $('chart').innerHTML=`<svg viewBox="0 0 700 74" preserveAspectRatio="none" role="img" aria-label="ผลการเล่นล่าสุด"><line x1="0" y1="70" x2="700" y2="70" stroke="#222836"/>${bars}</svg>`;
}
const STALE_MIN=40; // no report for this long => likely not farming
let lastReportAt=null;
function renderAge(){
  const el=$('age');
  if(!lastReportAt){el.textContent='ยังไม่มีรายงานจาก Discord';el.className='age';return}
  const m=Math.max(0,Math.floor((Date.now()-new Date(lastReportAt))/6e4));
  const t=m<1?'เมื่อสักครู่':m<60?m+' นาทีที่แล้ว':Math.floor(m/60)+' ชม. '+(m%60)+' นาทีที่แล้ว';
  el.textContent=(m>STALE_MIN?'⚠ ไม่มีรายงานมา ':'รายงานล่าสุด ')+t;
  el.className='age'+(m>STALE_MIN?' stale':'');
}
function renderRates(){
  const rs=allRuns,card=$('ratesCard');
  const hrs=rs.length>1?(new Date(rs[0].created_at)-new Date(rs[rs.length-1].created_at))/36e5:0;
  card.hidden=hrs<0.25; // too little data for a meaningful rate
  if(card.hidden)return;
  $('rateNote').textContent=`จาก ${rs.length} รอบ · ${hrs.toFixed(1)} ชม.`;
  const sum=re=>rs.reduce((a,r)=>a+(r.rewards||[]).filter(x=>re.test(x.item)).reduce((b,x)=>b+x.amount,0),0);
  const tiles=[`<div class="tile"><div><b>${(rs.length/hrs).toFixed(1)}</b><span>รอบ / ชม.</span></div></div>`];
  for(const s of slots){const v=sum(s.re);if(v>0)tiles.push(`<div class="tile"><img src="${asset(s.icon)}" alt=""><div><b>${fmt(Math.round(v/hrs))}</b><span>${s.label} / ชม.</span></div></div>`)}
  $('rates').innerHTML=tiles.join('');
}
function render(){renderTiles();renderRewards();renderRuns();renderChart();renderRates()}

async function load(){
  try{
    const res=await fetch('/api/dashboard',{cache:'no-store'});
    if(!res.ok)throw Error('HTTP '+res.status);
    const data=await res.json(),s=data.stats||{},r0=(data.runs||[])[0];
    // Normalize rows already stored with "## " prefixes; player can be "Name · Level 245 [..]".
    allRuns=(data.runs||[]).map(r=>({...r,map:String(r.map??'').replace(/^[#\s]+/,'').trim(),player:String(r.player??'').split(' · ')[0].trim()}));
    allRewards=Object.entries(data.totals||{}).filter(([n])=>!HIDDEN.test(n)).sort((a,b)=>b[1]-a[1]);
    const total=Number(s.total),rate=total?100*Number(s.wins)/total:0;
    $('total').textContent=fmt(s.total);$('wins').textContent=fmt(s.wins);$('losses').textContent=fmt(s.losses);
    $('rate').textContent=rate.toFixed(1)+'%';$('rateSub').textContent=`${fmt(s.wins)} / ${fmt(s.total)}`;$('rateBar').style.width=rate+'%';
    $('player').textContent=allRuns[0]?.player||'—';lastReportAt=data.lastReport;renderAge();
    render();
  }catch(err){$('runs').innerHTML='<div class="skeleton">โหลดข้อมูลไม่สำเร็จ: '+esc(err.message)+'</div>'}
}

$('search').oninput=renderRuns;
$('chips').onclick=e=>{const b=e.target.closest('.chip');if(!b)return;resultFilter=b.dataset.f;document.querySelectorAll('.chip').forEach(x=>x.classList.toggle('on',x===b));renderRuns()};
$('refresh').onclick=load;
$('clear').onclick=async()=>{
  if(!confirm('ล้างประวัติและสถิติทั้งหมด? ย้อนกลับไม่ได้'))return;
  if(!confirm('ยืนยันอีกครั้ง: ข้อมูลทุกรอบจะถูกลบถาวร'))return;
  try{const r=await fetch('/api/clear',{method:'POST',headers:{'x-confirm':'clear'}});if(!r.ok)throw Error('HTTP '+r.status);await load()}
  catch(e){alert('ล้างไม่สำเร็จ: '+e.message)}
};

const socket=io();
socket.on('connect',()=>{$('connection').textContent='Connected';$('dot').style.background='#4ade80';load()});
socket.on('disconnect',()=>{$('connection').textContent='Disconnected';$('dot').style.background='#f87171'});
socket.on('updated',load);
socket.on('connect_error',()=>{$('connection').textContent='API mode';$('dot').style.background='#f59e0b'});
load();
setInterval(renderAge,30000);
setInterval(load,60000); // keep working if WebSocket is unavailable
