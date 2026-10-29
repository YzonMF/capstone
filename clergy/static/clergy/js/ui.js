/* Pure UI helpers shared by every clergy page: the toast notification,
   in-app document preview modal with back/confirmation, zero-reload AJAX
   document & photo uploads that preserve unsaved form fields and return focus,
   sticky section navigation scrollspy, and unsaved changes protection. */

let toastTimer;
function showToast(message,level){
 const el=document.getElementById('toast');
 if(!el)return;
 el.textContent=message;
 el.className='toast show'+(level?' toast-'+level:'');
 el.title='Click to dismiss';
 el.style.cursor='pointer';
 clearTimeout(toastTimer);
 toastTimer=setTimeout(()=>el.classList.remove('show'),level==='error'?6000:3500);
}

document.getElementById('toast')?.addEventListener('click',function(){
 this.classList.remove('show');
 clearTimeout(toastTimer);
});

function quickPrintFile(url){
 const win=window.open(url,'_blank');
 if(!win){showToast('Please allow pop-ups to print this file.');return;}
 win.addEventListener('load',()=>{win.focus();win.print();});
}

// The sidebar's menu button on narrow screens
document.querySelectorAll('.nav-toggle').forEach(btn=>{
 btn.addEventListener('click',()=>{
  const open=btn.closest('.sidebar').classList.toggle('nav-open');
  btn.setAttribute('aria-expanded',open);
 });
});

// <button data-print-url="url"> prints that file
document.addEventListener('click',e=>{
 const printer=e.target.closest('[data-print-url]');
 if(printer)quickPrintFile(printer.dataset.printUrl);
});

// <form data-confirm="Question?"> asks before it submits. Runs in the capture
// phase so a cancelled submit is stopped before skeleton.js shows it loading.
document.addEventListener('submit',e=>{
 const question=e.target.dataset.confirm;
 if(question&&!confirm(question))e.preventDefault();
},true);

// Messages Django attached to this response ("Record saved", errors), rendered
// into #flash-messages by base.html, shown as toasts
document.querySelectorAll('#flash-messages [data-level]').forEach(msg=>showToast(msg.textContent,msg.dataset.level));

// Checks a chosen profile picture the moment it is selected, with the same rules the
// server applies (registrar.forms.ProfilePictureForm): JPG/PNG, at most 5 MB, and the
// file's first bytes must really be a JPG or PNG. Resolves to an error message, or null.
const PROFILE_PIC_MAX_BYTES=5*1024*1024;
function profilePicError(file){
 if(!/\.(jpe?g|png)$/i.test(file.name))return Promise.resolve('Only JPG and PNG images are allowed for a profile picture.');
 if(file.size>PROFILE_PIC_MAX_BYTES)return Promise.resolve('Image is too large - the maximum is 5 MB.');
 return file.slice(0,8).arrayBuffer().then(buf=>{
  const b=new Uint8Array(buf);
  const isPng=b.length>=4&&b[0]===0x89&&b[1]===0x50&&b[2]===0x4E&&b[3]===0x47;
  const isJpg=b.length>=3&&b[0]===0xFF&&b[1]===0xD8&&b[2]===0xFF;
  const wantsPng=/\.png$/i.test(file.name);
  return (wantsPng?isPng:isJpg)?null:'That file does not look like a real JPG or PNG image.';
 }).catch(()=>'Could not read that file. Please choose another image.');
}

// Live preview when choosing a profile picture on My Record & Profile
const profilePicInput=document.getElementById('profilePictureInput');
if(profilePicInput){
 profilePicInput.addEventListener('change',()=>{
  const file=profilePicInput.files&&profilePicInput.files[0];
  if(!file)return;
  profilePicError(file).then(error=>{
   if(error){
    profilePicInput.value='';
    showToast(error,'error');
    return;
   }
   const img=document.getElementById('profilePicPreviewImg');
   const initials=document.getElementById('profilePicInitials');
   if(img){img.src=URL.createObjectURL(file);img.classList.remove('hidden');}
   if(initials)initials.classList.add('hidden');
  });
 });
}

