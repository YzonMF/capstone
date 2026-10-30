/* Clergy Records page UI: the deanery -> parish cascade dropdown for the New
   Record modal, and the Link Account and Lost Phone modals. The record page
   (record-detail.html) loads this too, for the same cascade. Personal
   Information and Documents are now a real per-record page, not a
   JS-populated modal. Every value below comes from what Django already
   rendered into the page (the embedded deaneries JSON): nothing here
   holds or computes application data on its own. Depends on ui.js
   (openModal, closeModal). */

const deaneriesDataElement = document.getElementById('deaneries-data');
const deaneries = deaneriesDataElement ? JSON.parse(deaneriesDataElement.textContent) : {};

function populateDeaneries(selectId){
 const sel=document.getElementById(selectId);
 if(!sel)return;
 sel.innerHTML='<option value="">Select Deanery</option>'+Object.entries(deaneries).map(([id,d])=>`<option value="${id}">${d.name}</option>`).join('');
}

function updateParishOptions(deanerySelectId,assignmentSelectId){
 const deaneryId=document.getElementById(deanerySelectId)?.value;
 const parishSel=document.getElementById(assignmentSelectId);
 if(!parishSel)return;
 if(!deaneryId || !deaneries[deaneryId]){
  parishSel.innerHTML='<option value="">Select Deanery first</option>';
  parishSel.disabled=true;
  return;
 }
 parishSel.innerHTML='<option value="">Select Parish / Assignment</option>'+deaneries[deaneryId].parishes.map(p=>`<option value="${p}">${p}</option>`).join('');
 parishSel.disabled=false;
}

function toggleLeaveReason(statusSelectId,fieldId){
 const statusEl=document.getElementById(statusSelectId);
 const fieldEl=document.getElementById(fieldId);
 if(!statusEl || !fieldEl)return;
 fieldEl.classList.toggle('hidden',statusEl.value!=='On Leave');
}

function openNewRecordModal(e){
 if(e)e.preventDefault();
 populateDeaneries('newDeanery');
 const deanerySel=document.getElementById('newDeanery');
 const statusSel=document.getElementById('newStatus');
 const leaveReasonInput=document.getElementById('newLeaveReason');
 if(deanerySel && !deanerySel.dataset.selectedDeanery){
  deanerySel.value='';
  updateParishOptions('newDeanery','newAssignment');
 }
 if(statusSel && !statusSel.value){
  statusSel.value='Active';
 }
 if(leaveReasonInput && !leaveReasonInput.value){
  leaveReasonInput.value='';
 }
 toggleLeaveReason('newStatus','newLeaveReasonField');
 openModal('recordModal');
}

function openResetAccountModal(button){
 const id=button.dataset.recordId;
 document.getElementById('resetAccountName').textContent=button.dataset.recordName;
 document.getElementById('resetAccountForm').action=`/registrar/clergy-records/${id}/reset-account/`;
 openModal('resetAccountModal');
}

function openLinkAccountModal(button){
 const id=button.dataset.recordId;
 document.getElementById('linkAccountName').textContent=button.dataset.recordName;
 document.getElementById('linkAccountForm').action=`/registrar/clergy-records/${id}/link-account/`;
 openModal('linkAccountModal');
}

// A deanery <select data-parish-target="id"> refills that parish list; a status
// <select data-leave-field="id"> shows that Leave Reason field only for On Leave
document.querySelectorAll('[data-parish-target]').forEach(sel=>{
 sel.addEventListener('change',()=>updateParishOptions(sel.id,sel.dataset.parishTarget));
});
document.querySelectorAll('[data-leave-field]').forEach(sel=>{
 sel.addEventListener('change',()=>toggleLeaveReason(sel.id,sel.dataset.leaveField));
});

const newRecordButton=document.getElementById('newRecordButton');
if(newRecordButton)newRecordButton.addEventListener('click',openNewRecordModal);
document.querySelectorAll('[data-reset-account]').forEach(btn=>btn.addEventListener('click',()=>openResetAccountModal(btn)));
document.querySelectorAll('[data-link-account]').forEach(btn=>btn.addEventListener('click',()=>openLinkAccountModal(btn)));

