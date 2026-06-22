const API = 'https://api.github.com';
const page = document.body.dataset.page;

// ===== SHARED: Header search works on all pages =====
const headerSearch = document.getElementById('header-search');
if (headerSearch) {
  headerSearch.addEventListener('keypress', async (e) => {
    if (e.key === 'Enter') {
      const username = e.target.value.trim();
      if (!username) return;
      
      headerSearch.disabled = true;
      try {
        const res = await fetch(`${API}/users/${username}`);
        if (!res.ok) throw new Error('User not found');
        window.location.href = `/login/${username}`;
      } catch {
        alert(`User "${username}" not found`);
        headerSearch.disabled = false;
        headerSearch.value = '';
      }
    }
  });
}

// ===== SHARED: Logout =====
const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
  logoutBtn.addEventListener('click', () => window.location.href = '/');
}

// ===== LOGIN PAGE =====
if (page === 'login') {
  const loginBtn = document.getElementById('login-btn');
  const usernameInput = document.getElementById('username-input');
  const loginError = document.getElementById('login-error');

  loginBtn.addEventListener('click', handleLogin);
  usernameInput.addEventListener('keypress', e => { if (e.key === 'Enter') handleLogin(); });

  async function handleLogin() {
    const username = usernameInput.value.trim();
    if (!username) return;

    loginError.textContent = '';
    loginBtn.disabled = true;
    loginBtn.textContent = 'Signing in...';

    try {
      const res = await fetch(`${API}/users/${username}`);
      if (!res.ok) throw new Error('User not found');
      window.location.href = `/login/${username}`;
    } catch (err) {
      loginError.textContent = 'Could not find that user';
      loginBtn.disabled = false;
      loginBtn.textContent = 'Sign in';
    }
  }
}

// ===== PROFILE PAGE =====
if (page === 'profile') {
  let currentUser = null;

  function getUsernameFromUrl() {
    const pathMatch = window.location.pathname.match(/^\/login\/([^\/]+)/);
    if (pathMatch) return pathMatch[1];
    const params = new URLSearchParams(window.location.search);
    return params.get('user');
  }

  async function initProfile() {
    const username = getUsernameFromUrl();
    if (!username) return window.location.href = '/';

    try {
      const res = await fetch(`${API}/users/${username}`);
      if (!res.ok) throw new Error('User not found');
      currentUser = await res.json();
      document.getElementById('loading').style.display = 'none';
      document.getElementById('main-container').style.display = 'flex';
      loadProfile();
    } catch (err) {
      window.location.href = '/404.html';
    }
  }

  async function loadProfile() {
    document.title = `${currentUser.login} - GitHub Profile Viewer`;
    document.getElementById('profile-avatar').src = currentUser.avatar_url;
    document.getElementById('profile-name').textContent = currentUser.name || currentUser.login;
    document.getElementById('profile-username').textContent = currentUser.login;
    document.getElementById('profile-bio').textContent = currentUser.bio || '';
    document.getElementById('followers-count').textContent = currentUser.followers;
    document.getElementById('following-count').textContent = currentUser.following;

    const details = [];
    if (currentUser.company) details.push(`<li>🏢 ${currentUser.company}</li>`);
    if (currentUser.location) details.push(`<li>📍 ${currentUser.location}</li>`);
    if (currentUser.blog) details.push(`<li>🔗 <a href="${currentUser.blog}" target="_blank" rel="noopener">${currentUser.blog}</a></li>`);
    document.getElementById('profile-details').innerHTML = details.join('');

    document.getElementById('repo-count').textContent = currentUser.public_repos;
    loadOverview();
    loadRepos();
  }

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`${btn.dataset.tab}-tab`).classList.add('active');
    });
  });

  async function loadOverview() {
    const repos = await fetch(`${API}/users/${currentUser.login}/repos?sort=stars&per_page=6`).then(r => r.json());
    const pinnedHtml = repos.map(repo => `
      <div class="repo-card">
        <h3><a href="/repo/${currentUser.login}/${repo.name}">${repo.name}</a></h3>
        <p>${repo.description || ''}</p>
        <div class="repo-meta">
          ${repo.language? `<span>● ${repo.language}</span>` : ''}
          <span>★ ${repo.stargazers_count}</span>
        </div>
      </div>
    `).join('');
    document.getElementById('pinned-repos').innerHTML = pinnedHtml;

    document.getElementById('contrib-year').textContent = `Contributions in ${new Date().getFullYear()}`;
    document.getElementById('contrib-graph').innerHTML = '<p style="color:#57606a;">Contribution data requires authentication</p>';
  }

  let allRepos = [];
  async function loadRepos() {
    allRepos = await fetch(`${API}/users/${currentUser.login}/repos?per_page=100&sort=updated`).then(r => r.json());
    renderRepos(allRepos);
  }

  function renderRepos(repos) {
    const html = repos.map(repo => `
      <div class="repo-item">
        <h3><a href="/repo/${currentUser.login}/${repo.name}">${repo.name}</a></h3>
        <p>${repo.description || ''}</p>
        <div class="repo-meta">
          ${repo.language? `<span>● ${repo.language}</span>` : ''}
          <span>★ ${repo.stargazers_count}</span>
          <span>Updated ${new Date(repo.updated_at).toLocaleDateString()}</span>
        </div>
      </div>
    `).join('');
    document.getElementById('repo-list').innerHTML = html;
  }

  document.getElementById('repo-search').addEventListener('input', e => {
    const query = e.target.value.toLowerCase();
    const filtered = allRepos.filter(r =>
      r.name.toLowerCase().includes(query) ||
      (r.description && r.description.toLowerCase().includes(query))
    );
    renderRepos(filtered);
  });

  document.getElementById('repo-sort').addEventListener('change', e => {
    const sort = e.target.value;
    const sorted = [...allRepos].sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name);
      if (sort === 'stars') return b.stargazers_count - a.stargazers_count;
      return new Date(b.updated_at) - new Date(a.updated_at);
    });
    renderRepos(sorted);
  });

  initProfile();
}

