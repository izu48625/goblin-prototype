// R35: lightweight abuse report dialog for Public, non-owner works only.
(()=>{
'use strict';
const isJA=()=>document.documentElement.lang!=='en';
const tr=(ja,en)=>isJA()?ja:en;
const reasons=[['spam','宣伝・スパム','Spam / advertising'],
['inappropriate','不適切な内容','Inappropriate content'],
['harassment','嫌がらせ・差別','Harassment / hate'],
['copyright','著作権・権利の問題','Copyright / rights'],
['other','その他','Other']];
let dialog=null;
function open(){
  if(dialog){dialog.showModal();return;}
  dialog=document.createElement('dialog');dialog.className='workReportDialog';
  dialog.setAttribute('aria-labelledby','workReportTitle');
  dialog.innerHTML='<div class="workReportHead"><h2 id="workReportTitle">'+tr('作品を通報','Report this work')+'</h2><button type="button" class="workReportClose" aria-label="Close">×</button></div>'+
    '<p class="workReportHint">'+tr('管理者が内容を確認します。通報だけで作品が削除・非公開になることはありません。','Reports are reviewed. A report does not automatically hide or remove a work.')+'</p>'+
    '<form id="workReportForm"><label for="workReportReason">'+tr('理由','Reason')+'</label>'+
    '<select id="workReportReason" required>'+reasons.map(([id,ja,en])=>'<option value="'+id+'">'+(isJA()?ja:en)+'</option>').join('')+'</select>'+
    '<label for="workReportDetails">'+tr('補足（任意・最大500文字）','Details (optional, max 500 characters)')+'</label>'+
    '<textarea id="workReportDetails" maxlength="500" rows="3"></textarea>'+
    '<p id="workReportFeedback" role="status" aria-live="polite" class="workReportFeedback"></p>'+
    '<div class="workReportActions"><button type="button" class="workReportCancel">'+tr('キャンセル','Cancel')+'</button><button type="submit" class="workReportSubmit">'+tr('通報する','Send report')+'</button></div></form>';
  document.body.appendChild(dialog);
  dialog.querySelector('.workReportClose').onclick=()=>dialog.close();
  dialog.querySelector('.workReportCancel').onclick=()=>dialog.close();
  dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close()});
  dialog.addEventListener('close',()=>{dialog.remove();dialog=null});
  const form=dialog.querySelector('form'),feedback=dialog.querySelector('#workReportFeedback');
  form.addEventListener('submit',async e=>{
    e.preventDefault();
    const button=form.querySelector('[type="submit"]');
    if(button.disabled)return;
    const reason=form.querySelector('#workReportReason').value,details=form.querySelector('#workReportDetails').value.trim();
    if(reason==='other'&&details.length<8){feedback.textContent=tr('「その他」は8文字以上の補足が必要です。','For Other, please add at least 8 characters.');return;}
    button.disabled=true;feedback.textContent=tr('送信中…','Sending…');
    try{
      const sb=window.SM_SUPABASE?.client;if(!sb)throw Error('supabase_unavailable');
      let result=await sb.auth.getSession();if(result.error)throw result.error;
      let session=result.data?.session;
      if(!session){result=await sb.auth.signInAnonymously();if(result.error)throw result.error;session=result.data?.session;}
      if(!session?.access_token)throw Error('session_unavailable');
      const topicId=new URLSearchParams(location.search).get('id');
      const response=await fetch('/api/report/work',{method:'POST',
        headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token},
        body:JSON.stringify({topic_id:topicId,reason,details})});
      if(response.ok){
        feedback.textContent=tr('通報を受け付けました。内容を確認します。','Report received. It will be reviewed.');
        button.remove();form.querySelector('select').disabled=true;form.querySelector('textarea').disabled=true;
      }else{
        const result=await response.json().catch(()=>({}));
        feedback.textContent=result.error==='already_reported'?tr('この作品は通報済みです。','You already reported this work.')
          :response.status===429?tr('送信が多すぎます。少し時間を空けてください。','Too many reports. Try again later.')
          :response.status===403?tr('この作品は通報できません。','This work cannot be reported.')
          :tr('送信できませんでした。時間を空けて再試行してください。','Could not send the report. Try again later.');
        button.disabled=false;
      }
    }catch(error){
      console.warn('[Stats Maker] report unavailable',error?.message||error);
      feedback.textContent=tr('現在通報できません。時間を空けて再試行してください。','Reporting is unavailable. Try again later.');
      button.disabled=false;
    }
  });
  dialog.showModal();
}
document.addEventListener('click',event=>{if(event.target?.closest?.('#reportTopicBtn'))open()});
})();