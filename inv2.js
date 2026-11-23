// inv2.js — штрихкоды в накладной (дополнение к index.html)
(function(){var st=document.createElement('style');st.textContent=".inv-bc{display:flex;flex-direction:column;gap:2px;margin-bottom:4px}\n.inv-bc .inv-in{margin-bottom:2px;font-family:ui-monospace,Menlo,monospace;letter-spacing:1px}\n.inv-bc-ok{font-size:12px;font-weight:800;color:#1a6e3c}\n.inv-bc-bad{font-size:12px;font-weight:800;color:#a12a22}\n.inv-bc-no{font-size:12px;font-weight:700;color:#999}\n.inv-lk{display:flex;gap:10px;align-items:flex-start;font-size:13px;font-weight:700;color:#555;margin:4px 0 8px}\n.inv-lk-ok{background:#eef8f1;border-radius:12px;padding:8px 10px;color:#1a1a2e}\n.inv-lk img{width:54px;height:54px;object-fit:contain;border-radius:8px;background:#fff;flex-shrink:0}\n.inv-mini{padding:7px 12px;border-radius:10px;border:2px solid #e8c547;background:#fffdf0;color:#1a1a2e;font-size:13px;font-weight:800;font-family:'Nunito',sans-serif;cursor:pointer;margin:2px 0 8px}\n";document.head.appendChild(st);})();
function invOpenPicker(){document.getElementById('inv-file').click();}
function invNum(x){if(x==null||x==='')return null;const n=parseFloat(String(x).replace(/\s/g,'').replace(',','.'));return isNaN(n)?null:n;}
function invPref(){try{const m=parseFloat(localStorage.getItem('invMarkup')),r=parseInt(localStorage.getItem('invRound'));return{markup:isNaN(m)||m<0?20:m,round:[1,10,50,100].includes(r)?r:10};}catch(e){return{markup:20,round:10};}}
function invSavePref(d){try{localStorage.setItem('invMarkup',String(d.markup));localStorage.setItem('invRound',String(d.round));}catch(e){}}
function invSale(cost,d){
  if(cost==null||!(cost>0)||!d.useMarkup)return null;
  const raw=Math.round(cost*(1+(d.markup||0)/100)*100)/100,st=d.round||1;
  return Math.ceil(raw/st-1e-9)*st;
}

// ---- штрихкоды ----
const invDigits=x=>String(x==null?'':x).replace(/\D/g,'');
const invNormBc=x=>invDigits(x).replace(/^0+/,'');          // EAN-13 и UPC-12 сравниваем без ведущих нулей
function invBarcodeOk(b){                                      // контрольная цифра EAN/UPC
  b=invDigits(b);
  if(!/^(\d{8}|\d{12,14})$/.test(b))return false;
  const d=b.split('').map(Number),chk=d.pop();let s=0;
  d.reverse().forEach((v,i)=>{s+=v*(i%2===0?3:1);});
  return (10-(s%10))%10===chk;
}
const invBarcodeUsable=it=>invBarcodeOk(it.barcode)||(!!it.bcEdited&&/^\d{4,14}$/.test(it.barcode||''));
function invBcOf(p){const a=[];if(p.barcode)a.push(String(p.barcode));if(p.barcodes)Object.values(p.barcodes).forEach(v=>{if(v&&!a.includes(String(v)))a.push(String(v));});return a;}
function invFindByBarcode(b){
  const n=invNormBc(b);if(!n)return '';
  const e=Object.entries(window._products||{}).find(([,p])=>invBcOf(p).some(x=>invNormBc(x)===n));
  return e?e[0]:'';
}

