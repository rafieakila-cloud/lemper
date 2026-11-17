// Lemper — video teknologi/AI/coding/sains dari Internet Archive (CC/PD)
const feed = document.getElementById('feed');
const emptyState = document.getElementById('emptyState');
const toastEl = document.getElementById('toast');
const playerPage = document.getElementById('playerPage');
const playerFrame = document.getElementById('playerFrame');
const playerTitle = document.getElementById('playerTitle');
const pTitle = document.getElementById('pTitle');
const pLicense = document.getElementById('pLicense');
const pCreator = document.getElementById('pCreator');
const pSource = document.getElementById('pSource');
const pDesc = document.getElementById('pDesc');

/* ============ ACCOUNT (lokal per perangkat) ============ */
const ACCOUNTS_KEY = 'lemper-accounts';
const SESSION_KEY = 'lemper-session';
const ACC_LIKES = 'lemper-likes-';
const ACC_SAVES = 'lemper-saves-';

function loadAccounts() { try { return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '[]'); } catch { return []; } }
function saveAccounts(list) { localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(list)); }
function session() { try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch { return null; } }
function setSession(name) { name ? localStorage.setItem(SESSION_KEY, JSON.stringify({ name })) : localStorage.removeItem(SESSION_KEY); }
function currentUser() { const s = session(); return s ? s.name : null; }
function accountKey(p) { return p + (currentUser() || 'anon'); }
function loadSet(key) { try { return new Set(JSON.parse(localStorage.getItem(key) || '[]')); } catch { return new Set(); } }
function saveSet(key, s) { localStorage.setItem(key, JSON.stringify([...s])); }
let likes = loadSet(accountKey(ACC_LIKES)), saves = loadSet(accountKey(ACC_SAVES));

const gate = document.getElementById('accountGate');
const gCreate = document.getElementById('gateStepCreate');
const gLogin = document.getElementById('gateStepLogin');
const gateName = document.getElementById('gateName');
const gatePin = document.getElementById('gatePin');
const gatePinLogin = document.getElementById('gatePinLogin');
const btnCreate = document.getElementById('gateCreateBtn');
const btnLogin = document.getElementById('gateLoginBtn');
const gateSwitch = document.getElementById('gateSwitchBtn');
const gateWelcome = document.getElementById('gateWelcomeName');

function showGate() {
  const accounts = loadAccounts();
  if (accounts.length) {
    gCreate.classList.add('hidden'); gLogin.classList.remove('hidden');
    gateWelcome.textContent = (session() && session().name) || accounts[0].name;
    gatePinLogin.value = '';
  } else {
    gCreate.classList.remove('hidden'); gLogin.classList.add('hidden');
    gateName.value = ''; gatePin.value = '';
  }
  gate.classList.remove('hidden');
}
function hideGate() { gate.classList.add('hidden'); }
function afterLogin(name) {
  setSession(name);
  likes = loadSet(ACC_LIKES + name); saves = loadSet(ACC_SAVES + name);
  hideGate();
  loadFeed(true);
}
gate.classList.add('gate');
btnCreate.addEventListener('click', () => {
  const name = gateName.value.trim(), pin = gatePin.value.trim();
  if (!name || name.length < 2) return showToast('nama terlalu pendek');
  if (!/^[0-9]{4}$/.test(pin)) return showToast('PIN harus 4 digit');
  const accounts = loadAccounts();
  if (accounts.find(a => a.name.toLowerCase() === name.toLowerCase())) return showToast('nama sudah dipakai');
  accounts.push({ name, pin, created: Date.now() });
  saveAccounts(accounts); afterLogin(name);
});
btnLogin.addEventListener('click', () => {
  const accounts = loadAccounts();
  const name = (session() && session().name) || (accounts[0] && accounts[0].name);
  const pin = gatePinLogin.value.trim();
  const acc = accounts.find(a => a.name === name);
  if (!acc) return showToast('akun tidak ditemukan');
  if (acc.pin !== pin) return showToast('PIN salah');
  afterLogin(name);
});
gateSwitch.addEventListener('click', () => { setSession(null); gLogin.classList.add('hidden'); gCreate.classList.remove('hidden'); });
document.getElementById('btnAccount').addEventListener('click', () => { if (confirm('Keluar?')) { setSession(null); showGate(); } });
document.getElementById('btnBack').addEventListener('click', closePlayer);
document.getElementById('btnReport').addEventListener('click', () => showToast('Terima kasih — ditandai untuk ditinjau'));

/* ============ FEED (Internet Archive) ============ */
const BLOCKED = /porn|porno|sex(ual)?|nud(e|ity)|xxx|hentai|erotic|casino|gamble|gambl|judi|bet(ting)?|strip|nude|wtf|drugs?/i;
let currentQuery = 'software';
let continuePage = 1;
const PAGE_SIZE = 12;
let loading = false;

