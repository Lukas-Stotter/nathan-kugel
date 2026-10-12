// Nathan-Kugel: Sprachverbindung zum ElevenLabs-Agent "Nathan" plus Zustandsanzeige.
// Agent-Kennung kommt einmalig per Link (#agent=...) und bleibt nur im Geraet (localStorage).
// Testhilfen: ?demo (Zustaende laufen ohne Verbindung durch), Tasten i l t s w (Zustand setzen),
// ?conn=ws (WebSocket statt WebRTC), ?captions (Nathans Text unter der Kugel einblenden).

import { Conversation } from './vendor/elevenlabs-client.js';
import { createOrb } from './orb.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const DEMO = params.has('demo');
const CONNECTION = params.get('conn') === 'ws' ? 'websocket' : 'webrtc';
const CAPTIONS = params.has('captions');
const STORE_KEY = 'nathan.agent';

const STATUS = {
  idle: 'Bereit',
  connecting: 'Verbinde …',
  listening: 'Hört zu …',
  thinking: 'Denkt nach …',
  speaking: 'Spricht',
  working: 'Arbeitet …',
};

const orb = createOrb($('orb'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let conv = null;
let state = 'idle';
let mode = 'listening';
let handedOff = false;
let statusHoldUntil = 0;
let wakeLock = null;

// ---------- Anzeige ----------

function showStatus(text, ok = false) {
  $('statusText').textContent = text;
  $('status').classList.toggle('ok', ok);
}

function setState(next) {
  state = next;
  orb.setState(next);
  if (performance.now() >= statusHoldUntil) showStatus(STATUS[next]);
}

async function holdStatus(text, ms, ok = false) {
  statusHoldUntil = performance.now() + ms;
  showStatus(text, ok);
  await sleep(ms);
  if (performance.now() >= statusHoldUntil) showStatus(STATUS[state]);
}

function showChips(items) {
  const box = $('chips');
  box.innerHTML = '';
  items.forEach((label, i) => {
    const el = document.createElement('span');
    el.className = 'chip';
    el.textContent = label;
    box.appendChild(el);
    setTimeout(() => el.classList.add('on'), 140 * i + 30);
  });
}

function showTask(text) {
  const chips = [...$('chips').children];
  chips.forEach((el) => el.classList.remove('on'));
  setTimeout(() => {
    $('chips').innerHTML = '';
    $('taskText').textContent = text;
    $('task').classList.add('on');
  }, chips.length ? 450 : 0);
}

function resetHud() {
  $('chips').innerHTML = '';
  $('task').classList.remove('on');
  $('caption').textContent = '';
  handedOff = false;
}

// ---------- Werkzeuge, die der Agent in der Seite ausloesen darf ----------

function toList(value) {
  if (Array.isArray(value)) return value.map(String).map((s) => s.trim()).filter(Boolean);
  return String(value || '').split(/[,;|\n]/).map((s) => s.trim()).filter(Boolean);
}

const clientTools = {
  // Nathan blendet ein, welche gespeicherten Daten er fuer die Aufgabe gerade verwendet.
  zeige_kontext: async ({ punkte } = {}) => {
    const items = toList(punkte).slice(0, 8);
    holdStatus('Prüfe deine Vorlieben …', 1300).then(() => holdStatus('Profil geladen', 1600, true));
    setTimeout(() => showChips(items), 700);
    return 'eingeblendet';
  },
  // Nathan haelt den bestaetigten Auftrag fest, bevor die Ausfuehrung im Browser startet.
  auftrag_uebergeben: async ({ zusammenfassung } = {}) => {
    handedOff = true;
    showTask(String(zusammenfassung || '').trim() || 'Auftrag bestätigt');
    if (mode !== 'speaking') setState('working');
    return 'festgehalten';
  },
};

// ---------- Verbindung ----------

function readAgentId() {
  const hash = new URLSearchParams(location.hash.slice(1));
  const fromLink = hash.get('agent');
  if (fromLink) {
    try { localStorage.setItem(STORE_KEY, fromLink.trim()); } catch {}
    history.replaceState(null, '', location.pathname + location.search);
    return fromLink.trim();
  }
  try { return localStorage.getItem(STORE_KEY); } catch { return null; }
}

function micErrorText(err) {
  const name = err && err.name;
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'Mikro gesperrt · Einstellungen › Safari › Mikrofon';
  if (name === 'NotFoundError') return 'Kein Mikrofon gefunden';
  return 'Verbindung fehlgeschlagen';
}

function afterSession() {
  conv = null;
  mode = 'listening';
  $('mic').classList.remove('live');
  setState(handedOff ? 'working' : 'idle');
}

async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator && !wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    }
  } catch {}
}

