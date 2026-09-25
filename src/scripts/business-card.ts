// 名刺の札を、ばねで傾け、裏返し、つまんで回す。
// 角度はすべて度。ry は表を 0 とし、180 の倍数ごとに面が入れ替わる。rx は縦の傾きで、手を離すと平らに戻る。

/** ポインタを端に置いたときの傾き。 */
const MAX_TILT = 14;
/** ばねの硬さと減衰。減衰比は約 0.7 で、裏返しの終わりに一度だけ小さく揺り戻す。 */
const STIFFNESS = 100;
const DAMPING = 14;
/** 手を離したとき、この秒数だけ今の速さで回り続けたと見なして止まる面を決める。 */
const FLING = 0.18;
const DRAG_START = 6;
/** つまんで縦に回せる角度の上限。これより起こすと札の縁しか見えなくなる。 */
const MAX_PITCH = 65;

type Spring = { x: number; v: number };

function step(s: Spring, target: number, dt: number, k = STIFFNESS, c = DAMPING) {
  s.v += (k * (target - s.x) - c * s.v) * dt;
  s.x += s.v * dt;
}

/** 裏の絵を組み立てるまでの待ち時間(ms)。ページ移動のアニメーション(0.5 秒ほど)が終わってから。 */
const MOUNT_BACK_AFTER = 1500;

