/* Background music for the device.
 *
 * A small MIDI reader plus a square-wave voice, so whatever .mid sits
 * at assets/music/theme.mid plays back in a chiptune register that
 * suits the casing. Nothing is bundled: the file is fetched at runtime,
 * so swapping the tune means swapping that one file.
 *
 * Notes are scheduled a fraction of a second ahead rather than all at
 * once, which keeps a long track from building hundreds of oscillators
 * up front and lets the loop run indefinitely.
 */
(() => {
  const MIDI_URL = "assets/music/theme.mid";
  const VOLUME = 0.055; // per voice; several overlap, so this stays soft
  const LOOKAHEAD = 0.25; // seconds of notes queued at a time
  const TICK = 60; // ms between scheduler passes
  const GAP = 1.2; // seconds of silence before the loop repeats

  const btn = document.getElementById("btn-music");
  const led = document.getElementById("music-led");
  if (!btn) return;

  let notes = null;
  let duration = 0;
  let playing = false;
  let loading = false;
  let timer = null;
  let master = null;
  let startedAt = 0;
  let cursor = 0;

  function ctx() {
    // Shares the context app.js already creates for the button sounds.
    return typeof audioCtx === "function" ? audioCtx() : null;
  }

  /* ---------- MIDI ---------- */

  function parseMidi(buffer) {
    const b = new Uint8Array(buffer);
    const dv = new DataView(buffer);
    let p = 0;
    const u32 = () => { const v = dv.getUint32(p); p += 4; return v; };
    const u16 = () => { const v = dv.getUint16(p); p += 2; return v; };
    const vlq = () => {
      let v = 0, x;
      do { x = b[p++]; v = (v << 7) | (x & 0x7f); } while (x & 0x80);
      return v;
    };

    if (dv.getUint32(0) !== 0x4d546864) throw new Error("not a MIDI file");
    p = 4;
    const headerLen = u32();
    u16(); // format
    const trackCount = u16();
    const division = u16();
    p = 8 + headerLen;

    const events = [];
    const tempos = [];

    for (let t = 0; t < trackCount && p < b.length; t++) {
      p += 4;
      const len = u32();
      const end = p + len;
      let tick = 0;
      let status = 0;
      const sounding = new Map();

      while (p < end) {
        tick += vlq();
        if (b[p] & 0x80) status = b[p++]; // otherwise running status
        const kind = status & 0xf0;

        if (status === 0xff) {
          const meta = b[p++];
          const len2 = vlq();
          if (meta === 0x51) {
            tempos.push({ tick, us: (b[p] << 16) | (b[p + 1] << 8) | b[p + 2] });
          }
          p += len2;
        } else if (status === 0xf0 || status === 0xf7) {
          p += vlq();
        } else if (kind === 0x90 || kind === 0x80) {
          const note = b[p++];
          const vel = b[p++];
          const key = (status & 0x0f) * 128 + note;
          if (kind === 0x90 && vel > 0) {
            sounding.set(key, { tick, vel });
          } else {
            const started = sounding.get(key);
            if (started) {
              events.push({ tick: started.tick, ticks: tick - started.tick, note, vel: started.vel });
              sounding.delete(key);
            }
          }
        } else if (kind === 0xc0 || kind === 0xd0) {
          p += 1;
        } else {
          p += 2;
        }
      }
      p = end;
    }

    // Walk the tempo map so seconds are right even when it changes.
    tempos.sort((a, z) => a.tick - z.tick);
    const at = (tick) => {
      let seconds = 0;
      let last = 0;
      let us = 500000;
      for (const change of tempos) {
        if (change.tick >= tick) break;
        seconds += ((change.tick - last) * us) / 1e6 / division;
        last = change.tick;
        us = change.us;
      }
      return seconds + ((tick - last) * us) / 1e6 / division;
    };

    const out = events
      .map((e) => ({
        time: at(e.tick),
        dur: Math.max(0.05, at(e.tick + e.ticks) - at(e.tick)),
        freq: 440 * Math.pow(2, (e.note - 69) / 12),
        vel: e.vel / 127,
      }))
      .sort((a, z) => a.time - z.time);

    return { notes: out, duration: out.reduce((m, n) => Math.max(m, n.time + n.dur), 0) };
  }

  /* ---------- Playback ---------- */

  function voice(c, note, when) {
    const osc = c.createOscillator();
    const gain = c.createGain();
    const filter = c.createBiquadFilter();

    osc.type = "square";
    osc.frequency.value = note.freq;
    filter.type = "lowpass";
    filter.frequency.value = 2600;

    const peak = VOLUME * (0.45 + note.vel * 0.55);
    const stop = when + note.dur;
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(peak, when + 0.012);
    gain.gain.setValueAtTime(peak, Math.max(when + 0.013, stop - 0.05));
    gain.gain.exponentialRampToValueAtTime(0.0001, stop);

    osc.connect(filter).connect(gain).connect(master);
    osc.start(when);
    osc.stop(stop + 0.02);
  }

  function schedule() {
    const c = ctx();
    if (!c || !playing) return;
    const horizon = c.currentTime - startedAt + LOOKAHEAD;

    while (cursor < notes.length && notes[cursor].time <= horizon) {
      const note = notes[cursor++];
      voice(c, note, startedAt + note.time);
    }

    // Rewind once the last note has been queued and played out.
    if (cursor >= notes.length && c.currentTime - startedAt > duration + GAP) {
      startedAt = c.currentTime;
      cursor = 0;
    }
  }

  async function load() {
    if (notes || loading) return notes;
    loading = true;
    try {
      const res = await fetch(MIDI_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const parsed = parseMidi(await res.arrayBuffer());
      notes = parsed.notes;
      duration = parsed.duration;
    } catch (err) {
      // No track available: leave the control looking off rather than
      // pretending it worked.
      console.warn("Music unavailable:", err.message);
      notes = null;
    } finally {
      loading = false;
    }
    return notes;
  }

  function stop() {
    playing = false;
    clearInterval(timer);
    timer = null;
    if (master) {
      const c = ctx();
      // Fade rather than cut, so already-queued notes don't click off.
      master.gain.setTargetAtTime(0.0001, c.currentTime, 0.08);
      const dying = master;
      setTimeout(() => dying.disconnect(), 600);
      master = null;
    }
    btn.setAttribute("aria-pressed", "false");
    led?.classList.remove("on");
  }

  async function start() {
    const c = ctx();
    if (!c) return;
    if (!(await load())) return;

    master = c.createGain();
    master.gain.value = 1;
    master.connect(c.destination);

    playing = true;
    startedAt = c.currentTime + 0.08;
    cursor = 0;
    btn.setAttribute("aria-pressed", "true");
    led?.classList.add("on");

    schedule();
    timer = setInterval(schedule, TICK);
  }

  btn.addEventListener("click", () => {
    if (typeof clickSound === "function") clickSound();
    if (playing) stop();
    else start();
  });

  // Pause when the tab goes away; resume only if it was already on.
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && playing) {
      stop();
      btn.dataset.resume = "1";
    } else if (!document.hidden && btn.dataset.resume === "1") {
      delete btn.dataset.resume;
      start();
    }
  });
})();
