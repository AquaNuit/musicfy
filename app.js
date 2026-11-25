/* Musicfy — free web music player inspired by OpenTune.
   Catalog: iTunes Search API (30s previews). Lossless: Internet Archive FLAC + your own files.
   Lyrics: LRCLIB. No API keys, no tracking, library stays in your browser (localStorage). */
"use strict";

const $ = (s) => document.querySelector(s);
const audio = $("#audio");
const LS = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { localStorage.setItem(k, JSON.stringify(v)); },
};

const state = {
  queue: [], index: -1, shuffle: false, repeat: 0, // 0 off, 1 all, 2 one
  likes: LS.get("mf_likes", []),               // [trackKey]
  likeData: LS.get("mf_like_data", {}),        // key -> track
  playlists: LS.get("mf_playlists", []),       // [{name, tracks:[track]}]
  quality: LS.get("mf_quality", "lossless"),
  lyrics: [], // [{t, text}]
  localTracks: [],
};
const keyOf = (t) => t.id || (t.title + "|" + t.artist);

/* ---------- track factories ---------- */
function itunesTrack(r) {
  return {
    id: "itunes:" + r.trackId, source: "itunes", title: r.trackName, artist: r.artistName,
    album: r.collectionName || "", art: (r.artworkUrl100 || "").replace("100x100", "600x600"),
    url: r.previewUrl, duration: 30, preview: true, lossless: false,
    formatLabel: "AAC preview · 30s",
  };
}
function archiveTrack(id, title, artist, file, size) {
  return {
    id: "ia:" + id + "/" + file, source: "archive", title, artist: artist || "Internet Archive",
    album: id, art: "https://archive.org/services/img/" + id,
    url: "https://archive.org/download/" + encodeURIComponent(id) + "/" + encodeURIComponent(file),
    duration: 0, preview: false, lossless: true, size: size || 0,
    formatLabel: "FLAC · Lossless",
  };
}
function localTrack(file) {
  const ext = (file.name.split(".").pop() || "").toUpperCase();
  return {
    id: "local:" + file.name + ":" + file.size, source: "local",
    title: file.name.replace(/\.[^.]+$/, ""), artist: "Your files", album: "",
    art: "", url: URL.createObjectURL(file), duration: 0, preview: false,
    lossless: ["FLAC", "WAV", "ALAC", "AIFF"].includes(ext), size: file.size,
    formatLabel: ext + (["FLAC", "WAV", "ALAC", "AIFF"].includes(ext) ? " · Lossless" : ""),
  };
}

