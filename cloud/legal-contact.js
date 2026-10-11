// R35 P2 private contact form, using existing anonymous Supabase sessions.
(()=>{
'use strict';
const form=document.getElementById('legalContactForm');if(!form)return;
const ja=document.body.dataset.smLegalPage!=='en';
const tr=(a,b)=>ja?a:b;
const get=id=>document.getElementById(id);
form.addEventListener('submit',async event=>{
  event.preventDefault();
  const category=get('contactCategory').value,reply_email=get('contactEmail').value.trim(),
        work_url=get('contactWorkUrl').value.trim(),message=get('contactMessage').value.trim();
  const status=get('contactStatus'),button=get('contactSubmit');
  if(!['general','copyright','appeal','privacy'].includes(category)||message.length<20||message.length>2000){
    status.textContent=tr('内容を20〜2000文字で入力してください。','Please enter a message of 20–2000 characters.');return;
  }
  if(category!=='general'&&!reply_email){
    status.textContent=tr('権利・異議・個人情報の申請には返信先メールアドレスが必要です。','Please enter a reply email for rights, appeals or privacy requests.');return;
  }
  if(['copyright','appeal'].includes(category)&&!work_url){
    status.textContent=tr('対象作品のURLを入力してください。','Please enter the affected work URL.');return;
  }
  button.disabled=true;status.textContent=tr('送信中…','Sending…');
  try{
    const sb=window.SM_SUPABASE?.client;if(!sb)throw Error('supabase_unavailable');
    let response=await sb.auth.getSession();if(response.error)throw response.error;
    let session=response.data?.session;
    if(!session){response=await sb.auth.signInAnonymously();if(response.error)throw response.error;session=response.data?.session;}
    if(!session?.access_token)throw Error('session_missing');
    const sent=await fetch('/api/report/contact',{method:'POST',headers:{
      'Content-Type':'application/json',Authorization:'Bearer '+session.access_token},
      body:JSON.stringify({category,reply_email,work_url,message})});
    if(!sent.ok){
      status.textContent=sent.status===429?tr('送信が集中しています。少し時間を空けて再試行してください。','Too many requests. Try again later.')
        :tr('送信できませんでした。時間を空けて再試行してください。','Could not submit. Please try again later.');
      return;
    }
    status.textContent=tr('お問い合わせを受け付けました。必要に応じて記載のメールアドレスへ返信します。','Your message was received. We will reply to the address provided when needed.');
    form.reset();button.textContent=tr('送信済み','Submitted');button.remove();
  }catch(error){
    console.warn('[Stats Maker] contact request unavailable',error?.message||error);
    status.textContent=tr('現在送信できません。時間を空けて再試行してください。','Contact is temporarily unavailable. Please try later.');
  }finally{if(button.isConnected)button.disabled=false;}
});
})();
