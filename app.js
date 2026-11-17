// Lemper — YouTube-style tech/AI/science from 3 legal sources:
// Internet Archive (CC) · Wikimedia Commons (CC) · NASA (Public Domain)
const feed = document.getElementById('feed');
const emptyState = document.getElementById('emptyState');
const toastEl = document.getElementById('toast');

/* ============ ACCOUNT ============ */
const ACCOUNTS_KEY = 'lemper-accounts';
const SESSION_KEY = 'lemper-session';
const ACC_LIKES = 'lemper-likes-';
const ACC_SAVES = 'lemper-saves-';
const ACC_DISLIKES = 'lemper-dislikes-';
function loadAccounts() { try { return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '[]'); } catch { return []; } }
function saveAccounts(list) { localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(list)); }
function sessionUser() { try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch { return null; } }
function setSession(name) { name ? localStorage.setItem(SESSION_KEY, JSON.stringify({ name })) : localStorage.removeItem(SESSION_KEY); }
function currentUser() { const s = sessionUser(); return s ? s.name : null; }
function loadSet(key) { try { return new Set(JSON.parse(localStorage.getItem(key) || '[]')); } catch { return new Set(); } }
function saveSet(key, s) { localStorage.setItem(key, JSON.stringify([...s])); }
const userKey = p => p + (currentUser() || 'anon');
let likes = loadSet(userKey(ACC_LIKES)), saves = loadSet(userKey(ACC_SAVES)), dislikes = loadSet(userKey(ACC_DISLIKES));
function persistAll() { const u = currentUser(); if (!u) return;
  saveSet(ACC_LIKES + u, likes); saveSet(ACC_SAVES + u, saves); saveSet(ACC_DISLIKES + u, dislikes);
}
function baseLike(id) { let h = 0; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0; return h % 400; }

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
    gateWelcome.textContent = (sessionUser() && sessionUser().name) || accounts[0].name;
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
  likes = loadSet(ACC_LIKES + name); saves = loadSet(ACC_SAVES + name); dislikes = loadSet(ACC_DISLIKES + name);
  hideGate(); loadFeed(true);
}
btnCreate.addEventListener('click', () => {
  const name = gateName.value.trim(), pin = gatePin.value.trim();
  if (!name || name.length < 2) return showToast('nama terlalu pendek');
  if (!/^[0-9]{4}$/.test(pin)) return showToast('PIN harus 4 digit');
  const accounts = loadAccounts();
  if (accounts.find(a => a.name.toLowerCase() === name.toLowerCase())) return showToast('nama sudah dipakai');
  accounts.push({ name, pin, created: Date.now() }); saveAccounts(accounts); afterLogin(name);
});
btnLogin.addEventListener('click', () => {
  const accounts = loadAccounts();
  const name = (sessionUser() && sessionUser().name) || (accounts[0] && accounts[0].name);
  const pin = gatePinLogin.value.trim();
  const acc = accounts.find(a => a.name === name);
  if (!acc) return showToast('akun tidak ditemukan');
  if (acc.pin !== pin) return showToast('PIN salah');
  afterLogin(name);
});
gateSwitch.addEventListener('click', () => { setSession(null); gLogin.classList.add('hidden'); gCreate.classList.remove('hidden'); });

const btnAccount = document.getElementById('btnAccount');
const btnAbout = document.getElementById('btnAbout');
const btnCloseAbout = document.getElementById('btnCloseAbout');
const aboutPanel = document.getElementById('aboutPanel');
const btnBack = document.getElementById('btnBack');

btnAccount.addEventListener('click', () => { if (confirm('Keluar?')) { setSession(null); showGate(); } });
btnAbout.addEventListener('click', () => aboutPanel.classList.remove('hidden'));
btnCloseAbout.addEventListener('click', () => aboutPanel.classList.add('hidden'));

/* ============ SOURCES ============ */
const BLOCKED = /porn|porno|sex(ual)?|nud(e|ity)|xxx|hentai|erotic|casino|gamble|gambl|judi|bet(ting)?|strip|nude|fetish|bondage|drugs?|alcohol/i;
function stripHtml(s) { const d = document.createElement('div'); d.innerHTML = s || ''; return d.textContent || ''; }
function shortLicense(url, raw) {
  if (/publicdomain|cc0/i.test(url + raw)) return 'PD / CC0';
  if (/by-sa/i.test(url + raw)) return 'CC BY-SA';
  if (/licenses\/by(?!-)/i.test(url + raw)) return 'CC BY';
  if (/by-nc-sa/i.test(url + raw)) return 'CC BY-NC-SA';
  if (/by-nc/i.test(url + raw)) return 'CC BY-NC';
  if (/copyleft|gnu/i.test(url + raw)) return 'Copyleft';
  return 'External record';
}
function filtered(arr) { return arr.filter(v => v.title && !BLOCKED.test(v.title + ' ' + (v.description||''))); }

