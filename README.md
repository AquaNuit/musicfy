# Musicfy 🎵

A free, open-source **web music player** with a headline **lossless audio** feature —
modelled on the design of [OpenTune](https://github.com/justshivv/Opentune), the
open-source Android music app. Musicfy is an *independent reimplementation* that runs
anywhere a browser runs: on the web, installed as a PWA, or wrapped as an Android APK.

No build step, no API keys, no accounts, no tracking. Plain HTML + CSS + JavaScript.

## Features

- **Home** — chart shelves from the iTunes catalog.
- **Search** — the full iTunes catalog (plays as 30-second previews, clearly labelled `PREVIEW`).
- **Library** — liked songs and playlists, saved in your browser (`localStorage`).
- **Full player** — play/pause, seek, queue with next/previous, shuffle, repeat
  (off / all / one), volume, and lock-screen controls via the Media Session API.
- **Synced lyrics** — word-timed lyrics from [LRCLIB](https://lrclib.net) that highlight
  as the song plays; tap a line to jump to it.
- **Themes** — dark, pure black and light; quality and theme preferences persist.

## 🎧 The lossless feature

- **Lossless shelf** — full-length **FLAC** recordings streamed from the
  [Internet Archive](https://archive.org) (public-domain / openly licensed collections,
  e.g. classic jazz), badged `LOSSLESS` in the UI.
- **Your own files** — add your own **FLAC / WAV / ALAC** files in the Library tab.
  They play straight from your device via `URL.createObjectURL` — never uploaded,
  never re-encoded — with the real format and an estimated bitrate shown in the player.
- **Audio-quality selector** (Settings) — *Data saver / Normal / Lossless /
  Hi-Res Lossless*, persisted across visits, shown as a chip in the header.
- **Live format readout** — the player shows the actual format (e.g.
  `FLAC · Lossless · ~910 kbps`) while a lossless track plays.

> **Decoder note:** FLAC playback uses your browser's *native* decoder. It works in
> Chrome, Edge and Firefox (and in the Android app, whose WebView is Chromium-based).
> **Safari may not decode FLAC in-browser.**

## Run it on the web

Any static host works — there is nothing to build.

- **GitHub Pages:** push this repo, then in **Settings → Pages** choose
  *Deploy from a branch → main → / (root)*. Done.
- **Locally:** `npm run serve` (or any static server, e.g. `python3 -m http.server`).
- Or host the folder on Netlify, Vercel, Cloudflare Pages, etc.

## Install as a PWA

Open the hosted app in Chrome/Edge (Android or desktop) and choose
**“Install app” / “Add to Home screen”** — Musicfy installs with its own icon and
works offline for the app shell (catalog and streams still need the internet).

## Build the Android APK

See **[ANDROID.md](ANDROID.md)**. In short: the included GitHub Actions workflow
(**Actions → Build Android APK**, or publish a Release) builds a debug APK you can
download and install on any Android phone; locally you can do the same with
Capacitor (`npx cap add android`, then build in Android Studio).

## Honest notes

- Catalog songs are **30-second previews** served by the iTunes Search API — that is
  all Apple makes available without a paid service. **Full-length playback** is
  available for the Lossless shelf (Internet Archive) and for your own files.
- Musicfy is **not affiliated with** OpenTune, YouTube, Google, Apple or the
  Internet Archive. OpenTune is GPL-3.0; Musicfy is an independent reimplementation
  *inspired by its design* and shares no code with it.
- Artwork and previews belong to their respective owners. Lossless-shelf recordings
  are public-domain or openly licensed material hosted by the Internet Archive.

## License

[MIT](LICENSE) — do what you like, keep the notice.