/* ---------- rendering helpers ---------- */
function badge(t) {
  if (t.lossless) return '<span class="badge">LOSSLESS</span>';
  if (t.preview) return '<span class="badge preview">PREVIEW</span>';
  return "";
}
function cardHTML(t) {
  return `<button class="card" data-play='${encodeURIComponent(JSON.stringify(t))}'>
    ${t.art ? `<img loading="lazy" src="${t.art}" alt="">` : ""}
    <div class="t">${esc(t.title)}</div><div class="a">${esc(t.artist)}</div>${badge(t)}</button>`;
}
function rowHTML(t) {
  const liked = state.likes.includes(keyOf(t));
  return `<div class="row" data-row='${encodeURIComponent(JSON.stringify(t))}'>
    ${t.art ? `<img loading="lazy" src="${t.art}" alt="">` : ""}
    <div class="grow"><div class="t">${esc(t.title)}</div>
    <div class="a">${esc(t.artist)}</div></div>${badge(t)}
    <button class="icon-btn" data-like='${encodeURIComponent(JSON.stringify(t))}'>${liked ? "♥" : "♡"}</button></div>`;
}
function esc(s) { return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function fmtTime(s) { if (!isFinite(s) || s == null) return "0:00"; s = Math.max(0, Math.floor(s)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); }

document.addEventListener("click", (e) => {
  const playEl = e.target.closest("[data-play],[data-row]");
  const likeEl = e.target.closest("[data-like]");
  if (likeEl) { e.stopPropagation(); toggleLike(JSON.parse(decodeURIComponent(likeEl.dataset.like))); return; }
  if (playEl && !e.target.closest("[data-like]")) {
    const t = JSON.parse(decodeURIComponent(playEl.dataset.play || playEl.dataset.row));
    playQueue([t], 0);
  }
});

/* ---------- iTunes catalog ---------- */
async function itunesSearch(term, limit = 12) {
  const u = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=music&entity=song&limit=${limit}`;
  const r = await fetch(u); const j = await r.json();
  return (j.results || []).filter((x) => x.previewUrl).map(itunesTrack);
}
async function loadHome() {
  const shelves = [
    ["Top pop picks", "pop hits"],
    ["Bollywood favourites", "arijit singh"],
    ["Chill & acoustic", "acoustic chill"],
    ["Rock classics", "classic rock"],
  ];
  const host = $("#home-shelves"); host.innerHTML = "";
  for (const [title, term] of shelves) {
    const sec = document.createElement("div");
    sec.innerHTML = `<h2>${title}</h2><div class="shelf"><p class="sub">Loading…</p></div>`;
    host.appendChild(sec);
    try {
      const tracks = await itunesSearch(term, 12);
      sec.querySelector(".shelf").innerHTML = tracks.map(cardHTML).join("") || '<p class="sub">Nothing found.</p>';
      sec.querySelectorAll(".card").forEach((c, i) => c.addEventListener("click", () => playQueue(tracks, i)));
    } catch { sec.querySelector(".shelf").innerHTML = '<p class="sub">Could not load (offline?).</p>'; }
  }
}

/* ---------- Lossless shelf: Internet Archive FLAC ---------- */
async function loadLossless() {
  const host = $("#lossless-shelf");
  try {
    const q = "mediatype:audio AND format:FLAC AND (jazz OR blues OR classical)";
    const u = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(q)}&fl[]=identifier&fl[]=title&fl[]=creator&rows=12&output=json`;
    const j = await (await fetch(u)).json();
    const docs = (j.response && j.response.docs) || [];
    const tracks = [];
    for (const d of docs) {
      try {
        const meta = await (await fetch(`https://archive.org/metadata/${encodeURIComponent(d.identifier)}`)).json();
        const f = (meta.files || []).find((x) => /\.flac$/i.test(x.name) && (!x.size || +x.size > 500000));
        if (f) tracks.push(archiveTrack(d.identifier, (f.title || d.title || f.name).replace(/\.flac$/i, ""), d.creator || meta.metadata?.creator, f.name, +f.size || 0));
      } catch { /* skip item */ }
      if (tracks.length >= 10) break;
    }
    host.className = "list";
    host.innerHTML = tracks.length ? tracks.map(rowHTML).join("") : '<p class="sub">No lossless recordings found right now.</p>';
    host.querySelectorAll(".row").forEach((r, i) => r.addEventListener("click", (e) => {
      if (!e.target.closest("[data-like]")) playQueue(tracks, i);
    }));
  } catch { host.innerHTML = '<p class="sub">Could not load the Lossless shelf (offline?).</p>'; }
}

/* ---------- search ---------- */
$("#search-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const term = $("#search-input").value.trim(); if (!term) return;
  const host = $("#search-results"); host.innerHTML = '<p class="sub">Searching…</p>';
  try {
    const tracks = await itunesSearch(term, 30);
    host.innerHTML = tracks.length ? tracks.map(rowHTML).join("") : '<p class="sub">No results.</p>';
    host.querySelectorAll(".row").forEach((r, i) => r.addEventListener("click", (ev) => {
      if (!ev.target.closest("[data-like]")) playQueue(tracks, i);
    }));
  } catch { host.innerHTML = '<p class="sub">Search failed (offline?).</p>'; }
});