function invFileB64(f){
  return new Promise((res,rej)=>{
    const r=new FileReader();
    r.onload=async()=>{try{res(await shrinkB64(String(r.result).split(',')[1],1800));}catch(e){rej(e);}};
    r.onerror=()=>rej(new Error('не удалось открыть фото'));
    r.readAsDataURL(f);
  });
}
function invCatalogLines(){return Object.entries(window._products||{}).slice(0,400).map(([id,p])=>id+' | '+p.name+(p.weight?' | '+p.weight:'')).join('\n');}
async function invAnalyze(b64){
  const sys='Ты читаешь фото накладной поставщика для магазина в Казахстане (валюта — тенге ₸). Верни ТОЛЬКО JSON такого вида: {"company":"поставщик или null","date":"YYYY-MM-DD или null","doc_no":"номер или null","total":число или null,"items":[{"name":"название товара как в накладной","weight":"вес или объём (например 1 л, 500 г), если указан, иначе null","unit":"единица измерения (шт, кг, л, уп) или null","qty":число или null,"price":число (цена за единицу) или null,"sum":число или null,"barcode":"штрихкод только цифрами или null","match_id":"ID из каталога, если это тот же товар, иначе null"}]}. Правила: не выдумывай позиции и числа, нечитаемое ставь null; числа пиши без пробелов и без знака валюты. В накладных часто есть колонка со штрихкодами (ШК, EAN, штрих-код): читай каждую цифру внимательно, обычно 13 цифр (иногда 8 или 12); если цифры нечёткие, ставь null и не угадывай. match_id ставь только при уверенном совпадении (тот же вид товара, бренд и вес). Сегодня '+getTodayStr()+'.';
  const r=await fetch(AI_URL,{method:'POST',headers:{'Content-Type':'application/json','x-app-token':AI_TOKEN},body:JSON.stringify({max_tokens:4096,json:true,system:sys,messages:[{role:'user',content:[{type:'image',source:{type:'base64',media_type:'image/jpeg',data:b64}},{type:'text',text:'Каталог магазина (ID | название | вес):\n'+invCatalogLines()}]}]})});
  const j=await r.json();
  if(j.error)throw new Error(typeof j.error==='string'?j.error:(j.error.message||'ошибка ИИ'));
  const txt=(j.content&&j.content[0]&&j.content[0].text)||'';
  const m=txt.replace(/```json|```/g,'').match(/\{[\s\S]*\}/);
  if(!m)throw new Error('ИИ вернул непонятный ответ');
  let o;try{o=JSON.parse(m[0]);}catch(e){throw new Error('не удалось разобрать ответ ИИ');}
  const prods=window._products||{};
  const items=(Array.isArray(o.items)?o.items:[]).filter(it=>it&&it.name).slice(0,60).map(it=>{
    const qty=invNum(it.qty);let price=invNum(it.price),sum=invNum(it.sum);
    if(sum==null&&qty!=null&&price!=null)sum=Math.round(qty*price*100)/100;
    if(price==null&&qty>0&&sum!=null)price=Math.round(sum/qty*100)/100;
    const barcode=invDigits(it.barcode);
    let matchId='',matchedBy='';
    if(barcode){matchId=invFindByBarcode(barcode);if(matchId)matchedBy='barcode';}
    if(!matchId&&it.match_id&&prods[it.match_id]){matchId=it.match_id;matchedBy='name';}
    return{name:String(it.name).trim(),weight:it.weight?String(it.weight):'',unit:it.unit?String(it.unit):'',qty,price,sum,barcode,matchId,matchedBy,
      addNew:true,updatePrice:false,saleManual:null,bindBarcode:true,bcEdited:false,nameEdited:false,lookup:null,lookupState:'',useLookup:true};
  });
  if(!items.length)throw new Error('позиции не найдены на фото');
  let total=invNum(o.total);const isum=items.reduce((s,i)=>s+(i.sum||0),0);if(total==null||total<=0)total=Math.round(isum);
  return{company:String(o.company||'').trim(),date:getTodayStr(),invDate:/^\d{4}-\d\d-\d\d$/.test(o.date||'')?o.date:'',docNo:o.doc_no?String(o.doc_no):'',total,items,
    markup:20,round:10,useMarkup:false,catId:'',finOn:true,finBranch:'',finBranches:[]};
}
async function invLoadFinBranches(d){
  try{
    const snap=await window._get(window._ref(window._db,'fin/branches'));
    const v=snap.exists()?snap.val():{};
    d.finBranches=Object.entries(v||{}).map(([id,b])=>({id,name:b.name}));
  }catch(e){d.finOn=false;d.finNoAccess=true;}
  const pref=d.finBranches.find(b=>/магаз/i.test(b.name))||d.finBranches[0];
  d.finBranch=pref?pref.id:'__new';
}
async function invPick(e){
  const f=e.target.files&&e.target.files[0];e.target.value='';if(!f)return;
  if(!AI_URL){aiChat.push({role:'assistant',content:'Чтобы читать накладные, нужен ИИ-сервер (AI_URL).',x:1});aiRender();return;}
  aiChat.push({role:'user',content:'📄 Фото накладной',x:1});aiBusy=true;aiRender();
  try{
    const d=await invAnalyze(await invFileB64(f));
    await invLoadFinBranches(d);
    invPending=d;
    const found=d.items.filter(i=>i.matchId).length,fresh=d.items.length-found,withBc=d.items.filter(i=>i.barcode).length,pref=invPref();
    aiBusy=false;
    aiChat.push({role:'assistant',x:1,inv:1,content:'Накладная прочитана',html:
      '<b>📄 Накладная прочитана</b><br>'+(d.company?esc2(d.company)+' · ':'')+d.items.length+' поз. на сумму '+fmt(Math.round(d.total))+' ₸<br>✅ Есть в каталоге: <b>'+found+'</b> · ➕ Новых: <b>'+fresh+'</b> · 🔖 Со штрихкодом: <b>'+withBc+'</b>'+
      '<div class="inv-ask">Рассчитать цены с наценкой? <span class="inv-pct"><input id="inv-pct" type="number" inputmode="decimal" min="0" step="any" value="'+pref.markup+'"> %</span>'+
      '<div class="inv-btns"><button class="aic-chip" onclick="invAsk(true)">Рассчитать</button><button class="aic-chip" onclick="invAsk(false)">Без наценки</button></div></div>'});
    aiRender();
  }catch(err){
    aiBusy=false;
    aiChat.push({role:'assistant',x:1,content:'⚠️ Не получилось прочитать накладную: '+err.message+'\nСфотографируйте ровнее и ближе, чтобы текст и штрихкоды читались.'});
    aiRender();
  }
}
function invAsk(calc){
  const d=invPending;if(!d)return;
  const inp=document.getElementById('inv-pct'),pref=invPref(),v=inp?parseFloat(inp.value):NaN;
  d.markup=!isNaN(v)&&v>=0?v:pref.markup;d.round=pref.round;d.useMarkup=!!calc;
  if(calc)invSavePref(d);
  const m=aiChat.find(x=>x.inv&&x.html);
  if(m){m.html=null;m.content=calc?'Считаю цены с наценкой '+d.markup+'%. Проверьте список и подтвердите.':'Открываю список без наценки. Проверьте и подтвердите.';}
  invPending=null;aiRender();invOpen(d);
}
function invOpen(d){invData=d;invRenderAll();document.getElementById('inv-overlay').classList.add('open');setTimeout(invEnrich,50);}
function closeInv(){document.getElementById('inv-overlay').classList.remove('open');}

