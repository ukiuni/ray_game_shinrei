import { hitTest, shuffled, remainingSeconds } from "./logic.js";
const $ = (id) => document.getElementById(id);
let photos = [],
  order = [],
  index = 0,
  streak = 0,
  lives = 3,
  state = "home",
  deadline = 0,
  ticker,
  transition,
  registration,
  loading = false,
  operation = 0;
let best = 0;
try {
  best = Number(localStorage.getItem("unseen-best")) || 0;
} catch {}
$("best").textContent = best;
let audioOn = false,
  audio;
function tone(ok) {
  if (!audioOn) return;
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    audio.resume();
    const o = audio.createOscillator(),
      g = audio.createGain();
    o.connect(g);
    g.connect(audio.destination);
    o.type = "sine";
    o.frequency.setValueAtTime(ok ? 660 : 160, audio.currentTime);
    g.gain.setValueAtTime(0.08, audio.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.25);
    o.start();
    o.stop(audio.currentTime + 0.26);
  } catch {}
}
$("sound").onclick = () => {
  audioOn = !audioOn;
  $("sound").textContent = audioOn ? "音 ON" : "音 OFF";
  $("sound").setAttribute(
    "aria-label",
    `効果音を${audioOn ? "オフ" : "オン"}にする`,
  );
  tone(true);
};
function screen(name) {
  for (const n of ["home", "game", "result"]) $(n).hidden = n !== name;
}
function saveBest() {
  if (streak > best) {
    best = streak;
    try {
      localStorage.setItem("unseen-best", best);
    } catch {}
    $("best").textContent = best;
    return true;
  }
  return false;
}
async function loadData() {
  if (!photos.length) {
    const r = await fetch("./photos.json");
    if (!r.ok) throw Error("写真一覧を取得できません");
    photos = await r.json();
  }
}
function imageReady(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
async function nextPhoto() {
  const current = ++operation;
  state = "loading";
  loading = true;
  clearInterval(ticker);
  $("overlay").hidden = true;
  $("markers").replaceChildren();
  $("game-message").textContent = "写真を現像しています…";
  try {
    const item = photos[order[index]];
    await imageReady("./" + item.src);
    if (state !== "loading" || current !== operation) return;
    $("photo").src = "./" + item.src;
    $("photo-title").textContent =
      `記録写真 ${String(item.id).padStart(3, "0")}`;
    $("progress").textContent = `${String(index + 1).padStart(3, "0")} / 100`;
    $("streak").textContent = String(streak).padStart(2, "0");
    $("lives").textContent = "● ".repeat(lives).trim();
    $("game-message").textContent =
      "心霊が写っている場所をタップしてください。";
    deadline = performance.now() + 30000;
    state = "playing";
    loading = false;
    tick();
    ticker = setInterval(tick, 100);
    if (index + 1 < order.length) {
      const preload = new Image();
      preload.src = "./" + photos[order[index + 1]].src;
    }
  } catch {
    if (current !== operation) return;
    loading = false;
    finish(
      "写真を読み込めませんでした。通信状態を確認して、もう一度お試しください。",
    );
  }
}
async function start() {
  if (loading || applyingUpdate) return;
  const current = ++operation;
  state = "loading";
  loading = true;
  screen("game");
  $("photo").removeAttribute("src");
  $("game-message").textContent = "写真を準備しています…";
  try {
    await loadData();
    if (state !== "loading" || current !== operation) return;
    order = shuffled(photos.length);
    index = 0;
    streak = 0;
    lives = 3;
    await nextPhoto();
  } catch {
    if (current !== operation) return;
    loading = false;
    finish("写真を読み込めませんでした。通信状態を確認してください。");
  }
}
function tick() {
  if (state !== "playing") return;
  const left = remainingSeconds(deadline, performance.now());
  $("time").innerHTML = `${left}<span>s</span>`;
  $("timer-bar").style.width =
    `${Math.max(0, (deadline - performance.now()) / 300)}%`;
  $("timer-bar").classList.toggle("urgent", left <= 10);
  if (left <= 0) finish("時間切れ。気配は闇に消えてしまった。", true);
}
function marker(x, y, kind) {
  const m = document.createElement("span");
  m.className = "marker " + kind;
  m.style.left = x * 100 + "%";
  m.style.top = y * 100 + "%";
  m.textContent = kind === "wrong" ? "✗" : "○";
  $("markers").append(m);
  if (kind === "wrong") setTimeout(() => m.remove(), 1100);
}
function choose(x, y) {
  if (state !== "playing") return;
  if (performance.now() >= deadline) {
    tick();
    return;
  }
  const p = photos[order[index]];
  if (hitTest(p.target, x, y)) {
    state = "success";
    clearInterval(ticker);
    marker(x, y, "correct");
    tone(true);
    streak++;
    saveBest();
    $("streak").textContent = String(streak).padStart(2, "0");
    $("overlay").hidden = false;
    transition = setTimeout(() => {
      index++;
      if (index === order.length)
        finish("全100枚の心霊を発見。記録室の謎を解き明かしました。");
      else nextPhoto();
    }, 1350);
  } else {
    tone(false);
    marker(x, y, "wrong");
    lives--;
    $("lives").textContent = "● ".repeat(Math.max(0, lives)).trim() || "—";
    $("game-message").textContent =
      `そこには何もいないようです。残り${lives}回。`;
    if (lives <= 0) finish("3回の間違いで探索が終了しました。", true);
  }
}
$("photo-area").addEventListener("pointerdown", (e) => {
  if (e.button !== 0) return;
  const r = $("photo-area").getBoundingClientRect();
  choose((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
});
let cursor = { x: 0.5, y: 0.5 };
$("photo-area").addEventListener("keydown", (e) => {
  const directions = {
    ArrowLeft: [-0.04, 0],
    ArrowRight: [0.04, 0],
    ArrowUp: [0, -0.04],
    ArrowDown: [0, 0.04],
  };
  if (directions[e.key]) {
    e.preventDefault();
    cursor.x = Math.min(0.98, Math.max(0.02, cursor.x + directions[e.key][0]));
    cursor.y = Math.min(0.98, Math.max(0.02, cursor.y + directions[e.key][1]));
    let c = $("keyboard-cursor");
    if (!c) {
      c = document.createElement("span");
      c.id = "keyboard-cursor";
      c.className = "marker";
      c.textContent = "+";
      $("markers").append(c);
    }
    c.style.left = cursor.x * 100 + "%";
    c.style.top = cursor.y * 100 + "%";
  } else if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    choose(cursor.x, cursor.y);
  }
});
function finish(reason, reveal = false) {
  operation++;
  clearInterval(ticker);
  clearTimeout(transition);
  state = "result";
  loading = false;
  const record = saveBest();
  $("reason").textContent = reason;
  $("result-score").textContent = streak;
  $("record-message").textContent = record
    ? "最高記録を更新しました。"
    : `最高記録 ${best} 連続発見`;
  if (reveal && photos[order[index]]) {
    state = "revealing";
    const p = photos[order[index]];
    marker(p.target.x, p.target.y, "answer");
    $("game-message").textContent = "心霊は、この場所に写っていました。";
    transition = setTimeout(() => {
      state = "result";
      screen("result");
      applyUpdate();
    }, 1800);
  } else {
    screen("result");
    applyUpdate();
  }
}
$("start").onclick = start;
$("restart").onclick = start;
$("quit").onclick = () => finish("探索を終了しました。");
$("back").onclick = () => {
  state = "home";
  screen("home");
  applyUpdate();
};
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    tick();
    checkUpdate();
  }
});
// A waiting service worker is activated only outside the entire game session.
let applyingUpdate = false,
  controllerAtStart = !!navigator.serviceWorker?.controller;