/* ---------- library ---------- */
function toggleLike(t) {
  const k = keyOf(t), i = state.likes.indexOf(k);
  if (i >= 0) { state.likes.splice(i, 1); delete state.likeData[k]; }
  else { state.likes.push(k); state.likeData[k] = t; }
  LS.set("mf_likes", state.likes); LS.set("mf_like_data", state.likeData);
  renderLibrary(); updateLikeBtn();
}
function renderLibrary() {
  const liked = state.likes.map((k) => state.likeData[k]).filter(Boolean);
  $("#liked-list").innerHTML = liked.length ? liked.map(rowHTML).join("") : '<p class="sub">Tap ♥ on any song to like it.</p>';
  $("#liked-list").querySelectorAll(".row").forEach((r, i) => r.addEventListener("click", (e) => {
    if (!e.target.closest("[data-like]")) playQueue(liked, i);
  }));
  $("#playlist-list").innerHTML = state.playlists.map((p, pi) =>
    `<div class="row"><div class="grow"><div class="t">${esc(p.name)}</div>
     <div class="a">${p.tracks.length} songs — tap a song below to add the playing track</div></div>
     <button class="icon-btn" data-addpl="${pi}" title="Add current track">＋</button>
     <button class="icon-btn" data-delpl="${pi}" title="Delete playlist">🗑</button></div>` +
    p.tracks.map(rowHTML).join("")).join("") || '<p class="sub">No playlists yet.</p>';
  $("#playlist-list").querySelectorAll("[data-addpl]").forEach((b) => b.addEventListener("click", () => {
    const cur = state.queue[state.index]; if (!cur) return alert("Play a song first, then add it.");
    state.playlists[+b.dataset.addpl].tracks.push(cur); LS.set("mf_playlists", state.playlists); renderLibrary();
  }));
  $("#playlist-list").querySelectorAll("[data-delpl]").forEach((b) => b.addEventListener("click", () => {
    state.playlists.splice(+b.dataset.delpl, 1); LS.set("mf_playlists", state.playlists); renderLibrary();
  }));
  $("#playlist-list").querySelectorAll(".row[data-row]").forEach((r) => r.addEventListener("click", (e) => {
    if (e.target.closest("[data-like],[data-addpl],[data-delpl]")) return;
    const t = JSON.parse(decodeURIComponent(r.dataset.row));
    const all = state.playlists.flatMap((p) => p.tracks);
    playQueue(all, Math.max(0, all.findIndex((x) => keyOf(x) === keyOf(t))));
  }));
  $("#local-list").innerHTML = state.localTracks.map(rowHTML).join("");
  $("#local-list").querySelectorAll(".row").forEach((r, i) => r.addEventListener("click", (e) => {
    if (!e.target.closest("[data-like]")) playQueue(state.localTracks, i);
  }));
}
$("#playlist-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = $("#playlist-name").value.trim(); if (!name) return;
  state.playlists.push({ name, tracks: [] }); LS.set("mf_playlists", state.playlists);
  $("#playlist-name").value = ""; renderLibrary();
});
$("#file-input").addEventListener("change", (e) => {
  const files = [...e.target.files]; if (!files.length) return;
  state.localTracks.push(...files.map(localTrack)); renderLibrary();
  playQueue(state.localTracks, state.localTracks.length - files.length);
});

