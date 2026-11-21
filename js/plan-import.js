(function(){
 'use strict';
 const app=document.currentScript.dataset.app,Core=window.PlanImportCore;
 const make=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
 async function api(action,body){const r=await fetch('/api/'+app+'?action='+action,{credentials:'same-origin',cache:'no-store',...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});let data;try{data=await r.json();}catch{throw Error('Não foi possível falar com o servidor. Tente novamente.');}if(!r.ok)throw Error(data.error||'Não foi possível atualizar o plano.');return data;}
 async function settled(){
  if(!window.PlanImportBridge)throw Error('Aguarde o app terminar de carregar.');
  await window.PlanImportBridge.before();
  if(window.RitmoCloud.blocked()||window.RitmoCloud.pending())throw Error('Aguarde a sincronização dos seus registros antes de importar.');
 }
 async function readPDF(file){
  if(file.size>5*1024*1024)throw Error('Use um PDF de até 5 MB.');
  const bytes=new Uint8Array(await file.arrayBuffer());
  if(new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-')throw Error('Este arquivo não é um PDF válido.');
  const pdfjs=await import('/js/vendor/pdfjs/pdf.mjs');pdfjs.GlobalWorkerOptions.workerSrc='/js/vendor/pdfjs/pdf.worker.mjs';
  const task=pdfjs.getDocument({data:bytes,isEvalSupported:false,stopAtErrors:true});let document;
  try{
   document=await task.promise;if(document.numPages>40)throw Error('Use um PDF de até 40 páginas.');
   const pages=[];let total=0;
   for(let i=1;i<=document.numPages;i++){
    const page=await document.getPage(i),content=await page.getTextContent(),lines=[];
    for(const item of content.items){if(!item.str?.trim())continue;const y=Math.round(item.transform[5]*2)/2,x=item.transform[4];let line=lines.find(l=>Math.abs(l.y-y)<2);if(!line){line={y,items:[]};lines.push(line);}line.items.push({x,width:item.width,text:item.str});}
    lines.sort((a,b)=>b.y-a.y);for(const line of lines){line.items.sort((a,b)=>a.x-b.x);line.text=Core.joinItems(line.items).normalize('NFKC');}
    const text=lines.map(l=>l.text).join('\n');total+=text.length;if(total>150000)throw Error('Texto muito grande. Importe um documento menor.');pages.push({number:i,text,lines});
   }
   if(total<40)throw Error('Este PDF parece uma foto ou está sem texto legível. Cole o texto ou peça um PDF com texto selecionável.');
   return pages;
  }finally{await task.destroy();}
 }
 function field(parent,title,value,type='text',max=160){const label=make('label',title),input=make(type==='textarea'?'textarea':'input');if(type!=='textarea')input.type=type;input.value=value??'';input.maxLength=max;input.setAttribute('aria-label',title);label.append(input);parent.append(label);return input;}
 function choose(parent,title,value,options){const label=make('label',title),select=make('select');for(const [v,t] of options){const o=make('option',t);o.value=v;select.append(o);}select.value=String(value);select.setAttribute('aria-label',title);label.append(select);parent.append(label);return select;}
 async function open(kind){
  const dialog=make('dialog',undefined,'plan-import-dialog'),title=make('h2',kind==='diet'?'Atualizar dieta':'Atualizar treino'),status=make('p','','plan-import-status'),cancel=make('button','Fechar','secondary'),header=make('div',undefined,'plan-import-header'),topClose=make('button','✕','secondary');
  title.id='import-'+crypto.randomUUID();dialog.setAttribute('aria-labelledby',title.id);topClose.type='button';topClose.setAttribute('aria-label','Fechar importação');topClose.onclick=()=>dialog.close();header.append(title,topClose);
  status.setAttribute('role','status');cancel.type='button';cancel.onclick=()=>dialog.close();dialog.append(header,status,cancel);dialog.onclose=()=>dialog.remove();document.body.append(dialog);dialog.showModal();
  let revision=0,baseline,locked=false;
  try{status.textContent='Conferindo sua conta e sincronização…';await settled();baseline=await api('load');const day=app==='ritmo'&&kind==='diet'?'2026-10-29':'2000-01-03';const row=baseline.days.find(r=>r.day===day);revision=row?.revision||0;
   const intro=make('p','Importação gratuita, sem IA externa. O PDF é lido neste aparelho. Confira as porções e orientações antes de confirmar.','smallnote');
   if(kind==='training')intro.textContent+=' Confira no original os bi-sets e indicações por cor: as cores e imagens não são importadas.';
   const fileLabel=make('label','Escolher PDF'),file=make('input');file.type='file';file.accept='application/pdf';file.setAttribute('aria-label','Escolher PDF');fileLabel.append(file);
   const pasted=field(dialog,'Ou cole o texto do plano','','textarea',150000),read=make('button','Preparar prévia','primary'),preview=make('div',undefined,'plan-import-preview');read.type='button';
   const pasteDetails=make('details');pasteDetails.append(make('summary','Usar texto em vez de PDF'),pasted.parentElement,read);dialog.replaceChildren(header,intro,fileLabel,pasteDetails,preview,status,cancel);status.textContent='Nada será alterado antes da sua confirmação.';
   file.onchange=async()=>{if(!file.files[0])return;preview.replaceChildren();file.disabled=read.disabled=true;status.textContent='Lendo PDF neste aparelho…';try{const pages=await readPDF(file.files[0]);if(!dialog.isConnected)return;show(pages);}catch(e){status.textContent=e.message;}finally{file.disabled=read.disabled=false;}};
   read.onclick=()=>{try{if(!pasted.value.trim())throw Error('Escolha um PDF ou cole o texto do plano.');show([{number:1,text:pasted.value,lines:pasted.value.split('\n').map(text=>({text,items:[]}))}]);}catch(e){status.textContent=e.message;}};
   if(row?.payload.importMeta?.[kind]){
    const undo=make('button','Desfazer última importação','secondary');undo.type='button';dialog.insertBefore(undo,status);
    undo.onclick=async()=>{if(!confirm('Restaurar a versão anterior deste plano? Seus registros de treino e tarefas serão preservados.'))return;undo.disabled=true;try{await settled();await api('undo-plan-import',{kind,event:crypto.randomUUID(),expectedRevision:revision});location.reload();}catch(e){status.textContent=e.message;undo.disabled=false;}};
   }
   function show(pages){
    preview.replaceChildren();const draft=kind==='diet'?Core.parseDiet(pages):Core.parseTraining(pages);status.textContent='Confira a prévia. Se algo não estiver correto, edite ou feche sem salvar.';
    const source=make('details'),sourceTitle=make('summary','Conferir texto extraído do PDF');source.append(sourceTitle,make('pre',pages.map(p=>'Página '+p.number+'\n'+p.text).join('\n\n')));preview.append(source);
    const getters=[];let prescribed,guide;
    if(kind==='diet'){
     prescribed=field(preview,'Data do plano (como no documento)',draft.prescribed,'text',30);
     for(const [i,m] of draft.meals.entries()){
      const box=make('fieldset');box.append(make('legend','Opção '+(i+1)));preview.append(box);
      const group=choose(box,'Refeição da opção '+(i+1),m.group,Core.titles.map((t,i)=>[String(i),t]));
      const oldGroups=app==='ritmo'?row?.payload.foodPlan?.groups:[],oldMeal=row?.payload.userPlan?.meals?.find(x=>Core.plain(x.title)===Core.plain(Core.titles[m.group]));
      const name=field(box,'Nome da opção '+(i+1),m.title),time=field(box,'Horário da opção '+(i+1),oldGroups?.find(g=>g.slot===m.group)?.time||oldMeal?.time||'','time');
      const ingredients=field(box,'Alimentos e porções da opção '+(i+1),m.ingredients,'textarea',10000),substitutions=field(box,'Substituições da opção '+(i+1)+' (separe grupos com uma linha em branco)',m.substitutions.join('\n\n'),'textarea',30000);
      getters.push(()=>({...m,title:name.value.trim(),group:Number(group.value),time:time.value,ingredients:ingredients.value.trim(),substitutions:substitutions.value.split(/\n\s*\n/).map(s=>s.trim()).filter(Boolean)}));
     }
    }else {guide=field(preview,'Orientações gerais do documento',draft.guide||'','textarea',2000);for(const [i,w] of draft.workouts.entries()){
     const box=make('fieldset');box.append(make('legend','Treino '+(i+1)));preview.append(box);
     const name=field(box,'Nome do treino '+(i+1),w.title),day=choose(box,'Dia do treino '+(i+1),w.day,[['-1','Selecione o dia'],...['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'].map((s,i)=>[String(i),s])]),notes=field(box,'Orientações do treino '+(i+1),w.notes,'textarea',2000),exercises=[];
     for(const [j,e] of w.exercises.entries()){
      const section=make('details');section.open=true;section.append(make('summary','Exercício '+(j+1)));box.append(section);
      const label=' — treino '+(i+1)+', exercício '+(j+1),ename=field(section,'Nome'+label,e.name),sets=field(section,'Séries, uma por linha'+label,e.sets.join('\n'),'textarea',3400),tempo=field(section,'Ritmo'+label,e.tempo,'text',100),rest=field(section,'Descanso'+label,e.rest,'text',100),note=field(section,'Observações'+label,e.note,'textarea',2000),timed=choose(section,'Medida'+label,e.timed?'1':'0',[['0','Repetições'],['1','Segundos']]);
      exercises.push(()=>({name:ename.value.trim(),sets:sets.value.split('\n').map(s=>s.trim()).filter(Boolean),tempo:tempo.value,rest:rest.value,note:note.value,timed:timed.value==='1'}));
     }
     getters.push(()=>({title:name.value.trim(),day:Number(day.value),notes:notes.value,exercises:exercises.map(g=>g())}));
    }}
    const confirmLabel=make('label',undefined,'plan-import-check'),check=make('input');check.type='checkbox';check.setAttribute('aria-label','Conferi o plano e as quantidades');confirmLabel.append(check,make('span','Conferi o plano, as quantidades e as orientações.'));const save=make('button','Confirmar atualização','primary');save.type='button';save.disabled=true;check.onchange=()=>save.disabled=!check.checked||locked;preview.append(confirmLabel,save);
    save.onclick=async()=>{if(!check.checked||locked)return;locked=true;save.disabled=true;file.disabled=read.disabled=cancel.disabled=topClose.disabled=true;dialog.oncancel=e=>e.preventDefault();try{
     const value=kind==='diet'?{kind,prescribed:prescribed.value.trim(),meals:getters.map(g=>g())}:{kind,workouts:getters.map(g=>g()),guide:guide.value};Core.validate(value,app);await settled();status.textContent='Salvando o plano na sua conta…';await api('import-plan',{draft:value,event:crypto.randomUUID(),expectedRevision:revision});location.reload();
    }catch(e){status.textContent=e.message;locked=false;save.disabled=false;file.disabled=read.disabled=cancel.disabled=topClose.disabled=false;dialog.oncancel=null;}};
    preview.scrollIntoView({block:'start'});
   }
  }catch(e){status.textContent=e.message;}
 }
 document.querySelectorAll('[data-plan-import]').forEach(button=>button.addEventListener('click',()=>open(button.dataset.planImport)));
})();