// ---- поиск новых товаров по штрихкоду в интернете (тот же механизм, что при сканировании) ----
function invLookupHtml(i){
  const it=invData.items[i];
  if(it.matchId||!invBarcodeOk(it.barcode))return '';
  if(it.lookupState==='loading')return '<div class="inv-lk">🔎 Ищу в интернете по штрихкоду…</div>';
  if(it.lookupState==='done'&&it.lookup){
    const L=it.lookup;
    return '<div class="inv-lk inv-lk-ok">'+(L.imageUrl&&/^https?:\/\//.test(L.imageUrl)?'<img src="'+esc2(L.imageUrl)+'" alt="" onerror="this.style.display=\'none\'">':'')+'<div>🌐 Найдено: <b>'+esc2(L.name)+'</b>'+(L.brand?' · '+esc2(L.brand):'')+(L.weight?' · '+esc2(L.weight):'')+
      '<label class="inv-chk"><input type="checkbox" '+(it.useLookup?'checked':'')+' onchange="invData.items['+i+'].useLookup=this.checked"> Взять название, вес и фото отсюда</label></div></div>';
  }
  if(it.lookupState==='none')return '<div class="inv-lk">Не нашёл в интернете — добавлю по данным накладной. <button class="inv-mini" onclick="invLookupOne('+i+')">Повторить</button></div>';
  return '<button class="inv-mini" onclick="invLookupOne('+i+')">🔎 Найти по штрихкоду</button>';
}
function invRefreshLookup(i){const el=document.getElementById('inv-lk-'+i);if(el)el.innerHTML=invLookupHtml(i);}
async function invLookupOne(i){
  const d=invData,it=d.items[i];if(!it||!invBarcodeOk(it.barcode))return;
  it.lookupState='loading';invRefreshLookup(i);
  let r=null;try{r=await lookupBarcodeExternal(invDigits(it.barcode));}catch(e){}
  if(invData!==d)return;
  it.lookup=r&&r.name?r:null;it.lookupState=it.lookup?'done':'none';invRefreshLookup(i);
}
async function invEnrich(){
  const d=invData;if(!d)return;
  const todo=d.items.map((it,i)=>[it,i]).filter(([it])=>!it.matchId&&it.addNew&&invBarcodeOk(it.barcode)&&!it.lookupState).slice(0,12);
  todo.forEach(([it,i])=>{it.lookupState='loading';invRefreshLookup(i);});
  for(const [it,i] of todo){
    let r=null;try{r=await lookupBarcodeExternal(invDigits(it.barcode));}catch(e){}
    if(invData!==d)return;
    it.lookup=r&&r.name?r:null;it.lookupState=it.lookup?'done':'none';invRefreshLookup(i);
  }
}

function invOptions(){
  return Object.entries(window._products||{}).sort((a,b)=>(a[1].name||'').localeCompare(b[1].name||'','ru'))
    .map(([id,p])=>'<option value="'+esc2(id)+'">'+esc2(p.name)+(p.weight?' ('+esc2(p.weight)+')':'')+'</option>').join('');
}
function invIsDupe(){
  const d=invData;
  return Object.values(window._deliveries||{}).some(x=>x&&x.date===d.date&&Math.round(x.amount||0)===Math.round(d.total||0)&&String(x.company||'').trim().toLowerCase()===String(d.company||'').trim().toLowerCase());
}
function invDupe(){const el=document.getElementById('inv-dupe');if(el)el.innerHTML=invIsDupe()?'<div class="inv-warn inv-bad">⚠️ Такая поставка уже записана (та же компания, дата и сумма). Не дублируете?</div>':'';}
function invSetMarkup(v){const n=parseFloat(v);invData.useMarkup=v!==''&&!isNaN(n);invData.markup=isNaN(n)||n<0?0:n;if(invData.useMarkup)invSavePref(invData);invRenderRows();}
function invSetRound(v){invData.round=parseInt(v)||10;invSavePref(invData);invRenderRows();}
function invMatch(i,v){const it=invData.items[i];it.matchId=v;it.matchedBy=v?'manual':'';invRenderRows();}
function invBarcodeEdit(i,v){
  const it=invData.items[i];it.barcode=invDigits(v);it.bcEdited=true;it.lookup=null;it.lookupState='';
  const f=invFindByBarcode(it.barcode);
  if(f){it.matchId=f;it.matchedBy='barcode';}
  invRenderRows();
  if(!it.matchId&&invBarcodeOk(it.barcode))invLookupOne(i);
}
function invRenderAll(){
  const d=invData;
  const finBr=d.finBranches.map(b=>'<option value="'+esc2(b.id)+'" '+(b.id===d.finBranch?'selected':'')+'>'+esc2(b.name)+'</option>').join('')+(d.finBranches.length?'':'<option value="__new" selected>Магазин (будет создана)</option>');
  document.getElementById('inv-body').innerHTML=
    '<div class="inv-h">📄 Накладная'+(d.docNo?' №'+esc2(d.docNo):'')+'</div><div class="inv-sub" id="inv-sum"></div><div id="inv-dupe"></div>'+
    '<div class="inv-lbl">Поставщик</div><input class="inv-in" value="'+esc2(d.company)+'" placeholder="Название компании" oninput="invData.company=this.value;invDupe()">'+
    '<div class="inv-two"><div><div class="inv-lbl">Дата</div><input class="inv-in" type="date" value="'+esc2(d.date)+'" oninput="invData.date=this.value;invDupe()"></div>'+
    '<div><div class="inv-lbl">Сумма, ₸</div><input class="inv-in" type="number" inputmode="decimal" value="'+(d.total||'')+'" oninput="invData.total=parseFloat(this.value)||0;invDupe()"></div></div>'+
    '<div class="inv-lbl">Наценка и округление цены</div><div class="inv-two"><div><input class="inv-in" type="number" inputmode="decimal" min="0" step="any" placeholder="% наценки" value="'+(d.useMarkup?d.markup:'')+'" oninput="invSetMarkup(this.value)"></div>'+
    '<div><select class="inv-in" onchange="invSetRound(this.value)">'+[1,10,50,100].map(r=>'<option value="'+r+'" '+(r===d.round?'selected':'')+'>вверх до '+r+' ₸</option>').join('')+'</select></div></div>'+
    '<div class="inv-lbl">Товары</div><div id="inv-rows"></div><div id="inv-catbox"></div>'+
    '<div class="inv-lbl">Финансы</div>'+
    (d.finNoAccess?'<div class="inv-warn">Нет доступа к разделу «Финансы» — расход записать не получится.</div>':
      '<label class="inv-fin"><input type="checkbox" '+(d.finOn?'checked':'')+' onchange="invData.finOn=this.checked"> Записать расход «Закупка товара» в Финансы (дата — как выше)</label>'+
      '<select class="inv-in" onchange="invData.finBranch=this.value">'+finBr+'</select>')+
    '<button class="inv-save" id="inv-savebtn" onclick="invSave()">✅ Подтвердить и записать</button><button class="inv-cancel" onclick="closeInv()">Отмена</button>';
  invRenderRows();invDupe();
}
function invRenderRows(){
  const d=invData,opts=invOptions();
  const found=d.items.filter(i=>i.matchId).length,fresh=d.items.length-found,withBc=d.items.filter(i=>i.barcode).length;
  const isum=d.items.reduce((s,i)=>s+(i.sum||0),0);
  document.getElementById('inv-sum').innerHTML='✅ Есть в каталоге: <b>'+found+'</b> · ➕ Новых: <b>'+fresh+'</b> · 🔖 Со штрихкодом: <b>'+withBc+'</b>'+
    (d.total&&Math.abs(isum-d.total)>Math.max(1,d.total*0.01)?'<div class="inv-warn">Сумма позиций ('+fmt(Math.round(isum))+' ₸) не равна итогу накладной ('+fmt(Math.round(d.total))+' ₸). Проверьте числа.</div>':'');
  document.getElementById('inv-rows').innerHTML=d.items.map((it,i)=>{
    const p=it.matchId?(window._products||{})[it.matchId]:null,sale=invSaleOf(it,d);
    let h='<div class="inv-row"><div class="inv-rt">'+(i+1)+'. '+esc2(it.name)+(it.weight?' · '+esc2(it.weight):'')+'</div>';
    h+='<div class="inv-rs">'+(it.qty!=null?fmt(it.qty):'?')+(it.unit?' '+esc2(it.unit):'')+' × '+(it.price!=null?fmt(it.price)+' ₸':'?')+' = <b>'+(it.sum!=null?fmt(Math.round(it.sum))+' ₸':'?')+'</b></div>';
    if(d.useMarkup)h+='<div class="inv-price">'+(sale!=null?'Цена с наценкой '+d.markup+'%: <b>'+fmt(sale)+' ₸</b>':'Цена с наценкой: нет закупочной цены')+'</div>';
    h+='<select class="inv-in" onchange="invMatch('+i+',this.value)"><option value="">➕ Новый товар</option>'+(it.matchId?opts.replace('value="'+esc2(it.matchId)+'"','value="'+esc2(it.matchId)+'" selected'):opts)+'</select>';
    const bcSt=!it.barcode?'<span class="inv-bc-no">штрихкод на накладной не найден</span>':invBarcodeOk(it.barcode)?'<span class="inv-bc-ok">✓ штрихкод корректный</span>':'<span class="inv-bc-bad">⚠️ проверьте цифры штрихкода</span>';
    h+='<div class="inv-bc"><input class="inv-in" inputmode="numeric" placeholder="Штрихкод" value="'+esc2(it.barcode)+'" onchange="invBarcodeEdit('+i+',this.value)">'+bcSt+'</div>';
    if(p){
      h+='<div class="inv-ok">✓ Есть в каталоге'+(it.matchedBy==='barcode'?' (найден по штрихкоду)':it.matchedBy==='name'?' (по названию)':'')+(p.price?' · сейчас '+fmt(p.price)+' ₸':'')+'</div>';
      if(invBarcodeUsable(it)&&!invBcOf(p).some(x=>invNormBc(x)===invNormBc(it.barcode)))
        h+='<label class="inv-chk"><input type="checkbox" '+(it.bindBarcode?'checked':'')+' onchange="invData.items['+i+'].bindBarcode=this.checked"> Привязать штрихкод к этому товару (дальше найдётся сканером)</label>';
      if(sale!=null&&!p.variants&&sale!==p.price)h+='<label class="inv-chk"><input type="checkbox" '+(it.updatePrice?'checked':'')+' onchange="invData.items['+i+'].updatePrice=this.checked"> Обновить цену в каталоге на '+fmt(sale)+' ₸</label>';
    }else{
      h+='<div class="inv-new"><label class="inv-chk"><input type="checkbox" '+(it.addNew?'checked':'')+' onchange="invData.items['+i+'].addNew=this.checked"> Добавить в каталог</label>'+
        '<div id="inv-lk-'+i+'">'+invLookupHtml(i)+'</div>'+
        '<input class="inv-in" value="'+esc2(it.name)+'" placeholder="Название в каталоге" oninput="invData.items['+i+'].name=this.value;invData.items['+i+'].nameEdited=true">'+
        '<input class="inv-in" type="number" inputmode="decimal" value="'+(sale!=null?sale:'')+'" placeholder="Цена продажи ₸ (можно позже)" oninput="invData.items['+i+'].saleManual=parseFloat(this.value)||null"></div>';
    }
    return h+'</div>';
  }).join('');
  const cats=Object.entries(window._categories||{}).sort((a,b)=>(a[1].name||'').localeCompare(b[1].name||'','ru'));
  document.getElementById('inv-catbox').innerHTML=fresh?'<div class="inv-lbl">Категория для новых товаров</div><select class="inv-in" onchange="invData.catId=this.value"><option value="">— без категории —</option>'+cats.map(([id,c])=>'<option value="'+esc2(id)+'" '+(id===d.catId?'selected':'')+'>'+(c.parentId&&window._categories[c.parentId]?esc2(window._categories[c.parentId].name)+' › ':'')+esc2(c.name)+'</option>').join('')+'</select>':'';
}
async function invSave(){
  const d=invData,btn=document.getElementById('inv-savebtn'),company=d.company.trim();
  if(!company){showToast('Укажите поставщика');return;}
  if(!(d.total>0)){showToast('Укажите сумму накладной');return;}
  if(!/^\d{4}-\d\d-\d\d$/.test(d.date)){showToast('Укажите дату');return;}
  if(invIsDupe()&&!confirm('Такая поставка уже записана. Записать ещё раз?'))return;
  btn.disabled=true;btn.textContent='Записываю…';
  const ok=[],bad=[],ref=p=>window._ref(window._db,p);
  try{
    const nr=window._push(ref('deliveries'));
    await window._set(nr,{company,date:d.date,amount:d.total,note:'Накладная'+(d.docNo?' №'+d.docNo:'')+', '+d.items.length+' поз.',docNo:invNz(d.docNo),invoiceDate:invNz(d.invDate),
      items:d.items.map(it=>({name:it.name,weight:invNz(it.weight),unit:invNz(it.unit),qty:invNz(it.qty),price:invNz(it.price),sum:invNz(it.sum),barcode:invBarcodeUsable(it)?it.barcode:null,salePrice:invNz(invSaleOf(it,d)),productId:it.matchId||null})),updatedAt:Date.now()});
    ok.push('Поставка «'+company+'» на '+fmt(Math.round(d.total))+' ₸ записана ('+formatDate(d.date)+')');
  }catch(e){bad.push('поставка: '+e.message);}
  let added=0,withBc=0,withImg=0;
  for(const it of d.items){
    if(it.matchId||!it.addNew)continue;
    try{
      let name=it.name.trim()||'Товар',weight=it.weight||'',img=null;
      if(it.useLookup&&it.lookup){
        const L=it.lookup;
        if(!it.nameEdited)name=(L.brand&&!String(L.name).toLowerCase().includes(String(L.brand).toLowerCase())?L.brand+' ':'')+L.name;
        weight=L.weight||weight;
        img=L.imageUrl&&/^https?:\/\//.test(L.imageUrl)?L.imageUrl:null;
      }
      const sale=invSaleOf(it,d),data={name,weight,price:sale||0,catId:d.catId||'',emoji:'📦',imageUrl:img,updatedAt:Date.now()};
      if(invBarcodeUsable(it)){data.barcodes={b0:it.barcode};data.barcode=it.barcode;withBc++;}
      if(img)withImg++;
      await window._set(window._push(ref('products')),data);added++;
    }catch(e){bad.push('товар «'+it.name+'»: '+e.message);}
  }
  if(added)ok.push('Добавлено в каталог: '+added+(withBc?' (со штрихкодом: '+withBc+')':'')+(withImg?', с фото: '+withImg:''));
  let upd=0,bound=0;
  for(const it of d.items){
    if(!it.matchId)continue;
    const p=(window._products||{})[it.matchId];if(!p)continue;
    try{
      if(it.updatePrice){const sale=invSaleOf(it,d);if(sale!=null&&!p.variants){await window._set(ref('products/'+it.matchId+'/price'),sale);upd++;}}
      if(it.bindBarcode&&invBarcodeUsable(it)&&!invBcOf(p).some(x=>invNormBc(x)===invNormBc(it.barcode))){
        const list=invBcOf(p);list.push(it.barcode);
        const obj={};list.forEach((v,k)=>{obj['b'+k]=v;});
        await window._set(ref('products/'+it.matchId+'/barcodes'),obj);
        await window._set(ref('products/'+it.matchId+'/barcode'),list[0]);bound++;
      }
      if(it.updatePrice||it.bindBarcode)await window._set(ref('products/'+it.matchId+'/updatedAt'),Date.now());
    }catch(e){bad.push('товар «'+it.name+'»: '+e.message);}
  }
  if(upd)ok.push('Обновлено цен: '+upd);
  if(bound)ok.push('Штрихкодов привязано к товарам: '+bound);
  if(d.finOn){
    try{
      let br=d.finBranch;
      if(!br||br==='__new'){br=window._push(ref('fin/branches')).key;await window._set(ref('fin/branches/'+br),{name:'Магазин',icon:'🏪'});}
      const k=window._push(ref('fin/tx')).key;
      await window._set(ref('fin/tx/'+k),{type:'expense',branch:br,cat:'Закупка товара',date:d.date,amount:d.total,cur:'KZT',base:d.total,note:'Накладная: '+company,ts:Date.now()});
      ok.push('Расход '+fmt(Math.round(d.total))+' ₸ записан в Финансы');
    }catch(e){bad.push('финансы: '+e.message);}
  }
  closeInv();
  aiChat.push({role:'assistant',x:1,content:(ok.length?'✅ '+ok.join('\n✅ '):'')+(bad.length?'\n⚠️ Не записалось — '+bad.join('; '):'')});
  aiRender();
  showToast(bad.length?'Записано не всё — смотрите чат':'Накладная записана ✓');
}

