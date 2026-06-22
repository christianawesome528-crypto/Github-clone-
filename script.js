const API = 'https://api.github.com';
let currentUser = null;
let currentPath = [];

const loginView = document.getElementById('login-view');
const appView = document.getElementById('app-view');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const usernameInput = document.getElementById('username-input');
const loginError = document.getElementById('login-error');

// Login
loginBtn.addEventListener('click', login);
usernameInput.addEventListener('keypress', e => { if (e.key === 'Enter') login(); });

async function login() {
  const username = usernameInput.value.trim();
  if (!username) return;
  
  loginError.textContent = '';
  try {
    const res = await fetch(`${API}/users/${username}`);
    if (!res.ok) throw new Error('User not found');
    currentUser = await res.json();
    showApp();
    loadProfile();
  } catch (err) {
    loginError.textContent = 'Could not find that user';
  }
}

function showApp() {
  loginView.classList.remove('active');
  appView.classList.add('active');
}

logoutBtn.addEventListener('click', () => {
  currentUser = null;
  usernameInput.value = '';
  appView.classList.remove('active');
  loginView.classList.add('active');
});

// Load Profile
async function loadProfile() {
  // Sidebar
  document.getElementById('profile-avatar').src = currentUser.avatar_url;
  document.getElementById('profile-name').textContent = currentUser.name || currentUser.login;
  document.getElementById('profile-username').textContent = currentUser.login;
  document.getElementById('profile-bio').textContent = currentUser.bio || '';
  document.getElementById('followers-count').textContent = currentUser.followers;
  document.getElementById('following-count').textContent = currentUser.following;
  
  const details = [];
  if (currentUser.company) details.push(`<li>🏢 ${currentUser.company}</li>`);
  if (currentUser.location) details.push(`<li>📍 ${currentUser.location}</li>`);
  if (currentUser.blog) details.push(`<li>🔗 <a href="${currentUser.blog}">${currentUser.blog}</a></li>`);
  document.getElementById('profile-details').innerHTML = details.join('');
  
  // Tabs
  document.getElementById('repo-count').textContent = currentUser.public_repos;
  loadOverview();
  loadRepos();
}

// Tabs
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`${btn.dataset.tab}-tab`).classList.add('active');
  });
});

// Overview
async function loadOverview() {
  // Pinned repos - using most starred
  const repos = await fetch(`${API}/users/${currentUser.login}/repos?sort=stars&per_page=6`).then(r => r.json());
  const pinnedHtml = repos.map(repo => `
    <div class="repo-card">
      <h3><a href="#" data-repo="${repo.name}">${repo.name}</a></h3>
      <p>${repo.description || ''}</p>
      <div class="repo-meta">
        ${repo.language ? `<span>● ${repo.language}</span>` : ''}
        <span>★ ${repo.stargazers_count}</span>
      </div>
    </div>
  `).join('');
  document.getElementById('pinned-repos').innerHTML = pinnedHtml;
  
  document.getElementById('contrib-year').textContent = `Contributions in ${new Date().getFullYear()}`;
  document.getElementById('contrib-graph').innerHTML = '<p style="color:#57606a;">Contribution data requires authentication</p>';
  
  // Click handlers for repo links
  document.querySelectorAll('[data-repo]').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      openRepo(e.target.dataset.repo);
    });
  });
}

// Repositories
let allRepos = [];
async function loadRepos() {
  allRepos = await fetch(`${API}/users/${currentUser.login}/repos?per_page=100&sort=updated`).then(r => r.json());
  renderRepos(allRepos);
}

function renderRepos(repos) {
  const html = repos.map(repo => `
    <div class="repo-item">
      <h3><a href="#" data-repo="${repo.name}">${repo.name}</a></h3>
      <p>${repo.description || ''}</p>
      <div class="repo-meta">
        ${repo.language ? `<span>● ${repo.language}</span>` : ''}
        <span>★ ${repo.stargazers_count}</span>
        <span>Updated ${new Date(repo.updated_at).toLocaleDateString()}</span>
      </div>
    </div>
  `).join('');
  document.getElementById('repo-list').innerHTML = html;
  
  document.querySelectorAll('#repo-list [data-repo]').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      openRepo(e.target.dataset.repo);
    });
  });
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

// Repo View
async function openRepo(repoName) {
  currentPath = [];
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.getElementById('repo-view').classList.add('active');
  document.getElementById('repo-view-name').textContent = `${currentUser.login} / ${repoName}`;
  loadFiles(repoName, '');
}

async function loadFiles(repoName, path) {
  const url = `${API}/repos/${currentUser.login}/${repoName}/contents/${path}`;
  const files = await fetch(url).then(r => r.json());
  
  const html = files.map(file => {
    if (file.type === 'dir') {
      return `<div class="file-item"><a href="#" data-path="${file.path}" data-repo="${repoName}">📁 ${file.name}</a></div>`;
    }
    return `
      <div class="file-item">
        <a href="${file.html_url}" target="_blank">📄 ${file.name}</a>
        <button class="download-btn" data-url="${file.download_url}" data-name="${file.name}">Download</button>
      </div>
    `;
  }).join('');
  
  document.getElementById('file-browser').innerHTML = `<div class="file-list">${html}</div>`;
  
  // Folder click
  document.querySelectorAll('[data-path]').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      loadFiles(e.target.dataset.repo, e.target.dataset.path);
    });
  });
  
  // Download click
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

document.getElementById('back-to-profile').addEventListener('click', () => {
  document.getElementById('repo-view').classList.remove('active');
  document.getElementById('overview-tab').classList.add('active');
  document.querySelector('[data-tab="overview"]').classList.add('active');
});