/* ---------- player ---------- */
function playQueue(queue, index) {
  state.queue = queue; state.index = index; loadCurrent(); audio.play().catch(() => {});
}
function current() { return state.queue[state.index]; }
function loadCurrent() {
  const t = current(); if (!t) return;
  audio.src = t.url;
  $("#player").classList.remove("hidden");
  $("#p-title").textContent = t.title; $("#p-artist").textContent = t.artist;
  $("#p-art").src = t.art || "icons/icon.svg";
  $("#p-badge").innerHTML = badge(t);
  $("#p-format").textContent = t.formatLabel || "";
  document.title = "♪ " + t.title + " — Musicfy";
  document.querySelectorAll(".row.playing").forEach((r) => r.classList.remove("playing"));
  updateLikeBtn(); loadLyrics(t);
  if ("mediaSession" in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({ title: t.title, artist: t.artist, album: t.album || "", artwork: t.art ? [{ src: t.art }] : [] });
  }
}
function updateLikeBtn() {
  const t = current(); if (!t) return;
  $("#btn-like").textContent = state.likes.includes(keyOf(t)) ? "♥" : "♡";
}
$("#btn-like").addEventListener("click", () => { const t = current(); if (t) toggleLike(t); });
$("#btn-play").addEventListener("click", () => audio.paused ? audio.play() : audio.pause());
audio.addEventListener("play", () => $("#btn-play").textContent = "⏸");
audio.addEventListener("pause", () => $("#btn-play").textContent = "▶");
audio.addEventListener("loadedmetadata", () => {
  $("#t-dur").textContent = fmtTime(audio.duration);
  const t = current();
  if (t && t.size && isFinite(audio.duration) && audio.duration > 0) {
    const kbps = Math.round((t.size * 8) / audio.duration / 1000);
    $("#p-format").textContent = `${t.formatLabel} · ~${kbps} kbps`;
  }
});
audio.addEventListener("timeupdate", () => {
  if (isFinite(audio.duration) && audio.duration > 0)
    $("#seek").value = Math.round((audio.currentTime / audio.duration) * 1000);
  $("#t-cur").textContent = fmtTime(audio.currentTime);
  syncLyrics(audio.currentTime);
});
$("#seek").addEventListener("input", (e) => {
  if (isFinite(audio.duration)) audio.currentTime = (e.target.value / 1000) * audio.duration;
});
$("#volume").addEventListener("input", (e) => audio.volume = e.target.value / 100);
audio.volume = 0.9;
function step(dir) {
  if (!state.queue.length) return;
  if (state.shuffle) state.index = Math.floor(Math.random() * state.queue.length);
  else state.index = (state.index + dir + state.queue.length) % state.queue.length;
  loadCurrent(); audio.play().catch(() => {});
}
$("#btn-next").addEventListener("click", () => step(1));
$("#btn-prev").addEventListener("click", () => audio.currentTime > 3 ? audio.currentTime = 0 : step(-1));
$("#btn-shuffle").addEventListener("click", (e) => { state.shuffle = !state.shuffle; e.currentTarget.classList.toggle("on", state.shuffle); });
$("#btn-repeat").addEventListener("click", (e) => {
  state.repeat = (state.repeat + 1) % 3;
  e.currentTarget.classList.toggle("on", state.repeat > 0);
  e.currentTarget.textContent = state.repeat === 2 ? "🔂" : "🔁";
});
audio.addEventListener("ended", () => {
  if (state.repeat === 2) { audio.currentTime = 0; audio.play(); }
  else if (state.index < state.queue.length - 1 || state.repeat === 1) step(1);
});
if ("mediaSession" in navigator) {
  navigator.mediaSession.setActionHandler("nexttrack", () => step(1));
  navigator.mediaSession.setActionHandler("previoustrack", () => step(-1));
}

