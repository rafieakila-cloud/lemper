// Lemper — Shorts dari Wikimedia Commons, CC/PD, tanpa konten dewasa/judi
const feed = document.getElementById('feed');
const emptyState = document.getElementById('emptyState');
const toastEl = document.getElementById('toast');

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
function accountKey(prefix) { return prefix + (currentUser() || 'anon'); }
function loadSet(key) { try { return new Set(JSON.parse(localStorage.getItem(key) || '[]')); } catch { return new Set(); } }
function saveSet(key, s) { localStorage.setItem(key, JSON.stringify([...s])); }
let likes = loadSet(accountKey(ACC_LIKES));
let saves = loadSet(accountKey(ACC_SAVES));

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
    gCreate.classList.add('hidden');
    gLogin.classList.remove('hidden');
    gateWelcome.textContent = (session() && session().name) || accounts[0].name;
    gatePinLogin.value = '';
  } else {
    gCreate.classList.remove('hidden');
    gLogin.classList.add('hidden');
    gateName.value = ''; gatePin.value = '';
  }
  gate.classList.remove('hidden');
}
function hideGate() { gate.classList.add('hidden'); }
function afterLogin(name) {
  setSession(name);
  likes = loadSet(ACC_LIKES + name);
  saves = loadSet(ACC_SAVES + name);
  hideGate();
  loadFeed(true);
}

btnCreate.addEventListener('click', () => {
  const name = gateName.value.trim();
  const pin = gatePin.value.trim();
  if (!name || name.length < 2) return showToast('nama terlalu pendek');
  if (!/^[0-9]{4}$/.test(pin)) return showToast('PIN harus 4 digit');
  const accounts = loadAccounts();
  if (accounts.find(a => a.name.toLowerCase() === name.toLowerCase())) return showToast('nama sudah dipakai');
  accounts.push({ name, pin, created: Date.now() });
  saveAccounts(accounts);
  afterLogin(name);
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
gateSwitch.addEventListener('click', () => { setSession(null); gLogin.classList.add('hidden'); gCreate.classList.remove('hidden'); gateName.value=''; gatePin.value=''; });
document.getElementById('btnAccount').addEventListener('click', () => { if (confirm('Keluar?')) { setSession(null); showGate(); } });

/* ============ FEED ============ */
const BLOCKED = /porn|porno|sex(ual)?|nud(i|e|ity)|xxx|hentai|erotic|casino|gamble|gambl|judi|bet(ting)?|rummy|poker|strip|inces|milf|fetish|bondage|fetish/i;
const DEFAULT_QUERY = 'cartoon animation';
const FALLBACKS = ['science animation','timelapse nature','AI animation','educational animation'];
let currentQuery = DEFAULT_QUERY;

let items = [];
const seen = new Set();
let continueToken = null;
let loading = false;
let activeIndex = -1;

async function fetchPage(query, cont) {
  const base = 'https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=filetype:video ' +
    encodeURIComponent(query) + '&gsrlimit=20&gsrnamespace=6&prop=videoinfo&viprop=url|size|width|height|duration|extmetadata&format=json&origin=*';
  const url = cont ? base + '&gsroffset=' + cont : base;
  const r = await fetch(url);
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const j = await r.json();
  const next = j.continue ? j.continue.gsroffset : null;
  const pages = j && j.query && j.query.pages ? Object.values(j.query.pages) : [];
  const out = pages.map(p => {
    const vi = (p.videoinfo && p.videoinfo[0]) || {};
    const meta = vi.extmetadata || {};
    const artist = stripHtml(meta.Artist ? meta.Artist.value : '') || 'Commons';
    const license = meta.LicenseShortName ? meta.LicenseShortName.value : 'CC';
    const licenseUrl = (meta.LicenseUrl && meta.LicenseUrl.value) || 'https://creativecommons.org';
    const descUrl = vi.descriptionurl || ('https://commons.wikimedia.org/wiki/' + encodeURIComponent(p.title || ''));
    return {
      title: (p.title || '').replace(/^File:/, ''),
      url: vi.url, duration: vi.duration || 999, size: vi.size || Infinity,
      artist, license, licenseUrl, descUrl
    };
  }).filter(v => v.url && v.duration <= 62 && v.size <= 60*1024*1024 && !seen.has(v.url) && /cc/i.test(v.license + '' + v.licenseUrl) && !BLOCKED.test(v.title));
  return { items: out, next };
}
function stripHtml(s) { const d = document.createElement('div'); d.innerHTML = s || ''; return d.textContent || ''; }
function escapeHtml(s) { return String(s || '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }
function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.remove('hidden');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toastEl.classList.add('hidden'), 2200);
}

async function loadFeed(reset) {
  if (loading) return;
  loading = true;
  if (reset) { items = []; seen.clear(); continueToken = null; activeIndex = -1; feed.innerHTML = ''; emptyState.classList.add('hidden'); }
  try {
    const { items: fresh, next } = await fetchPage(currentQuery, continueToken);
    fresh.forEach(v => seen.add(v.url));
    items = items.concat(fresh);
    continueToken = next;
    if (!items.length) { const i = FALLBACKS.indexOf(currentQuery); const nx = FALLBACKS[i+1] || FALLBACKS[0]; if (currentQuery !== nx) { currentQuery = nx; loading = false; return loadFeed(true); } emptyState.classList.remove('hidden'); loading = false; return; }
    appendSlides(items.length - fresh.length);
    loading = false;
  } catch (e) { showToast('gagal memuat: ' + e.message); loading = false; }
}

function appendSlides(from) {
  for (let i = from; i < items.length; i++) {
    const v = items[i];
    const slide = document.createElement('section');
    slide.className = 'slide'; slide.dataset.index = i;
    slide.innerHTML = `
      <video src="${escapeHtml(v.url)}" playsinline muted loop preload="metadata" webkit-playsinline></video>
      <div class="scrim"></div>
      <div class="caption">
        <h3>${escapeHtml(v.title)}</h3>
        <div class="byline">${escapeHtml(v.artist.slice(0, 60))} · <a href="${escapeHtml(v.descUrl)}" target="_blank" rel="noopener license">Commons</a></div>
        <a class="lic-pill" href="${escapeHtml(v.licenseUrl)}" target="_blank" rel="noopener license">${escapeHtml(v.license)}</a>
      </div>`;
    feed.appendChild(slide);
    const vid = slide.querySelector('video');
    vid.addEventListener('error', () => { slide.remove(); if (feed.children.length < 4 && continueToken) loadFeed(false); });
    io.observe(slide);
  }
  if (activeIndex === -1) activateSlide(0);
}

const io = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (e.isIntersecting && e.intersectionRatio > 0.6) activateSlide(+e.target.dataset.index);
    else { const v = e.target.querySelector('video'); if (v && !v.paused) v.pause(); }
  }
}, { root: feed, threshold: [0, 0.6] });

