// 3D 도장 장면: 大자 짚단 인형 3개를 세우고, 베면 윗부분이 잘린 면을 따라 미끄러져 앞으로 쓰러짐.
import * as THREE from './vendor/three.module.min.js';

const SPACING = 2.2;                       // 인형 사이 간격
const CUT_Y = 1.75;                        // 베는 높이 (몸통 가운데)
const CUT_ANGLE = 0.5;                     // 베는 각도(라디안): 왼쪽 아래 → 오른쪽 위
const CUT_DIR = new THREE.Vector3(Math.cos(CUT_ANGLE), Math.sin(CUT_ANGLE), 0);
const CUT_NORMAL = new THREE.Vector3(-Math.sin(CUT_ANGLE), Math.cos(CUT_ANGLE), 0);
const FALLEN = { pos: new THREE.Vector3(-0.25, 0.36 - CUT_Y, 0.55), rot: new THREE.Euler(1.47, 0.18, 0.12) };

const easeIn = (t) => t * t;
const easeOut = (t) => 1 - (1 - t) ** 3;
const lerp = (a, b, t) => a + (b - a) * t;

// ---- 캔버스로 만드는 텍스처 ------------------------------------------------
function canvasTexture(w, h, draw, repeat) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
}

function strawTexture() {
  return canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = '#d6b05c';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) {
      const x = Math.random() * w;
      g.strokeStyle = ['#b8923e', '#e9d08a', '#c9a24c', '#a9852f'][i % 4];
      g.globalAlpha = 0.35 + Math.random() * 0.5;
      g.lineWidth = 0.6 + Math.random() * 1.6;
      g.beginPath();
      g.moveTo(x, 0);
      g.bezierCurveTo(x + Math.random() * 6 - 3, h / 3, x + Math.random() * 6 - 3, (2 * h) / 3, x + Math.random() * 4 - 2, h);
      g.stroke();
    }
  }, [3, 1]);
}

function floorTexture() {
  return canvasTexture(512, 512, (g, w, h) => {
    const plank = h / 6;
    for (let i = 0; i < 6; i++) {
      g.fillStyle = ['#b7834e', '#ad7a46', '#bf8b55'][i % 3];
      g.fillRect(0, i * plank, w, plank);
      g.strokeStyle = 'rgba(80,45,20,.25)';
      for (let k = 0; k < 14; k++) {
        g.lineWidth = Math.random() * 1.5;
        const y = i * plank + Math.random() * plank;
        g.beginPath();
        g.moveTo(0, y);
        g.bezierCurveTo(w / 3, y + Math.random() * 6 - 3, (2 * w) / 3, y + Math.random() * 6 - 3, w, y);
        g.stroke();
      }
      g.fillStyle = 'rgba(60,30,10,.55)';
      g.fillRect(0, i * plank, w, 2);
      g.fillRect(((i * 197) % w), i * plank, 2, plank);
    }
  }, [4, 4]);
}

function wallTexture() {
  return canvasTexture(512, 256, (g, w, h) => {
    g.fillStyle = '#f1e6cf';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#6b4226';
    g.lineWidth = 6;
    for (let x = 0; x <= w; x += w / 8) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    for (let y = 0; y <= h; y += h / 4) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  }, [3, 1]);
}

