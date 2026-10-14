'use strict';

// ---- 설정 ----------------------------------------------------------------
const BREAK_HOUR = 22;     // 밤 10시: 부수기 알림 (인형별 도착 시간은 아래 DOLLS의 arrive)
const DAY_START_HOUR = 4;  // 새벽 4시 전까지는 '어제'로 취급 (자정 넘어 부숴도 인정)
const SEQUENTIAL = true;   // 첫 번째 → 두 번째 → 세 번째 순서로만 부술 수 있음

const DOLLS = [
  { id: 'calcium', name: '칼슘제', question: '칼슘제를 먹었습니까?', icon: '🦴', color: '#4f7fb8', tag: '칼슘', arrive: 10 },
  { id: 'ginseng', name: '홍삼', question: '홍삼을 먹었습니까?', icon: '🌱', color: '#b5482a', tag: '홍삼', arrive: 10 },
  { id: 'acne', name: '여드름약', question: '여드름약을 먹었습니까?', icon: '💊', color: '#4f8f5a', tag: '여드름', arrive: 22 },
];

const STORE_KEY = 'breakmed:v1';
const $ = (id) => document.getElementById(id);

// ---- 저장 ----------------------------------------------------------------
function load() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || { days: {} }; }
  catch { return { days: {} }; }
}
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch { /* 사파리 사생활 보호 모드 등 */ }
}
let state = load();
state.days ||= {};

