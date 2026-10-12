/* Decap 3.9.0 adapter. No credentials are persisted or logged by this module. */
(function (root) {
  'use strict';
  const REPO = 'sighmoan1/bathos';
  const BRANCH = 'main';
  const PROJECT = 'bathos-web';
  const INTERVAL = 60000;

  function deploymentState(sha, runs) {
    // Require the exact commit, Cloudflare App and project. Ignore PR builds,
    // Vercel and unrelated CI, even if they succeeded on the same commit.
    const matches = runs.filter(run => run.head_sha === sha &&
      run.name === 'Cloudflare Pages' && run.app?.slug === 'cloudflare-workers-and-pages' &&
      projectURL(run.details_url));
    const latest = matches.sort((a, b) => Number(b.id) - Number(a.id))[0];
    if (!latest) return { state: 'unknown', message: 'No deployment check found. This commit may not be live.' };
    if (latest.status !== 'completed') return { state: 'pending', message: 'Deployment is queued or building.', url: latest.details_url };
    if (latest.conclusion === 'success') return { state: 'success', message: 'Deployment check passed. Open the public site to check your post.', url: latest.details_url };
    if (['failure', 'timed_out', 'cancelled', 'action_required', 'startup_failure', 'stale'].includes(latest.conclusion)) {
      return { state: 'failure', message: 'Deployment failed or was cancelled. Your Git changes remain saved; the public site may show the previous version.', url: latest.details_url };
    }
    return { state: 'unknown', message: 'Deployment was skipped or has no confirmed result. This commit may not be live.', url: latest.details_url };
  }

  function projectURL(value) {
    try {
      const url = new URL(value);
      return url.origin === 'https://dash.cloudflare.com' &&
        /\/pages\/view\/bathos-web(?:\/|$)/.test(url.searchParams.get('to') || url.pathname);
    } catch { return false; }
  }

  // Testable without a browser or authenticated account.
  if (typeof module !== 'undefined' && module.exports) module.exports = { deploymentState, projectURL };
  if (!root.document || !root.CMS) return;

  const panel = document.createElement('aside');
  panel.id = 'publishing-status';
  panel.setAttribute('aria-label', 'Publishing status');
  panel.innerHTML = '<p id="git-save-status" role="status">Save commits your changes to Git. The public site updates after a successful deployment. Deleting a post removes it for all readers after deployment; Git history keeps a recovery copy.</p>' +
    '<p id="deployment-status" role="status">Sign in, then check deployment status.</p>' +
    '<div><button type="button" id="deployment-refresh">Check deployment</button> ' +
    '<a href="https://bathos.org/" target="_blank" rel="noopener noreferrer">Open public site</a> · ' +
    '<a href="https://github.com/' + REPO + '/commits/main/" target="_blank" rel="noopener noreferrer">Git history and recovery</a></div>';
  const shell = document.getElementById('admin-shell');
  if (shell) shell.insertAdjacentElement('afterend', panel);
  else document.body.prepend(panel);
  const saved = document.getElementById('git-save-status');
  const status = document.getElementById('deployment-status');
  const button = document.getElementById('deployment-refresh');
  let backend;
  let lastCheck = 0;
  let inFlight = false;
  let retries = 0;
  let timer;
  let generation = 0;

  // CMS.getBackend returns a factory, not the signed-in instance. Capture the
  // instance Decap creates, leaving its implementation/authentication untouched.
  // Reading its token at request time also honors Decap logout (token becomes null).
  const factory = root.CMS.getBackend('github');
  if (factory && typeof factory.init === 'function') {
    const init = factory.init;
    factory.init = function (...args) {
      backend = init.apply(this, args);
      const deleteFiles = backend.deleteFiles;
      if (typeof deleteFiles === 'function') {
        backend.deleteFiles = function (...deleteArgs) {
          return Promise.resolve(deleteFiles.apply(this, deleteArgs)).then(result => {
            changesSaved('Deletion saved to Git. It takes effect on the public site after deployment. Recover a deleted post from Git history.');
            return result;
          });
        };
      }
      return backend;
    };
  }

  async function github(path) {
    if (!backend?.token) throw new Error('signed-out');
    const response = await fetch('https://api.github.com/repos/' + REPO + path, {
      headers: { Authorization: 'Bearer ' + backend.token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
      cache: 'no-store', referrerPolicy: 'no-referrer',
    });
    if (!response.ok) throw new Error(response.status === 429 || (response.status === 403 && response.headers.get('x-ratelimit-remaining') === '0') ? 'rate-limit' : 'unavailable');
    return response.json();
  }

  function render(result, sha) {
    status.textContent = 'Checked main commit ' + sha.slice(0, 7) + ': ' + result.message;
    panel.dataset.state = result.state;
    if (result.url) {
      const link = document.createElement('a');
      link.href = result.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = ' View build details';
      status.appendChild(link);
    }
  }

  async function check() {
    if (inFlight) return;
    if (!backend?.token) {
      clearTimeout(timer);
      status.textContent = 'Sign in to check deployment status.';
      panel.dataset.state = 'unknown';
      return;
    }
    if (Date.now() - lastCheck < INTERVAL) return;
    const requestGeneration = generation;
    lastCheck = Date.now();
    inFlight = true;
    button.disabled = true;
    status.textContent = 'Checking the latest main commit…';
    try {
      const commit = await github('/commits/' + BRANCH);
      const data = await github('/commits/' + commit.sha + '/check-runs?per_page=100&filter=latest');
      // A newer commit arriving during this request does not replace this SHA.
      // This is a branch snapshot, never a claim that HEAD is the author's save.
      if (!backend?.token) throw new Error('signed-out');
      if (requestGeneration !== generation) return;
      const result = deploymentState(commit.sha, data.check_runs || []);
      render(result, commit.sha);
      clearTimeout(timer);
      if (['pending', 'unknown'].includes(result.state) && retries++ < 5) {
        timer = setTimeout(() => { if (!document.hidden) check(); }, INTERVAL);
      }
    } catch (error) {
      if (requestGeneration !== generation) return;
      clearTimeout(timer);
      panel.dataset.state = 'unknown';
      status.textContent = error.message === 'rate-limit'
        ? 'Deployment status unavailable: GitHub request limit reached. Wait before checking again; use Git history to open the commit checks.'
        : 'Deployment status unavailable. Your save result is separate; open Git history to check the commit and build details.';
    } finally {
      inFlight = false;
      // Bound manual requests as well as automatic polling.
      setTimeout(() => { button.disabled = false; }, Math.max(0, INTERVAL - (Date.now() - lastCheck)));
    }
  }
  button.addEventListener('click', () => { retries = 0; check(); });
  function changesSaved(message) {
    generation++;
    saved.textContent = message;
    panel.dataset.state = 'pending';
    status.textContent = 'Git changed. Deployment has not yet been checked for these changes.';
    retries = 0;
    clearTimeout(timer);
    const delay = Math.max(0, INTERVAL - (Date.now() - lastCheck));
    if (delay || inFlight) timer = setTimeout(check, Math.max(delay, 100));
    else check();
  }
  root.CMS.registerEventListener({ name: 'postSave', handler: () => {
    changesSaved('Changes saved to Git. Deployment is a separate step. The checked main commit may include changes by other authors.');
  } });
  root.CMS.registerEventListener({ name: 'postPublish', handler: () => {
    changesSaved('Changes committed to Git. Check the deployment before expecting them on the public site.');
  } });
  root.CMS.registerEventListener({ name: 'postUnpublish', handler: () => {
    changesSaved('Removal committed to Git. It takes effect on the public site after deployment. Recover content from Git history.');
  } });
})(typeof window !== 'undefined' ? window : globalThis);