// Client-side validation and data-loss prevention on recordModal submission
const createRecordForm = document.getElementById('createRecordForm') || document.querySelector('#recordModal form');
if (createRecordForm) {
 createRecordForm.addEventListener('submit', function (e) {
  const nameInput = createRecordForm.querySelector('[name="name"]');
  const assignmentSelect = createRecordForm.querySelector('[name="assignment"]');
  const statusSelect = createRecordForm.querySelector('[name="status"]');
  const leaveReasonInput = createRecordForm.querySelector('[name="leave_reason"]');
  const baptismInput = createRecordForm.querySelector('[name="baptism_date"]');
  const confirmationInput = createRecordForm.querySelector('[name="confirmation_date"]');
  const holyOrdersInput = createRecordForm.querySelector('[name="holy_orders_date"]');
  const contractEndInput = createRecordForm.querySelector('[name="contract_end"]');

  let errorMsg = null;
  let focusTarget = null;

  if (nameInput && !nameInput.value.trim()) {
   errorMsg = 'Please enter the clergy name.';
   focusTarget = nameInput;
  } else if (assignmentSelect && (!assignmentSelect.value || assignmentSelect.disabled)) {
   errorMsg = 'Please select a deanery and parish or assignment.';
   focusTarget = assignmentSelect;
  } else if (statusSelect && statusSelect.value === 'On Leave' && leaveReasonInput && !leaveReasonInput.value.trim()) {
   errorMsg = 'Leave reason is required when status is On Leave.';
   focusTarget = leaveReasonInput;
  } else if (baptismInput && confirmationInput && baptismInput.value && confirmationInput.value && baptismInput.value > confirmationInput.value) {
   errorMsg = 'Confirmation date cannot be earlier than baptism date.';
   focusTarget = confirmationInput;
  } else if (holyOrdersInput && contractEndInput && holyOrdersInput.value && contractEndInput.value && holyOrdersInput.value > contractEndInput.value) {
   errorMsg = 'Contract end cannot be earlier than Holy Orders date.';
   focusTarget = contractEndInput;
  }

  if (errorMsg) {
   e.preventDefault();
   let alertBox = createRecordForm.querySelector('.record-modal-client-error');
   if (!alertBox) {
    alertBox = document.createElement('div');
    alertBox.className = 'alert alert-error record-modal-client-error';
    alertBox.setAttribute('role', 'alert');
    alertBox.style.marginBottom = 'var(--spacing-md, 1rem)';
    createRecordForm.prepend(alertBox);
   }
   alertBox.textContent = errorMsg;
   if (focusTarget) {
    focusTarget.focus();
    if (typeof focusTarget.reportValidity === 'function') {
     focusTarget.setCustomValidity(errorMsg);
     focusTarget.reportValidity();
     focusTarget.addEventListener('input', function onInput() {
      focusTarget.setCustomValidity('');
      focusTarget.removeEventListener('input', onInput);
     });
    }
   }
   return false;
  }
 });
}

// Auto-open modal if rendered with error alert or existing draft values
document.addEventListener('DOMContentLoaded', function () {
 const modalHasErrors = document.querySelector('#recordModal .alert-error');
 const deanerySel = document.getElementById('newDeanery');
 if (modalHasErrors) {
  openModal('recordModal');
 }
 if (deanerySel && deanerySel.dataset.selectedDeanery) {
  populateDeaneries('newDeanery');
  deanerySel.value = deanerySel.dataset.selectedDeanery;
  updateParishOptions('newDeanery', 'newAssignment');
  const assignmentSel = document.getElementById('newAssignment');
  if (assignmentSel && assignmentSel.dataset.selectedAssignment) {
   assignmentSel.value = assignmentSel.dataset.selectedAssignment;
  }
 }
});