// ---- 날짜 ----------------------------------------------------------------
function gameDay(now = new Date()) {
  const d = new Date(now);
  d.setHours(d.getHours() - DAY_START_HOUR);
  d.setHours(0, 0, 0, 0);
  return d;
}
function keyOf(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function at(day, hour) {
  const d = new Date(day);
  d.setHours(hour, 0, 0, 0);
  return d;
}
function today() {
  const k = keyOf(gameDay());
  const rec = (state.days[k] ||= { received: [], broken: [] });
  // 예전 형식(received: true/false)이면 지금까지 도착한 인형만 받은 것으로 바꿈
  if (!Array.isArray(rec.received)) rec.received = rec.received ? arrivedIds() : [];
  return rec;
}
function hasArrived(doll, now = new Date()) { return now >= at(gameDay(now), doll.arrive); }
function arrivedIds(now = new Date()) { return DOLLS.filter((d) => hasArrived(d, now)).map((d) => d.id); }
function eulReul(word) { // 받침 있으면 '을', 없으면 '를'
  const c = word.charCodeAt(word.length - 1) - 0xac00;
  return word + (c >= 0 && c <= 11171 && c % 28 ? '을' : '를');
}
function hourLabel(h) {
  if (h < 12) return `오전 ${h}시`;
  if (h === 12) return '낮 12시';
  return `${h >= 18 ? '밤' : '오후'} ${h - 12}시`;
}
function isDone(rec) { return rec && DOLLS.every((d) => rec.broken.includes(d.id)); }

function streak() {
  let n = 0;
  const d = gameDay();
  if (!isDone(state.days[keyOf(d)])) d.setDate(d.getDate() - 1);
  while (isDone(state.days[keyOf(d)])) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

// ---- 짚단 인형 그림 (大자 모양, 칼로 베는 연습용) ------------------------
function strawLines(x1, x2, y1, y2, step, vertical) {
  let d = '';
  if (vertical) for (let x = x1; x <= x2; x += step) d += `M${x} ${y1}L${x + 0.6} ${y2}`;
  else for (let y = y1; y <= y2; y += step) d += `M${x1} ${y}L${x2} ${y + 0.4}`;
  return `<path d="${d}" stroke="#a9852f" stroke-width=".9" fill="none" opacity=".75"/>`;
}

function dollSVG(doll) {
  return `
<svg viewBox="0 0 120 180" xmlns="http://www.w3.org/2000/svg">
  <rect x="55" y="140" width="10" height="34" fill="#7a4a24"/>
  <rect x="32" y="169" width="56" height="9" rx="2" fill="#5a3518"/>
  <path d="M10 61Q60 55 110 61L110 81Q60 75 10 81Z" fill="#d6b25e" stroke="#94712c" stroke-width="1.5"/>
  ${strawLines(12, 108, 64, 78, 3.5, false)}
  <path d="M10 62L3 57M10 66L2 65M10 71L1 73M10 76L3 81M10 80L5 86M110 62L117 57M110 66L118 65M110 71L119 73M110 76L117 81M110 80L115 86"
        stroke="#b8923e" stroke-width="1.4" stroke-linecap="round"/>
  <path d="M41 50Q60 46 79 50L83 147Q60 153 37 147Z" fill="#dcb968" stroke="#94712c" stroke-width="1.5"/>
  ${strawLines(44, 77, 54, 146, 4.5, true)}
  <ellipse cx="60" cy="31" rx="15" ry="19" fill="#dcb968" stroke="#94712c" stroke-width="1.5"/>
  <path d="M51 16Q49 31 52 46M56 13Q55 31 56 49M60 12V50M64 13Q65 31 64 49M69 16Q71 31 68 46" stroke="#a9852f" stroke-width=".9" fill="none"/>
  <path d="M60 13L52 3M60 13L57 1M60 13L63 1M60 13L68 3M60 13L72 7M60 13L48 7" stroke="#b8923e" stroke-width="1.5" stroke-linecap="round"/>
  <rect x="44" y="46" width="32" height="6" rx="2" fill="#6b4226"/>
  <rect x="39" y="130" width="44" height="6" rx="2" fill="#6b4226"/>
  <rect x="22" y="59" width="5" height="24" rx="1.5" fill="#6b4226"/>
  <rect x="93" y="59" width="5" height="24" rx="1.5" fill="#6b4226"/>
  <rect x="45" y="86" width="30" height="38" rx="2" fill="#fbf6ea" stroke="${doll.color}" stroke-width="2.5"/>
  <circle cx="60" cy="92" r="2" fill="${doll.color}"/>
  <text x="60" y="112" text-anchor="middle" font-size="10" font-weight="800" fill="${doll.color}"
        font-family="Apple SD Gothic Neo, Noto Sans KR, sans-serif">${doll.tag}</text>
</svg>`;
}

// 베는 선: 왼쪽 아래(0,108) → 오른쪽 위(120,40)
const SLASH_SVG = `
<svg class="slash" viewBox="0 0 120 180" xmlns="http://www.w3.org/2000/svg" overflow="visible">
  <line x1="-12" y1="114.8" x2="132" y2="33.2" stroke="#fff" stroke-width="5" stroke-linecap="round"
        pathLength="1" stroke-dasharray="1" stroke-dashoffset="1" style="filter:drop-shadow(0 0 4px #fff) drop-shadow(0 0 2px #9ad)"/>
</svg>`;

// ---- 화면 ----------------------------------------------------------------
function slotStatus(rec, i) {
  const doll = DOLLS[i];
  if (!rec.received.includes(doll.id)) return 'waiting';
  if (rec.broken.includes(doll.id)) return 'broken';
  if (SEQUENTIAL && i > 0 && !rec.broken.includes(DOLLS[i - 1].id)) return 'locked';
  return 'ready';
}

function render({ arriving = [] } = {}) {
  const now = new Date();
  const day = gameDay(now);
  const rec = today();

  $('today').textContent = day.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' });
  const s = streak();
  $('streak').textContent = s > 0 ? `🔥 ${s}일 연속 성공` : '';

  const toReceive = DOLLS.filter((d) => hasArrived(d, now) && !rec.received.includes(d.id));
  $('receiveBtn').hidden = !toReceive.length;

  const left = DOLLS.filter((d) => !rec.broken.includes(d.id));
  const next = left[0];
  let msg;
  if (toReceive.length) {
    msg = `📦 ${toReceive.map((d) => d.name).join('·')} 인형이 도착했어요! 받아 주세요.`;
  } else if (next && !rec.received.includes(next.id)) {
    const coming = DOLLS.filter((d) => d.arrive === next.arrive);
    const mins = Math.ceil((at(day, next.arrive) - now) / 60000);
    msg = `${hourLabel(next.arrive)}에 ${coming.map((d) => d.name).join('·')} 인형이 도착해요.`
      + `<br><small>${Math.floor(mins / 60)}시간 ${mins % 60}분 남음</small>`;
  } else if (next) {
    msg = SEQUENTIAL
      ? `<b>${eulReul(next.name)}</b> 먹고 ${DOLLS.indexOf(next) + 1}번째 인형을 부수세요.`
      : `약을 먹고 인형을 부수세요. (${left.length}개 남음)`;
  } else {
    msg = '오늘의 목각 인형을 모두 부쉈어요.';
  }
  $('status').innerHTML = msg;
  $('done').hidden = !isDone(rec);

  const shelf = $('shelf');
  shelf.innerHTML = '';
  DOLLS.forEach((doll, i) => {
    const st = slotStatus(rec, i);
    const slot = document.createElement('div');
    const isArriving = arriving.includes(doll.id);
    slot.className = `slot ${st}${isArriving ? ' arriving' : ''}`;
    slot.dataset.id = doll.id;
    const sub = { waiting: `${hourLabel(doll.arrive)} 도착`, locked: '🔒 앞 인형 먼저', ready: '눌러서 부수기', broken: '✔ 부숨' }[st];
    slot.innerHTML = `
      <button class="doll" aria-label="${i + 1}번째 목각 인형: ${doll.name} (${sub})" ${st === 'ready' ? '' : 'aria-disabled="true"'}>
        <div class="half bot">${dollSVG(doll)}</div>
        <div class="half top">${dollSVG(doll)}</div>
        ${SLASH_SVG}
      </button>
      <div class="label">${i + 1}. ${doll.name}</div>
      <div class="sub">${sub}</div>`;
    if (isArriving) slot.querySelector('.doll').style.animationDelay = `${arriving.indexOf(doll.id) * 0.15}s`;
    if (st === 'broken') {
      slot.querySelector('.half.top').style.transform = FALLEN;
    }
    slot.querySelector('.doll').addEventListener('click', () => onDollTap(i));
    shelf.appendChild(slot);
  });

  if (arriving.length) {
    setTimeout(() => shelf.querySelectorAll('.slot').forEach((el) => el.classList.remove('arriving')), 1200);
  }
}

// ---- 상호작용 ------------------------------------------------------------
const FALLEN = 'translate(-14%, 34%) rotate(-30deg)'; // 베인 윗부분이 떨어져 누운 자세
let pending = null;
let busy = false;

function onDollTap(i) {
  const rec = today();
  const st = slotStatus(rec, i);
  const slot = $('shelf').children[i];
  if (st === 'locked') {
    nudge(slot);
    $('status').innerHTML = `먼저 <b>${DOLLS[i - 1].name}</b> 인형부터 부숴야 해요.`;
    return;
  }
  if (st !== 'ready' || busy) return;
  pending = i;
  $('modalIcon').textContent = DOLLS[i].icon;
  $('modalQ').textContent = DOLLS[i].question;
  $('modal').hidden = false;
  $('ateBtn').focus();
}

function nudge(el) {
  el.querySelector('.doll').animate(
    [{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(0)' }],
    { duration: 260 });
}

$('modal').addEventListener('click', (e) => {
  if (e.target === $('modal')) { $('modal').hidden = true; pending = null; }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !$('modal').hidden) { $('modal').hidden = true; pending = null; }
});

$('ateBtn').addEventListener('click', async () => {
  if (pending === null) return;
  const i = pending;
  pending = null;
  $('modal').hidden = true;
  busy = true;
  const rec = today();
  if (!rec.broken.includes(DOLLS[i].id)) rec.broken.push(DOLLS[i].id);
  save(); // 연출 도중 앱을 닫아도 기록은 남도록 먼저 저장
  try { await smash(i); } finally { busy = false; }
  render();
  if (isDone(rec)) celebrate();
});

$('receiveBtn').addEventListener('click', () => {
  const rec = today();
  const fresh = arrivedIds().filter((id) => !rec.received.includes(id));
  rec.received.push(...fresh);
  save();
  render({ arriving: fresh });
});

// ---- 부수기 연출 ---------------------------------------------------------
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

async function smash(i) {
  const slot = $('shelf').children[i];
  slot.classList.remove('ready');
  const doll = slot.querySelector('.doll');
  const top = doll.querySelector('.half.top');
  const slash = doll.querySelector('.slash');
  const line = slash.querySelector('line');
  const box = doll.getBoundingClientRect();

  // 1) 숨 고르기: 살짝 움찔
  if (!reduced) {
    await doll.animate([
      { transform: 'rotate(0)' }, { transform: 'rotate(2deg) translateX(2px)' }, { transform: 'rotate(0)' },
    ], { duration: 300, easing: 'ease-in-out' }).finished;
  }

  // 2) 싹둑! 칼날이 대각선으로 지나감
  slash.style.opacity = '1';
  swish();
  navigator.vibrate?.([15, 20, 90]);
  await line.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }],
    { duration: reduced ? 1 : 110, easing: 'ease-in', fill: 'forwards' }).finished;
  bang(box.left + box.width * 0.78, box.top + box.height * 0.18);
  if (!reduced) {
    chips(box.left + box.width / 2, box.top + box.height * 0.41, 30);
    slash.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 350, fill: 'forwards' });
    await wait(260); // 베인 뒤 잠깐 멈춤 — 그다음 스르륵
  }
  slash.style.opacity = '0';

  // 3) 윗부분이 베인 면을 따라 미끄러져 떨어짐
  await top.animate([
    { transform: 'translate(0,0) rotate(0)' },
    { transform: 'translate(-9%, 5%) rotate(-3deg)', offset: 0.3, easing: 'ease-in' },
    { transform: 'translate(-17%, 37%) rotate(-38deg)', offset: 0.78 },
    { transform: 'translate(-13%, 31%) rotate(-26deg)', offset: 0.9 },
    { transform: FALLEN },
  ], { duration: reduced ? 1 : 900, easing: 'ease-in', fill: 'forwards' }).finished;
  if (!reduced) {
    thud();
    chips(box.left + box.width * 0.4, box.top + box.height * 0.85, 10);
  }
  await wait(300);
}

