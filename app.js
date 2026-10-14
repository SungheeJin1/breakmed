'use strict';

// ---- 설정 ----------------------------------------------------------------
const ARRIVE_HOUR = 13;    // 오후 1시: 목각 인형 도착 + 알림
const BREAK_HOUR = 22;     // 밤 10시: 부수기 알림
const DAY_START_HOUR = 4;  // 새벽 4시 전까지는 '어제'로 취급 (자정 넘어 부숴도 인정)
const SEQUENTIAL = true;   // 첫 번째 → 두 번째 → 세 번째 순서로만 부술 수 있음

const DOLLS = [
  { id: 'calcium', name: '칼슘제', question: '칼슘제를 먹었습니까?', icon: '🦴', color: '#4f7fb8', tag: '칼슘' },
  { id: 'ginseng', name: '홍삼', question: '홍삼을 먹었습니까?', icon: '🌱', color: '#b5482a', tag: '홍삼' },
  { id: 'acne', name: '여드름약', question: '여드름약을 먹었습니까?', icon: '💊', color: '#4f8f5a', tag: '여드름' },
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
  state.days[k] ||= { received: false, broken: [] };
  return state.days[k];
}
function isDone(rec) { return rec && DOLLS.every((d) => rec.broken.includes(d.id)); }

function streak() {
  let n = 0;
  const d = gameDay();
  if (!isDone(state.days[keyOf(d)])) d.setDate(d.getDate() - 1);
  while (isDone(state.days[keyOf(d)])) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

// ---- 목각 인형 그림 ------------------------------------------------------
function dollSVG(doll) {
  return `
<svg viewBox="0 0 120 180" xmlns="http://www.w3.org/2000/svg">
  <path d="M60 6C34 6 24 34 32 60C12 78 8 118 14 148C18 170 40 177 60 177C80 177 102 170 106 148C112 118 108 78 88 60C96 34 86 6 60 6Z"
        fill="#c48a52" stroke="#6b4226" stroke-width="3"/>
  <g fill="none" stroke="#8b5a2b" stroke-width="1.4" opacity=".35">
    <path d="M24 100C40 92 44 110 60 104"/><path d="M70 150C84 142 92 156 102 146"/>
    <path d="M18 132C30 126 36 138 48 132"/><path d="M78 88C88 82 96 92 104 86"/>
  </g>
  <path d="M60 10C38 10 28 30 30 52C40 46 50 66 60 66C70 66 80 46 90 52C92 30 82 10 60 10Z" fill="${doll.color}"/>
  <circle cx="60" cy="42" r="21" fill="#f7e3c8" stroke="#6b4226" stroke-width="1.5"/>
  <path d="M42 30C48 22 72 22 78 30C70 27 50 27 42 30Z" fill="#3b2414"/>
  <ellipse cx="52" cy="42" rx="2.6" ry="3.4" fill="#3b2414"/>
  <ellipse cx="68" cy="42" rx="2.6" ry="3.4" fill="#3b2414"/>
  <circle cx="47" cy="50" r="4" fill="#f19a9a" opacity=".7"/>
  <circle cx="73" cy="50" r="4" fill="#f19a9a" opacity=".7"/>
  <path d="M54 53Q60 58 66 53" fill="none" stroke="#3b2414" stroke-width="2" stroke-linecap="round"/>
  <ellipse cx="60" cy="122" rx="32" ry="38" fill="#fff6e6" stroke="${doll.color}" stroke-width="4"/>
  <circle cx="60" cy="108" r="11" fill="${doll.color}" opacity=".9"/>
  <circle cx="60" cy="108" r="4" fill="#fff6e6"/>
  <text x="60" y="140" text-anchor="middle" font-size="14" font-weight="800" fill="${doll.color}"
        font-family="Apple SD Gothic Neo, Noto Sans KR, sans-serif">${doll.tag}</text>
</svg>`;
}

const CRACK_SVG = `
<svg class="crack" viewBox="0 0 120 180" xmlns="http://www.w3.org/2000/svg">
  <polyline points="64.8,0 55.2,39.6 66,72 54,104.4 64.8,136.8 56.4,180"
            fill="none" stroke="#2a160a" stroke-width="3.5" stroke-linejoin="bevel"
            pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/>
</svg>`;

// ---- 화면 ----------------------------------------------------------------
function slotStatus(rec, i) {
  const doll = DOLLS[i];
  if (!rec.received) return 'waiting';
  if (rec.broken.includes(doll.id)) return 'broken';
  if (SEQUENTIAL && i > 0 && !rec.broken.includes(DOLLS[i - 1].id)) return 'locked';
  return 'ready';
}

function render({ arriving = false } = {}) {
  const now = new Date();
  const day = gameDay(now);
  const rec = today();
  const arriveAt = at(day, ARRIVE_HOUR);

  $('today').textContent = day.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' });
  const s = streak();
  $('streak').textContent = s > 0 ? `🔥 ${s}일 연속 성공` : '';

  const canReceive = !rec.received && now >= arriveAt;
  $('receiveBtn').hidden = !canReceive;

  const left = DOLLS.filter((d) => !rec.broken.includes(d.id));
  let msg;
  if (!rec.received && now < arriveAt) {
    const mins = Math.ceil((arriveAt - now) / 60000);
    msg = `오후 ${ARRIVE_HOUR - 12}시에 목각 인형 3개가 도착해요.<br><small>${Math.floor(mins / 60)}시간 ${mins % 60}분 남음</small>`;
  } else if (canReceive) {
    msg = '📦 목각 인형이 도착했어요! 받아 주세요.';
  } else if (left.length) {
    const next = SEQUENTIAL ? left[0] : null;
    msg = next
      ? `<b>${next.name}</b>을(를) 먹고 ${DOLLS.indexOf(next) + 1}번째 인형을 부수세요.`
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
    slot.className = `slot ${st}${arriving ? ' arriving' : ''}`;
    slot.dataset.id = doll.id;
    const sub = { waiting: '도착 전', locked: '🔒 앞 인형 먼저', ready: '눌러서 부수기', broken: '✔ 부숨' }[st];
    slot.innerHTML = `
      <button class="doll" aria-label="${i + 1}번째 목각 인형: ${doll.name} (${sub})" ${st === 'ready' ? '' : 'aria-disabled="true"'}>
        <div class="half l">${dollSVG(doll)}</div>
        <div class="half r">${dollSVG(doll)}</div>
        ${CRACK_SVG}
      </button>
      <div class="label">${i + 1}. ${doll.name}</div>
      <div class="sub">${sub}</div>`;
    if (arriving) slot.querySelector('.doll').style.animationDelay = `${i * 0.15}s`;
    if (st === 'broken') {
      slot.querySelector('.half.l').style.transform = 'translate(-10%, 0) rotate(-12deg)';
      slot.querySelector('.half.r').style.transform = 'translate(10%, 0) rotate(12deg)';
    }
    slot.querySelector('.doll').addEventListener('click', () => onDollTap(i));
    shelf.appendChild(slot);
  });

  if (arriving) {
    setTimeout(() => shelf.querySelectorAll('.slot').forEach((el) => el.classList.remove('arriving')), 1200);
  }
}