export function startBusinessCard(stage: HTMLElement): () => void {
  const hit = stage.querySelector<HTMLButtonElement>('.bc-hit')!;
  // 毎フレーム書き換えるのは、ここで取った要素の transform と opacity だけにする。
  // 外枠に CSS 変数を書くと中の SVG まで受け継がれ、数千の要素のスタイル計算と描き直しが毎フレーム走る。
  const card = stage.querySelector<HTMLElement>('.bc-card')!;
  const [shadowNear, shadowFar] = stage.querySelectorAll<HTMLElement>('.bc-shadow');
  const lights = [...stage.querySelectorAll<HTMLElement>('.bc-light')];
  const edges = [...stage.querySelectorAll<HTMLElement>('.bc-edge')];
  const cores = [...stage.querySelectorAll<HTMLElement>('.bc-core')];
  const netShadow = stage.querySelector<HTMLElement>('.bc-net-shadow');
  const painted = [card, shadowNear, shadowFar, ...lights, ...edges, ...cores, ...(netShadow ? [netShadow] : [])];
  /** 見えないときは合成の対象から外す。重なったレイヤーの面積がそのまま毎フレームの合成の手間になる。 */
  const show = (el: HTMLElement, on: boolean) => { el.style.visibility = on ? '' : 'hidden'; };
  const front = stage.querySelector<HTMLElement>('[data-face="front"]')!;
  const back = stage.querySelector<HTMLElement>('[data-face="back"]')!;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const ac = new AbortController();
  const on = <K extends keyof HTMLElementEventMap>(el: HTMLElement, type: K, fn: (e: HTMLElementEventMap[K]) => void) =>
    el.addEventListener(type, fn, { signal: ac.signal });

  // 裏の絵は template に入れてある。裏返しそうになったとき(カーソルが乗った・押した・キーボードで選んだ)に組み立てる。
  // それ以外は、ページ移動のアニメーションが終わるのを待ってから手が空いたときに組み立てる。
  // 「手が空いたら」だけだと、アニメーション中のメインスレッドは空いて見えるので、その最中に千を超える図形を組み立てて描き、アニメーションが止まる。
  const mountBack = () => stage.querySelectorAll<HTMLTemplateElement>('template[data-card-art]').forEach((t) => t.replaceWith(t.content));
  const later = setTimeout(() => {
    if ('requestIdleCallback' in globalThis) {
      const id = requestIdleCallback(mountBack, { timeout: 2000 });
      ac.signal.addEventListener('abort', () => cancelIdleCallback(id));
    } else mountBack();
  }, MOUNT_BACK_AFTER);
  ac.signal.addEventListener('abort', () => clearTimeout(later));
  on(stage, 'pointerenter', mountBack);
  on(hit, 'pointerdown', mountBack);
  on(hit, 'focus', mountBack);

  // 表からの枚数。偶数で表、奇数で裏。何回転しても角度が飛ばないよう、足し引きだけで増減させる。
  let face = 0;
  const rx: Spring = { x: 0, v: 0 };
  const ry: Spring = { x: 0, v: 0 };
  const lift: Spring = { x: 0, v: 0 };
  let pointer: { x: number; y: number } | null = null;
  let drag: {
    id: number; touch: boolean; x0: number; y0: number; rx0: number; ry0: number; face0: number;
    lastT: number; vx: number; vy: number; active: boolean;
  } | null = null;
  let suppressClick = false;

  // 札は斜めに置いてあるため、画面上の向きを札の縦横に直してから使う。
  const tiltRad = (parseFloat(getComputedStyle(stage).rotate) || 0) * (Math.PI / 180);
  const toCard = (x: number, y: number) => ({
    x: x * Math.cos(tiltRad) + y * Math.sin(tiltRad),
    y: -x * Math.sin(tiltRad) + y * Math.cos(tiltRad),
  });

  const showSide = () => {
    const isBack = Math.abs(face) % 2 === 1;
    stage.classList.toggle('is-back', isBack);
    hit.setAttribute('aria-pressed', String(isBack));
    front.setAttribute('aria-hidden', String(isBack));
    back.setAttribute('aria-hidden', String(!isBack));
  };

  const flip = (dir: number) => {
    face += dir;
    showSide();
    // 動きを減らす設定では CSS が面を差し替える。
    if (!reduce.matches) wake();
  };

  on(hit, 'click', () => {
    if (suppressClick) { suppressClick = false; return; }
    // 指した側が奥へ沈む向きに回す。キーボードでは右回り。
    flip(pointer && pointer.x < 0 ? -1 : 1);
  });

  on(stage, 'pointermove', (e) => {
    if (e.pointerType === 'touch' && !drag) return;
    const r = stage.getBoundingClientRect();
    const w = stage.offsetWidth, h = stage.offsetHeight;
    const at = toCard(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2));
    pointer = { x: Math.max(-1, Math.min(1, at.x / (w / 2))), y: Math.max(-1, Math.min(1, at.y / (h / 2))) };
    if (!drag || drag.id !== e.pointerId) return;
    const { x: dx, y: dy } = toCard(e.clientX - drag.x0, e.clientY - drag.y0);
    if (!drag.active) {
      // 指では縦の動きをページのスクロールに譲り、横に動かしたときだけつまむ。
      const moved = drag.touch ? Math.abs(dx) >= DRAG_START && Math.abs(dx) > Math.abs(dy) : Math.hypot(dx, dy) >= DRAG_START;
      if (!moved) return;
      drag.active = true;
      stage.classList.add('is-dragging');
      hit.setPointerCapture(e.pointerId);
    }
    // 札の幅だけ横に動かすと半回転する。縦は札の高さで 140° 起こせる速さにし、上限で止める。
    const nextRy = drag.ry0 + (dx / w) * 180;
    const nextRx = drag.touch ? rx.x : Math.max(-MAX_PITCH, Math.min(MAX_PITCH, drag.rx0 - (dy / h) * 140));
    const dt = Math.max(1, e.timeStamp - drag.lastT) / 1000;
    drag.vx = drag.vx * 0.6 + ((nextRy - ry.x) / dt) * 0.4;
    drag.vy = drag.vy * 0.6 + ((nextRx - rx.x) / dt) * 0.4;
    drag.lastT = e.timeStamp;
    ry.x = nextRy;
    ry.v = drag.vx;
    if (!drag.touch) { rx.x = nextRx; rx.v = drag.vy; }
  });
  on(stage, 'pointerleave', (e) => { if (e.pointerType !== 'touch' && !drag) pointer = null; });
  on(hit, 'pointerdown', (e) => {
    if (e.button !== 0 || reduce.matches) return;
    drag = { id: e.pointerId, touch: e.pointerType === 'touch', x0: e.clientX, y0: e.clientY, rx0: rx.x, ry0: ry.x, face0: face, lastT: e.timeStamp, vx: 0, vy: 0, active: false };
    wake();
  });
  const release = (e: PointerEvent) => {
    if (!drag || drag.id !== e.pointerId) return;
    if (drag.active) {
      // 指を離したあとの click で、もう一度裏返さない。
      suppressClick = e.type === 'pointerup';
      // 止めてから離したときは、最後の速さを持ち越さない。
      const stale = e.timeStamp - drag.lastT > 80;
      const vx = stale ? 0 : drag.vx;
      const landing = Math.round((ry.x + vx * FLING) / 180);
      face = Math.max(drag.face0 - 2, Math.min(drag.face0 + 2, landing));
      ry.v = vx;
      // 縦は離した勢いのまま、ばねで平らに戻す。
      if (!drag.touch) rx.v = stale ? 0 : drag.vy;
      showSide();
      stage.classList.remove('is-dragging');
    }
    if (e.pointerType === 'touch') pointer = null;
    drag = null;
  };
  // Android では指の長押しでメニューが開く。マウスの右クリックのメニューは残す。
  on(stage, 'contextmenu', (e) => { if (drag?.touch) e.preventDefault(); });
  on(hit, 'pointerup', release);
  on(hit, 'pointercancel', release);

  // 画面にあり、タブが表示されているときだけ描く。
  let visible = false;
  let raf = 0;
  let last = 0;
  const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; wake(); });
  io.observe(stage);
  document.addEventListener('visibilitychange', () => wake(), { signal: ac.signal });

  function wake() {
    if (raf || !visible || document.hidden || reduce.matches) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function frame(now: number) {
    raf = 0;
    const dt = Math.min(now - last, 50) / 1000;
    last = now;
    const t = now / 1000;
    const hovering = pointer !== null;
    // 触れていないときは、机の上で息をするようにゆっくり揺らす。
    const idleX = hovering ? 0 : Math.sin(t * 0.7) * 3;
    const idleY = hovering ? 0 : Math.sin(t * 0.5 + 1) * 6;
    const dragging = drag?.active ?? false;
    const targetRx = pointer && !dragging ? -pointer.y * MAX_TILT : idleX;
    const targetRy = face * 180 + (pointer && !dragging ? pointer.x * MAX_TILT : idleY);
    // 押しているあいだは札が沈み、つまんで回しているあいだは手元へ持ち上がる。
    const targetLift = dragging ? 1.3 : drag ? -0.6 : hovering ? 1 : 0;
    // 刻みを分け、硬いばねでも大きな dt で発散しないようにする。
    for (let i = 0; i < 2; i++) {
      if (!dragging || drag!.touch) step(rx, targetRx, dt / 2);
      if (!dragging) step(ry, targetRy, dt / 2);
      step(lift, targetLift, dt / 2, 260, 26);
    }
    render();
    if (visible && !document.hidden) raf = requestAnimationFrame(frame);
  }

  /** 影のぼかし。弱い影と強い影の 2 枚を重ね、不透明度の配分で間のぼかしを表す。半径そのものを毎フレーム変えると、毎回ぼかし直しになる。
      弱い影は置いたままのぼけ具合、強い影は持ち上げたときのぼけ具合に合わせ、止まっているあいだはどちらか 1 枚で済ませる。 */
  const BLUR_NEAR = 10, BLUR_FAR = 24;
  /** 断ちの板を出す傾き。指したほうへ傾けるだけ(14° まで)なら断ちは 0.4px に届かないため、裏返しやつまんで回すときだけ出す。 */
  const CORE_FROM = 20;

  function render() {
    // 一番近い面からのずれ。光沢と影はこれで決める。
    const dev = ry.x - 180 * Math.round(ry.x / 180);
    const tilt = Math.min(1, Math.hypot(dev, rx.x) / MAX_TILT);
    const up = Math.max(0, lift.x), down = Math.max(0, -lift.x);
    const rad = Math.PI / 180;
    card.style.transform = `translateZ(${((up - down) * 24).toFixed(2)}px) rotateX(${rx.x.toFixed(2)}deg) rotateY(${ry.x.toFixed(2)}deg)`;

    // 影は札と一緒に回さず、下に落ちたものとして傾きと逆へずらす。持ち上げるほどぼけて薄く、押し込むほど締まって濃くなる。
    const devClamped = Math.max(-MAX_TILT * 1.5, Math.min(MAX_TILT * 1.5, dev));
    const sw = Math.max(0.06, Math.abs(Math.cos(ry.x * rad))) * (1 - up * 0.05);
    const sh = Math.max(0.1, Math.abs(Math.cos(rx.x * rad))) * (1 - up * 0.05);
    const shadow = `translate(${(devClamped * -0.8 + 4).toFixed(2)}px, ${(12 + rx.x * 0.4 + (up - down) * 12).toFixed(2)}px) scale(${sw.toFixed(3)}, ${sh.toFixed(3)})`;
    const blur = 10 + up * 14 - down * 8;
    const far = Math.max(0, Math.min(1, (blur - BLUR_NEAR) / (BLUR_FAR - BLUR_NEAR)));
    const alpha = 0.8 - up * 0.25 + down * 0.3;
    shadowNear.style.transform = shadowFar.style.transform = shadow;
    shadowNear.style.opacity = (alpha * (1 - far)).toFixed(3);
    shadowFar.style.opacity = (alpha * far).toFixed(3);
    show(shadowFar, far > 0.01);
    show(shadowNear, far < 0.99);

    // 光の板は札の中心に置いたまま動かす。中心の移動を translate、光の点から一番遠い角までの距離(グラデーションの半径)を scale で表す。
    const w = stage.offsetWidth, h = stage.offsetHeight;
    const gx = (0.5 + (dev / MAX_TILT) * 0.4) * w, gy = (0.5 - (rx.x / MAX_TILT) * 0.4) * h;
    const reach = Math.hypot(Math.max(gx, w - gx), Math.max(gy, h - gy)) / (Math.hypot(w, h) / 2);
    const light = `translate(${(gx - w / 2).toFixed(1)}px, ${(gy - h / 2).toFixed(1)}px) scale(${reach.toFixed(3)})`;
    const glow = (0.25 + tilt * 0.75).toFixed(3);
    for (const l of lights) { l.style.transform = light; l.style.opacity = glow; }

    // 真横に近いほど 1。|cos| が 0.25(約 75°)より大きいときは 0。
    const edgeOn = Math.max(0, 1 - Math.abs(Math.cos(ry.x * rad)) / 0.25).toFixed(3);
    for (const e of edges) { e.style.opacity = edgeOn; show(e, +edgeOn > 0); }
    // 水底の網の影。紙面では太陽の反対へ 0.45mm ずらしてあり、傾けると水の厚みのぶん逆へ流れる。
    if (netShadow) {
      const mm = w / 55, sx = 0.45 * mm - (dev / MAX_TILT) * 2.5, sy = 0.45 * mm + (rx.x / MAX_TILT) * 2.5;
      netShadow.style.transform = `translate(${sx.toFixed(2)}px, ${sy.toFixed(2)}px)`;
    }
    const side = Math.max(Math.abs(dev), Math.abs(rx.x));
    for (const c of cores) show(c, side >= CORE_FROM);
  }

  const settle = () => painted.forEach((el) => { el.style.removeProperty('transform'); el.style.removeProperty('opacity'); el.style.removeProperty('visibility'); });
  reduce.addEventListener('change', () => {
    if (!reduce.matches) return wake();
    cancelAnimationFrame(raf);
    raf = 0;
    settle();
  }, { signal: ac.signal });
  wake();

  return () => {
    ac.abort();
    io.disconnect();
    cancelAnimationFrame(raf);
    settle();
  };
}
