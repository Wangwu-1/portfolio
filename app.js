'use strict';
(() => {
  const $ = (id) => document.getElementById(id);
  const names = ['Project 01', 'Project 02', 'Project 03', 'Project 04'];
  const records = new Map();
  const tabs = [...document.querySelectorAll('.work-tab')];
  const accepted = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf', 'video/mp4', 'video/webm']);
  const typeByExtension = { jpg:'image/jpeg', jpeg:'image/jpeg', png:'image/png', webp:'image/webp', gif:'image/gif', pdf:'application/pdf', mp4:'video/mp4', webm:'video/webm' };
  let active = 0, editing = 0, pendingFile = null, mediaUrl = null, database = null, toastTimer, busy = false;
  const number = (i) => String(i + 1).padStart(2, '0');

  function notify(message) {
    $('toast').textContent = message;
    $('toast').classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $('toast').classList.remove('show'), 4500);
  }

  function parseProjectLink(value, kind) {
    const text = typeof value === 'string' ? value.trim() : '';
    if (!text) return '';
    const label = kind === 'itch' ? 'itch.io' : 'Git repository';
    let url;
    try { url = new URL(text); }
    catch { throw new Error(`Enter a full ${label} URL starting with https:// or http://.`); }
    if (!['https:', 'http:'].includes(url.protocol) || !url.hostname || url.username || url.password) {
      throw new Error(`Use an https:// or http:// address without embedded credentials for the ${label} link.`);
    }
    if (kind === 'itch' && url.hostname !== 'itch.io' && !url.hostname.endsWith('.itch.io')) {
      throw new Error('Use an itch.io address, such as https://username.itch.io/project.');
    }
    return url.href;
  }
  function safeProjectLink(value, kind) {
    try { return parseProjectLink(value, kind); } catch { return ''; }
  }
  function renderProjectLinks(project) {
    const gitUrl = safeProjectLink(project?.gitUrl, 'git');
    const itchUrl = safeProjectLink(project?.itchUrl, 'itch');
    for (const [id, url] of [['git-link', gitUrl], ['itch-link', itchUrl]]) {
      const anchor = $(id);
      anchor.hidden = !url;
      if (url) anchor.href = url; else anchor.removeAttribute('href');
    }
    $('project-links').hidden = !gitUrl && !itchUrl;
  }

  function render() {
    const project = records.get(active);
    const hasFile = project?.file instanceof Blob;
    tabs.forEach((tab, i) => {
      const item = records.get(i);
      tab.setAttribute('aria-selected', String(active === i));
      tab.tabIndex = active === i ? 0 : -1;
      tab.querySelector('.tab-name').textContent = item?.title || names[i];
      tab.querySelector('.tab-status').textContent = item ? 'Added' : 'Empty';
    });
    $('project-panel').setAttribute('aria-labelledby', 'tab-' + active);
    $('page-indicator').textContent = number(active) + ' / 04';
    $('empty-index').textContent = number(active);
    document.querySelector('.empty-title').textContent = project ? 'Ready to explore.' : `A space for project ${number(active)}.`;
    document.querySelector('.empty-copy').textContent = project ? 'Use the links below to view the code or try the project.' : "Add a file or a link when you're ready.";
    $('add-work-label').textContent = project ? 'Edit project' : 'Add project';
    $('project-title').textContent = project?.title || names[active];
    $('project-description').textContent = project?.description || (project ? 'Every project has a story.' : 'Work in progress.');
    $('project-category').textContent = project?.category || (project ? 'LOCAL PREVIEW' : 'COMING SOON');
    renderProjectLinks(project);
    $('empty-state').hidden = hasFile;
    $('edit-work').hidden = !project;
    $('media-container').hidden = !hasFile;
    $('stage').classList.toggle('has-media', hasFile);
    $('media-container').replaceChildren();
    if (mediaUrl) URL.revokeObjectURL(mediaUrl);
    mediaUrl = null;
    if (hasFile) {
      mediaUrl = URL.createObjectURL(project.file);
      let media;
      if (project.mime.startsWith('image/')) {
        media = document.createElement('img'); media.alt = project.title;
      } else if (project.mime.startsWith('video/')) {
        media = document.createElement('video'); media.controls = true; media.preload = 'metadata'; media.playsInline = true;
      } else {
        media = document.createElement('iframe'); media.title = project.title + ' PDF preview';
      }
      media.src = mediaUrl;
      if (media.tagName !== 'IFRAME') media.addEventListener('error', () => notify('This browser cannot preview the file. Try another format.'), {once:true});
      $('media-container').append(media);
    }
  }

  function select(slot, focus = false) {
    active = (slot + 4) % 4;
    render();
    if (focus) tabs[active].focus();
  }
  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => select(i));
    tab.addEventListener('keydown', (event) => {
      let slot;
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') slot = active + 1;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') slot = active - 1;
      if (event.key === 'Home') slot = 0;
      if (event.key === 'End') slot = 3;
      if (slot !== undefined) { event.preventDefault(); select(slot, true); }
    });
  });
  $('prev-work').addEventListener('click', () => select(active - 1));
  $('next-work').addEventListener('click', () => select(active + 1));

  function openEditor() {
    if (busy) { notify('Saving. Please wait.'); return; }
    editing = active;
    const item = records.get(editing);
    pendingFile = null;
    $('editor-form').reset();
    $('editor-slot').textContent = 'PROJECT ' + number(editing);
    $('editor-title').textContent = item ? 'Edit your project.' : 'Add a project.';
    $('work-title').value = item?.title || '';
    $('work-category').value = item?.category || '';
    $('work-description').value = item?.description || '';
    $('work-git').value = item?.gitUrl || '';
    $('work-itch').value = item?.itchUrl || '';
    $('file-label').textContent = item?.file ? item.file.name + ' (click to replace)' : 'Choose a file or drop it here (optional)';
    $('remove-work').hidden = !item;
    $('remove-work').textContent = 'Remove project';
    $('form-error').textContent = '';
    $('editor').showModal();
  }
  ['manage-open', 'add-work', 'edit-work'].forEach(id => $(id).addEventListener('click', openEditor));
  $('about-open').addEventListener('click', () => $('about').showModal());
  document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => {
    if (button.dataset.close !== 'editor' || !busy) $(button.dataset.close).close();
  }));
  $('editor').addEventListener('cancel', event => {if (busy) event.preventDefault();});
  document.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('click', event => {
    if (dialog.id === 'editor' && busy) return;
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  }));

  function getMime(file) { return file.type || typeByExtension[file.name.split('.').pop().toLowerCase()] || ''; }
  function chooseFile(file) {
    $('form-error').textContent = '';
    if (!file) return;
    if (!accepted.has(getMime(file))) { $('form-error').textContent = 'Choose a JPG, PNG, WebP, GIF, PDF, MP4, or WebM file.'; return; }
    if (file.size > 100 * 1024 * 1024) { $('form-error').textContent = 'This file exceeds 100 MB. Reduce its size and try again.'; return; }
    pendingFile = file;
    $('file-label').textContent = `${file.name} · ${(file.size / 1024 / 1024).toFixed(1)} MB`;
    if (!$('work-title').value.trim()) $('work-title').value = file.name.replace(/\.[^.]+$/, '').slice(0, 40);
  }
  $('work-file').addEventListener('change', event => chooseFile(event.target.files[0]));
  ['dragenter', 'dragover'].forEach(type => $('upload-area').addEventListener(type, event => {event.preventDefault(); $('upload-area').classList.add('dragover');}));
  ['dragleave', 'drop'].forEach(type => $('upload-area').addEventListener(type, event => {event.preventDefault(); $('upload-area').classList.remove('dragover');}));
  $('upload-area').addEventListener('drop', event => chooseFile(event.dataTransfer.files[0]));
  window.addEventListener('dragover', event => { if ([...event.dataTransfer.types].includes('Files')) event.preventDefault(); });
  window.addEventListener('drop', event => { if ([...event.dataTransfer.types].includes('Files')) event.preventDefault(); });

  async function writeRecord(record, remove = false) {
    await ready;
    if (!database) throw new Error('Browser storage is unavailable. Try a regular browsing window.');
    await new Promise((resolve, reject) => {
      const transaction = database.transaction('works', 'readwrite');
      const store = transaction.objectStore('works');
      if (remove) store.delete(record.slot); else store.put(record);
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  }
  function storageError(error) { return error?.name === 'QuotaExceededError' ? 'Browser storage is full. Try a smaller file.' : error?.message || 'Could not save. Please try again.'; }
  $('editor-form').addEventListener('submit', async event => {
    event.preventDefault();
    if (busy) return;
    const file = pendingFile || records.get(editing)?.file;
    const title = $('work-title').value.trim();
    if (!title) { $('form-error').textContent = 'Enter a project name.'; return; }
    let gitUrl, itchUrl;
    try {
      gitUrl = parseProjectLink($('work-git').value, 'git');
      itchUrl = parseProjectLink($('work-itch').value, 'itch');
    } catch (error) { $('form-error').textContent = error.message; return; }
    if (!file && !gitUrl && !itchUrl) { $('form-error').textContent = 'Add a file or at least one Git / itch.io link.'; return; }
    const record = {slot:editing, title, category:$('work-category').value.trim(), description:$('work-description').value.trim(), gitUrl, itchUrl, mime:file ? getMime(file) : '', file:file || null};
    busy = true;
    $('save-work').disabled = true;
    $('remove-work').disabled = true;
    $('form-error').textContent = '';
    try {
      await writeRecord(record);
      records.set(record.slot, record);
      select(record.slot);
      $('editor').close();
      notify('Preview saved in this browser only.');
    } catch (error) { $('form-error').textContent = storageError(error); }
    finally { busy = false; $('save-work').disabled = false; $('remove-work').disabled = false; }
  });
  $('remove-work').addEventListener('click', async () => {
    if (busy) return;
    if ($('remove-work').textContent !== 'Confirm removal?') { $('remove-work').textContent = 'Confirm removal?'; return; }
    const slot = editing;
    busy = true;
    $('remove-work').disabled = true;
    $('save-work').disabled = true;
    try {
      await writeRecord({slot}, true);
      records.delete(slot); select(slot); $('editor').close(); notify('Project removed. This space is ready for something new.');
    } catch (error) { $('form-error').textContent = storageError(error); }
    finally { busy = false; $('remove-work').disabled = false; $('save-work').disabled = false; }
  });

  const ready = new Promise(resolve => {
    try {
      const request = indexedDB.open('liubai-portfolio-v1', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('works', {keyPath:'slot'});
      request.onerror = () => {notify('Browser storage is unavailable. Previews cannot be saved.'); resolve();};
      request.onblocked = () => {notify('Close other portfolio tabs, then refresh this page.'); resolve();};
      request.onsuccess = () => {
        database = request.result;
        database.onversionchange = () => database.close();
        const read = database.transaction('works', 'readonly').objectStore('works').getAll();
        read.onsuccess = () => {
          read.result.forEach(record => {
            const gitUrl = safeProjectLink(record.gitUrl, 'git');
            const itchUrl = safeProjectLink(record.itchUrl, 'itch');
            if (Number.isInteger(record.slot) && record.slot >= 0 && record.slot < 4 && (record.file instanceof Blob || gitUrl || itchUrl)) {
              records.set(record.slot, {...record, gitUrl, itchUrl});
            }
          });
          render(); resolve();
        };
        read.onerror = () => {notify('Could not load saved previews. Please refresh and try again.'); resolve();};
      };
    } catch {notify('Browser storage is unavailable. Previews cannot be saved.'); resolve();}
  });
  $('year').textContent = new Date().getFullYear();
  render();
})();
