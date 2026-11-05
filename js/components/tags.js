import { state } from '../state.js';

export function addTag(type) {
  const input = document.getElementById(`input-tag-${type}`);
  if (!input) return;
  const val = input.value.trim();
  if (val && !state.currentTags[type].includes(val)) {
    state.currentTags[type].push(val);
    renderTags(type);
    input.value = '';
  }
  input.focus();
}

export function removeTag(type, val) {
  state.currentTags[type] = state.currentTags[type].filter(item => item !== val);
  renderTags(type);
  const input = document.getElementById(`input-tag-${type}`);
  if (input) input.focus();
}

export function renderTags(type) {
  const container = document.getElementById(`tags-${type}`);
  if (!container) return;
  container.innerHTML = '';
  state.currentTags[type].forEach(val => {
    container.innerHTML += `<span class="tag-chip">${val} <button type="button" data-tag-type="${type}" data-tag-val="${val}" class="btn-remove-tag">×</button></span>`;
  });

  container.querySelectorAll('.btn-remove-tag').forEach(btn => {
    btn.onclick = () => removeTag(btn.getAttribute('data-tag-type'), btn.getAttribute('data-tag-val'));
  });
}

export function handleFileSelect(event, type) {
  const files = Array.from(event.target.files);
  files.forEach(file => {
    state.currentFiles[type].push({
      fileObj: file,
      name: file.name,
      mime: file.type,
      isNew: true
    });
  });
  renderFileChips(type);
  event.target.value = '';
}

export function removeFile(type, index) {
  state.currentFiles[type].splice(index, 1);
  renderFileChips(type);
}

export function renderFileChips(type) {
  const container = document.getElementById(`list-files-${type}`);
  if (!container) return;
  container.innerHTML = '';

  state.currentFiles[type].forEach((item, index) => {
    if (item.url) {
      container.innerHTML += `
        <div class="file-chip">
          <a href="${item.url}" target="_blank" title="${item.name}">🔗 ${item.name}</a>
          <button type="button" data-file-type="${type}" data-file-idx="${index}" class="btn-remove-file">×</button>
        </div>`;
    } else {
      container.innerHTML += `
        <div class="file-chip">
          <span class="file-name" title="${item.name}">📄 ${item.name}</span>
          <button type="button" data-file-type="${type}" data-file-idx="${index}" class="btn-remove-file">×</button>
        </div>`;
    }
  });

  container.querySelectorAll('.btn-remove-file').forEach(btn => {
    btn.onclick = () => removeFile(btn.getAttribute('data-file-type'), parseInt(btn.getAttribute('data-file-idx'), 10));
  });
}