function bang(x, y) {
  const el = document.createElement('div');
  el.className = 'bang';
  el.textContent = '싹둑!';
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  $('fx').appendChild(el);
  el.animate([
    { transform: 'translate(-50%,-50%) scale(.3) rotate(-12deg)', opacity: 0 },
    { transform: 'translate(-50%,-50%) scale(1.3) rotate(-8deg)', opacity: 1, offset: 0.25 },
    { transform: 'translate(-50%,-90%) scale(1) rotate(-8deg)', opacity: 0 },
  ], { duration: 800, easing: 'ease-out' }).finished.then(() => el.remove());
}

function chips(x, y, n) {
  for (let k = 0; k < n; k++) {
    const el = document.createElement('div');
    el.className = 'chip';
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.width = `${2 + Math.random() * 2}px`;
    el.style.height = `${8 + Math.random() * 14}px`;
    if (Math.random() < 0.35) el.style.background = '#b8923e';
    $('fx').appendChild(el);
    const a = Math.random() * Math.PI * 2;
    const v = 80 + Math.random() * 160;
    const dx = Math.cos(a) * v;
    const dy = Math.sin(a) * v - 120;
    const rot = (Math.random() - 0.5) * 1080;
    el.animate([
      { transform: 'translate(0,0) rotate(0)', opacity: 1 },
      { transform: `translate(${dx * 0.6}px, ${dy * 0.6}px) rotate(${rot * 0.5}deg)`, opacity: 1, offset: 0.4 },
      { transform: `translate(${dx}px, ${dy + 380}px) rotate(${rot}deg)`, opacity: 0 },
    ], { duration: 900 + Math.random() * 500, easing: 'cubic-bezier(.25,.6,.6,1)' }).finished.then(() => el.remove());
  }
}