const SOURCE_META = {
  commons: { name: 'Wikimedia Commons', label: 'Commons' },
  archive: { name: 'Internet Archive',  label: 'Archive.org' },
  nasa:    { name: 'NASA (Public Domain)', label: 'NASA' }
};

async function searchCommons(query) {
  const url = 'https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=filetype:video ' + encodeURIComponent(query) + '&gsrlimit=8&gsrnamespace=6&prop=videoinfo&viprop=url|size|width|height|duration|extmetadata&format=json&origin=*';
  const r = await fetch(url);
  if (!r.ok) throw new Error('Commons HTTP ' + r.status);
  const j = await r.json();
  const pages = j.query && j.query.pages ? Object.values(j.query.pages) : [];
  return pages.map(p => {
    const vi = (p.videoinfo && p.videoinfo[0]) || {};
    const meta = vi.extmetadata || {};
    const artist = stripHtml(meta.Artist ? meta.Artist.value : '') || 'Commons';
    const license = meta.LicenseShortName ? meta.LicenseShortName.value : 'CC';
    const licenseUrl = (meta.LicenseUrl && meta.LicenseUrl.value) || 'https://creativecommons.org';
    return {
      id: 'commons:' + p.title,
      source: 'commons',
      sourceName: SOURCE_META.commons.name,
      title: (p.title || '').replace(/^File:/, ''),
      creator: artist.slice(0, 60),
      licenseShort: license.toUpperCase().slice(0, 16),
      licenseUrl,
      description: stripHtml(meta.ImageDescription ? meta.ImageDescription.value : '') || '',
      thumb: (vi.url ? ('https://commons.wikimedia.org/w/index.php?title=Special:FilePath/' + encodeURIComponent((p.title||'').replace(/^File:/,'')) + '&width=480') : ''),
      videoUrl: vi.url,
      duration: vi.duration
    };
  }).filter(v => v.videoUrl);
}

async function searchArchive(query, page) {
  const subjectFilter = '(subject:software OR subject:technology OR subject:programming OR subject:computer OR subject:electronics OR subject:"artificial intelligence" OR subject:"machine learning" OR subject:science OR subject:physics)';
  const q = query ? '(' + query + ') AND ' + subjectFilter : subjectFilter;
  const url = 'https://archive.org/advancedsearch.php?q=(' + encodeURIComponent(q) + ')+AND+mediatype%3Amovies+AND+licenseurl%3A%2A'
    + '&fl[]=identifier,title,creator,licenseurl,description&rows=10&page=' + (page || 1) + '&output=json';
  const r = await fetch(url);
  if (!r.ok) throw new Error('Archive HTTP ' + r.status);
  const j = await r.json();
  const docs = (j.response && j.response.docs) || [];
  return docs.map(d => ({
    id: 'archive:' + d.identifier,
    source: 'archive',
    sourceName: SOURCE_META.archive.name,
    title: d.title || 'Tanpa judul',
    creator: (Array.isArray(d.creator) ? d.creator[0] : d.creator) || 'archive.org',
    licenseShort: shortLicense(d.licenseurl, ''),
    licenseUrl: d.licenseurl || 'https://archive.org/about/terms',
    description: stripHtml(Array.isArray(d.description) ? d.description[0] : (d.description || '')),
    thumb: 'https://archive.org/services/img/' + encodeURIComponent(d.identifier),
    embed: 'archive://' + d.identifier,
    duration: null
  }));
}

async function searchNasa(query) {
  const url = 'https://images-api.nasa.gov/search?q=' + encodeURIComponent(query) + '&media_type=video&page_size=8';
  const r = await fetch(url);
  if (!r.ok) throw new Error('NASA HTTP ' + r.status);
  const j = await r.json();
  const items = (j.collection && j.collection.items) || [];
  return items.map(it => {
    const d = (it.data && it.data[0]) || {};
    const links = it.links || [];
    const thumb = links.find(l => l.rel === 'preview') || links.find(l => l.render === 'image') || {};
    return {
      id: 'nasa:' + (d.nasa_id || ''),
      source: 'nasa',
      sourceName: SOURCE_META.nasa.name,
      title: d.title || 'Tanpa judul',
      creator: d.center || 'NASA',
      licenseShort: 'PUBLIC DOMAIN',
      licenseUrl: 'https://www.nasa.gov/about/highlights/media_usage_guidelines.html',
      description: stripHtml(d.description || ''),
      thumb: thumb.href || '',
      nasaId: d.nasa_id,
      duration: null
    };
  }).filter(v => v.nasaId);
}

