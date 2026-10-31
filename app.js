const $=id=>document.getElementById(id);
const departments=['교무기획부(손대원)','교육과정부(채선미)','정보환경부(이덕귀)','생활안전부(박정원)','기숙사운영부(김두은)','1학년기초학력부(정세미)','2학년역량강화부(김희진)','3학년진학연구부(강상수)','진로상담부(김희진)','행정실(실장)','교감','교장'];
let records={}, api=null, user=null, profile=null, unsub=null, editing=null, busy=false, ready=false;
const demo=!window.FIREBASE_CONFIG;
const now=new Date(); $('date').value=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format(now);
function notice(s){$('notice').textContent=s}
function allowed(i){return demo||!!(user&&profile&&(profile.role==='admin'||profile.department===String(i)))}
function render(){
 const d=$('date').value; $('heading').textContent=d?new Date(d+'T12:00:00').toLocaleDateString('ko-KR',{year:'numeric',month:'long',day:'numeric',weekday:'long'})+' 회의자료':'회의자료';
 $('progress').textContent=`완료 ${Object.values(records).filter(r=>r.status==='완료').length} / ${departments.length}개 부서`;
 $('rows').replaceChildren(); departments.forEach((name,i)=>{
 const r=records[i]||{}, tr=document.createElement('tr'), a=document.createElement('td'), b=document.createElement('td'), c=document.createElement('td');
 a.textContent=name; b.className='text'+(r.text?'':' empty');b.textContent=r.text||'등록된 전달사항이 없습니다.';
 const badge=document.createElement('span');badge.className='badge '+(r.status==='완료'?'done':r.status==='수정 중'?'editing':'');badge.textContent=r.status||'미입력'; c.append(badge,document.createElement('br'));
 const btn=document.createElement('button');btn.textContent='수정';btn.disabled=!ready||!allowed(i);btn.onclick=()=>openEditor(i);c.append(btn);
 if(r.updatedAt){const t=document.createElement('small'); t.className='stamp';t.textContent=new Date(r.updatedAt).toLocaleString('ko-KR');c.append(t)}
 tr.append(a,b,c);$('rows').append(tr);
 });
}
function draftKey(){return `jjflhs-draft-${demo?'demo':user?.uid}-${editing?.date}-${editing?.index}`}
function openEditor(index){editing={index,date:$('date').value,revision:records[index]?.revision||0};$('editTitle').textContent=departments[index];$('content').value=records[index]?.text||'';$('state').value=records[index]?.status||'수정 중';$('saveMessage').textContent='';try{const draft=JSON.parse(sessionStorage.getItem(draftKey())||'null');if(draft){$('content').value=draft.text;$('state').value=draft.status;$('saveMessage').textContent='이 브라우저 탭에 남아 있는 미저장 초안을 복원했습니다.'}}catch{} $('editor').showModal()}
function remember(){try{sessionStorage.setItem(draftKey(),JSON.stringify({text:$('content').value,status:$('state').value}))}catch{}}
$('content').oninput=remember;$('state').onchange=remember;
$('editor').addEventListener('cancel',e=>{if(busy)e.preventDefault()});$('cancel').onclick=()=>$('editor').close();
$('editform').onsubmit=async e=>{
 e.preventDefault();if(busy)return;if(!demo&&!navigator.onLine){$('saveMessage').textContent='인터넷 연결 후 다시 저장해 주세요. 초안은 현재 탭에 보관됩니다.';return}
 const text=$('content').value.trim(),status=text?$('state').value:'미입력';
 if(!demo&&!allowed(editing.index))return;
 busy=true;$('save').disabled=true;$('cancel').disabled=true;$('saveMessage').textContent='저장 확인 중…';
 const record={text,status,revision:editing.revision+1,updatedAt:Date.now()};
 try{
 if(demo){const key='jjflhs-demo-'+editing.date;const data=JSON.parse(localStorage.getItem(key)||'{}');if((data[editing.index]?.revision||0)!==editing.revision)throw Error('다른 창에서 수정되었습니다. 창을 닫고 다시 열어 내용을 확인해 주세요.');data[editing.index]=record;localStorage.setItem(key,JSON.stringify(data));records=data;render()}
 else{const ref=api.doc(api.db,'meetings',editing.date,'entries',String(editing.index));await api.runTransaction(api.db,async tx=>{const old=await tx.get(ref);if((old.data()?.revision||0)!==editing.revision)throw Error('다른 선생님이 먼저 저장했습니다. 입력 내용을 복사한 뒤 창을 닫고 최신 자료를 확인해 주세요.');tx.set(ref,{...record,updatedBy:user.uid})})}
 sessionStorage.removeItem(draftKey());$('editor').close();notice(demo?'체험 자료를 이 브라우저에 저장했습니다. 다른 기기와 공유되지 않습니다.':'서버에 저장되었습니다.');
 }catch(err){$('saveMessage').textContent=err.message||'저장에 실패했습니다. 다시 시도해 주세요.'}
 finally{busy=false;$('save').disabled=false;$('cancel').disabled=false}
};
function load(){if(unsub)unsub();unsub=null;records={};ready=false;render();if(!$('date').value)return;
 if(demo){try{records=JSON.parse(localStorage.getItem('jjflhs-demo-'+$('date').value)||'{}');ready=true;notice('체험 모드 · 현재 브라우저에만 저장됩니다. 공동 사용은 Firebase 연결 후 가능합니다.')}catch{notice('브라우저 저장소를 읽을 수 없습니다. 브라우저 설정을 확인하세요.')}render();return}
 if(!user||!profile){notice('로그인 후 회의자료를 조회할 수 있습니다.');return}
 notice('서버에서 자료를 불러오는 중…');
 unsub=api.onSnapshot(api.collection(api.db,'meetings',$('date').value,'entries'),{includeMetadataChanges:true},s=>{records={};s.forEach(d=>records[d.id]=d.data());ready=!s.metadata.fromCache;notice(s.metadata.fromCache?'서버 연결 확인 중 · 현재 표시 자료는 최신이 아닐 수 있습니다.':'서버 연결됨 · 변경사항이 자동 반영됩니다.');render()},()=>{ready=false;notice('자료 조회 권한이나 연결 상태를 확인하세요.');render()});
}
$('date').onchange=load;$('print').onclick=()=>{if(!ready){alert('자료를 불러온 후 인쇄해 주세요.');return}window.print()};
$('export').onclick=()=>{if(!ready)return;const blob=new Blob([JSON.stringify({date:$('date').value,departments,entries:records},null,2)],{type:'application/json'});const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download='부장회의_'+$('date').value+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)};
$('login').onclick=async()=>{if(demo){alert('config.js에 Firebase 설정을 연결한 후 로그인할 수 있습니다.');return}if(!api){alert('연결 준비가 완료되지 않았습니다.');return}if(user){await api.signOut(api.auth);return}$('authdialog').showModal()};
$('authcancel').onclick=()=>$('authdialog').close();$('authform').onsubmit=async e=>{e.preventDefault();$('authMessage').textContent='로그인 중…';try{await api.signInWithEmailAndPassword(api.auth,$('email').value,$('password').value);$('password').value='';$('authdialog').close();$('authMessage').textContent=''}catch{$('authMessage').textContent='로그인에 실패했습니다. 계정 정보와 연결 상태를 확인하세요.'}};
window.addEventListener('beforeunload',e=>{if(busy){e.preventDefault();e.returnValue=''}});
if(demo)load();else{render();try{
 const [app,auth,fs]=await Promise.all([import('https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js'),import('https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js'),import('https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js')]);
 const instance=app.initializeApp(window.FIREBASE_CONFIG);api={...auth,...fs,auth:auth.getAuth(instance),db:fs.getFirestore(instance)};
 await auth.setPersistence(api.auth,auth.browserSessionPersistence);
 auth.onAuthStateChanged(api.auth,async u=>{if(unsub)unsub();user=u;profile=null;records={};ready=false;render();$('login').textContent=u?'로그아웃':'교직원 로그인';if(u){try{const p=await fs.getDoc(fs.doc(api.db,'members',u.uid));if(user?.uid!==u.uid)return;profile=p.data()||null;if(!profile){notice('관리자의 계정 권한 등록이 필요합니다.');return}}catch{notice('계정 권한을 확인할 수 없습니다.');return}}load()});
 }catch{notice('Firebase 연결 실패 · config.js 설정 또는 네트워크를 확인한 후 새로고침해 주세요.')}}
