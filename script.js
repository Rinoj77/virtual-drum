
"use strict";

/* ================================================================
   SECTION 0 — FALLBACK SVG PLACEHOLDER (used when PNGs missing)
   Generates a simple ellipse data-URI so the kit is usable
   without real assets during development.
================================================================ */
function fallbackSVG(label, w, h, color) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <ellipse cx="${w/2}" cy="${h/2}" rx="${w/2-4}" ry="${h/2-4}"
      fill="${color}" fill-opacity=".18" stroke="${color}" stroke-width="2"/>
    <text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle"
      fill="${color}" font-size="${Math.max(11, h/5)}" font-family="system-ui" font-weight="700"
      opacity=".7">${label}</text>
  </svg>`;
  return 'data:image/svg+xml;base64,' + btoa(svg);
}

/* ================================================================
   SECTION 1 — WEB AUDIO API ENGINE
   Preloads .wav buffers for zero-latency playback.
   Falls back to synthesised beeps when files are missing.
================================================================ */
const AudioEngine = (() => {
  let ctx = null; // AudioContext — created on first user gesture

  // Map drum name → asset path
  const AUDIO_PATHS = {
    hihat:    './assets/sounds/pearlkit-hihat.wav',
    snare:    './assets/sounds/pearlkit-snare1.wav',
    kick:     './assets/sounds/pearlkit-kick.wav',
    crash:    './assets/sounds/18_inch_crash.wav',
    ride:     './assets/sounds/pearlkit-ride1.wav',
    tom1:     './assets/sounds/pearlkit-hitom1.wav',
    tom2:     './assets/sounds/pearlkit-hitom2.wav',
    floortom: './assets/sounds/floor.wav',
  };

  // Loaded AudioBuffers keyed by drum name
  const buffers = {};

  // Synth fallback parameters when .wav not found
  const SYNTH = {
    hihat:    { type:'square', freq:8000, duration:.06, gain:.25 },
    snare:    { type:'white',  freq:200,  duration:.18, gain:.6  },
    kick:     { type:'sine',   freq:60,   duration:.3,  gain:1   },
    crash:    { type:'white',  freq:6000, duration:.8,  gain:.3  },
    ride:     { type:'white',  freq:5000, duration:.45, gain:.22 },
    tom1:     { type:'sine',   freq:180,  duration:.25, gain:.8  },
    tom2:     { type:'sine',   freq:130,  duration:.28, gain:.8  },
    floortom: { type:'sine',   freq:80,   duration:.32, gain:.9  },
  };

  function getCtx() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  /** Attempt to fetch & decode a .wav; silently uses synth on failure */
  async function loadBuffer(drum) {
    try {
      const res = await fetch(AUDIO_PATHS[drum]);
      if (!res.ok) throw new Error('not found');
      const arrayBuf = await res.arrayBuffer();
      buffers[drum] = await getCtx().decodeAudioData(arrayBuf);
    } catch {
      buffers[drum] = null; // will fall back to synth
    }
  }

  /** Preload all drums in parallel */
  async function preload() {
    getCtx();
    await Promise.all(Object.keys(AUDIO_PATHS).map(loadBuffer));
  }

  /** Synthesise a hit when no .wav is available */
  function playSynth(drum) {
    const c = getCtx();
    const p = SYNTH[drum] || SYNTH.snare;
    const gain = c.createGain();
    gain.gain.setValueAtTime(p.gain, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, c.currentTime + p.duration);
    gain.connect(c.destination);

    if (p.type === 'white') {
      // White-noise buffer for snare/hi-hat/crash/ride
      const bufLen = c.sampleRate * p.duration;
      const noiseBuf = c.createBuffer(1, bufLen, c.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;
      const src = c.createBufferSource();
      src.buffer = noiseBuf;
      // Bandpass filter to shape timbre
      const filter = c.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = p.freq;
      filter.Q.value = (drum === 'snare') ? 0.5 : 2;
      src.connect(filter); filter.connect(gain);
      src.start();
    } else {
      const osc = c.createOscillator();
      osc.type = p.type;
      osc.frequency.setValueAtTime(p.freq, c.currentTime);
      // Kick: pitch drop for punch
      if (drum === 'kick') osc.frequency.exponentialRampToValueAtTime(30, c.currentTime + .15);
      osc.connect(gain);
      osc.start(); osc.stop(c.currentTime + p.duration);
    }
  }

  /** Public: play a drum sound */
  function play(drum) {
    const c = getCtx();
    if (buffers[drum]) {
      const src = c.createBufferSource();
      src.buffer = buffers[drum];
      src.connect(c.destination);
      src.start();
    } else {
      playSynth(drum);
    }
  }

  return { preload, play };
})();


/* ================================================================
   SECTION 2 — PATTERN LIBRARY
   Realistic, mathematically timed 8-count grooves.
================================================================ */
const PATTERNS = {
  beginner: [
    {
      id: 'rock_01',
      name: 'The Arena Rock Backbeat',
      icon: '🎸',
      exampleSong: 'Back in Black – AC/DC (1980)',
      tempo: 90,
      sequence: [
        // Bar 1
        { drum:'kick',  timeOffset:   0 }, { drum:'hihat', timeOffset:   0 },
        { drum:'hihat', timeOffset: 333 },
        { drum:'snare', timeOffset: 666 }, { drum:'hihat', timeOffset: 666 },
        { drum:'hihat', timeOffset: 999 },
        { drum:'kick',  timeOffset:1333 }, { drum:'hihat', timeOffset:1333 },
        { drum:'hihat', timeOffset:1666 },
        { drum:'snare', timeOffset:2000 }, { drum:'hihat', timeOffset:2000 },
        { drum:'hihat', timeOffset:2333 },
        // Bar 2 (Added 2667ms)
        { drum:'kick',  timeOffset:2667 }, { drum:'hihat', timeOffset:2667 },
        { drum:'hihat', timeOffset:3000 },
        { drum:'snare', timeOffset:3333 }, { drum:'hihat', timeOffset:3333 },
        { drum:'hihat', timeOffset:3666 },
        { drum:'kick',  timeOffset:4000 }, { drum:'hihat', timeOffset:4000 },
        { drum:'hihat', timeOffset:4333 },
        { drum:'snare', timeOffset:4667 }, { drum:'hihat', timeOffset:4667 },
        { drum:'hihat', timeOffset:5000 },
      ]
    },
    {
      id: 'pop_01',
      name: 'Four-on-the-Floor Pop',
      icon: '🕺',
      exampleSong: 'Billie Jean – Michael Jackson (1982)',
      tempo: 117,
      sequence: [
        // Bar 1
        { drum:'kick',  timeOffset:   0 }, { drum:'hihat', timeOffset:   0 },
        { drum:'hihat', timeOffset: 256 },
        { drum:'kick',  timeOffset: 513 }, { drum:'snare', timeOffset: 513 }, { drum:'hihat', timeOffset: 513 },
        { drum:'hihat', timeOffset: 769 },
        { drum:'kick',  timeOffset:1026 }, { drum:'hihat', timeOffset:1026 },
        { drum:'hihat', timeOffset:1282 },
        { drum:'kick',  timeOffset:1538 }, { drum:'snare', timeOffset:1538 }, { drum:'hihat', timeOffset:1538 },
        { drum:'hihat', timeOffset:1795 },
        // Bar 2 (Added 2051ms)
        { drum:'kick',  timeOffset:2051 }, { drum:'hihat', timeOffset:2051 },
        { drum:'hihat', timeOffset:2307 },
        { drum:'kick',  timeOffset:2564 }, { drum:'snare', timeOffset:2564 }, { drum:'hihat', timeOffset:2564 },
        { drum:'hihat', timeOffset:2820 },
        { drum:'kick',  timeOffset:3077 }, { drum:'hihat', timeOffset:3077 },
        { drum:'hihat', timeOffset:3333 },
        { drum:'kick',  timeOffset:3589 }, { drum:'snare', timeOffset:3589 }, { drum:'hihat', timeOffset:3589 },
        { drum:'hihat', timeOffset:3846 },
      ]
    },
    {
      id: 'hiphop_01',
      name: 'Boom Bap Classic',
      icon: '🎤',
      exampleSong: 'C.R.E.A.M. – Wu-Tang Clan (1993)',
      tempo: 88,
      sequence: [
        // Bar 1
        { drum:'kick',  timeOffset:   0 }, { drum:'hihat', timeOffset:   0 },
        { drum:'hihat', timeOffset: 341 },
        { drum:'snare', timeOffset: 682 }, { drum:'hihat', timeOffset: 682 },
        { drum:'hihat', timeOffset:1023 },
        { drum:'kick',  timeOffset:1193 },
        { drum:'hihat', timeOffset:1364 },
        { drum:'snare', timeOffset:1705 }, { drum:'hihat', timeOffset:1705 },
        { drum:'hihat', timeOffset:2045 },
        // Bar 2 (Added 2727ms)
        { drum:'kick',  timeOffset:2727 }, { drum:'hihat', timeOffset:2727 },
        { drum:'hihat', timeOffset:3068 },
        { drum:'snare', timeOffset:3409 }, { drum:'hihat', timeOffset:3409 },
        { drum:'hihat', timeOffset:3750 },
        { drum:'kick',  timeOffset:3920 },
        { drum:'hihat', timeOffset:4091 },
        { drum:'snare', timeOffset:4432 }, { drum:'hihat', timeOffset:4432 },
        { drum:'hihat', timeOffset:4772 },
      ]
    },
    {
      id: 'reggae_01',
      name: 'One Drop Reggae',
      icon: '🌴',
      exampleSong: 'Three Little Birds – Bob Marley (1977)',
      tempo: 75,
      sequence: [
        // Bar 1
        { drum:'hihat', timeOffset:   0 }, { drum:'hihat', timeOffset: 400 },
        { drum:'hihat', timeOffset: 800 }, { drum:'hihat', timeOffset:1200 },
        { drum:'kick',  timeOffset:1600 }, { drum:'snare', timeOffset:1600 }, { drum:'hihat', timeOffset:1600 },
        { drum:'hihat', timeOffset:2000 }, { drum:'hihat', timeOffset:2400 },
        { drum:'hihat', timeOffset:2800 },
        // Bar 2 (Added 3200ms)
        { drum:'hihat', timeOffset:3200 }, { drum:'hihat', timeOffset:3600 },
        { drum:'hihat', timeOffset:4000 }, { drum:'hihat', timeOffset:4400 },
        { drum:'kick',  timeOffset:4800 }, { drum:'snare', timeOffset:4800 }, { drum:'hihat', timeOffset:4800 },
        { drum:'hihat', timeOffset:5200 }, { drum:'hihat', timeOffset:5600 },
        { drum:'hihat', timeOffset:6000 },
      ]
    },
    {
      id: 'country_01',
      name: 'The Train Beat',
      icon: '🚂',
      exampleSong: 'Folsom Prison Blues – Johnny Cash (1955)',
      tempo: 104,
      sequence: [
        // Bar 1
        { drum:'kick',  timeOffset:   0 }, { drum:'snare', timeOffset:   0 },
        { drum:'snare', timeOffset: 288 },
        { drum:'snare', timeOffset: 577 }, { drum:'snare', timeOffset: 865 },
        { drum:'kick',  timeOffset:1154 }, { drum:'snare', timeOffset:1154 },
        { drum:'snare', timeOffset:1442 },
        { drum:'snare', timeOffset:1731 }, { drum:'snare', timeOffset:2019 },
        // Bar 2 (Added 2308ms)
        { drum:'kick',  timeOffset:2308 }, { drum:'snare', timeOffset:2308 },
        { drum:'snare', timeOffset:2596 },
        { drum:'snare', timeOffset:2885 }, { drum:'snare', timeOffset:3173 },
        { drum:'kick',  timeOffset:3462 }, { drum:'snare', timeOffset:3462 },
        { drum:'snare', timeOffset:3750 },
        { drum:'snare', timeOffset:4039 }, { drum:'snare', timeOffset:4327 },
      ]
    }
  ],

  learner: [
    {
      id: 'indie_01',
      name: 'The Indie Dance Floor',
      icon: '🪩',
      exampleSong: 'Take Me Out – Franz Ferdinand (2004)',
      tempo: 104,
      sequence: [
        // Bar 1
        { drum:'crash', timeOffset:   0 }, { drum:'kick',  timeOffset:   0 },
        { drum:'hihat', timeOffset: 288 },
        { drum:'snare', timeOffset: 577 }, { drum:'kick',  timeOffset: 577 },
        { drum:'hihat', timeOffset: 865 },
        { drum:'kick',  timeOffset:1154 },
        { drum:'hihat', timeOffset:1442 },
        { drum:'snare', timeOffset:1730 }, { drum:'kick',  timeOffset:1730 },
        { drum:'hihat', timeOffset:2019 },
        // Bar 2 (Added 2308ms)
        { drum:'hihat', timeOffset:2308 }, { drum:'kick',  timeOffset:2308 },
        { drum:'hihat', timeOffset:2596 },
        { drum:'snare', timeOffset:2885 }, { drum:'kick',  timeOffset:2885 },
        { drum:'hihat', timeOffset:3173 },
        { drum:'kick',  timeOffset:3462 },
        { drum:'hihat', timeOffset:3750 },
        { drum:'snare', timeOffset:4038 }, { drum:'kick',  timeOffset:4038 },
        { drum:'hihat', timeOffset:4327 },
      ]
    },
    {
      id: 'funk_01',
      name: 'Classic Funk Groove',
      icon: '🌶️',
      exampleSong: 'Cold Sweat – James Brown (1967)',
      tempo: 110,
      sequence: [
        // Bar 1
        { drum:'kick',  timeOffset:   0 }, { drum:'hihat', timeOffset:   0 },
        { drum:'hihat', timeOffset: 273 },
        { drum:'snare', timeOffset: 545 }, { drum:'hihat', timeOffset: 545 },
        { drum:'hihat', timeOffset: 818 },
        { drum:'kick',  timeOffset: 954 }, { drum:'hihat', timeOffset:1091 },
        { drum:'kick',  timeOffset:1227 },
        { drum:'snare', timeOffset:1364 }, { drum:'hihat', timeOffset:1364 },
        { drum:'hihat', timeOffset:1636 },
        { drum:'snare', timeOffset:1909 }, { drum:'hihat', timeOffset:1909 },
        // Bar 2 (Added 2182ms)
        { drum:'kick',  timeOffset:2182 }, { drum:'hihat', timeOffset:2182 },
        { drum:'hihat', timeOffset:2455 },
        { drum:'snare', timeOffset:2727 }, { drum:'hihat', timeOffset:2727 },
        { drum:'hihat', timeOffset:3000 },
        { drum:'kick',  timeOffset:3136 }, { drum:'hihat', timeOffset:3273 },
        { drum:'kick',  timeOffset:3409 },
        { drum:'snare', timeOffset:3546 }, { drum:'hihat', timeOffset:3546 },
        { drum:'hihat', timeOffset:3818 },
        { drum:'snare', timeOffset:4091 }, { drum:'hihat', timeOffset:4091 },
      ]
    },
    {
      id: 'disco_01',
      name: '16th Note Disco Hustle',
      icon: '✨',
      exampleSong: 'Stayin\' Alive – Bee Gees (1977)',
      tempo: 104,
      sequence: [
        // Bar 1
        { drum:'kick',  timeOffset:   0 }, { drum:'hihat', timeOffset:   0 },
        { drum:'hihat', timeOffset: 144 }, { drum:'hihat', timeOffset: 288 }, { drum:'hihat', timeOffset: 432 },
        { drum:'kick',  timeOffset: 577 }, { drum:'snare', timeOffset: 577 }, { drum:'hihat', timeOffset: 577 },
        { drum:'hihat', timeOffset: 721 }, { drum:'hihat', timeOffset: 865 }, { drum:'hihat', timeOffset:1009 },
        { drum:'kick',  timeOffset:1154 }, { drum:'hihat', timeOffset:1154 },
        { drum:'hihat', timeOffset:1298 }, { drum:'hihat', timeOffset:1442 }, { drum:'hihat', timeOffset:1586 },
        { drum:'kick',  timeOffset:1731 }, { drum:'snare', timeOffset:1731 }, { drum:'hihat', timeOffset:1731 },
        // Bar 2 (Added 2308ms)
        { drum:'kick',  timeOffset:2308 }, { drum:'hihat', timeOffset:2308 },
        { drum:'hihat', timeOffset:2452 }, { drum:'hihat', timeOffset:2596 }, { drum:'hihat', timeOffset:2740 },
        { drum:'kick',  timeOffset:2885 }, { drum:'snare', timeOffset:2885 }, { drum:'hihat', timeOffset:2885 },
        { drum:'hihat', timeOffset:3029 }, { drum:'hihat', timeOffset:3173 }, { drum:'hihat', timeOffset:3317 },
        { drum:'kick',  timeOffset:3462 }, { drum:'hihat', timeOffset:3462 },
        { drum:'hihat', timeOffset:3606 }, { drum:'hihat', timeOffset:3750 }, { drum:'hihat', timeOffset:3894 },
        { drum:'kick',  timeOffset:4039 }, { drum:'snare', timeOffset:4039 }, { drum:'hihat', timeOffset:4039 },
      ]
    },
    {
      id: 'rock_02',
      name: 'Heavy Grunge Anthem',
      icon: '💥',
      exampleSong: 'Smells Like Teen Spirit – Nirvana (1991)',
      tempo: 116,
      sequence: [
        // Bar 1
        { drum:'kick',  timeOffset:   0 }, { drum:'crash', timeOffset:   0 },
        { drum:'kick',  timeOffset: 259 }, { drum:'hihat', timeOffset: 259 },
        { drum:'snare', timeOffset: 517 }, { drum:'hihat', timeOffset: 517 },
        { drum:'snare', timeOffset: 646 }, { drum:'hihat', timeOffset: 776 },
        { drum:'kick',  timeOffset: 905 },
        { drum:'kick',  timeOffset:1034 }, { drum:'hihat', timeOffset:1034 },
        { drum:'kick',  timeOffset:1293 }, { drum:'hihat', timeOffset:1293 },
        { drum:'snare', timeOffset:1552 }, { drum:'hihat', timeOffset:1552 },
        { drum:'hihat', timeOffset:1810 },
        // Bar 2 (Added 2069ms)
        { drum:'kick',  timeOffset:2069 }, { drum:'hihat', timeOffset:2069 },
        { drum:'kick',  timeOffset:2328 }, { drum:'hihat', timeOffset:2328 },
        { drum:'snare', timeOffset:2586 }, { drum:'hihat', timeOffset:2586 },
        { drum:'snare', timeOffset:2715 }, { drum:'hihat', timeOffset:2845 },
        { drum:'kick',  timeOffset:2974 },
        { drum:'kick',  timeOffset:3103 }, { drum:'hihat', timeOffset:3103 },
        { drum:'kick',  timeOffset:3362 }, { drum:'hihat', timeOffset:3362 },
        { drum:'snare', timeOffset:3621 }, { drum:'hihat', timeOffset:3621 },
        { drum:'hihat', timeOffset:3879 },
      ]
    },
    {
      id: 'synth_01',
      name: '80s Tom-Driven Synthpop',
      icon: '🎹',
      exampleSong: 'Everybody Wants to Rule the World – Tears for Fears (1985)',
      tempo: 112,
      sequence: [
        // Bar 1
        { drum:'kick',  timeOffset:   0 }, { drum:'tom1',  timeOffset:   0 },
        { drum:'tom1',  timeOffset: 268 },
        { drum:'snare', timeOffset: 536 }, { drum:'tom1',  timeOffset: 536 },
        { drum:'tom1',  timeOffset: 804 },
        { drum:'kick',  timeOffset:1071 }, { drum:'tom2',  timeOffset:1071 },
        { drum:'tom2',  timeOffset:1339 },
        { drum:'snare', timeOffset:1607 }, { drum:'tom2',  timeOffset:1607 },
        { drum:'tom2',  timeOffset:1875 },
        // Bar 2 (Added 2143ms)
        { drum:'kick',  timeOffset:2143 }, { drum:'tom1',  timeOffset:2143 },
        { drum:'tom1',  timeOffset:2411 },
        { drum:'snare', timeOffset:2679 }, { drum:'tom1',  timeOffset:2679 },
        { drum:'tom1',  timeOffset:2947 },
        { drum:'kick',  timeOffset:3214 }, { drum:'tom2',  timeOffset:3214 },
        { drum:'tom2',  timeOffset:3482 },
        { drum:'snare', timeOffset:3750 }, { drum:'tom2',  timeOffset:3750 },
        { drum:'tom2',  timeOffset:4018 },
      ]
    }
  ],

  expert: [
    {
      id: 'jazz_01',
      name: 'Smooth Jazz Swing',
      icon: '🎷',
      exampleSong: 'So What – Miles Davis (1959)',
      tempo: 130,
      sequence: [
        // Bar 1
        { drum:'ride',  timeOffset:   0 }, { drum:'kick',  timeOffset:   0 },
        { drum:'ride',  timeOffset: 461 }, { drum:'hihat', timeOffset: 461 },
        { drum:'ride',  timeOffset: 768 },
        { drum:'ride',  timeOffset: 922 }, { drum:'snare', timeOffset: 922 },
        { drum:'ride',  timeOffset:1383 }, { drum:'hihat', timeOffset:1383 },
        { drum:'ride',  timeOffset:1690 },
        // Bar 2 (Added 1846ms)
        { drum:'ride',  timeOffset:1846 },
        { drum:'ride',  timeOffset:2307 }, { drum:'hihat', timeOffset:2307 },
        { drum:'ride',  timeOffset:2614 },
        { drum:'ride',  timeOffset:2768 }, { drum:'snare', timeOffset:2768 },
        { drum:'ride',  timeOffset:3229 }, { drum:'hihat', timeOffset:3229 },
        { drum:'ride',  timeOffset:3536 },
      ]
    },
    {
      id: 'metal_01',
      name: 'Double Kick Thrash',
      icon: '🤘',
      exampleSong: 'Master of Puppets – Metallica (1986)',
      tempo: 212,
      sequence: [
        // Bar 1
        { drum:'kick',  timeOffset:   0 }, { drum:'ride',  timeOffset:   0 },
        { drum:'kick',  timeOffset: 142 },
        { drum:'kick',  timeOffset: 283 }, { drum:'snare', timeOffset: 283 },
        { drum:'kick',  timeOffset: 425 },
        { drum:'kick',  timeOffset: 566 }, { drum:'ride',  timeOffset: 566 },
        { drum:'kick',  timeOffset: 708 },
        { drum:'kick',  timeOffset: 849 }, { drum:'snare', timeOffset: 849 },
        { drum:'kick',  timeOffset: 991 },
        // Bar 2 (Added 1132ms)
        { drum:'kick',  timeOffset:1132 }, { drum:'ride',  timeOffset:1132 },
        { drum:'kick',  timeOffset:1274 },
        { drum:'kick',  timeOffset:1415 }, { drum:'snare', timeOffset:1415 },
        { drum:'kick',  timeOffset:1557 },
        { drum:'kick',  timeOffset:1698 }, { drum:'ride',  timeOffset:1698 },
        { drum:'kick',  timeOffset:1840 },
        { drum:'kick',  timeOffset:1981 }, { drum:'snare', timeOffset:1981 },
        { drum:'kick',  timeOffset:2123 },
      ]
    },
    {
      id: 'prog_01',
      name: '7/4 Odd Time Signature',
      icon: '🧩',
      exampleSong: 'Money – Pink Floyd (1973)',
      tempo: 120,
      sequence: [
        // Bar 1 (7 counts)
        { drum:'kick',  timeOffset:   0 }, { drum:'hihat', timeOffset:   0 },
        { drum:'hihat', timeOffset: 500 },
        { drum:'snare', timeOffset:1000 }, { drum:'hihat', timeOffset:1000 },
        { drum:'kick',  timeOffset:1500 }, { drum:'hihat', timeOffset:1500 },
        { drum:'snare', timeOffset:2000 }, { drum:'hihat', timeOffset:2000 },
        { drum:'kick',  timeOffset:2500 }, { drum:'hihat', timeOffset:2500 },
        { drum:'snare', timeOffset:3000 }, { drum:'hihat', timeOffset:3000 },
        // Bar 2 (Added 3500ms)
        { drum:'kick',  timeOffset:3500 }, { drum:'hihat', timeOffset:3500 },
        { drum:'hihat', timeOffset:4000 },
        { drum:'snare', timeOffset:4500 }, { drum:'hihat', timeOffset:4500 },
        { drum:'kick',  timeOffset:5000 }, { drum:'hihat', timeOffset:5000 },
        { drum:'snare', timeOffset:5500 }, { drum:'hihat', timeOffset:5500 },
        { drum:'kick',  timeOffset:6000 }, { drum:'hihat', timeOffset:6000 },
        { drum:'snare', timeOffset:6500 }, { drum:'hihat', timeOffset:6500 },
      ]
    },
    {
      id: 'latin_01',
      name: 'Bossa Nova Breeze',
      icon: '🍹',
      exampleSong: 'The Girl from Ipanema – Stan Getz (1964)',
      tempo: 130,
      sequence: [
        // Bar 1 & 2 (Already an 8-count, but doubled here for a full 4-bar phrase)
        { drum:'kick',  timeOffset:   0 }, { drum:'hihat', timeOffset:   0 }, { drum:'snare', timeOffset:   0 },
        { drum:'hihat', timeOffset: 231 }, { drum:'hihat', timeOffset: 462 },
        { drum:'snare', timeOffset: 693 }, { drum:'hihat', timeOffset: 693 },
        { drum:'kick',  timeOffset: 924 }, { drum:'hihat', timeOffset: 924 }, { drum:'hihat', timeOffset:1155 },
        { drum:'snare', timeOffset:1386 }, { drum:'hihat', timeOffset:1386 }, { drum:'hihat', timeOffset:1617 },
        { drum:'kick',  timeOffset:1848 }, { drum:'hihat', timeOffset:1848 },
        { drum:'hihat', timeOffset:2079 }, { drum:'snare', timeOffset:2079 },
        { drum:'kick',  timeOffset:2310 }, { drum:'hihat', timeOffset:2310 }, { drum:'hihat', timeOffset:2541 },
        { drum:'snare', timeOffset:2772 }, { drum:'hihat', timeOffset:2772 }, { drum:'hihat', timeOffset:3003 },
        { drum:'kick',  timeOffset:3234 }, { drum:'hihat', timeOffset:3234 },
        // Bar 3 & 4 (Added 3692ms)
        { drum:'kick',  timeOffset:3692 }, { drum:'hihat', timeOffset:3692 }, { drum:'snare', timeOffset:3692 },
        { drum:'hihat', timeOffset:3923 }, { drum:'hihat', timeOffset:4154 },
        { drum:'snare', timeOffset:4385 }, { drum:'hihat', timeOffset:4385 },
        { drum:'kick',  timeOffset:4616 }, { drum:'hihat', timeOffset:4616 }, { drum:'hihat', timeOffset:4847 },
        { drum:'snare', timeOffset:5078 }, { drum:'hihat', timeOffset:5078 }, { drum:'hihat', timeOffset:5309 },
        { drum:'kick',  timeOffset:5540 }, { drum:'hihat', timeOffset:5540 },
        { drum:'hihat', timeOffset:5771 }, { drum:'snare', timeOffset:5771 },
        { drum:'kick',  timeOffset:6002 }, { drum:'hihat', timeOffset:6002 }, { drum:'hihat', timeOffset:6233 },
        { drum:'snare', timeOffset:6464 }, { drum:'hihat', timeOffset:6464 }, { drum:'hihat', timeOffset:6695 },
        { drum:'kick',  timeOffset:6926 }, { drum:'hihat', timeOffset:6926 },
      ]
    },
    {
      id: 'funk_02',
      name: 'Linear Ghost Funk',
      icon: '🛸',
      exampleSong: 'Give It Away – Red Hot Chili Peppers (1991)',
      tempo: 92,
      sequence: [
        // Bar 1
        { drum:'kick',  timeOffset:   0 }, { drum:'hihat', timeOffset: 163 },
        { drum:'hihat', timeOffset: 326 }, { drum:'snare', timeOffset: 489 },
        { drum:'hihat', timeOffset: 652 }, { drum:'kick',  timeOffset: 815 },
        { drum:'kick',  timeOffset: 978 }, { drum:'hihat', timeOffset:1141 },
        { drum:'snare', timeOffset:1304 }, { drum:'hihat', timeOffset:1467 },
        { drum:'hihat', timeOffset:1630 }, { drum:'kick',  timeOffset:1793 },
        { drum:'hihat', timeOffset:1956 }, { drum:'snare', timeOffset:2119 },
        { drum:'crash', timeOffset:2282 }, { drum:'kick',  timeOffset:2445 },
        // Bar 2 (Added 2609ms)
        { drum:'kick',  timeOffset:2609 }, { drum:'hihat', timeOffset:2772 },
        { drum:'hihat', timeOffset:2935 }, { drum:'snare', timeOffset:3098 },
        { drum:'hihat', timeOffset:3261 }, { drum:'kick',  timeOffset:3424 },
        { drum:'kick',  timeOffset:3587 }, { drum:'hihat', timeOffset:3750 },
        { drum:'snare', timeOffset:3913 }, { drum:'hihat', timeOffset:4076 },
        { drum:'hihat', timeOffset:4239 }, { drum:'kick',  timeOffset:4402 },
        { drum:'hihat', timeOffset:4565 }, { drum:'snare', timeOffset:4728 },
        { drum:'hihat', timeOffset:4891 }, { drum:'kick',  timeOffset:5054 }, // Swapped crash for hihat on the repeat
      ]
    }
  ]
};


/* ================================================================
   SECTION 3 — DOM REFERENCES & KEYBOARD MAP
================================================================ */
const KEY_MAP = {
  'd': 'hihat',
  's': 'snare',
  'a': 'kick',
  'q': 'crash',
  'r': 'ride',
  'f': 'tom1',
  'g': 'tom2',
  'h': 'floortom',
};

// Gather all .drum elements keyed by data-drum
const drumPads = {};
document.querySelectorAll('.drum').forEach(el => {
  drumPads[el.dataset.drum] = el;
});

const selDifficulty   = document.getElementById('sel-difficulty');
const selPattern      = document.getElementById('sel-pattern');
const btnPlayPattern  = document.getElementById('btn-play-pattern');
const btnStopPattern  = document.getElementById('btn-stop-pattern');
const patternInfo     = document.getElementById('pattern-info');
const btnRecord       = document.getElementById('btn-record');
const btnStopRecord   = document.getElementById('btn-stop-record');
const btnPlayRec      = document.getElementById('btn-play-recording');
const btnClearRec     = document.getElementById('btn-clear-recording');
const recStatus       = document.getElementById('rec-status');


/* ================================================================
   SECTION 4 — VISUAL FEEDBACK
   Adds .hit class, lets CSS animation play, then removes it.
================================================================ */
function flashPad(drum) {
  const el = drumPads[drum];
  if (!el) return;
  const cls = (drum === 'kick') ? 'hit-kick' : 'hit';
  el.classList.remove(cls);          // reset if mid-animation
  void el.offsetWidth;               // force reflow
  el.classList.add(cls);
  setTimeout(() => el.classList.remove(cls), 220);
}


/* ================================================================
   SECTION 5 — TRIGGER (combines audio + visual)
================================================================ */
function triggerDrum(drum) {
  AudioEngine.play(drum);
  flashPad(drum);
}


/* ================================================================
   SECTION 6 — INPUT HANDLERS (mouse/touch + keyboard)
================================================================ */

// Mouse / touch on drum pads
document.querySelectorAll('.drum').forEach(el => {
  el.addEventListener('pointerdown', e => {
    e.preventDefault();
    const drum = el.dataset.drum;
    triggerDrum(drum);
    if (RecordEngine.isRecording()) RecordEngine.logHit(drum);
  });
});

// Keyboard
document.addEventListener('keydown', e => {
  if (e.repeat) return; // ignore held keys
  const drum = KEY_MAP[e.key.toLowerCase()];
  if (!drum) return;
  triggerDrum(drum);
  if (RecordEngine.isRecording()) RecordEngine.logHit(drum);
});


/* ================================================================
   SECTION 7 — PATTERN PLAYBACK ENGINE
================================================================ */
const PatternPlayer = (() => {
  let timeouts = [];   // track setTimeout IDs so we can stop
  let playing   = false;

  function play(pattern) {
    stop();
    playing = true;
    btnStopPattern.disabled = false;
    btnPlayPattern.classList.add('active');

    // Change the button text when pattern plays
    btnPlayPattern.innerHTML = '▶ Playing...';

    //Find the icon and make it spin
    const iconEl = document.querySelector('.track-icon');
    if (iconEl) iconEl.classList.add('spin');

    const ids = pattern.sequence.map(({ drum, timeOffset }) =>
      setTimeout(() => triggerDrum(drum), timeOffset)
    );
    timeouts = ids;

    // Auto-stop after last event + 500 ms buffer
    const last = Math.max(...pattern.sequence.map(e => e.timeOffset));
    timeouts.push(setTimeout(stop, last + 500));
  }

  function stop() {
    timeouts.forEach(clearTimeout);
    timeouts = [];
    playing = false;
    btnStopPattern.disabled = true;
    btnPlayPattern.classList.remove('active');

    // 1. Change the button text back to default
    btnPlayPattern.innerHTML = '▶ Play Pattern';

    // 2. Find the icon and stop the spin
    const iconEl = document.querySelector('.track-icon');
    if (iconEl) iconEl.classList.remove('spin');
  }

  return { play, stop, isPlaying: () => playing };
})();


/* ================================================================
   SECTION 8 — RECORD ENGINE
================================================================ */
const RecordEngine = (() => {
  let recording  = false;
  let startTime  = 0;
  let events     = [];      // { drum, timeOffset }
  let playTimeouts = [];

  function start() {
    events    = [];
    startTime = performance.now();
    recording = true;
    // UI
    btnRecord.disabled     = true;
    btnStopRecord.disabled = false;
    btnPlayRec.disabled    = true;
    btnClearRec.disabled   = true;
    recStatus.textContent  = '● Recording';
    recStatus.className    = 'status-pill recording';
  }

  function stop() {
    recording = false;
    btnRecord.disabled     = false;
    btnStopRecord.disabled = true;
    btnPlayRec.disabled    = events.length === 0;
    btnClearRec.disabled   = events.length === 0;
    recStatus.textContent  = events.length > 0 ? `${events.length} hits saved` : 'Idle';
    recStatus.className    = 'status-pill';
  }

  function logHit(drum) {
    events.push({ drum, timeOffset: Math.round(performance.now() - startTime) });
  }

  function playBack() {
    if (!events.length) return;
    // Clear any existing playback
    playTimeouts.forEach(clearTimeout);
    playTimeouts = [];

    recStatus.textContent = '▶ Playing back';
    recStatus.className   = 'status-pill playing';
    btnPlayRec.disabled   = true;

    playTimeouts = events.map(({ drum, timeOffset }) =>
      setTimeout(() => triggerDrum(drum), timeOffset)
    );
    const last = Math.max(...events.map(e => e.timeOffset));
    playTimeouts.push(setTimeout(() => {
      recStatus.textContent = `${events.length} hits saved`;
      recStatus.className   = 'status-pill';
      btnPlayRec.disabled   = false;
    }, last + 500));
  }

  function clear() {
    events = [];
    playTimeouts.forEach(clearTimeout);
    playTimeouts = [];
    btnPlayRec.disabled  = true;
    btnClearRec.disabled = true;
    recStatus.textContent = 'Idle';
    recStatus.className   = 'status-pill';
  }

  return { start, stop, logHit, playBack, clear, isRecording: () => recording };
})();


/* ================================================================
   SECTION 9 — PATTERN SELECTOR UI
================================================================ */
function populatePatternSelect(difficulty) {
  selPattern.innerHTML = '';
  PATTERNS[difficulty].forEach(p => {
    const opt = document.createElement('option');
    opt.value       = p.id;
    opt.textContent = p.name;
    selPattern.appendChild(opt);
  });
  updatePatternInfo(difficulty);
}

function updatePatternInfo(difficulty) {
  const id = selPattern.value;
  const pattern = PATTERNS[difficulty].find(p => p.id === id);
  if (pattern) {
    patternInfo.innerHTML = `
      <div class="track-icon">${pattern.icon}</div>
      <div class="track-details">
        <span class="track-title">${pattern.name}</span>
        <span class="track-desc">This beat can be heard in <strong>${pattern.exampleSong}</strong></span>
      </div>
    `;
  }
}

function getSelectedPattern() {
  const diff = selDifficulty.value;
  const id   = selPattern.value;
  return PATTERNS[diff].find(p => p.id === id);
}

// Event listeners for selectors
selDifficulty.addEventListener('change', () => populatePatternSelect(selDifficulty.value));
selPattern.addEventListener('change', () => updatePatternInfo(selDifficulty.value));

// Pattern playback buttons
btnPlayPattern.addEventListener('click', () => {
  const p = getSelectedPattern();
  if (p) PatternPlayer.play(p);
});
btnStopPattern.addEventListener('click', () => PatternPlayer.stop());

// Record buttons
btnRecord.addEventListener('click',    () => RecordEngine.start());
btnStopRecord.addEventListener('click',() => RecordEngine.stop());
btnPlayRec.addEventListener('click',   () => RecordEngine.playBack());
btnClearRec.addEventListener('click',  () => RecordEngine.clear());


/* ================================================================
   SECTION 10 — INITIALISE
================================================================ */
(async () => {
  // Populate pattern UI with defaults
  populatePatternSelect('beginner');
  // Preload audio buffers (silently falls back to synth if files absent)
  await AudioEngine.preload();
})();


/* ================================================================
   SECTION 11 — FULLSCREEN STAGE LOGIC
================================================================ */
const btnFullscreen = document.getElementById('btn-fullscreen');
const stageContainer = document.getElementById('stage');

btnFullscreen.addEventListener('click', () => {
  // Toggle the class that handles the resizing and rotation
  stageContainer.classList.toggle('fullscreen-mode');
  
  // Change the icon from "Expand" to "Shrink"
  if (stageContainer.classList.contains('fullscreen-mode')) {
    btnFullscreen.innerHTML = '✖'; // Close icon
  } else {
    btnFullscreen.innerHTML = '⛶'; // Expand icon
  }
});