/* ============ FEED ============ */
let items = [], currentQuery = 'artificial intelligence', currentPage = 1, loading = false;
const PAGE_SIZE = 18;

async function queryAll(q, page) {
  const [a, b, c] = await Promise.allSettled([searchArchive(q, page), searchCommons(q), searchNasa(q)]);
  const commons = a.status === 'fulfilled' ? a.value : [];
  const archive = b.status === 'fulfilled' ? b.value : [];
  const nasa = c.status === 'fulfilled' ? c.value : [];
  return filtered([...archive, ...commons, ...nasa]).slice(0, PAGE_SIZE);
}
async function loadFeed(reset) {
  if (loading) return;
  loading = true;
  if (reset) { currentPage = 1; items = []; feed.innerHTML = ''; }
  try {
    const fresh = await queryAll(currentQuery, currentPage);
    if (!fresh.length) { if (currentPage === 1) showEmpty(); loading = false; return; }
    emptyState.classList.add('hidden');
    items = items.concat(fresh);
    appendCards(items.length - fresh.length);
    currentPage++;
    loading = false;
  } catch (e) { showToast('gagal memuat: ' + e.message); loading = false; }
}
function cardHTML(v) {
  const id = escapeHtml(v.id);
  const thumb = v.thumb ? `<img class="thumb" src="${escapeHtml(v.thumb)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">` : '<div class="thumb" style="display:flex;align-items:center;justify-content:center;color:#555">video</div>';
  return `<article class="card" data-id="${id}">${thumb}
    <div class="card-info">
      <div class="card-title">${escapeHtml(v.title)}</div>
      <div class="card-creator">${escapeHtml(v.creator)} · <i>${escapeHtml(v.sourceName)}</i></div>
      <div class="card-meta"><span class="lic-pill">${escapeHtml(v.licenseShort)}</span></div>
    </div>
  </article>`;
}
function appendCards(from) {
  feed.insertAdjacentHTML('beforeend', items.slice(from).map(cardHTML).join(''));
  feed.querySelectorAll('.card').forEach(c => c.addEventListener('click', () => openPlayer(c.dataset.id)));
}
function showEmpty() { emptyState.classList.remove('hidden'); }

/* ============ PLAYER ============ */
const playerPage = document.getElementById('playerPage');
const playerFrame = document.getElementById('playerFrame');
const playerTitle = document.getElementById('playerTitle');
const pTitle = document.getElementById('pTitle');
const pCreator = document.getElementById('pCreator');
const pLicense = document.getElementById('pLicense');
const pSource = document.getElementById('pSource');
const pDesc = document.getElementById('pDesc');
const btnLike = document.getElementById('btnLike');
const btnDislike = document.getElementById('btnDislike');
const btnShareVideo = document.getElementById('btnShareVideo');
const btnSaveVideo = document.getElementById('btnSaveVideo');
const likeLabel = document.getElementById('likeLabel');
const saveLabel = document.getElementById('saveLabel');
let currentVideoId = null;

