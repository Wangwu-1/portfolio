(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PortfolioPublisher = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const API = 'https://api.github.com';
  const MAX_FILE_BYTES = 100 * 1024 * 1024;
  const MAX_MANIFEST_BYTES = 128 * 1024;
  const EXTENSIONS = {
    'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
    'image/gif': 'gif', 'application/pdf': 'pdf', 'video/mp4': 'mp4', 'video/webm': 'webm'
  };
  const MIME_BY_EXTENSION = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
    gif: 'image/gif', pdf: 'application/pdf', mp4: 'video/mp4', webm: 'video/webm'
  };

  class GitHubError extends Error {
    constructor(message, status = 0) {
      super(message);
      this.name = 'GitHubError';
      this.status = status;
    }
  }

  function plainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  function textField(value, label, maximum, required = false) {
    if (value == null && !required) return '';
    if (typeof value !== 'string') throw new Error(`${label} must be text.`);
    const text = value.trim();
    if (required && !text) throw new Error(`Enter a ${label.toLowerCase()}.`);
    if (text.length > maximum) throw new Error(`${label} must be ${maximum} characters or fewer.`);
    return text;
  }

  function validateLink(value, kind) {
    const label = kind === 'itch' ? 'itch.io URL' : 'Git repository URL';
    const text = textField(value, label, 2048);
    if (!text) return '';
    let url;
    try { url = new URL(text); }
    catch { throw new Error(`${label} must start with https:// or http://.`); }
    if (!['https:', 'http:'].includes(url.protocol) || !url.hostname || url.username || url.password) {
      throw new Error(`${label} must be a web address without embedded credentials.`);
    }
    if (kind === 'itch' && url.hostname !== 'itch.io' && !url.hostname.endsWith('.itch.io')) {
      throw new Error('Use an itch.io address, such as https://username.itch.io/project.');
    }
    return url.href;
  }

  function fileMetadata(file, suppliedMime) {
    if (typeof Blob === 'undefined' || !(file instanceof Blob)) throw new Error('Choose a valid project file.');
    if (!Number.isSafeInteger(file.size) || file.size < 0 || file.size > MAX_FILE_BYTES) {
      throw new Error('Choose a file no larger than 100 MB.');
    }
    const originalName = typeof file.name === 'string' ? file.name : '';
    const extension = originalName.split('.').pop().toLowerCase();
    const mime = file.type || suppliedMime || MIME_BY_EXTENSION[extension] || '';
    if (!Object.hasOwn(EXTENSIONS, mime)) throw new Error('Choose a JPG, PNG, WebP, GIF, PDF, MP4, or WebM file.');
    const name = textField(originalName || `project.${EXTENSIONS[mime]}`, 'File name', 255, true);
    return {mime, name, size: file.size};
  }

  function normalizeMedia(media, slot) {
    if (!plainObject(media)) throw new Error('The published media record is invalid.');
    const path = textField(media.path, 'Media path', 240, true);
    if (!new RegExp(`^assets/projects/${slot}/[A-Za-z0-9][A-Za-z0-9._-]*$`).test(path)) {
      throw new Error('The published media path is invalid.');
    }
    const mime = media.mime;
    const extension = path.split('.').pop().toLowerCase();
    if (!Object.hasOwn(EXTENSIONS, mime) || MIME_BY_EXTENSION[extension] !== mime) {
      throw new Error('The published media type is invalid.');
    }
    const name = textField(media.name, 'File name', 255, true);
    if (!Number.isSafeInteger(media.size) || media.size < 0 || media.size > MAX_FILE_BYTES) {
      throw new Error('The published media size is invalid.');
    }
    return {path, mime, name, size: media.size};
  }

  function validateProject(input, options = {}) {
    if (!plainObject(input) || !Number.isInteger(input.slot) || input.slot < 0 || input.slot > 3) {
      throw new Error('Choose a project slot from 01 to 04.');
    }
    const project = {
      slot: input.slot,
      title: textField(input.title, 'Project name', 40, true),
      category: textField(input.category, 'Category', 24),
      description: textField(input.description, 'Description', 180),
      gitUrl: validateLink(input.gitUrl, 'git'),
      itchUrl: validateLink(input.itchUrl, 'itch')
    };
    if (input.media != null) project.media = normalizeMedia(input.media, input.slot);
    if (input.file != null) {
      if (options.allowFile === false) throw new Error('Published project data cannot contain a local file.');
      const metadata = fileMetadata(input.file, input.mime);
      project.file = input.file;
      project.mime = metadata.mime;
    }
    if (!project.file && !project.media && !project.gitUrl && !project.itchUrl) {
      throw new Error('Add a file or at least one Git / itch.io link.');
    }
    return project;
  }

  function normalizeManifest(input) {
    if (!plainObject(input) || input.version !== 1 || !Array.isArray(input.projects) || input.projects.length > 4) {
      throw new Error('The published project data is invalid. It has not been replaced.');
    }
    if (typeof input.revision !== 'string' || !/^[A-Za-z0-9._-]{1,160}$/.test(input.revision)) {
      throw new Error('The published project revision is invalid.');
    }
    if (typeof input.updatedAt !== 'string' || !Number.isFinite(Date.parse(input.updatedAt))) {
      throw new Error('The published project timestamp is invalid.');
    }
    const used = new Set();
    const projects = input.projects.map(raw => {
      const project = validateProject(raw, {allowFile: false});
      if (used.has(project.slot)) throw new Error('The published data contains duplicate project slots.');
      used.add(project.slot);
      return project;
    }).sort((a, b) => a.slot - b.slot);
    return {version: 1, revision: input.revision, updatedAt: new Date(input.updatedAt).toISOString(), projects};
  }

  function emptyManifest() {
    return {version: 1, revision: 'initial', updatedAt: '1970-01-01T00:00:00.000Z', projects: []};
  }

  function randomId() {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
    if (!globalThis.crypto?.getRandomValues) throw new Error('This browser cannot create a publication ID. Use a current browser.');
    const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
    return [...bytes].map(value => value.toString(16).padStart(2, '0')).join('');
  }

  function encodeBase64(bytes) {
    const chunks = [];
    for (let index = 0; index < bytes.length; index += 32768) {
      chunks.push(String.fromCharCode(...bytes.subarray(index, index + 32768)));
    }
    return btoa(chunks.join(''));
  }

  function decodeManifest(encoded) {
    if (!plainObject(encoded) || encoded.encoding !== 'base64' || typeof encoded.content !== 'string' ||
        (encoded.size != null && encoded.size > MAX_MANIFEST_BYTES) || encoded.content.length > MAX_MANIFEST_BYTES * 1.5) {
      throw new Error('GitHub returned an invalid published data file. It has not been replaced.');
    }
    try {
      const binary = atob(encoded.content.replace(/\s/g, ''));
      const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
      const text = new TextDecoder('utf-8', {fatal: true}).decode(bytes);
      return normalizeManifest(JSON.parse(text));
    } catch (error) {
      if (error instanceof SyntaxError || error instanceof TypeError || error.name === 'InvalidCharacterError') {
        throw new Error('The published data file is not valid JSON. It has not been replaced.');
      }
      throw error;
    }
  }

  function sha(value) {
    if (typeof value !== 'string' || !/^[a-f0-9]{40,64}$/i.test(value)) {
      throw new Error('GitHub returned an unexpected commit response. Check the repository before trying again.');
    }
    return value;
  }

  class GitHubPublisher {
    #owner;
    #repo;
    #branch;
    #fetch;
    #token = '';
    #busy = false;
    #controllers = new Set();
    #connectionGeneration = 0;

    constructor({owner = 'Wangwu-1', repo = 'portfolio', branch = 'main', fetchImpl} = {}) {
      if (typeof owner !== 'string' || !/^[A-Za-z0-9-]{1,100}$/.test(owner) ||
          typeof repo !== 'string' || !/^[A-Za-z0-9._-]{1,100}$/.test(repo) || ['.', '..'].includes(repo) ||
          typeof branch !== 'string' || !branch.trim() || branch.length > 200 || /[\r\n\0]/.test(branch)) {
        throw new Error('The GitHub publication settings are invalid.');
      }
      this.#owner = owner;
      this.#repo = repo;
      this.#branch = branch;
      this.#fetch = fetchImpl || globalThis.fetch?.bind(globalThis);
      if (typeof this.#fetch !== 'function') throw new Error('This browser cannot connect to GitHub.');
    }

    get isConnected() { return Boolean(this.#token); }
    get isBusy() { return this.#busy; }
    get #repositoryPath() { return `/repos/${encodeURIComponent(this.#owner)}/${encodeURIComponent(this.#repo)}`; }

    disconnect() {
      this.#token = '';
      this.#connectionGeneration += 1;
      for (const controller of this.#controllers) controller.abort();
    }

    async #api(path, {method = 'GET', body, allowMissing = false, token} = {}) {
      const credential = token === undefined ? this.#token : token;
      if (!credential) throw new Error('Connect your GitHub account before publishing.');
      const controller = new AbortController();
      this.#controllers.add(controller);
      const timer = setTimeout(() => controller.abort(), 180000);
      try {
        let response;
        try {
          response = await this.#fetch(API + path, {
            method,
            headers: {
              Accept: 'application/vnd.github+json',
              Authorization: `Bearer ${credential}`,
              'X-GitHub-Api-Version': '2026-03-10',
              ...(body === undefined ? {} : {'Content-Type': 'application/json'})
            },
            ...(body === undefined ? {} : {body: JSON.stringify(body)}),
            signal: controller.signal,
            credentials: 'omit', redirect: 'error', cache: 'no-store', referrerPolicy: 'no-referrer'
          });
          if (controller.signal.aborted) throw new Error('Cancelled');
        } catch {
          throw new GitHubError(controller.signal.aborted ? 'The GitHub request was cancelled or timed out. Check the repository before retrying.' : 'Could not reach GitHub. Check your connection and try again.');
        }
        if (allowMissing && response.status === 404) return null;
        if (!response.ok) {
          if (response.status === 401) throw new GitHubError('Your GitHub token is invalid or has expired. Create a new token and connect again.', 401);
          if (response.status === 403) {
            const limited = response.headers?.get?.('x-ratelimit-remaining') === '0';
            throw new GitHubError(limited ? 'GitHub API rate limit reached. Please try again later.' : `GitHub refused the request. Use a token with Contents read/write access to ${this.#owner}/${this.#repo}.`, 403);
          }
          if (response.status === 404) throw new GitHubError('GitHub could not find the repository or branch. Check the token repository access.', 404);
          if (response.status === 409 || response.status === 422) throw new GitHubError('The repository changed while publishing. Reload and try again.', response.status);
          if (response.status === 413) throw new GitHubError('GitHub rejected the file because it is too large. Choose a smaller file.', 413);
          throw new GitHubError(`GitHub could not complete the request (HTTP ${response.status}). Please try again.`, response.status);
        }
        if (response.status === 204) return null;
        try { return await response.json(); }
        catch { throw new Error('GitHub returned an unexpected response. Check the repository before trying again.'); }
      } finally {
        clearTimeout(timer);
        this.#controllers.delete(controller);
      }
    }

    async connect(token) {
      if (this.#busy) throw new Error('Wait for the current GitHub operation to finish.');
      this.disconnect();
      const generation = this.#connectionGeneration;
      if (typeof token !== 'string' || !token.trim() || /\s/.test(token.trim())) throw new Error('Enter your GitHub token.');
      const credential = token.trim();
      this.#busy = true;
      try {
        const user = await this.#api('/user', {token: credential});
        if (typeof user?.login !== 'string' || user.login.toLowerCase() !== this.#owner.toLowerCase()) {
          throw new Error(`Only ${this.#owner} can publish this portfolio.`);
        }
        const repository = await this.#api(this.#repositoryPath, {token: credential});
        if (!repository?.permissions?.push) throw new Error(`This token cannot publish to ${this.#owner}/${this.#repo}. Enable Contents read/write access for this repository.`);
        if (generation !== this.#connectionGeneration) throw new Error('The connection was cancelled. Connect again before publishing.');
        this.#token = credential;
        return {login: user.login};
      } finally { this.#busy = false; }
    }

    async #snapshot() {
      const reference = await this.#api(`${this.#repositoryPath}/git/ref/heads/${encodeURIComponent(this.#branch)}`);
      const head = sha(reference?.object?.sha);
      const commit = await this.#api(`${this.#repositoryPath}/git/commits/${head}`);
      const tree = sha(commit?.tree?.sha);
      const file = await this.#api(`${this.#repositoryPath}/contents/projects.json?ref=${encodeURIComponent(head)}`, {allowMissing: true});
      return {head, tree, manifest: file === null ? emptyManifest() : decodeManifest(file)};
    }

    async publish(slot, input) {
      if (!this.isConnected) throw new Error('Connect your GitHub account before publishing.');
      if (this.#busy) throw new Error('A publication is already in progress. Please wait.');
      if (!Number.isInteger(slot) || slot < 0 || slot > 3) throw new Error('Choose a project slot from 01 to 04.');
      if (input != null && (!plainObject(input) || (input.slot != null && input.slot !== slot))) throw new Error('The project does not match the selected slot.');
      const project = input == null ? null : validateProject({...input, slot});
      this.#busy = true;
      let uploadedMedia = null;
      let uploadedBlobSha = null;
      let firstTarget;
      try {
        for (let attempt = 0; attempt < 2; attempt += 1) {
          const snapshot = await this.#snapshot();
          const currentTarget = snapshot.manifest.projects.find(item => item.slot === slot) || null;
          if (attempt === 0) firstTarget = JSON.stringify(currentTarget);
          else if (firstTarget !== JSON.stringify(currentTarget)) throw new Error('This project changed while you were publishing. Reload its latest version before trying again.');

          if (project?.file && !uploadedMedia) {
            const metadata = fileMetadata(project.file, project.mime);
            let buffer;
            try { buffer = await project.file.arrayBuffer(); }
            catch { throw new Error('Could not read the project file. Choose it again and retry.'); }
            if (buffer.byteLength !== metadata.size) throw new Error('The project file changed while it was being read. Choose it again and retry.');
            const blob = await this.#api(`${this.#repositoryPath}/git/blobs`, {method: 'POST', body: {content: encodeBase64(new Uint8Array(buffer)), encoding: 'base64'}});
            uploadedBlobSha = sha(blob?.sha);
            uploadedMedia = {...metadata, path: `assets/projects/${slot}/${randomId()}.${EXTENSIONS[metadata.mime]}`};
          }

          const projects = snapshot.manifest.projects.filter(item => item.slot !== slot);
          if (project) {
            const {file, mime, ...published} = project;
            if (uploadedMedia) published.media = uploadedMedia;
            projects.push(published);
          }
          const manifest = normalizeManifest({version: 1, revision: randomId(), updatedAt: new Date().toISOString(), projects});
          const entries = [{path: 'projects.json', mode: '100644', type: 'blob', content: JSON.stringify(manifest, null, 2) + '\n'}];
          if (uploadedMedia) entries.push({path: uploadedMedia.path, mode: '100644', type: 'blob', sha: uploadedBlobSha});
          const tree = await this.#api(`${this.#repositoryPath}/git/trees`, {method: 'POST', body: {base_tree: snapshot.tree, tree: entries}});
          const commit = await this.#api(`${this.#repositoryPath}/git/commits`, {method: 'POST', body: {
            message: `${project ? 'Publish' : 'Remove'} portfolio project ${String(slot + 1).padStart(2, '0')}`,
            tree: sha(tree?.sha), parents: [snapshot.head],
            author: {name: this.#owner, email: `${this.#owner}@users.noreply.github.com`},
            committer: {name: this.#owner, email: `${this.#owner}@users.noreply.github.com`}
          }});
          const commitSha = sha(commit?.sha);
          let reference;
          try {
            reference = await this.#api(`${this.#repositoryPath}/git/refs/heads/${encodeURIComponent(this.#branch)}`, {method: 'PATCH', body: {sha: commitSha, force: false}});
          } catch (error) {
            if (attempt === 0 && error instanceof GitHubError && [409, 422].includes(error.status)) continue;
            throw error;
          }
          if (reference?.object?.sha !== commitSha) throw new Error('GitHub did not confirm the new publication. Check the repository before trying again.');
          return {manifest, commitSha};
        }
        throw new Error('The repository changed again while publishing. Reload and try again.');
      } finally { this.#busy = false; }
    }
  }

  return {GitHubPublisher, GitHubError, normalizeManifest, validateProject, validateLink, MAX_FILE_BYTES};
});