/* =========================================================================
   UX ENHANCEMENTS:
   1. Shared Styles for Preview Modal & Floating Unsaved Bar
   2. In-App Document Preview Modal with Back Button & Confirmation
   3. Zero-Reload AJAX Document & Profile Picture Uploads + Field Focus Return
   4. Sticky Sub-Section Navigation Scrollspy
   5. Floating Unsaved Changes Bar & beforeunload Guard
   ========================================================================= */
(function(){
 const style=document.createElement('style');
 style.textContent=`
  .doc-preview-modal-card {
   width: min(920px, 95vw) !important;
   max-width: 920px !important;
   height: min(86vh, 820px);
   display: flex;
   flex-direction: column;
   padding: 0 !important;
   overflow: hidden;
  }
  .doc-preview-head {
   display: flex;
   align-items: center;
   justify-content: space-between;
   padding: 14px 18px;
   border-bottom: 1px solid #e2e8f0;
   background: #f8fafc;
  }
  .doc-preview-head h3 {
   margin: 0;
   font-size: 15px;
   color: #0f172a;
   display: flex;
   align-items: center;
   gap: 8px;
  }
  .doc-preview-body {
   flex: 1;
   background: #334155;
   position: relative;
   overflow: hidden;
   display: flex;
   align-items: center;
   justify-content: center;
  }
  .doc-preview-frame {
   width: 100%;
   height: 100%;
   border: 0;
   background: #fff;
  }
  .doc-preview-foot {
   display: flex;
   align-items: center;
   justify-content: space-between;
   flex-wrap: wrap;
   gap: 10px;
   padding: 12px 18px;
   border-top: 1px solid #e2e8f0;
   background: #ffffff;
  }
  .doc-preview-foot-left, .doc-preview-foot-right {
   display: flex;
   align-items: center;
   gap: 8px;
   flex-wrap: wrap;
  }
  .preview-confirmed-tag {
   display: inline-flex;
   align-items: center;
   gap: 4px;
   font-size: 11px;
   font-weight: 600;
   color: #15803d;
   background: #dcfce7;
   padding: 2px 7px;
   border-radius: 9999px;
  }
  .floating-save-bar {
   position: fixed;
   bottom: 20px;
   right: 24px;
   z-index: 90;
   background: #0f172a;
   color: #ffffff;
   padding: 10px 16px;
   border-radius: 12px;
   box-shadow: 0 12px 28px rgba(15, 23, 42, 0.35);
   display: flex;
   align-items: center;
   gap: 14px;
   font-size: 13px;
   transform: translateY(140%);
   opacity: 0;
   pointer-events: none;
   transition: transform 0.22s ease, opacity 0.22s ease;
  }
  .floating-save-bar.visible {
   transform: translateY(0);
   opacity: 1;
   pointer-events: auto;
  }
  .floating-save-bar .unsaved-dot {
   width: 8px;
   height: 8px;
   border-radius: 50%;
   background: #f59e0b;
   display: inline-block;
   margin-right: 6px;
  }
 `;
 document.head.appendChild(style);

 // 1. Track last clicked quick-upload trigger so we can return focus & scroll to it
 let lastUploadTriggerField=null;
 document.addEventListener('click',function(e){
  const btn=e.target.closest('[data-quick-upload]');
  if(btn){
   lastUploadTriggerField=btn.closest('.field, .edit-field, .doc-card');
  }
 },true);

 // 2. In-App Document Preview Modal with Back & Confirmation
 let activePreviewTrigger=null;
 let activePreviewUrl='';
 let activePreviewTitle='Document Preview';

 function ensurePreviewModal(){
  let modal=document.getElementById('docPreviewModal');
  if(modal)return modal;
  modal=document.createElement('div');
  modal.className='modal-bg';
  modal.id='docPreviewModal';
  modal.setAttribute('role','dialog');
  modal.setAttribute('aria-modal','true');
  modal.innerHTML=`
   <div class="modal doc-preview-modal-card">
    <div class="doc-preview-head">
     <div>
      <h3 id="docPreviewTitle"><i class="fa-solid fa-file-eye" style="color:#2f6fed;"></i> <span>Document Preview</span></h3>
      <span class="muted" style="font-size:11px;">Review the attached document below, then confirm or return to your form.</span>
     </div>
     <button type="button" class="close" id="docPreviewCloseTop" aria-label="Close preview">
      <i class="fa-solid fa-xmark"></i>
     </button>
    </div>
    <div class="doc-preview-body">
     <iframe class="doc-preview-frame" id="docPreviewFrame" title="Document Preview"></iframe>
    </div>
    <div class="doc-preview-foot">
     <div class="doc-preview-foot-left">
      <button type="button" class="btn secondary small" id="docPreviewBackBtn">
       <i class="fa-solid fa-arrow-left"></i> Back
      </button>
      <button type="button" class="btn secondary small" id="docPreviewPrintBtn">
       <i class="fa-solid fa-print"></i> Print
      </button>
      <a href="#" target="_blank" rel="noopener" class="btn secondary small" id="docPreviewNewTabBtn">
       <i class="fa-solid fa-up-right-from-square"></i> Open in New Tab
      </a>
     </div>
     <div class="doc-preview-foot-right">
      <button type="button" class="btn green small" id="docPreviewConfirmBtn">
       <i class="fa-solid fa-circle-check"></i> Confirm Document
      </button>
     </div>
    </div>
   </div>
  `;
  document.body.appendChild(modal);

  function closePreview(){
   modal.classList.remove('show');
   const frame=document.getElementById('docPreviewFrame');
   if(frame)frame.src='about:blank';
   if(activePreviewTrigger){
    const field=activePreviewTrigger.closest('.field, .edit-field, .doc-card');
    if(field){
     field.scrollIntoView({behavior:'smooth',block:'center'});
    }
    activePreviewTrigger.focus();
   }
  }

  modal.addEventListener('click',function(e){
   if(e.target===modal)closePreview();
  });
  document.getElementById('docPreviewCloseTop')?.addEventListener('click',closePreview);
  document.getElementById('docPreviewBackBtn')?.addEventListener('click',closePreview);
  document.getElementById('docPreviewPrintBtn')?.addEventListener('click',function(){
   if(activePreviewUrl)quickPrintFile(activePreviewUrl);
  });
  document.getElementById('docPreviewConfirmBtn')?.addEventListener('click',function(){
   if(activePreviewTrigger){
    const container=activePreviewTrigger.closest('.date-att-bar, .doc-card');
    if(container&&!container.querySelector('.preview-confirmed-tag')){
     const tag=document.createElement('span');
     tag.className='preview-confirmed-tag';
     tag.innerHTML='<i class="fa-solid fa-check"></i> Confirmed';
     const statusEl=container.querySelector('.att-status, .doc-card-head');
     if(statusEl)statusEl.appendChild(tag);
    }
   }
   showToast(activePreviewTitle+' confirmed.','success');
   closePreview();
  });
  document.addEventListener('keydown',function(e){
   if(e.key==='Escape'&&modal.classList.contains('show'))closePreview();
  });
  return modal;
 }

 document.addEventListener('click',function(e){
  const viewLink=e.target.closest('a.att-btn.view, .doc-card .row-actions a[href*="/documents/"][href$="/view/"]');
  if(!viewLink||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;
  const href=viewLink.getAttribute('href');
  if(!href)return;
  e.preventDefault();
  e.stopImmediatePropagation();
  activePreviewTrigger=viewLink;
  activePreviewUrl=href;
  const cardOrBar=viewLink.closest('[data-doc-title], .doc-card, .date-att-bar');
  activePreviewTitle=
   viewLink.dataset.docName||
   (cardOrBar&&cardOrBar.dataset.docTitle)||
   (cardOrBar&&cardOrBar.querySelector('.doc-card-head b')?.textContent)||
   'Document Preview';
  const modal=ensurePreviewModal();
  const titleSpan=modal.querySelector('#docPreviewTitle span');
  if(titleSpan)titleSpan.textContent='Preview: '+activePreviewTitle;
  const frame=modal.querySelector('#docPreviewFrame');
  if(frame)frame.src=href;
  const newTabBtn=modal.querySelector('#docPreviewNewTabBtn');
  if(newTabBtn)newTabBtn.href=href;
  modal.classList.add('show');
  document.getElementById('docPreviewConfirmBtn')?.focus();
 },true);

 // 3. Zero-Reload AJAX Uploads for Quick Attachment Modal, Requirement Cards & Profile Picture
 function highlightAndReturnToField(fieldEl){
  if(!fieldEl)return;
  fieldEl.scrollIntoView({behavior:'smooth',block:'center'});
  fieldEl.classList.remove('field-highlight-flash');
  void fieldEl.offsetWidth;
  fieldEl.classList.add('field-highlight-flash');
  const input=fieldEl.querySelector('input:not([type="hidden"]):not([type="file"]):not([readonly]), select, textarea');
  if(input)setTimeout(()=>input.focus({preventScroll:true}),250);
 }

 function updateAttachmentBarsInDOM(data){
  const docTypeId=String(data.document_type_id);
  document.querySelectorAll(`.date-att-bar[data-att-doc-type="${docTypeId}"]`).forEach(bar=>{
   bar.className='date-att-bar uploaded';
   const statusEl=bar.querySelector('.att-status');
   if(statusEl){
    statusEl.innerHTML=`<i class="fa-solid fa-circle-check"></i> ${data.document_name} attached <span class="preview-confirmed-tag"><i class="fa-solid fa-check"></i> Just uploaded</span>`;
   }
   const actionsEl=bar.querySelector('.att-actions');
   if(actionsEl){
    actionsEl.innerHTML=`
     <a href="${data.view_url}" target="_blank" class="att-btn view" data-doc-name="${data.document_name}"><i class="fa-solid fa-eye"></i> View</a>
     <button type="button" class="att-btn replace" data-quick-upload="${docTypeId}" data-doc-name="${data.document_name}"><i class="fa-solid fa-arrow-up-from-bracket"></i> Replace</button>
    `;
   }
  });

  document.querySelectorAll(`.doc-card[data-doc-card-type="${docTypeId}"]`).forEach(card=>{
   const badge=card.querySelector('.doc-card-head .badge');
   if(badge){
    badge.className='badge green';
    badge.textContent='Submitted';
   }
   let fileDiv=card.querySelector('.doc-card-file');
   if(!fileDiv){
    fileDiv=document.createElement('div');
    fileDiv.className='doc-card-file';
    const uploadForm=card.querySelector('.doc-card-upload');
    if(uploadForm)card.insertBefore(fileDiv,uploadForm);
   }
   fileDiv.innerHTML=`<i class="fa-solid fa-file-lines"></i> Submitted ${data.submitted_date}${data.notes?'<br>'+data.notes:''}`;

   let rowActions=card.querySelector('.row-actions');
   if(!rowActions){
    rowActions=document.createElement('div');
    rowActions.className='row-actions';
    const uploadForm=card.querySelector('.doc-card-upload');
    if(uploadForm)card.insertBefore(rowActions,uploadForm);
   }
   rowActions.innerHTML=`
    <a class="btn secondary small" href="${data.view_url}" target="_blank" rel="noopener" data-doc-name="${data.document_name}"><i class="fa-solid fa-eye"></i> View</a>
    <a class="btn secondary small" href="${data.download_url}"><i class="fa-solid fa-download"></i> Download</a>
    <button type="button" class="btn secondary small" data-print-url="${data.view_url}"><i class="fa-solid fa-print"></i> Print</button>
   `;
   const submitBtn=card.querySelector('.doc-card-upload button');
   if(submitBtn){
    submitBtn.innerHTML='<i class="fa-solid fa-rotate"></i> Replace';
   }
  });

  if(data.summary_submitted!==undefined&&data.summary_total!==undefined){
   document.querySelectorAll('.sidebar .nav a[href*="requirements"] .badge').forEach(b=>{
    b.textContent=`${data.summary_submitted}/${data.summary_total}`;
    b.classList.toggle('complete',data.summary_submitted===data.summary_total);
   });
  }
 }

 document.addEventListener('submit',async function(e){
  const form=e.target;
  if(e.defaultPrevented)return;

  // Case A: Quick Upload Modal or Requirement Card Upload Form
  const isQuickUpload=Boolean(form.closest('#quickUploadModal'));
  const isDocCardUpload=form.classList.contains('doc-card-upload');
  // Case B: Profile picture upload/remove button inside #profileForm
  const submitter=e.submitter;
  const isProfilePicAction=form.id==='profileForm'&&submitter&&(submitter.name==='upload_profile_picture'||submitter.name==='remove_profile_picture');

  if(!isQuickUpload&&!isDocCardUpload&&!isProfilePicAction)return;

  e.preventDefault();
  e.stopImmediatePropagation();

  const btn=submitter||form.querySelector('button[type="submit"], button:not([type])');
  const origHtml=btn?btn.innerHTML:'';
  if(btn){
   btn.disabled=true;
   btn.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> Uploading…';
  }

  try{
   const formData=new FormData(form);
   if(submitter&&submitter.name){
    formData.append(submitter.name,submitter.value||'1');
   }
   const res=await fetch(form.getAttribute('action')||window.location.href,{
    method:'POST',
    body:formData,
    headers:{'X-Requested-With':'XMLHttpRequest'}
   });
   const data=await res.json();
   if(!res.ok||!data.ok){
    showToast((data&&data.error)||'Could not upload file. Please check the file and try again.','error');
    return;
   }

   if(isProfilePicAction){
    showToast(data.message||'Profile picture updated.','success');
    const previewImg=document.getElementById('profilePicPreviewImg');
    const initialsEl=document.getElementById('profilePicInitials');
    if(data.removed){
     if(previewImg){previewImg.src='';previewImg.classList.add('hidden');}
     if(initialsEl){initialsEl.textContent=data.initials||'';initialsEl.classList.remove('hidden');}
    }else if(data.picture_url){
     if(previewImg){previewImg.src=data.picture_url;previewImg.classList.remove('hidden');}
     if(initialsEl)initialsEl.classList.add('hidden');
     document.querySelectorAll('.sidebar-avatar img, .top-avatar img').forEach(img=>{img.src=data.picture_url;});
    }
    if(profilePicInput)profilePicInput.value='';
    return;
   }

   updateAttachmentBarsInDOM(data);
   showToast(data.message||'Document uploaded successfully.','success');
   form.reset();

   if(isQuickUpload){
    if(typeof closeModal==='function')closeModal('quickUploadModal');
    const targetField=lastUploadTriggerField||document.querySelector(`.date-att-bar[data-att-doc-type="${data.document_type_id}"]`)?.closest('.field, .edit-field');
    highlightAndReturnToField(targetField);
   }else if(isDocCardUpload){
    const card=form.closest('.doc-card');
    highlightAndReturnToField(card);
   }
  }catch(_err){
   showToast('Network error while uploading. Please try again.','error');
  }finally{
   if(btn){
    btn.disabled=false;
    btn.innerHTML=origHtml;
   }
  }
 },true);

 // 4. Sticky Sub-Section Navigation Scrollspy & Smooth Scrolling
 const sectionNav=document.getElementById('personalSectionNav');
 if(sectionNav){
  const pills=Array.from(sectionNav.querySelectorAll('.nav-pill'));
  const targets=pills.map(p=>document.querySelector(p.getAttribute('href'))).filter(Boolean);

  pills.forEach(pill=>{
   pill.addEventListener('click',function(e){
    const targetId=pill.getAttribute('href');
    const targetEl=targetId?document.querySelector(targetId):null;
    if(!targetEl)return;
    e.preventDefault();
    pills.forEach(p=>p.classList.remove('active'));
    pill.classList.add('active');
    targetEl.scrollIntoView({behavior:'smooth',block:'start'});
    targetEl.classList.remove('field-highlight-flash');
    void targetEl.offsetWidth;
    targetEl.classList.add('field-highlight-flash');
   });
  });

  if('IntersectionObserver' in window&&targets.length){
   const observer=new IntersectionObserver(entries=>{
    entries.forEach(entry=>{
     if(entry.isIntersecting){
      const id='#'+entry.target.id;
      pills.forEach(p=>p.classList.toggle('active',p.getAttribute('href')===id));
     }
    });
   },{rootMargin:'-15% 0px -70% 0px',threshold:0});
   targets.forEach(t=>observer.observe(t));
  }
 }

 // 5. Floating Unsaved Changes Bar & beforeunload Guard on #profileForm
 const profileForm=document.getElementById('profileForm');
 if(profileForm){
  let isDirty=false;
  const saveBar=document.createElement('div');
  saveBar.className='floating-save-bar';
  saveBar.innerHTML=`
   <span><span class="unsaved-dot"></span>You have unsaved changes</span>
   <button type="button" class="btn small secondary" id="floatingDiscardBtn" style="padding:5px 10px;">Discard</button>
   <button type="button" class="btn small green" id="floatingSaveBtn" style="padding:5px 12px;"><i class="fa-solid fa-floppy-disk"></i> Save Changes</button>
  `;
  document.body.appendChild(saveBar);

  function markDirty(){
   if(!isDirty){
    isDirty=true;
    saveBar.classList.add('visible');
   }
  }

  profileForm.addEventListener('input',function(e){
   if(e.target.name==='profile_picture')return;
   markDirty();
  });
  profileForm.addEventListener('change',function(e){
   if(e.target.name==='profile_picture')return;
   markDirty();
  });
  document.getElementById('addChildBtn')?.addEventListener('click',markDirty);
  document.getElementById('addEduBtn')?.addEventListener('click',markDirty);

  document.getElementById('floatingSaveBtn')?.addEventListener('click',function(){
   isDirty=false;
   saveBar.classList.remove('visible');
   profileForm.requestSubmit();
  });
  document.getElementById('floatingDiscardBtn')?.addEventListener('click',function(){
   if(confirm('Discard your unsaved changes?')){
    isDirty=false;
    saveBar.classList.remove('visible');
    window.location.reload();
   }
  });
  profileForm.addEventListener('submit',function(){
   isDirty=false;
   saveBar.classList.remove('visible');
  });
  window.addEventListener('beforeunload',function(e){
   if(isDirty){
    e.preventDefault();
    e.returnValue='';
   }
  });
 }

 // 6. Preserve & Restore Scroll Position Across Standard Form Submits
 const SCROLL_KEY='ednp_scroll_'+window.location.pathname;
 const savedScroll=sessionStorage.getItem(SCROLL_KEY);
 if(savedScroll){
  sessionStorage.removeItem(SCROLL_KEY);
  const y=parseInt(savedScroll,10);
  if(!isNaN(y)&&y>0){
   window.scrollTo({top:y,behavior:'instant'});
  }
 }
 document.addEventListener('submit',function(e){
  if(!e.defaultPrevented){
   try{sessionStorage.setItem(SCROLL_KEY,String(window.scrollY));}catch(_){}
  }
 });
})();