// ---- 상호작용 ------------------------------------------------------------
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
  today().received = true;
  save();
  render({ arriving: true });
});

// ---- 부수기 연출 ---------------------------------------------------------
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

async function smash(i) {
  const slot = $('shelf').children[i];
  slot.classList.remove('ready');
  const doll = slot.querySelector('.doll');
  const l = doll.querySelector('.half.l');
  const r = doll.querySelector('.half.r');
  const crack = doll.querySelector('.crack');
  const line = crack.querySelector('polyline');

  // 1) 덜덜 떨기
  if (!reduced) {
    await doll.animate([
      { transform: 'rotate(0) scale(1)' },
      { transform: 'rotate(-6deg) scale(1.03)' },
      { transform: 'rotate(6deg) scale(1.05)' },
      { transform: 'rotate(-8deg) scale(1.07)' },
      { transform: 'rotate(8deg) scale(1.08)' },
      { transform: 'rotate(0) scale(1.1)' },
    ], { duration: 520, easing: 'ease-in' }).finished;
  }

  // 2) 쩍! 금이 감
  crack.style.opacity = '1';
  await line.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: reduced ? 1 : 180, fill: 'forwards' }).finished;

  // 3) 쾅! 두 동강
  crunch();
  navigator.vibrate?.([20, 30, 120]);
  const box = doll.getBoundingClientRect();
  bang(box.left + box.width / 2, box.top + box.height * 0.35);
  if (!reduced) {
    document.body.classList.remove('shake');
    void document.body.offsetWidth;
    document.body.classList.add('shake');
    chips(box.left + box.width / 2, box.top + box.height * 0.45, 26);
  }
  crack.style.opacity = '0';
  const fly = (el, dir) => el.animate([
    { transform: 'translate(0,0) rotate(0)' },
    { transform: `translate(${dir * 40}%, -16%) rotate(${dir * 30}deg)`, offset: 0.45 },
    { transform: `translate(${dir * 10}%, 0) rotate(${dir * 12}deg)` },
  ], { duration: reduced ? 1 : 650, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'forwards' }).finished;
  await Promise.all([fly(l, -1), fly(r, 1)]);
  await wait(250);
}

