'use strict';

const $ = (s) => document.querySelector(s);
const KINDS = {
  all: 'Tout', texte: 'Textes', lien: 'Liens', image: 'Images',
  video: 'Vidéos', audio: 'Audios', doc: 'Documents',
};

let items = [];
const state = { q: '', kind: 'all', tag: null };
let objectUrls = [];
let editing = null; // { item, isNew }

/* ---------- Utilitaires ---------- */

function el(tag, props = {}, ...children) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    n.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return n;
}

const norm = (s) => (s || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
const blobUrl = (b) => { const u = URL.createObjectURL(b); objectUrls.push(u); return u; };
const dateFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const fmtSize = (n) => n < 1024 ? n + ' o' : n < 1048576 ? Math.round(n / 1024) + ' Ko' : (n / 1048576).toFixed(1) + ' Mo';
const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } };
const parseTags = (s) => [...new Set(
  (s || '').split(/[,\s]+/).map((t) => t.replace(/^#/, '').trim().toLowerCase()).filter(Boolean)
)];
const searchText = (i) => [i.title, i.text, i.url, i.note, i.tags.map((t) => '#' + t).join(' '), i.files.map((f) => f.name).join(' ')].join(' ');

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 2600);
}

/* ---------- Données ---------- */

async function load() {
  items = (await dbAll()).map((i) => ({ tags: [], files: [], ...i }));
  items.sort((a, b) => (Number(!!b.pinned) - Number(!!a.pinned)) || (b.createdAt - a.createdAt));
  render();
  updateStorageInfo();
}

async function updateStorageInfo() {
  if (!navigator.storage?.estimate) return;
  const { usage = 0 } = await navigator.storage.estimate();
  $('#storage-info').textContent = `${items.length} élément(s) · ${fmtSize(usage)} utilisés sur ce téléphone`;
}

/* ---------- Rendu de la liste ---------- */

function chip(label, active, onClick) {
  return el('button', { type: 'button', class: 'chip' + (active ? ' active' : ''), onclick: onClick }, label);
}

function render() {
  objectUrls.forEach((u) => URL.revokeObjectURL(u));
  objectUrls = [];

  const present = new Set(items.map((i) => i.kind));
  const kinds = Object.entries(KINDS).filter(([k]) => k === 'all' || present.has(k));
  $('#kinds').replaceChildren(...(items.length ? kinds : []).map(([k, label]) =>
    chip(label, state.kind === k, () => { state.kind = k; render(); })));

  const counts = {};
  items.forEach((i) => i.tags.forEach((t) => { counts[t] = (counts[t] || 0) + 1; }));
  if (state.tag && !counts[state.tag]) state.tag = null;
  const tags = Object.keys(counts).sort((a, b) => a.localeCompare(b, 'fr'));
  $('#tags').replaceChildren(...tags.map((t) =>
    chip(['#' + t, el('span', { class: 'n' }, counts[t])], state.tag === t,
      () => { state.tag = state.tag === t ? null : t; render(); })));

  const q = norm(state.q.trim());
  const list = items.filter((i) =>
    (state.kind === 'all' || i.kind === state.kind) &&
    (!state.tag || i.tags.includes(state.tag)) &&
    (!q || norm(searchText(i)).includes(q)));

  $('#list').replaceChildren(...list.map(card));
  $('#empty').hidden = items.length > 0;
  $('#noresult').hidden = !(items.length > 0 && list.length === 0);
  $('#count').textContent = !items.length ? '' :
    list.length === items.length ? `${items.length} élément${items.length > 1 ? 's' : ''}` :
    `${list.length} sur ${items.length}`;
}

function mediaFor(f) {
  const type = f.type || '';
  if (type.startsWith('image/')) return el('img', { src: blobUrl(f.blob), alt: f.name, loading: 'lazy', class: 'media' });
  if (type.startsWith('video/')) return el('video', { src: blobUrl(f.blob), controls: true, preload: 'metadata', playsinline: true, class: 'media' });
  if (type.startsWith('audio/')) return el('audio', { src: blobUrl(f.blob), controls: true, class: 'audio' });
  return el('a', { href: blobUrl(f.blob), download: f.name, class: 'file' },
    '📄 ', f.name, el('span', { class: 'muted small' }, ' · ' + fmtSize(f.size)));
}

function card(i) {
  return el('article', {
    class: 'card' + (i.pinned ? ' pinned' : ''),
    onclick: (e) => { if (!e.target.closest('a, video, audio, button')) openEditor(i); },
  },
    el('div', { class: 'meta' },
      el('span', { class: 'kind' }, KINDS[i.kind] || i.kind),
      el('span', {}, dateFmt.format(i.createdAt)),
      i.pinned ? el('span', { class: 'pin' }, '📌') : null),
    i.files.length ? el('div', { class: 'medias' }, i.files.map(mediaFor)) : null,
    i.title ? el('div', { class: 'title' }, i.title) : null,
    i.text ? el('div', { class: 'text' }, i.text) : null,
    i.url ? el('a', { href: i.url, target: '_blank', rel: 'noopener', class: 'url' }, hostOf(i.url)) : null,
    i.note ? el('div', { class: 'note' }, i.note) : null,
    i.tags.length ? el('div', { class: 'chips small-chips' }, i.tags.map((t) =>
      chip('#' + t, state.tag === t, () => {
        state.tag = state.tag === t ? null : t;
        render();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }))) : null,
  );
}

/* ---------- Éditeur ---------- */

const editor = $('#editor');

