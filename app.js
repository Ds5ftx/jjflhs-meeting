const $=id=>document.getElementById(id);
const departments=['교무기획부(손대원)','교육과정부(채선미)','정보환경부(이덕귀)','생활안전부(박정원)','기숙사운영부(김두은)','1학년기초학력부(정세미)','2학년역량강화부(김희진)','3학년진학연구부(강상수)','진로상담부(김희진)','행정실(실장)','교감','교장'];
let records={}, editing=null, busy=false, ready=false;
const demo=!window.MEETING_API_URL;
const base=(window.MEETING_API_URL||'').replace(/\/$/,'');
let generation=0;
async function request(path, body){const response=await fetch(base+path,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,cache:'no-store',signal:AbortSignal.timeout(20000)});const data=await response.json();if(!response.ok)throw Error(data.error||'요청 실패');return data}
const now=new Date(); $('date').value=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format(now);
function notice(s){$('notice').textContent=s}
function render(){
 const d=$('date').value; $('heading').textContent=d?new Date(d+'T12:00:00').toLocaleDateString('ko-KR',{year:'numeric',month:'long',day:'numeric',weekday:'long'})+' 회의자료':'회의자료';
 $('progress').textContent=`완료 ${Object.values(records).filter(r=>r.status==='완료').length} / ${departments.length}개 부서`;
 $('rows').replaceChildren(); departments.forEach((name,i)=>{
 const r=records[i]||{}, tr=document.createElement('tr'), a=document.createElement('td'), b=document.createElement('td'), c=document.createElement('td');
 a.textContent=name; b.className='text'+(r.text?'':' empty');b.textContent=r.text||'등록된 전달사항이 없습니다.';
 const badge=document.createElement('span');badge.className='badge '+(r.status==='완료'?'done':r.status==='수정 중'?'editing':'');badge.textContent=r.status||'미입력'; c.append(badge,document.createElement('br'));
 const btn=document.createElement('button');btn.textContent='수정';btn.disabled=!ready;btn.onclick=()=>openEditor(i);c.append(btn);
 if(r.updatedAt){const t=document.createElement('small'); t.className='stamp';t.textContent=new Date(r.updatedAt).toLocaleString('ko-KR');c.append(t)}
 tr.append(a,b,c);$('rows').append(tr);
 });
}
function draftKey(){return `jjflhs-draft-${demo?'demo':'shared'}-${editing?.date}-${editing?.index}`}
function openEditor(index){$('pin').value='';editing={index,date:$('date').value,revision:records[index]?.revision||0};$('editTitle').textContent=departments[index];$('content').value=records[index]?.text||'';$('state').value=records[index]?.status||'수정 중';$('saveMessage').textContent='';try{const draft=JSON.parse(sessionStorage.getItem(draftKey())||'null');if(draft){$('content').value=draft.text;$('state').value=draft.status;$('saveMessage').textContent='이 브라우저 탭에 남아 있는 미저장 초안을 복원했습니다.'}}catch{} $('editor').showModal()}
function remember(){try{sessionStorage.setItem(draftKey(),JSON.stringify({text:$('content').value,status:$('state').value}))}catch{}}
$('content').oninput=remember;$('state').onchange=remember;
$('editor').addEventListener('cancel',e=>{if(busy)e.preventDefault()});$('cancel').onclick=()=>$('editor').close();
$('editform').onsubmit=async e=>{
 e.preventDefault();if(busy)return;if(!demo&&!navigator.onLine){$('saveMessage').textContent='인터넷 연결 후 다시 저장해 주세요. 초안은 현재 탭에 보관됩니다.';return}
 const text=$('content').value.trim(),status=text?$('state').value:'미입력';

 busy=true;$('save').disabled=true;$('cancel').disabled=true;$('saveMessage').textContent='저장 확인 중…';
 const record={text,status,revision:editing.revision+1,updatedAt:Date.now()};
 try{
 if(demo){if($('pin').value!=='7564')throw Error('비밀번호가 올바르지 않습니다.');const key='jjflhs-demo-'+editing.date;const data=JSON.parse(localStorage.getItem(key)||'{}');if((data[editing.index]?.revision||0)!==editing.revision)throw Error('다른 창에서 수정되었습니다. 창을 닫고 다시 열어 내용을 확인해 주세요.');data[editing.index]=record;localStorage.setItem(key,JSON.stringify(data));records=data;render()}
 else{await request('/entries',{date:editing.date,department:editing.index,pin:$('pin').value,text,status,revision:editing.revision})}

 sessionStorage.removeItem(draftKey());$('pin').value='';$('editor').close();if(!demo)await load();notice(demo?'체험 자료를 이 브라우저에 저장했습니다. 다른 기기와 공유되지 않습니다.':'서버에 저장되었습니다.');
 }catch(err){$('saveMessage').textContent=err.message||'저장에 실패했습니다. 다시 시도해 주세요.'}
 finally{busy=false;$('save').disabled=false;$('cancel').disabled=false}
};
async function load(){const g=++generation;records={};ready=false;render();if(!$('date').value)return;
 if(demo){try{records=JSON.parse(localStorage.getItem('jjflhs-demo-'+$('date').value)||'{}');ready=true;notice('체험 모드 · 현재 브라우저에만 저장됩니다. 서버 연결 후 공동 사용 가능합니다.')}catch{notice('브라우저 저장소를 읽을 수 없습니다.')}render();return}
 notice('자료를 불러오는 중…');try{const data=await request('/entries?date='+encodeURIComponent($('date').value));if(g!==generation)return;records=data.entries;ready=true;notice('공동 사용 · 열람은 로그인 없이, 수정은 공통번호로 가능합니다.')}catch(err){if(g!==generation)return;notice('조회 실패: '+err.message)}render();
}
$('date').onchange=load;$('print').onclick=()=>{if(!ready){alert('자료를 불러온 후 인쇄해 주세요.');return}window.print()};
$('export').onclick=()=>{if(!ready)return;const blob=new Blob([JSON.stringify({date:$('date').value,departments,entries:records},null,2)],{type:'application/json'});const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download='부장회의_'+$('date').value+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)};
window.addEventListener('beforeunload',e=>{if(busy){e.preventDefault();e.returnValue=''}});
load();
setInterval(()=>{if(!busy&&!$('editor').open&&document.visibilityState==='visible')load()},60000);