async function start() {
  const agentId = readAgentId();
  if (!agentId) { openSetup(); return; }
  resetHud();
  $('mic').classList.add('live');
  setState('connecting');
  requestWakeLock();
  try {
    conv = await Conversation.startSession({
      agentId,
      connectionType: CONNECTION,
      clientTools,
      onModeChange: ({ mode: m }) => {
        mode = m;
        if (m === 'speaking') setState('speaking');
        else setState(handedOff ? 'working' : 'listening');
      },
      onMessage: ({ role, message }) => {
        if (role === 'user' && mode !== 'speaking' && !handedOff) setState('thinking');
        if (role === 'agent' && CAPTIONS) $('caption').textContent = message;
      },
      onError: (message) => {
        console.error('[nathan]', message);
        holdStatus('Verbindung wackelt', 2500);
      },
      onDisconnect: () => afterSession(),
    });
    if (state === 'connecting') setState('listening');
  } catch (err) {
    console.error('[nathan]', err);
    afterSession();
    holdStatus(micErrorText(err), 4500);
  }
}

async function stop() {
  const c = conv;
  conv = null;
  try { await c.endSession(); } catch {}
  afterSession();
}

$('mic').addEventListener('click', () => (conv ? stop() : start()));

// Pegel an die Kugel: beim Zuhoeren das Mikro, beim Sprechen Nathans Stimme.
(function levelLoop() {
  if (conv) {
    let v = 0;
    try {
      if (state === 'speaking') v = conv.getOutputVolume();
      else if (state === 'listening') v = conv.getInputVolume();
    } catch {}
    orb.setLevel(Math.min(1, Math.pow(v, 0.55) * 1.35));
  } else if (!DEMO) {
    orb.setLevel(0);
  }
  requestAnimationFrame(levelLoop);
})();

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && conv) requestWakeLock();
});

// ---------- Einrichtung ----------

function openSetup() {
  $('setup').classList.add('on');
  $('agentInput').focus();
}

$('setupForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const v = $('agentInput').value.trim();
  if (!/^agent_[A-Za-z0-9]{8,}$/.test(v)) {
    $('setupErr').textContent = 'Die Kennung beginnt mit agent_ …';
    return;
  }
  try { localStorage.setItem(STORE_KEY, v); } catch {}
  $('setupErr').textContent = '';
  $('setup').classList.remove('on');
});
$('agentInput').addEventListener('input', () => { $('setupErr').textContent = ''; });
$('setup').addEventListener('click', (e) => { if (e.target === $('setup')) $('setup').classList.remove('on'); });

// Doppeltipp auf "NATHAN" oeffnet die Einrichtung erneut.
document.querySelector('.brand').addEventListener('dblclick', openSetup);

// ---------- Testhilfen ----------

const KEYS = { i: 'idle', l: 'listening', t: 'thinking', s: 'speaking', w: 'working' };
window.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement) return;
  const s = KEYS[e.key];
  if (s) setState(s);
  if (e.key === 'k') clientTools.zeige_kontext({ punkte: ['Lukas', 'EU 42,5', 'Schmaler Fuß', 'Gym + HIIT', 'Flache Sohle', 'Beste Preis-Leistung'] });
  if (e.key === 'a') clientTools.auftrag_uebergeben({ zusammenfassung: 'Trainingsschuh · EU 42,5 · flach und stabil · beste Preis-Leistung · Lieferung AT' });
  if (e.key === 'r') { resetHud(); setState('idle'); }
});

if (DEMO) {
  (async function demoLoop() {
    const t0 = performance.now();
    const wave = (speed) => () => {
      const t = (performance.now() - t0) / 1000;
      return Math.max(0, 0.35 + 0.35 * Math.sin(t * speed) * Math.sin(t * speed * 0.37 + 1.3));
    };
    const seq = [['idle', 2500, null], ['listening', 3500, wave(9)], ['thinking', 2200, null], ['speaking', 4500, wave(13)], ['working', 4500, null]];
    for (;;) {
      for (const [s, ms, lv] of seq) {
        setState(s);
        const end = performance.now() + ms;
        while (performance.now() < end) {
          orb.setLevel(lv ? lv() : 0);
          await sleep(33);
        }
      }
    }
  })();
}