function tagTexture(doll) {
  return canvasTexture(128, 170, (g, w, h) => {
    g.fillStyle = '#fbf6ea';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = doll.color;
    g.lineWidth = 10;
    g.strokeRect(5, 5, w - 10, h - 10);
    g.fillStyle = doll.color;
    g.beginPath();
    g.arc(w / 2, 26, 7, 0, Math.PI * 2);
    g.fill();
    g.font = `800 ${doll.tag.length > 2 ? 30 : 40}px "Apple SD Gothic Neo","Noto Sans KR",sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(doll.tag, w / 2, h * 0.58);
  });
}

// 잘린 면 안쪽(뒷면)이 속이 빈 것처럼 안 보이도록 밝은 짚 색으로 칠함
function withInnerColor(mat, hex) {
  const inner = new THREE.Color(hex);
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.innerColor = { value: inner };
    shader.fragmentShader = 'uniform vec3 innerColor;\n' + shader.fragmentShader.replace(
      '#include <dithering_fragment>',
      '#include <dithering_fragment>\nif (!gl_FrontFacing) gl_FragColor.rgb = innerColor;');
  };
  mat.side = THREE.DoubleSide;
  return mat;
}

// ---- 짚단 인형 한 개 -------------------------------------------------------
function buildDummy(doll, straw) {
  const mats = {
    straw: withInnerColor(new THREE.MeshStandardMaterial({ map: straw, roughness: 0.95 }), '#f0d993'),
    rope: new THREE.MeshStandardMaterial({ color: '#6b4226', roughness: 0.8 }),
    wood: withInnerColor(new THREE.MeshStandardMaterial({ color: '#7a4a24', roughness: 0.7 }), '#c79a63'),
    tag: new THREE.MeshStandardMaterial({ map: tagTexture(doll), roughness: 0.6, side: THREE.DoubleSide }),
  };
  const g = new THREE.Group();
  const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
    return m;
  };
  add(new THREE.BoxGeometry(1.0, 0.12, 1.0), mats.wood, 0, 0.06, 0);
  add(new THREE.CylinderGeometry(0.08, 0.09, 0.9, 12), mats.wood, 0, 0.55, 0);
  add(new THREE.CylinderGeometry(0.3, 0.35, 1.45, 28, 1), mats.straw, 0, 1.55, 0);                // 몸통
  add(new THREE.CylinderGeometry(0.13, 0.13, 1.7, 18, 1), mats.straw, 0, 2.05, 0, 0, 0, Math.PI / 2); // 팔
  const head = add(new THREE.SphereGeometry(0.27, 24, 16), mats.straw, 0, 2.58, 0);
  head.scale.set(1, 1.25, 1);
  add(new THREE.ConeGeometry(0.12, 0.28, 10), mats.straw, 0, 3.0, 0, Math.PI, 0, 0);               // 머리 위 짚 술
  for (const x of [-0.92, 0.92]) add(new THREE.ConeGeometry(0.16, 0.2, 10), mats.straw, x, 2.05, 0, 0, 0, x < 0 ? -Math.PI / 2 : Math.PI / 2);
  add(new THREE.TorusGeometry(0.29, 0.04, 8, 28), mats.rope, 0, 2.25, 0, Math.PI / 2);              // 목 새끼줄
  add(new THREE.TorusGeometry(0.345, 0.04, 8, 28), mats.rope, 0, 1.1, 0, Math.PI / 2);              // 허리
  for (const x of [-0.6, 0.6]) add(new THREE.TorusGeometry(0.14, 0.035, 8, 20), mats.rope, x, 2.05, 0, 0, Math.PI / 2);
  add(new THREE.PlaneGeometry(0.4, 0.53), mats.tag, 0, 1.55, 0.345);                                // 약 이름표
  return { group: g, mats };
}

// ---- 장면 ----------------------------------------------------------------
export function createScene(container, dolls, onTap) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'low-power' });
  } catch {
    return null; // WebGL 안 되면 2D로
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.localClippingEnabled = true;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#efe2c8');
  scene.fog = new THREE.Fog('#efe2c8', 9, 18);

  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
  const CAM_HOME = new THREE.Vector3(0, 2.7, 7.6);
  const LOOK_HOME = new THREE.Vector3(0, 1.45, 0);
  const look = LOOK_HOME.clone();
  camera.position.copy(CAM_HOME);

  scene.add(new THREE.HemisphereLight('#fff6e0', '#8a6040', 1.6));
  const sun = new THREE.DirectionalLight('#fff1d6', 2.2);
  sun.position.set(-3, 7, 5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -5, right: 5, top: 5, bottom: -3, near: 1, far: 20 });
  sun.shadow.bias = -0.0005;
  scene.add(sun);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshStandardMaterial({ map: floorTexture(), roughness: 0.85 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(30, 6), new THREE.MeshStandardMaterial({ map: wallTexture(), roughness: 1 }));
  wall.position.set(0, 3, -3.5);
  scene.add(wall);

  const straw = strawTexture();
  const strawGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.22, 4);
  const strawMat = new THREE.MeshStandardMaterial({ color: '#e2c374', roughness: 0.9 });

  // 인형마다: root(위치·흔들림) 아래에 아랫부분(bot)과 윗부분(top)을 같은 모양으로 2벌 두고 잘린 면으로 잘라 보여줌
  const items = dolls.map((doll, i) => {
    const root = new THREE.Group();
    root.position.x = (i - 1) * SPACING;
    scene.add(root);
    const bot = buildDummy(doll, straw);
    const top = buildDummy(doll, straw);
    // top 그룹의 원점을 잘린 면 가운데로 옮겨서 거기를 축으로 돌게 함
    const pivot = new THREE.Group();
    pivot.position.set(0, CUT_Y, 0);
    top.group.position.set(0, -CUT_Y, 0);
    pivot.add(top.group);
    root.add(bot.group, pivot);
    const planeBot = new THREE.Plane();
    const planeTop = new THREE.Plane();
    const mats = [...Object.values(bot.mats), ...Object.values(top.mats)];
    for (const m of Object.values(bot.mats)) { m.clippingPlanes = [planeBot]; m.clipShadows = true; }
    for (const m of Object.values(top.mats)) { m.clippingPlanes = [planeTop]; m.clipShadows = true; }
    for (const m of mats) m.userData.base = m.color.clone();
    return { doll, root, pivot, planeBot, planeTop, mats, state: 'waiting', anim: null, sway: Math.random() * 6 };
  });

  // 잘린 면(평면)을 각 조각에 붙여서 같이 움직이게 함
  const localPlane = new THREE.Plane(CUT_NORMAL.clone(), -CUT_NORMAL.dot(new THREE.Vector3(0, CUT_Y, 0)));
  const negPlane = localPlane.clone().negate();
  const pivotLocalPlane = new THREE.Plane(CUT_NORMAL.clone(), 0);
  function updatePlanes(it) {
    it.root.updateMatrixWorld(true);
    it.planeBot.copy(negPlane).applyMatrix4(it.root.matrixWorld);
    it.planeTop.copy(pivotLocalPlane).applyMatrix4(it.pivot.matrixWorld);
  }

  function setLook(it, st) {
    const ghost = st === 'waiting';
    const grey = new THREE.Color('#8f8a80');
    for (const m of it.mats) {
      m.transparent = ghost;
      m.opacity = ghost ? 0.16 : 1;
      m.depthWrite = !ghost;
      m.color.copy(m.userData.base);
      if (st === 'locked') m.color.lerp(grey, 0.45);
      m.needsUpdate = true;
    }
    it.root.traverse((o) => { if (o.isMesh) o.castShadow = !ghost; });
  }

  function placeTop(it, broken) {
    if (broken) {
      it.pivot.position.set(FALLEN.pos.x, CUT_Y + FALLEN.pos.y, FALLEN.pos.z);
      it.pivot.rotation.copy(FALLEN.rot);
    } else {
      it.pivot.position.set(0, CUT_Y, 0);
      it.pivot.rotation.set(0, 0, 0);
    }
  }

  // ---- 크기 맞추기: 인형 3개가 화면 가로를 3등분한 칸 가운데에 오도록 화각 계산
  function resize() {
    const w = container.clientWidth || 360;
    const h = Math.round(Math.max(240, Math.min(440, w * 0.68)));
    container.style.height = `${h}px`;
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = `${h}px`;
    camera.aspect = w / h;
    const halfW = SPACING * 1.5 + 0.05;
    camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(halfW / (CAM_HOME.z * camera.aspect)));
    camera.fov = Math.max(camera.fov, 30);
    camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize);
  resize();

  // ---- 탭으로 인형 고르기
  const ray = new THREE.Raycaster();
  renderer.domElement.addEventListener('click', (e) => {
    const r = renderer.domElement.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
    const hit = ray.intersectObjects(items.map((it) => it.root), true)[0];
    let i = hit ? items.findIndex((it) => it.root === hit.object.parent?.parent || it.root === hit.object.parent?.parent?.parent) : -1;
    if (i < 0) i = Math.max(0, Math.min(2, Math.floor(((e.clientX - r.left) / r.width) * 3))); // 빗나가도 그 칸의 인형
    onTap(i);
  });

  // ---- 짚 부스러기
  const bits = [];
  function burst(at, n, speed = 1) {
    for (let k = 0; k < n; k++) {
      const m = new THREE.Mesh(strawGeo, strawMat);
      m.position.copy(at);
      m.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      m.castShadow = true;
      scene.add(m);
      const a = Math.random() * Math.PI * 2;
      bits.push({
        m,
        v: new THREE.Vector3(Math.cos(a) * 2.2, 1.5 + Math.random() * 3, Math.sin(a) * 2.2).multiplyScalar(speed * (0.4 + Math.random())),
        w: new THREE.Vector3(Math.random() * 20 - 10, Math.random() * 20 - 10, Math.random() * 20 - 10),
        life: 1.6 + Math.random(),
      });
    }
  }

  // ---- 칼날 빛
  const bladeMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const blade = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.025), bladeMat);
  blade.rotation.z = CUT_ANGLE;
  scene.add(blade);
  const glowMat = bladeMat.clone();
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.16), glowMat);
  glow.rotation.z = CUT_ANGLE;
  scene.add(glow);

  // ---- 애니메이션 루프
  const tweens = [];
  const tween = (ms, fn) => new Promise((res) => tweens.push({ t0: performance.now(), ms: Math.max(1, ms), fn, res }));
  let shake = 0;
  const camTarget = { pos: CAM_HOME.clone(), look: LOOK_HOME.clone() };
  let last = performance.now();

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    for (let k = tweens.length - 1; k >= 0; k--) {
      const tw = tweens[k];
      const p = Math.min(1, (now - tw.t0) / tw.ms);
      tw.fn(p);
      if (p >= 1) { tweens.splice(k, 1); tw.res(); }
    }
    for (const it of items) {
      if (it.state === 'ready' && !it.anim) it.root.rotation.z = Math.sin(now / 900 + it.sway) * 0.025;
      updatePlanes(it);
    }
    for (let k = bits.length - 1; k >= 0; k--) {
      const b = bits[k];
      b.v.y -= 9.8 * dt;
      b.m.position.addScaledVector(b.v, dt);
      if (b.m.position.y < 0.02) { b.m.position.y = 0.02; b.v.multiplyScalar(0.3); b.v.y = Math.abs(b.v.y) * 0.3; b.w.multiplyScalar(0.5); }
      b.m.rotation.x += b.w.x * dt;
      b.m.rotation.z += b.w.z * dt;
      b.life -= dt;
      if (b.life < 0.4) b.m.scale.setScalar(Math.max(0.001, b.life / 0.4));
      if (b.life <= 0) { scene.remove(b.m); bits.splice(k, 1); }
    }
    camera.position.lerp(camTarget.pos, 1 - Math.exp(-dt * 6));
    look.lerp(camTarget.look, 1 - Math.exp(-dt * 6));
    camera.lookAt(look);
    if (shake > 0) {
      camera.position.x += (Math.random() - 0.5) * shake;
      camera.position.y += (Math.random() - 0.5) * shake;
      shake = Math.max(0, shake - dt * 0.6);
    }
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // ---- 바깥(app.js)에서 쓰는 기능
  return {
    canvas: renderer.domElement,

    update(states, arriving = [], reduced = false) {
      items.forEach((it, i) => {
        const st = states[i];
        it.state = st;
        setLook(it, st);
        placeTop(it, st === 'broken');
        if (st !== 'ready') it.root.rotation.z = 0;
        const k = arriving.indexOf(it.doll.id);
        if (k >= 0 && !reduced) {
          it.anim = 'drop';
          it.root.position.y = 7;
          setTimeout(() => tween(750, (p) => {
            // 위에서 떨어져 쿵, 살짝 튀어오름
            const y = p < 0.7 ? 7 * (1 - easeIn(p / 0.7)) : Math.sin(((p - 0.7) / 0.3) * Math.PI) * 0.25;
            it.root.position.y = y;
            if (p >= 1) { it.root.position.y = 0; it.anim = null; }
          }).then(() => { shake = Math.max(shake, 0.06); burst(new THREE.Vector3(it.root.position.x, 0.1, 0.3), 6, 0.4); }), k * 160);
        } else {
          it.root.position.y = 0;
        }
      });
    },

    nudge(i) {
      const it = items[i];
      tween(320, (p) => { it.root.rotation.y = Math.sin(p * Math.PI * 4) * 0.12 * (1 - p); });
    },

    // 화면 위 좌표 (DOM 효과 글자 위치용)
    screenPos(i, y = CUT_Y) {
      const v = new THREE.Vector3(items[i].root.position.x, y, 0).project(camera);
      const r = renderer.domElement.getBoundingClientRect();
      return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
    },

    async smash(i, { reduced = false, onSlash, onLand } = {}) {
      const it = items[i];
      it.anim = 'smash';
      it.root.rotation.z = 0;
      const x = it.root.position.x;
      const cutCenter = new THREE.Vector3(x, CUT_Y, 0);
      const D = reduced ? 0.01 : 1;

      // 1) 카메라가 인형 쪽으로 다가감 + 살짝 움찔
      camTarget.pos.set(x * 0.55, 2.4, 5.4);
      camTarget.look.set(x * 0.9, 1.6, 0);
      await tween(420 * D, (p) => { it.root.rotation.y = Math.sin(p * Math.PI) * 0.06; });

      // 2) 칼날이 대각선으로 지나감
      onSlash?.();
      blade.position.copy(cutCenter).add(new THREE.Vector3(0, 0, 0.42));
      glow.position.copy(blade.position).add(new THREE.Vector3(0, 0, -0.01));
      const start = cutCenter.clone().addScaledVector(CUT_DIR, 1.6).add(new THREE.Vector3(0, 0, 0.42));
      await tween(120 * D, (p) => {
        const len = 3.2 * easeOut(p);
        for (const m of [blade, glow]) {
          m.scale.x = Math.max(0.001, len);
          m.position.copy(start).addScaledVector(CUT_DIR, -len / 2);
        }
        bladeMat.opacity = 1;
        glowMat.opacity = 0.3;
      });
      burst(cutCenter.clone().add(new THREE.Vector3(0, 0, 0.3)), reduced ? 0 : 36, 1);
      shake = reduced ? 0 : 0.05;
      tween(380 * D, (p) => { bladeMat.opacity = 1 - p; glowMat.opacity = 0.3 * (1 - p); });
      await tween(280 * D, () => {}); // 베인 뒤 잠깐 멈춤

      // 3) 윗부분이 잘린 면을 따라 스르륵 미끄러지다가 앞으로 쿵 쓰러짐
      const slideTo = new THREE.Vector3(0, CUT_Y, 0).addScaledVector(CUT_DIR, -0.22);
      await tween(260 * D, (p) => {
        it.pivot.position.lerpVectors(new THREE.Vector3(0, CUT_Y, 0), slideTo, easeIn(p));
        it.pivot.rotation.z = 0.05 * p;
      });
      const endPos = new THREE.Vector3(FALLEN.pos.x, CUT_Y + FALLEN.pos.y, FALLEN.pos.z);
      await tween(520 * D, (p) => {
        const e = easeIn(p);
        it.pivot.position.lerpVectors(slideTo, endPos, e);
        it.pivot.rotation.set(lerp(0, FALLEN.rot.x, e), lerp(0, FALLEN.rot.y, e), lerp(0.05, FALLEN.rot.z, e));
      });
      onLand?.();
      shake = reduced ? 0 : 0.09;
      burst(new THREE.Vector3(x - 0.2, 0.15, 1.2), reduced ? 0 : 14, 0.5);
      await tween(180 * D, (p) => { it.pivot.rotation.x = FALLEN.rot.x - Math.sin(p * Math.PI) * 0.12; });

      // 카메라 제자리로
      camTarget.pos.copy(CAM_HOME);
      camTarget.look.copy(LOOK_HOME);
      await tween(450 * D, () => {});
      it.anim = null;
    },
  };
}