function openEditor(item, isNew = false) {
  editing = { item, isNew };
  $('#ed-title').textContent = isNew ? 'Nouvel élément' : 'Classer';
  $('#ed-text').value = item.text || '';
  $('#ed-url').value = item.url || '';
  $('#ed-tags').value = item.tags.join(', ');
  $('#ed-note').value = item.note || '';
  $('#ed-pinned').checked = !!item.pinned;
  $('#ed-files').replaceChildren(...item.files.map((f) =>
    el('div', { class: 'file' }, '📎 ', f.name, el('span', { class: 'muted small' }, ' · ' + fmtSize(f.size)))));
  $('#ed-delete').hidden = isNew;
  $('#ed-paste').hidden = !isNew || !navigator.clipboard?.readText;
  renderSuggest();
  editor.showModal();
  if (!isNew) $('#ed-tags').focus();
}

function renderSuggest() {
  const current = new Set(parseTags($('#ed-tags').value));
  const all = [...new Set(items.flatMap((i) => i.tags))].sort((a, b) => a.localeCompare(b, 'fr'));
  $('#ed-suggest').replaceChildren(...all.map((t) =>
    chip('#' + t, current.has(t), () => {
      if (current.has(t)) current.delete(t); else current.add(t);
      $('#ed-tags').value = [...current].join(', ');
      renderSuggest();
    })));
}

$('#ed-tags').addEventListener('input', renderSuggest);
$('#ed-cancel').addEventListener('click', () => editor.close());

$('#ed-paste').addEventListener('click', async () => {
  try {
    const txt = await navigator.clipboard.readText();
    $('#ed-text').value = txt;
    if (!$('#ed-url').value) $('#ed-url').value = extractUrl(txt);
  } catch {
    toast('Accès au presse-papiers refusé : colle avec un appui long');
  }
});

$('#editor-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const { item, isNew } = editing;
  const text = $('#ed-text').value.trim();
  let url = $('#ed-url').value.trim() || extractUrl(text);
  if (url && !/^https?:\/\//i.test(url)) url = 'https://' + url;
  if (isNew && !text && !url) { toast('Rien à enregistrer'); return; }

  Object.assign(item, {
    text,
    url,
    tags: parseTags($('#ed-tags').value),
    note: $('#ed-note').value.trim(),
    pinned: $('#ed-pinned').checked,
    updatedAt: Date.now(),
  });
  item.kind = kindOf(item);
  await dbPut(item);
  editor.close();
  await load();
  toast(isNew ? 'Ajouté' : 'Enregistré');
  navigator.storage?.persist?.();
});

$('#ed-delete').addEventListener('click', async () => {
  if (!confirm('Supprimer cet élément ? (irréversible)')) return;
  await dbDelete(editing.item.id);
  editor.close();
  await load();
  toast('Supprimé');
});

/* ---------- Sauvegarde ---------- */

const toDataURL = (blob) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(r.result);
  r.onerror = () => reject(r.error);
  r.readAsDataURL(blob);
});

async function exportBackup() {
  const all = await dbAll();
  const out = await Promise.all(all.map(async (i) => ({
    ...i,
    files: await Promise.all((i.files || []).map(async (f) => ({
      name: f.name, type: f.type, size: f.size, data: await toDataURL(f.blob),
    }))),
  })));
  const blob = new Blob(
    [JSON.stringify({ app: 'classeur-wa', version: 1, exportedAt: new Date().toISOString(), items: out })],
    { type: 'application/json' });
  const a = el('a', { href: URL.createObjectURL(blob), download: `classeur-wa-${new Date().toISOString().slice(0, 10)}.json` });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  toast('Sauvegarde exportée');
}

async function importBackup(file) {
  const data = JSON.parse(await file.text());
  if (data.app !== 'classeur-wa' || !Array.isArray(data.items)) throw new Error('format inconnu');
  let n = 0;
  for (const i of data.items) {
    const files = await Promise.all((i.files || [])
      .filter((f) => typeof f.data === 'string' && f.data.startsWith('data:'))
      .map(async (f) => ({ name: f.name, type: f.type, size: f.size, blob: await (await fetch(f.data)).blob() })));
    const item = { tags: [], note: '', pinned: false, ...i, files };
    item.kind = kindOf(item);
    await dbPut(item);
    n++;
  }
  await load();
  toast(`${n} élément(s) importé(s)`);
}

$('#btn-export').addEventListener('click', () => {
  $('.menu').open = false;
  exportBackup().catch(() => toast("L'export a échoué"));
});
$('#file-import').addEventListener('change', (e) => {
  const f = e.target.files[0];
  e.target.value = '';
  $('.menu').open = false;
  if (f) importBackup(f).catch(() => toast('Fichier de sauvegarde invalide'));
});

/* ---------- Divers ---------- */

let searchTimer;
$('#search').addEventListener('input', (e) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => { state.q = e.target.value; render(); }, 120);
});

$('#fab').addEventListener('click', () => openEditor(makeItem({}), true));

document.addEventListener('click', (e) => {
  const menu = $('.menu');
  if (menu.open && !menu.contains(e.target)) menu.open = false;
});

async function init() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
  await load();

  const params = new URLSearchParams(location.search);
  if (params.has('shared') || params.has('share-error')) {
    history.replaceState(null, '', location.pathname);
  }
  if (params.has('shared')) {
    const item = items.find((i) => i.id === params.get('shared'));
    if (item) { toast('Reçu ! Ajoute des tags'); openEditor(item); }
  } else if (params.has('share-error')) {
    toast("Le partage n'a pas pu être enregistré");
  }
}

init();