function bang(x, y) {
  const el = document.createElement('div');
  el.className = 'bang';
  el.textContent = '쾅!';
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
    const w = 6 + Math.random() * 10;
    el.style.width = `${w}px`;
    el.style.height = `${w * (0.4 + Math.random() * 0.4)}px`;
    if (Math.random() < 0.3) el.style.background = '#8b5a2b';
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
function crunch() {
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    const len = audio.sampleRate * 0.25;
    const buf = audio.createBuffer(1, len, audio.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    const src = audio.createBufferSource();
    src.buffer = buf;
    const filter = audio.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1400;
    const gain = audio.createGain();
    gain.gain.value = 0.8;
    src.connect(filter).connect(gain).connect(audio.destination);
    src.start();
  } catch { /* 소리 없이 진행 */ }
}

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
  const plan = [
    [ARRIVE_HOUR, () => show('📦 목각 인형 도착!', '오늘의 목각 인형 3개가 도착했어요.')],
    [BREAK_HOUR, () => {
      const left = DOLLS.filter((d) => !today().broken.includes(d.id));
      if (left.length) show('🔨 목각 인형을 부술 시간!', `${left.map((d) => d.name).join(', ')} 먹고 인형을 부수세요.`);
    }],
  ];
  for (const [hour, fn] of plan) {
    const t = new Date(now);
    t.setHours(hour, 0, 0, 0);
    if (t <= now) t.setDate(t.getDate() + 1);
    timers.push(setTimeout(() => { fn(); scheduleNotifications(); }, t - now));
  }
}

function renderNotifyState() {
  const el = $('notifyState');
  if (!('Notification' in window)) {
    el.textContent = '이 브라우저는 알림을 지원하지 않아요. (아이폰은 홈 화면에 추가한 뒤 열어 주세요)';
    $('notifyBtn').disabled = true;
    return;
  }
  if (Notification.permission === 'denied') el.textContent = '알림이 차단돼 있어요. 휴대폰 설정에서 허용해 주세요.';
  else if (notifyOn()) el.textContent = `켜짐 — 매일 오후 ${ARRIVE_HOUR - 12}시, 밤 ${BREAK_HOUR - 12}시`;
  else el.textContent = '';
  $('notifyBtn').textContent = notifyOn() ? '🔔 테스트 알림 보내기' : '🔔 앱 알림 켜기';
}

$('notifyBtn').addEventListener('click', async () => {
  if (notifyOn()) { show('🔔 테스트', '알림이 잘 옵니다!'); return; }
  const p = await Notification.requestPermission();
  if (p === 'granted') {
    try { localStorage.setItem(NOTIFY_KEY, '1'); } catch { /* 무시 */ }
    show('🔔 알림 켜짐', `매일 오후 ${ARRIVE_HOUR - 12}시와 밤 ${BREAK_HOUR - 12}시에 알려 드릴게요.`);
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

// 시간이 지나면(오후 1시, 새벽 4시 등) 화면 갱신 — 모달이 떠 있거나 부수는 중엔 건드리지 않음
const idle = () => $('modal').hidden && !busy;
setInterval(() => { if (idle()) render(); }, 30000);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  if (idle()) render();
  scheduleNotifications();
});