/* ---------- synced lyrics (LRCLIB) ---------- */
function parseLRC(lrc) {
  return lrc.split("\n").map((line) => {
    const m = line.match(/\[(\d+):(\d+(?:\.\d+)?)\](.*)/);
    return m ? { t: +m[1] * 60 + parseFloat(m[2]), text: m[3].trim() } : null;
  }).filter((x) => x && x.text);
}
async function loadLyrics(t) {
  state.lyrics = [];
  $("#lyrics-status").textContent = "";
  $("#lyrics-body").innerHTML = '<p class="sub">Looking up lyrics…</p>';
  try {
    const u = `https://lrclib.net/api/get?artist_name=${encodeURIComponent(t.artist)}&track_name=${encodeURIComponent(t.title)}` +
      (isFinite(audio.duration) && audio.duration ? `&duration=${Math.round(audio.duration)}` : "");
    const j = await (await fetch(u)).json();
    if (j && j.syncedLyrics) {
      state.lyrics = parseLRC(j.syncedLyrics);
      $("#lyrics-body").innerHTML = state.lyrics.map((l, i) =>
        `<div class="line" data-i="${i}">${esc(l.text)}</div>`).join("");
      $("#lyrics-body").querySelectorAll(".line").forEach((el) =>
        el.addEventListener("click", () => { audio.currentTime = state.lyrics[+el.dataset.i].t; }));
      $("#lyrics-status").textContent = "synced · LRCLIB";
    } else if (j && j.plainLyrics) {
      $("#lyrics-body").innerHTML = j.plainLyrics.split("\n").map((l) => `<div>${esc(l)}</div>`).join("");
      $("#lyrics-status").textContent = "plain · LRCLIB";
    } else $("#lyrics-body").innerHTML = '<p class="sub">No lyrics found for this track.</p>';
  } catch { $("#lyrics-body").innerHTML = '<p class="sub">Lyrics unavailable (offline?).</p>'; }
}
function syncLyrics(now) {
  if (!state.lyrics.length || $("#lyrics-panel").classList.contains("hidden")) return;
  let active = -1;
  for (let i = 0; i < state.lyrics.length; i++) if (state.lyrics[i].t <= now) active = i;
  const lines = $("#lyrics-body").children;
  for (let i = 0; i < lines.length; i++) lines[i].classList.toggle("active", i === active);
  if (active >= 0 && lines[active]) lines[active].scrollIntoView({ block: "center", behavior: "smooth" });
}
$("#btn-lyrics").addEventListener("click", () => $("#lyrics-panel").classList.toggle("hidden"));
$("#lyrics-close").addEventListener("click", () => $("#lyrics-panel").classList.add("hidden"));

/* ---------- views, settings, PWA ---------- */
document.querySelectorAll(".tab").forEach((tab) => tab.addEventListener("click", () => {
  document.querySelectorAll(".tab").forEach((x) => x.classList.toggle("active", x === tab));
  document.querySelectorAll(".view").forEach((v) => v.classList.toggle("active", v.id === "view-" + tab.dataset.view));
}));
const QUALITY_LABELS = { "data-saver": "Data saver", normal: "Normal", lossless: "Lossless", "hi-res": "Hi-Res Lossless" };
function applyQuality() {
  $("#quality-select").value = state.quality;
  $("#quality-chip").textContent = QUALITY_LABELS[state.quality];
}
$("#quality-select").addEventListener("change", (e) => {
  state.quality = e.target.value; LS.set("mf_quality", state.quality); applyQuality();
});
function applyTheme(name) {
  if (name === "dark") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", name);
  $("#theme-select").value = name;
}
$("#theme-select").addEventListener("change", (e) => { LS.set("mf_theme", e.target.value); applyTheme(e.target.value); });
$("#clear-data").addEventListener("click", () => {
  ["mf_likes", "mf_like_data", "mf_playlists"].forEach((k) => localStorage.removeItem(k));
  state.likes = []; state.likeData = {}; state.playlists = []; renderLibrary();
});
let deferredInstall = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault(); deferredInstall = e; $("#install-btn").classList.remove("hidden");
});
$("#install-btn").addEventListener("click", async () => {
  if (!deferredInstall) return;
  deferredInstall.prompt(); await deferredInstall.userChoice;
  deferredInstall = null; $("#install-btn").classList.add("hidden");
});
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});

/* ---------- init ---------- */
applyQuality();
applyTheme(LS.get("mf_theme", "dark"));
renderLibrary();
loadHome();
loadLossless();