function busy() {
  return ["loading", "playing", "success", "revealing"].includes(state);
}
function applyUpdate() {
  // Installation events may arrive after that worker has already activated.
  // Only the registration's current waiting worker can represent an update.
  const worker = registration?.waiting;
  if (
    !worker ||
    worker.state !== "installed" ||
    worker === navigator.serviceWorker.controller ||
    busy() ||
    applyingUpdate
  )
    return;
  applyingUpdate = true;
  $("update").hidden = false;
  $("start").disabled = true;
  $("restart").disabled = true;
  worker.postMessage({ type: "ACTIVATE" });
}
async function checkUpdate() {
  if (registration && navigator.onLine)
    try {
      await registration.update();
      applyUpdate();
    } catch {}
}
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (applyingUpdate && controllerAtStart) location.reload();
    else {
      controllerAtStart = true;
      applyingUpdate = false;
      $("update").hidden = true;
      $("start").disabled = false;
      $("restart").disabled = false;
    }
  });
  navigator.serviceWorker
    .register("./sw.js", { updateViaCache: "none" })
    .then((r) => {
      registration = r;
      if (r.waiting) {
        applyUpdate();
      }
      r.addEventListener("updatefound", () => {
        const w = r.installing;
        w?.addEventListener("statechange", () => {
          if (w.state === "installed" && navigator.serviceWorker.controller) {
            applyUpdate();
          }
        });
      });
    })
    .catch(() => {});
  setInterval(checkUpdate, 5 * 60 * 1000);
}
function connectivity() {
  $("offline").hidden = navigator.onLine;
}
window.addEventListener("online", () => {
  connectivity();
  checkUpdate();
});
window.addEventListener("offline", connectivity);
connectivity();