async function openPlayer(id) {
  const v = items.find(x => x.id === id);
  if (!v) return;
  currentVideoId = id;
  playerPage.classList.remove('hidden');
  playerTitle.textContent = v.title;
  pTitle.textContent = v.title;
  pCreator.textContent = 'oleh ' + v.creator;
  pLicense.textContent = v.licenseShort;
  pLicense.href = v.licenseUrl;
  pSource.href = v.licenseUrl;
  pDesc.textContent = v.description.slice(0, 1500) || '(tanpa deskripsi)';
  btnLike.classList.toggle('active', likes.has(id));
  btnDislike.classList.toggle('active', dislikes.has(id));
  btnSaveVideo.classList.toggle('saved', saves.has(id));
  likeLabel.textContent = likes.has(id) ? 'Suka' : 'Suka';
  saveLabel.textContent = saves.has(id) ? 'Tersimpan' : 'Simpan';
  // src choice
  if (v.source === 'commons') {
    const frame = document.createElement('video');
    frame.id = 'pVideo'; frame.controls = true; frame.autoplay = true; frame.playsInline = true;
    frame.poster = v.thumb || '';
    frame.style.cssText = 'width:100%;height:100%;background:#000;';
    frame.src = v.videoUrl;
    playerFrame.replaceWith(frame);
    playerFrame = frame;
  } else if (v.source === 'nasa') {
    try {
      const r = await fetch('https://images-api.nasa.gov/asset/' + encodeURIComponent(v.nasaId));
      const cj = await r.json();
      const files = (cj.collection && cj.collection.items) || [];
      const mp4 = files.find(f => /\.mp4$/i.test((f.href || '')));
      const frame = document.createElement('video');
      frame.id = 'pVideo'; frame.controls = true; frame.autoplay = true; frame.playsInline = true;
      frame.style.cssText = 'width:100%;height:100%;background:#000;';
      frame.src = mp4 ? mp4.href : '';
      frame.poster = v.thumb || '';
      playerFrame.replaceWith(frame);
      playerFrame = frame;
    } catch (e) { showToast('NASA aset tidak bisa dimuat'); }
  } else {
    const iframe = document.createElement('iframe');
    iframe.id = 'playerFrame'; iframe.src = 'https://archive.org/embed/' + encodeURIComponent(v.id.split(':')[1]) + '?autoplay=1';
    iframe.allow = 'autoplay; fullscreen'; iframe.allowFullscreen = true;
    iframe.style.cssText = 'width:100%;height:100%;border:0;';
    playerFrame.replaceWith(iframe);
    playerFrame = iframe;
  }
}
function closePlayer() { playerPage.classList.add('hidden'); const v = document.getElementById('pVideo'); if (v) v.pause(); }
btnBack.addEventListener('click', closePlayer);
document.getElementById('btnReport').addEventListener('click', () => showToast('ditandai untuk ditinjau'));

btnLike.addEventListener('click', () => {
  if (!currentVideoId) return;
  if (likes.has(currentVideoId)) { likes.delete(currentVideoId); } else { likes.add(currentVideoId); dislikes.delete(currentVideoId); }
  persistAll(); openPlayer(currentVideoId); showToast(likes.has(currentVideoId) ? 'disukai' : 'batal suka');
});
btnDislike.addEventListener('click', () => {
  if (!currentVideoId) return;
  if (dislikes.has(currentVideoId)) dislikes.delete(currentVideoId); else { dislikes.add(currentVideoId); likes.delete(currentVideoId); }
  persistAll(); openPlayer(currentVideoId); showToast(dislikes.has(currentVideoId) ? 'tidak suka' : 'batal');
});
btnShareVideo.addEventListener('click', async () => {
  if (!currentVideoId) return;
  const v = items.find(x => x.id === currentVideoId);
  try { if (navigator.share) await navigator.share({ title: v.title, url: window.location.href }); else { await navigator.clipboard.writeText(window.location.href); showToast('link disalin'); } } catch {}
});
btnSaveVideo.addEventListener('click', () => {
  if (!currentVideoId) return;
  if (saves.has(currentVideoId)) saves.delete(currentVideoId); else saves.add(currentVideoId);
  persistAll(); openPlayer(currentVideoId); showToast(saves.has(currentVideoId) ? 'tersimpan' : 'batal simpan');
});

/* ============ CONTROLS ============ */
const q = document.getElementById('q');
const chips = document.querySelectorAll('.chip');
document.getElementById('searchForm').addEventListener('submit', e => {
  e.preventDefault();
  currentQuery = q.value.trim() || 'artificial intelligence';
  chips.forEach(c => c.classList.remove('active'));
  loadFeed(true);
});
chips.forEach(c => c.addEventListener('click', () => {
  currentQuery = c.dataset.q; q.value = c.dataset.q;
  chips.forEach(x => x.classList.toggle('active', x === c));
  loadFeed(true);
}));
feed.addEventListener('scroll', () => { if (feed.scrollTop + feed.clientHeight > feed.scrollHeight - 300) loadFeed(false); });

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
const u = sessionUser();
if (u && loadAccounts().find(a => a.name === u.name)) { likes = loadSet(ACC_LIKES + u.name); saves = loadSet(ACC_SAVES + u.name); dislikes = loadSet(ACC_DISLIKES + u.name); hideGate(); loadFeed(true); }
else showGate();