function activateSlide(i) {
  if (i === activeIndex) return;
  activeIndex = i;
  [...feed.children].forEach((s, j) => {
    const v = s.querySelector('video');
    if (j === i) v.play().catch(() => {}); else if (!v.paused) v.pause();
  });
  updateActionState();
  if (i >= items.length - 3 && continueToken) loadFeed(false);
}

/* ============ ACTIONS ============ */
const btnLike = document.getElementById('btnLike');
const btnSave = document.getElementById('btnSave');
const btnShare = document.getElementById('btnShare');
const likeCount = document.getElementById('likeCount');
const saveLabel = document.getElementById('saveLabel');
function currentUrl() { const s = feed.children[activeIndex]; return s ? s.querySelector('video').src : null; }
function updateActionState() {
  const url = currentUrl(); if (!url) return;
  btnLike.classList.toggle('active', likes.has(url));
  btnSave.classList.toggle('active', saves.has(url));
  likeCount.textContent = likes.has(url) ? '1' : '0';
  saveLabel.textContent = saves.has(url) ? 'Tersimpan' : 'Simpan';
}
btnLike.addEventListener('click', () => {
  const url = currentUrl(); if (!url) return;
  likes.has(url) ? likes.delete(url) : likes.add(url);
  saveSet(ACC_LIKES + (currentUser()||'anon'), likes); updateActionState(); showToast(likes.has(url) ? 'disukai' : 'batal suka');
});
btnSave.addEventListener('click', () => {
  const url = currentUrl(); if (!url) return;
  saves.has(url) ? saves.delete(url) : saves.add(url);
  saveSet(ACC_SAVES + (currentUser()||'anon'), saves); updateActionState(); showToast(saves.has(url) ? 'tersimpan' : 'batal simpan');
});
btnShare.addEventListener('click', async () => {
  const v = items[activeIndex]; if (!v) return;
  try { if (navigator.share) await navigator.share({ title: v.title, text: v.title + ' — via Lemper', url: v.descUrl }); else { await navigator.clipboard.writeText(v.descUrl); showToast('link disalin'); } } catch {}
});
document.getElementById('btnReload').addEventListener('click', () => loadFeed(true));
document.addEventListener('keydown', e => {
  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
  e.preventDefault();
  const t = Math.min(Math.max(activeIndex + (e.key === 'ArrowDown' ? 1 : -1), 0), feed.children.length - 1);
  feed.children[t].scrollIntoView({ behavior: 'smooth' });
});
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

/* start */
const u = session();
if (u && loadAccounts().find(a => a.name === u.name)) { likes = loadSet(ACC_LIKES + u.name); saves = loadSet(ACC_SAVES + u.name); hideGate(); loadFeed(true); }
else showGate();