let audio;
function noise(seconds, shape, filterType, freq, gainValue) {
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    const len = Math.floor(audio.sampleRate * seconds);
    const buf = audio.createBuffer(1, len, audio.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * shape(i / len);
    const src = audio.createBufferSource();
    src.buffer = buf;
    const filter = audio.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = freq;
    const gain = audio.createGain();
    gain.gain.value = gainValue;
    src.connect(filter).connect(gain).connect(audio.destination);
    src.start();
  } catch { /* 소리 없이 진행 */ }
}
const swish = () => noise(0.22, (t) => Math.sin(Math.PI * t) ** 2, 'bandpass', 3200, 1.2); // 칼바람
const thud = () => noise(0.18, (t) => (1 - t) ** 4, 'lowpass', 500, 1.0);                // 툭 떨어짐

function celebrate() {
  if (reduced) return;
  const w = innerWidth;
  for (let k = 0; k < 4; k++) setTimeout(() => chips(w * (0.2 + 0.2 * k), innerHeight * 0.4, 18), k * 150);
}

// ---- 앱 알림 (앱이 살아 있는 동안) ----------------------------------------
const NOTIFY_KEY = 'breakmed:notify';
let timers = [];

function notifyOn() {
  try { return localStorage.getItem(NOTIFY_KEY) === '1' && 'Notification' in window && Notification.permission === 'granted'; }
  catch { return false; }
}