// ===== REPO PAGE =====
if (page === 'repo') {
  let currentPath = [];

  function getParamsFromUrl() {
    const match = window.location.pathname.match(/^\/repo\/([^\/]+)\/([^\/]+)/);
    if (match) return { user: match[1], repo: match[2] };
    const params = new URLSearchParams(window.location.search);
    return { user: params.get('user'), repo: params.get('repo') };
  }

  async function initRepo() {
    const { user, repo } = getParamsFromUrl();
    if (!user ||!repo) return window.location.href = '/404.html';

    try {
      const repoRes = await fetch(`${API}/repos/${user}/${repo}`);
      if (!repoRes.ok) throw new Error('Repo not found');
      const repoData = await repoRes.json();

      document.getElementById('loading').style.display = 'none';
      document.getElementById('main-container').style.display = 'block';

      document.title = `${user}/${repo} - GitHub Profile Viewer`;
      document.getElementById('repo-name').innerHTML = `<a href="/login/${user}">${user}</a> / ${repo}`;
      document.getElementById('repo-description').textContent = repoData.description || '';

      const meta = [];
      if (repoData.language) meta.push(`<span>● ${repoData.language}</span>`);
      meta.push(`<span>★ ${repoData.stargazers_count}</span>`);
      meta.push(`<span>⑂ ${repoData.forks_count}</span>`);
      document.getElementById('repo-meta').innerHTML = meta.join('');

      document.getElementById('breadcrumb').innerHTML = `
        <a href="/login/${user}">${user}</a> / <strong>${repo}</strong>
      `;

      loadFiles(user, repo, '');
    } catch (err) {
      window.location.href = '/404.html';
    }
  }

  async function loadFiles(user, repo, path) {
    const url = `${API}/repos/${user}/${repo}/contents/${path}`;
    const files = await fetch(url).then(r => r.json());

    if (path) {
      currentPath = path.split('/');
    } else {
      currentPath = [];
    }

    const pathHtml = currentPath.length > 0?
      `<div class="file-item"><a href="#" data-path-back="true">..</a></div>` : '';

    const html = pathHtml + files.map(file => {
      if (file.type === 'dir') {
        return `<div class="file-item"><a href="#" data-path="${file.path}">📁 ${file.name}</a></div>`;
      }
      return `
        <div class="file-item">
          <a href="${file.html_url}" target="_blank" rel="noopener">📄 ${file.name}</a>
          <button class="download-btn" data-url="${file.download_url}" data-name="${file.name}">Download</button>
        </div>
      `;
    }).join('');

    document.getElementById('file-browser').innerHTML = `<div class="file-list">${html}</div>`;

    document.querySelectorAll('[data-path]').forEach(link => {
      link.addEventListener('click', e => {
        e.preventDefault();
        loadFiles(user, repo, e.target.dataset.path);
      });
    });

    document.querySelectorAll('[data-path-back]').forEach(link => {
      link.addEventListener('click', e => {
        e.preventDefault();
        const newPath = currentPath.slice(0, -1).join('/');
        loadFiles(user, repo, newPath);
      });
    });

    document.querySelectorAll('.download-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        const url = e.target.dataset.url;
        const name = e.target.dataset.name;
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        a.click();
      });
    });
  }

  initRepo();
}
