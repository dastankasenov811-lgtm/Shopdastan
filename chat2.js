// chat2.js — дополнение к index.html: голосовой ввод, свободные ответы ИИ, понятное сообщение при перегрузке
(function(){
  // ---- 1. ИИ отвечает на любые вопросы, а данные магазина использует, когда вопрос про магазин ----
  window.aiSystem=function(){
    return 'Тебя зовут dastan.gpt. Ты умный универсальный помощник владельца магазина Dastan Shop (Алматинская область, Казахстан, валюта — тенге ₸). Если спросят, как тебя зовут, отвечай: dastan.gpt. Отвечай по-русски, понятно и по делу, на ЛЮБЫЕ вопросы: бизнес, товары, цены, тексты, переводы, расчёты, советы, повседневные вопросы. Если вопрос про магазин — опирайся на данные ниже и не выдумывай товары и цены. В каталоге НЕТ остатков и продаж — если спрашивают о них, скажи прямо. Финансовые данные тебе недоступны: они в разделе «Финансы» (кнопка справа сверху). Для вопросов не про магазин данные ниже не нужны.\n\nДанные магазина: '+JSON.stringify(shopCtx());
  };
  var NEEDS_WEB=/сегодня|сейчас|новост|курс|погод|последн|актуальн|в интернете|найди в сети|2026|2027/i;
  window.aiSend=async function(q){
    var inp=document.getElementById('ai-input');
    q=(typeof q==='string'&&q?q:inp.value).trim();
    if(!q||aiBusy)return;
    inp.value='';
    aiChat.push({role:'user',content:q});aiBusy=true;aiRender();
    var reply='';
    if(!AI_URL){
      reply=localShopSummary()+'\n\n(Чтобы я отвечал на любые вопросы, подключите ИИ: впишите AI_URL и AI_TOKEN.)';
    }else{
      try{
        var hist=aiChat.filter(function(m){return !m.x;}).slice(-6);
        while(hist.length&&hist[0].role!=='user')hist.shift();
        var body={max_tokens:2000,system:aiSystem(),messages:hist.map(function(m){return{role:m.role,content:m.content};})};
        if(NEEDS_WEB.test(q))body.tools=[{type:'web_search'}];
        var r=await fetch(AI_URL,{method:'POST',headers:{'Content-Type':'application/json','x-app-token':AI_TOKEN},body:JSON.stringify(body)});
        var j=await r.json();
        if(j.error)throw new Error(typeof j.error==='string'?j.error:(j.error.message||'ошибка ИИ'));
        reply=(j.content&&j.content[0]&&j.content[0].text)||'';
        if(!reply)throw new Error('пустой ответ');
      }catch(e){
        reply='⏳ '+(/бесплатные ИИ/.test(e.message)?e.message:'ИИ сейчас недоступен ('+e.message+'). Попробуйте чуть позже.');
      }
    }
    aiChat.push({role:'assistant',content:reply});aiBusy=false;aiRender();
  };

  // ---- имя ----
  var tt=document.querySelector('.aic-title span');if(tt)tt.textContent='dastan.gpt';
  var ph=document.getElementById('ai-input');if(ph)ph.placeholder='Спросите dastan.gpt…';

  // ---- 2. Голосовой ввод: говорите — слова появляются в строке, потом нажимаете ➤ ----
  var SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  var st=document.createElement('style');
  st.textContent='.aic-mic{width:48px;height:48px;border-radius:50%;border:2px solid #e0dbd0;background:#fff;font-size:20px;cursor:pointer;flex-shrink:0}.aic-mic.rec{background:#ffdede;border-color:#e5484d;animation:micp 1s infinite}@keyframes micp{50%{transform:scale(1.08)}}';
  document.head.appendChild(st);
  var inp=document.getElementById('ai-input');
  if(!inp)return;
  var btn=document.createElement('button');btn.className='aic-mic';btn.type='button';btn.title='Говорить';btn.textContent='🎤';
  inp.parentNode.insertBefore(btn,inp.nextSibling);
  var rec=null,on=false,base='';
  function stop(){on=false;btn.classList.remove('rec');btn.textContent='🎤';try{rec&&rec.stop();}catch(e){}}
  btn.onclick=function(){
    if(!SR){showToast('Голосовой ввод не работает в этом браузере. Откройте сайт в Chrome.');return;}
    if(on){stop();return;}
    rec=new SR();rec.lang='ru-RU';rec.interimResults=true;rec.continuous=true;
    base=inp.value?inp.value.trim()+' ':'';
    rec.onresult=function(ev){
      var t='';for(var i=0;i<ev.results.length;i++)t+=ev.results[i][0].transcript;
      inp.value=base+t;
    };
    rec.onerror=function(ev){
      stop();
      showToast(ev.error==='not-allowed'||ev.error==='service-not-allowed'?'Разрешите доступ к микрофону в настройках браузера':ev.error==='no-speech'?'Не услышал голос, попробуйте ещё раз':'Не получилось записать голос');
    };
    rec.onend=function(){if(on)stop();};
    try{rec.start();on=true;btn.classList.add('rec');btn.textContent='⏹';}catch(e){showToast('Не удалось включить микрофон');}
  };
  // если закрыли чат или отправили сообщение — выключаем запись
  var send=document.getElementById('ai-send-btn');
  if(send)send.addEventListener('click',stop,true);
  inp.addEventListener('keydown',function(e){if(e.key==='Enter'&&!e.shiftKey)stop();},true);
})();