async function queryArchive(q, page) {
  const subjectFilter = '(subject:software OR subject:technology OR subject:programming OR subject:computer OR subject:electronics OR subject:ai OR subject:"artificial intelligence" OR subject:"machine learning" OR subject:science OR subject:physics)';
  const search = q.trim()
    ? '(' + q.trim() + ') AND ' + subjectFilter
    : subjectFilter;
  const url =
    'https://archive.org/advancedsearch.php?' +
    'q=(' + encodeURIComponent(search) + ')+AND+mediatype%3Amovies+AND+licenseurl%3A%2A' +
    '&fl[]=identifier,title,creator,licenseurl,medianame,publicdate,description' +
    '&sort[]=downloads+desc&rows=' + PAGE_SIZE + '&page=' + (page || 1) +
    '&output=json';
  const r = await fetch(url);
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const j = await r.json();
  const docs = (j.response && j.response.docs) || [];
  return docs.map(d => ({
    identifier: d.identifier,
    title: d.title || 'Tanpa judul',
    creator: (d.creator && (Array.isArray(d.creator) ? d.creator[0] : d.creator)) || 'archive.org',
    licenseurl: d.licenseurl || 'https://archive.org/about/terms',
    description: (d.description && (Array.isArray(d.description) ? d.description[0] : d.description)) || ''
  })).filter(d => !BLOCKED.test(d.title + ' ' + d.description));
}
function thumbUrl(id) { return 'https://archive.org/services/img/' + encodeURIComponent(id); }
function embedUrl(id) { return 'https://archive.org/embed/' + encodeURIComponent(id) + '?autoplay=1&mute=1'; }
function sourceUrl(id) { return 'https://archive.org/details/' + encodeURIComponent(id); }

function renderCards(items) {
  feed.innerHTML = items.map(it => `
    <article class="card" data-id="${escapeHtml(it.identifier)}">
      <img class="thumb" src="${escapeHtml(thumbUrl(it.identifier))}" alt="${escapeHtml(it.title)}" loading="lazy" onerror="this.style.visibility='hidden'">
      <div class="card-info">
        <div class="card-title">${escapeHtml(it.title)}</div>
        <div class="card-creator">${escapeHtml(it.creator)}</div>
        <div class="card-meta"><span class="lic-pill">${escapeHtml(shortLicense(it.licenseurl))}</span></div>
      </div>
    </article>`).join('');
  feed.querySelectorAll('.card').forEach(c => c.addEventListener('click', () => openPlayer(c.dataset.id, items)));
}
function shortLicense(url) {
  if (/creativecommons\.org\/licenses\/by-sa/i.test(url)) return 'CC BY-SA';
  if (/creativecommons\.org\/licenses\/by\//i.test(url))  return 'CC BY';
  if (/creativecommons\.org\/licenses\/by-nc/i.test(url)) return 'CC BY-NC';
  if (/creativecommons\.org\/licenses\/zero|creativecommons\.org\/publicdomain/i.test(url)) return 'PD / CC0';
  if (/fsf\.org|gnu\.org/i.test(url)) return 'Copyleft';
  return 'Lihat lisensi';
}
function escapeHtml(s) { return String(s || '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }
function stripHtml(s) { const d = document.createElement('div'); d.innerHTML = s || ''; return d.textContent || ''; }

function showToast(msg) {
  toastEl.textContent = msg; toastEl.classList.remove('hidden');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toastEl.classList.add('hidden'), 2200);
}
function showEmpty() { emptyState.classList.remove('hidden'); }
function hideEmpty() { emptyState.classList.add('hidden'); }

async function loadFeed(reset) {
  if (loading) return;
  loading = true;
  if (reset) { continuePage = 1; feed.innerHTML = ''; hideEmpty(); }
  try {
    const items = await queryArchive(currentQuery, continuePage);
    if (!items.length) { showEmpty(); loading = false; return; }
    if (continuePage === 1) feed.innerHTML = '';
    const html = items.map(it => cardHTML(it)).join('');
    feed.insertAdjacentHTML('beforeend', html);
    feed.querySelectorAll('.card').forEach(c => c.addEventListener('click', () => openPlayer(c.dataset.id, items)));
    continuePage++;
    loading = false;
  } catch (e) { showToast('gagal memuat: ' + e.message); loading = false; }
}
function cardHTML(it) {
  return `<article class="card" data-id="${escapeHtml(it.identifier)}">
    <img class="thumb" src="${escapeHtml(thumbUrl(it.identifier))}" alt="${escapeHtml(it.title)}" loading="lazy" onerror="this.style.visibility='hidden'">
    <div class="card-info">
      <div class="card-title">${escapeHtml(it.title)}</div>
      <div class="card-creator">${escapeHtml(it.creator)}</div>
      <div class="card-meta"><span class="lic-pill">${escapeHtml(shortLicense(it.licenseurl))}</span></div>
    </div>
  </article>`;
}
async function openPlayer(id, items) {
  const it = items ? items.find(x => x.identifier === id) : null;
  if (!it) return;
  playerPage.classList.remove('hidden');
  playerTitle.textContent = it.title;
  pTitle.textContent = it.title;
  pCreator.textContent = 'oleh ' + it.creator;
  pLicense.textContent = shortLicense(it.licenseurl);
  pSource.href = it.licenseurl;
  pDesc.textContent = stripHtml(it.description).slice(0, 1200);
  playerFrame.src = embedUrl(id);
}
function closePlayer() { playerPage.classList.add('hidden'); playerFrame.src = ''; }

/* ============ INPUT BAR / CHIPS ============ */
const q = document.getElementById('q');
const chips = document.querySelectorAll('.chip');
document.getElementById('searchForm').addEventListener('submit', e => {
  e.preventDefault();
  currentQuery = q.value.trim() || 'software';
  chips.forEach(c => c.classList.remove('active'));
  loadFeed(true);
});
chips.forEach(c => c.addEventListener('click', () => {
  currentQuery = c.dataset.q; q.value = c.dataset.q;
  chips.forEach(x => x.classList.toggle('active', x === c));
  loadFeed(true);
}));

/* infinite scroll */
feed.addEventListener('scroll', () => {
  if (feed.scrollTop + feed.clientHeight > feed.scrollHeight - 300) loadFeed(false);
});

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

/* start */
const u = session();
if (u && loadAccounts().find(a => a.name === u.name)) { likes = loadSet(ACC_LIKES + u.name); saves = loadSet(ACC_SAVES + u.name); hideGate(); loadFeed(true); }
else showGate();
