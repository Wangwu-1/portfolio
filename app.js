'use strict';
(() => {
  const $ = (id) => document.getElementById(id);
  const PUBLIC_BASE = 'https://wangwu-1.github.io/portfolio/';
  const names = ['Project 01', 'Project 02', 'Project 03', 'Project 04'];
  const tabs = [...document.querySelectorAll('.work-tab')];
  const localDrafts = new Map();
  const accepted = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf', 'video/mp4', 'video/webm']);
  const typeByExtension = {jpg:'image/jpeg', jpeg:'image/jpeg', png:'image/png', webp:'image/webp', gif:'image/gif', pdf:'application/pdf', mp4:'video/mp4', webm:'video/webm'};
  const number = (slot) => String(slot + 1).padStart(2, '0');
  let publisher = null;
  let publicManifest = null, pendingManifest = null;
  const pendingChanges = new Map();
  let active = 0, editing = 0, editorBase = null, pendingFile = null, fileError = '';
  let database = null, busy = false, authBusy = false, authTarget = null;
  let loading = true, loadFailed = false, fetchGeneration = 0, watchGeneration = 0, toastTimer;

  function notify(message) {
    $('toast').textContent = message;
    $('toast').classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $('toast').classList.remove('show'), 5000);
  }

  function safeLink(value, kind) {
    if (typeof value !== 'string' || !value.trim()) return '';
    try {
      const url = new URL(value.trim());
      if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return '';
      if (kind === 'itch' && url.hostname !== 'itch.io' && !url.hostname.endsWith('.itch.io')) return '';
      return url.href;
    } catch { return ''; }
  }

  function renderProjectLinks(project) {
    let count = 0;
    for (const [id, value, kind] of [['git-link', project?.gitUrl, 'git'], ['itch-link', project?.itchUrl, 'itch']]) {
      const url = safeLink(value, kind);
      $(id).hidden = !url;
      if (url) { $(id).href = url; count += 1; }
      else $(id).removeAttribute('href');
    }
    $('project-links').hidden = count === 0;
  }

  function currentManifest() {
    return publisher?.isConnected && pendingManifest ? pendingManifest : publicManifest;
  }
  function publishedProject(slot) {
    return currentManifest()?.projects.find(project => project.slot === slot) || null;
  }
  function render() {
    const manifest = currentManifest();
    const project = manifest?.projects.find(item => item.slot === active);
    const connected = Boolean(publisher?.isConnected);
    const hasFile = Boolean(project?.media);
    const unavailable = !manifest;
    tabs.forEach((tab, slot) => {
      const item = manifest?.projects.find(entry => entry.slot === slot);
      tab.setAttribute('aria-selected', String(active === slot));
      tab.tabIndex = active === slot ? 0 : -1;
      tab.querySelector('.tab-name').textContent = item?.title || names[slot];
      tab.querySelector('.tab-status').textContent = unavailable ? '—' : item ? 'Published' : 'Empty';
    });
    $('owner-session').hidden = !connected;
    $('project-panel').setAttribute('aria-labelledby', 'tab-' + active);
    $('project-panel').setAttribute('aria-busy', String(loading && unavailable));
    $('page-indicator').textContent = number(active) + ' / 04';
    $('empty-index').textContent = number(active);
    document.querySelector('.empty-title').textContent = unavailable
      ? (loadFailed ? 'Work could not be loaded.' : 'Loading published work…')
      : project ? 'Ready to explore.' : `A space for project ${number(active)}.`;
    document.querySelector('.empty-copy').textContent = unavailable
      ? (loadFailed ? 'Please retry loading the published portfolio.' : 'Please wait a moment.')
      : project ? 'Use the links below to view the code or try the project.' : "New work will appear here when it's ready.";
    $('add-work-label').textContent = project ? 'Edit project' : 'Add project';
    $('add-work').hidden = !connected || unavailable;
    $('project-title').textContent = project?.title || names[active];
    $('project-description').textContent = project?.description || (unavailable ? 'Published projects are not available yet.' : project ? 'Every project has a story.' : 'Work in progress.');
    $('project-category').textContent = project?.category || (unavailable ? (loadFailed ? 'UNAVAILABLE' : 'LOADING') : pendingManifest && connected ? 'PUBLISHING' : project ? 'SELECTED WORK' : 'COMING SOON');
    renderProjectLinks(project);
    $('empty-state').hidden = hasFile;
    $('edit-work').hidden = !connected || !project;
    $('media-container').hidden = !hasFile;
    $('stage').classList.toggle('has-media', hasFile);
    $('media-container').replaceChildren();
    if (hasFile) {
      const mediaInfo = project.media;
      let media;
      if (mediaInfo.mime.startsWith('image/')) {
        media = document.createElement('img'); media.alt = project.title;
      } else if (mediaInfo.mime.startsWith('video/')) {
        media = document.createElement('video'); media.controls = true; media.preload = 'metadata'; media.playsInline = true;
      } else {
        media = document.createElement('iframe'); media.title = project.title + ' PDF preview';
      }
      media.src = new URL(mediaInfo.path, PUBLIC_BASE).href;
      if (media.tagName !== 'IFRAME') media.addEventListener('error', () => notify('This file is not available yet. GitHub Pages may still be deploying.'), {once:true});
      $('media-container').append(media);
    }
  }

  function select(slot, focus = false) {
    active = (slot + 4) % 4;
    render();
    if (focus) tabs[active].focus();
  }
  tabs.forEach((tab, slot) => {
    tab.addEventListener('click', () => select(slot));
    tab.addEventListener('keydown', event => {
      let next;
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = active + 1;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = active - 1;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = 3;
      if (next !== undefined) { event.preventDefault(); select(next, true); }
    });
  });
  $('prev-work').addEventListener('click', () => select(active - 1));
  $('next-work').addEventListener('click', () => select(active + 1));

  async function fetchPublicManifest() {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const url = new URL('projects.json', PUBLIC_BASE);
      url.searchParams.set('v', String(Date.now()));
      const response = await fetch(url.href, {cache:'no-store', signal:controller.signal});
      if (!response.ok) throw new Error('Published work is temporarily unavailable. Please try again.');
      return window.PortfolioPublisher.normalizeManifest(await response.json());
    } finally { clearTimeout(timer); }
  }
  async function loadPublic() {
    const generation = ++fetchGeneration;
    loading = true;
    $('load-message').textContent = publicManifest ? 'Refreshing published work…' : 'Loading published work…';
    $('load-status').hidden = false;
    $('retry-load').hidden = true;
    render();
    try {
      const manifest = await fetchPublicManifest();
      if (generation !== fetchGeneration) return;
      publicManifest = manifest;
      loadFailed = false;
      $('load-status').hidden = true;
    } catch {
      if (generation !== fetchGeneration) return;
      loadFailed = true;
      $('load-message').textContent = publicManifest ? 'Could not refresh published work. Showing the last loaded version.' : 'Could not load published work. Check your connection and retry.';
      $('retry-load').hidden = false;
    } finally {
      if (generation === fetchGeneration) { loading = false; render(); }
    }
  }
  $('retry-load').addEventListener('click', loadPublic);

  function updateDraftNotice() {
    $('draft-notice').hidden = localDrafts.size === 0;
    $('draft-message').textContent = `${localDrafts.size} saved local ${localDrafts.size === 1 ? 'draft was' : 'drafts were'} found in this browser. ${localDrafts.size === 1 ? 'It is' : 'They are'} not public yet.`;
  }
  const draftsReady = new Promise(resolve => {
    try {
      const request = indexedDB.open('liubai-portfolio-v1', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('works', {keyPath:'slot'});
      request.onerror = request.onblocked = () => resolve();
      request.onsuccess = () => {
        database = request.result;
        database.onversionchange = () => {database.close(); database = null;};
        try {
          const read = database.transaction('works', 'readonly').objectStore('works').getAll();
          read.onsuccess = () => {
            for (const record of read.result) {
              if (Number.isInteger(record.slot) && record.slot >= 0 && record.slot < 4 && (record.file instanceof Blob || safeLink(record.gitUrl, 'git') || safeLink(record.itchUrl, 'itch'))) localDrafts.set(record.slot, record);
            }
            updateDraftNotice(); resolve();
          };
          read.onerror = () => resolve();
        } catch { resolve(); }
      };
    } catch { resolve(); }
  });
  async function clearPublishedDraft(slot) {
    await draftsReady;
    localDrafts.delete(slot);
    updateDraftNotice();
    if (!database) return;
    await new Promise((resolve, reject) => {
      const transaction = database.transaction('works', 'readwrite');
      transaction.objectStore('works').delete(slot);
      transaction.oncomplete = resolve;
      transaction.onerror = transaction.onabort = () => reject(transaction.error);
    });
  }

  function resetFileSelection() {
    pendingFile = null; fileError = '';
    $('work-file').value = '';
    $('reset-file').hidden = true;
    const name = editorBase?.file?.name || editorBase?.media?.name;
    $('file-label').textContent = name ? name + ' (click to replace)' : 'Choose a file or drop it here (optional)';
  }
  async function requestEditor(slot = active) {
    if (!publisher) { notify('Publishing is unavailable. Please reload the page.'); return; }
    if (busy || authBusy) { notify('Please wait for the current operation to finish.'); return; }
    await draftsReady;
    if (!publisher.isConnected) {
      authTarget = slot;
      $('auth-form').reset();
      $('auth-error').textContent = '';
      $('github-auth').showModal();
      return;
    }
    editing = slot;
    editorBase = localDrafts.get(slot) || publishedProject(slot);
    $('editor-form').reset();
    $('editor-slot').textContent = 'PROJECT ' + number(slot);
    $('editor-title').textContent = editorBase ? 'Edit your project.' : 'Add a project.';
    $('draft-editor-note').hidden = !localDrafts.has(slot);
    $('work-title').value = editorBase?.title || '';
    $('work-category').value = editorBase?.category || '';
    $('work-description').value = editorBase?.description || '';
    $('work-git').value = editorBase?.gitUrl || '';
    $('work-itch').value = editorBase?.itchUrl || '';
    resetFileSelection();
    $('remove-work').hidden = !editorBase;
    $('remove-work').textContent = 'Remove project';
    $('form-error').textContent = '';
    $('editor').showModal();
  }
  ['manage-open', 'add-work', 'edit-work'].forEach(id => $(id).addEventListener('click', () => requestEditor(active)));
  $('review-drafts').addEventListener('click', async () => {
    await draftsReady;
    const slot = localDrafts.has(active) ? active : localDrafts.keys().next().value;
    if (slot === undefined) return;
    select(slot);
    requestEditor(slot);
  });
  $('auth-form').addEventListener('submit', async event => {
    event.preventDefault();
    if (authBusy || !publisher) return;
    const token = $('github-token').value.trim();
    $('github-token').value = '';
    if (!token) { $('auth-error').textContent = 'Enter a GitHub token.'; return; }
    const slot = authTarget ?? active;
    authBusy = true;
    $('connect-github').disabled = true;
    $('github-token').disabled = true;
    $('auth-error').textContent = '';
    try {
      await publisher.connect(token);
      $('github-auth').close();
      render();
      notify('Connected to GitHub. You can publish changes to this portfolio.');
    } catch (error) {
      $('auth-error').textContent = error.message || 'Could not connect. Check the token and repository permissions.';
    } finally {
      authBusy = false;
      $('connect-github').disabled = false;
      $('github-token').disabled = false;
    }
    if (publisher.isConnected) requestEditor(slot);
  });
  $('disconnect-github').addEventListener('click', () => {
    if (busy || authBusy || !publisher) return;
    publisher.disconnect();
    $('github-token').value = '';
    if ($('editor').open) $('editor').close();
    render();
    notify('Disconnected. Your token is no longer held by this page.');
  });

  $('about-open').addEventListener('click', () => $('about').showModal());
  function canClose(dialog) {
    return !(dialog.id === 'editor' && busy) && !(dialog.id === 'github-auth' && authBusy);
  }
  document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => {
    const dialog = $(button.dataset.close);
    if (canClose(dialog)) dialog.close();
  }));
  document.querySelectorAll('dialog').forEach(dialog => {
    dialog.addEventListener('cancel', event => {if (!canClose(dialog)) event.preventDefault();});
    dialog.addEventListener('click', event => {
      if (event.target !== dialog || !canClose(dialog)) return;
      const rect = dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
    });
  });
  $('github-auth').addEventListener('close', () => {$('github-token').value = ''; authTarget = null;});

  function getMime(file) { return file.type || typeByExtension[(file.name || '').split('.').pop().toLowerCase()] || ''; }
  function chooseFile(file) {
    if (!file) return;
    $('form-error').textContent = '';
    fileError = !accepted.has(getMime(file)) ? 'Choose a JPG, PNG, WebP, GIF, PDF, MP4, or WebM file.' : file.size > 100 * 1024 * 1024 ? 'This file exceeds 100 MB. Reduce its size and try again.' : '';
    pendingFile = fileError ? null : file;
    $('reset-file').hidden = false;
    if (fileError) { $('work-file').value = ''; $('form-error').textContent = fileError; return; }
    $('file-label').textContent = `${file.name || 'Selected file'} · ${(file.size / 1024 / 1024).toFixed(1)} MB`;
    if (!$('work-title').value.trim()) $('work-title').value = (file.name || 'Untitled project').replace(/\.[^.]+$/, '').slice(0, 40);
  }
  $('work-file').addEventListener('change', event => chooseFile(event.target.files[0]));
  $('reset-file').addEventListener('click', () => {resetFileSelection(); $('form-error').textContent = '';});
  ['dragenter', 'dragover'].forEach(type => $('upload-area').addEventListener(type, event => {event.preventDefault(); if (!busy) $('upload-area').classList.add('dragover');}));
  ['dragleave', 'drop'].forEach(type => $('upload-area').addEventListener(type, event => {event.preventDefault(); $('upload-area').classList.remove('dragover');}));
  $('upload-area').addEventListener('drop', event => {if (!busy) chooseFile(event.dataTransfer.files[0]);});
  window.addEventListener('dragover', event => {if ([...event.dataTransfer.types].includes('Files')) event.preventDefault();});
  window.addEventListener('drop', event => {if ([...event.dataTransfer.types].includes('Files')) event.preventDefault();});

  function setBusy(value) {
    busy = value;
    for (const id of ['save-work', 'remove-work', 'work-title', 'work-category', 'work-description', 'work-git', 'work-itch', 'work-file', 'reset-file', 'disconnect-github']) $(id).disabled = value;
    $('save-work').textContent = value ? 'Publishing…' : 'Save & publish ↗';
    $('editor-form').setAttribute('aria-busy', String(value));
  }
  function projectSignature(project) {
    if (!project) return 'absent';
    const media = project.media;
    return JSON.stringify([project.slot, project.title, project.category || '', project.description || '', project.gitUrl || '', project.itchUrl || '', media ? [media.path, media.mime, media.name, media.size] : null]);
  }
  function includesPendingChanges(manifest) {
    return [...pendingChanges].every(([slot, project]) => projectSignature(manifest.projects.find(item => item.slot === slot)) === projectSignature(project));
  }
  const pause = (milliseconds) => new Promise(resolve => setTimeout(resolve, milliseconds));
  async function watchPublication() {
    if (!pendingManifest) return;
    const generation = ++watchGeneration;
    const started = Date.now();
    $('publish-notice').hidden = false;
    $('publish-message').textContent = 'Saved to GitHub. Publishing to GitHub Pages… Other visitors will see the update after deployment finishes.';
    $('retry-publish-status').hidden = true;
    while (generation === watchGeneration && Date.now() - started < 180000) {
      try {
        const readGeneration = ++fetchGeneration;
        const manifest = await fetchPublicManifest();
        if (generation !== watchGeneration) return;
        if (readGeneration === fetchGeneration) {
          publicManifest = manifest;
          loading = false; loadFailed = false;
          $('load-status').hidden = true;
          if (manifest.revision === pendingManifest.revision || includesPendingChanges(manifest)) {
            pendingManifest = null; pendingChanges.clear();
            $('publish-message').textContent = 'Published. Everyone can see the updated portfolio.';
            $('retry-publish-status').hidden = true;
            render();
            return;
          }
          render();
        }
      } catch { /* A transient read failure does not undo a successful Git commit. */ }
      await pause(10000);
    }
    if (generation !== watchGeneration) return;
    $('publish-message').textContent = 'Your changes are saved to GitHub, but the public update is not confirmed yet. Pages may still be deploying. Check again shortly.';
    $('retry-publish-status').hidden = false;
  }
  $('retry-publish-status').addEventListener('click', watchPublication);

  async function publishChange(slot, record) {
    if (!publisher?.isConnected) throw new Error('Connect GitHub before publishing.');
    const result = await publisher.publish(slot, record);
    pendingManifest = window.PortfolioPublisher.normalizeManifest(result.manifest);
    pendingChanges.set(slot, pendingManifest.projects.find(item => item.slot === slot) || null);
    clearPublishedDraft(slot).catch(() => notify('Saved to GitHub. The old local draft could not be removed from browser storage.'));
    select(slot);
    $('editor').close();
    watchPublication();
  }
  $('editor-form').addEventListener('submit', async event => {
    event.preventDefault();
    if (busy) return;
    if (fileError) { $('form-error').textContent = fileError; return; }
    const slot = editing;
    const file = pendingFile || (editorBase?.file instanceof Blob ? editorBase.file : null);
    const record = {slot, title:$('work-title').value.trim(), category:$('work-category').value.trim(), description:$('work-description').value.trim(), gitUrl:$('work-git').value.trim(), itchUrl:$('work-itch').value.trim()};
    if (file) { record.file = file; record.mime = getMime(file) || editorBase?.mime; }
    else if (editorBase?.media) record.media = editorBase.media;
    setBusy(true);
    $('form-error').textContent = '';
    try { await publishChange(slot, record); }
    catch (error) { $('form-error').textContent = error.message || 'Could not publish. Your existing public work and local draft have been kept.'; }
    finally { setBusy(false); }
  });
  $('remove-work').addEventListener('click', async () => {
    if (busy) return;
    if ($('remove-work').textContent !== 'Confirm removal?') { $('remove-work').textContent = 'Confirm removal?'; return; }
    const slot = editing;
    setBusy(true);
    $('form-error').textContent = '';
    try { await publishChange(slot, null); }
    catch (error) { $('form-error').textContent = error.message || 'Could not remove the project. Please try again.'; }
    finally { setBusy(false); }
  });
  window.addEventListener('beforeunload', event => {if (busy) {event.preventDefault(); event.returnValue = '';}});

  $('year').textContent = new Date().getFullYear();
  if (!window.PortfolioPublisher?.GitHubPublisher) {
    loading = false; loadFailed = true;
    $('load-message').textContent = 'The publishing tools could not be loaded. Please reload the page.';
    $('retry-load').hidden = true;
    $('manage-open').disabled = true;
    render();
    return;
  }
  publisher = new window.PortfolioPublisher.GitHubPublisher({owner:'Wangwu-1', repo:'portfolio', branch:'main'});
  render();
  loadPublic();
})();