async function show(title, body) {
  const opts = { body, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: 'breakmed', renotify: true };
  const reg = await navigator.serviceWorker?.getRegistration();
  if (reg) reg.showNotification(title, opts);
  else new Notification(title, opts);
}

function scheduleNotifications() {
  timers.forEach(clearTimeout);
  timers = [];
  if (!notifyOn()) return;
  const now = new Date();
  // 인형이 도착하는 시각마다, 그리고 밤 부수기 시각에 알림
  const hours = [...new Set([...DOLLS.map((d) => d.arrive), BREAK_HOUR])];
  const plan = hours.map((hour) => [hour, () => {
    const rec = today();
    const coming = DOLLS.filter((d) => d.arrive === hour);
    const left = DOLLS.filter((d) => d.arrive <= hour && !rec.broken.includes(d.id));
    if (coming.length) show(`📦 ${coming.map((d) => d.name).join('·')} 인형 도착!`, '먹고 나서 인형을 베세요.');
    else if (left.length) show('🔨 인형을 벨 시간!', `${left.map((d) => d.name).join(', ')} 먹고 인형을 베세요.`);
  }]);
  for (const [hour, fn] of plan) {
    const t = new Date(now);
    t.setHours(hour, 0, 0, 0);
    if (t <= now) t.setDate(t.getDate() + 1);
    timers.push(setTimeout(() => { fn(); scheduleNotifications(); }, t - now));
  }
}

function notifyHoursText() {
  return [...new Set([...DOLLS.map((d) => d.arrive), BREAK_HOUR])].sort((x, y) => x - y).map(hourLabel).join(', ');
}

function renderNotifyState() {
  const el = $('notifyState');
  if (!('Notification' in window)) {
    el.textContent = '이 브라우저는 알림을 지원하지 않아요. (아이폰은 홈 화면에 추가한 뒤 열어 주세요)';
    $('notifyBtn').disabled = true;
    return;
  }
  if (Notification.permission === 'denied') el.textContent = '알림이 차단돼 있어요. 휴대폰 설정에서 허용해 주세요.';
  else if (notifyOn()) el.textContent = `켜짐 — 매일 ${notifyHoursText()}`;
  else el.textContent = '';
  $('notifyBtn').textContent = notifyOn() ? '🔔 테스트 알림 보내기' : '🔔 앱 알림 켜기';
}

$('notifyBtn').addEventListener('click', async () => {
  if (notifyOn()) { show('🔔 테스트', '알림이 잘 옵니다!'); return; }
  const p = await Notification.requestPermission();
  if (p === 'granted') {
    try { localStorage.setItem(NOTIFY_KEY, '1'); } catch { /* 무시 */ }
    show('🔔 알림 켜짐', `매일 ${notifyHoursText()}에 알려 드릴게요.`);
  }
  renderNotifyState();
  scheduleNotifications();
});

// ---- 시작 ----------------------------------------------------------------
if ('serviceWorker' in navigator) {
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

render();
renderNotifyState();
scheduleNotifications();

// 시간이 지나면(인형 도착 시각, 새벽 4시 등) 화면 갱신 — 모달이 떠 있거나 부수는 중엔 건드리지 않음
const idle = () => $('modal').hidden && !busy;
setInterval(() => { if (idle()) render(); }, 30000);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  if (idle()) render();
  scheduleNotifications();
});
