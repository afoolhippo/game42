const screens = {
  title: document.getElementById("title-screen"),
  draw: document.getElementById("draw-screen"),
  race: document.getElementById("race-screen"),
  result: document.getElementById("result-screen"),
};

const startBtn = document.getElementById("start-btn");
const backTitleBtn = document.getElementById("back-title-btn");
const raceTitleBtn = document.getElementById("race-title-btn");
const clearBtn = document.getElementById("clear-btn");
const raceBtn = document.getElementById("race-btn");
const retryBtn = document.getElementById("retry-btn");
const homeBtn = document.getElementById("home-btn");
const shareBtn = document.getElementById("share-btn");
const registerBtn = document.getElementById("register-btn");
const raceBgm = document.getElementById("race-bgm");

const GAME_ID = "game42";
const GAME_TITLE = "てがきタイヤグランプリ";

const drawCanvas = document.getElementById("draw-canvas");
const drawCtx = drawCanvas.getContext("2d");

const raceCanvas = document.getElementById("race-canvas");
const raceCtx = raceCanvas.getContext("2d");

const distanceMeter = document.getElementById("distance-meter");
const staminaFill = document.getElementById("stamina-fill");
const commentary = document.getElementById("commentary");

const resultDistance = document.getElementById("result-distance");
const resultStars = document.getElementById("result-stars");
const resultRank = document.getElementById("result-rank");
const resultComment = document.getElementById("result-comment");
const resultButtons = document.getElementById("result-buttons");

const carImg = new Image();
carImg.src = "car.png";

let drawing = false;
let points = [];
let tirePoints = [];
let tireStats = null;

let terrain = [];
let distance = 0;
let speed = 0;
let durability = 100;
let maxDurability = 100;
let frame = 0;
let raceTimer = null;
let revealTimer = null;
let enableTimer = null;
let currentResult = null;
let scoreClient;

function resetResult() {
  clearTimeout(revealTimer);
  clearTimeout(enableTimer);
  resultButtons.classList.remove("show", "ready");
  for (const button of resultButtons.children) button.disabled = true;
  registerBtn.textContent = "記録を登録";
  currentResult = null;
}

function showScreen(name) {
  if (name !== "result") resetResult();
  if (name !== "race" && screens.race.classList.contains("active")) {
    raceBgm.pause();
    raceBgm.currentTime = 0;
  }

  Object.values(screens).forEach((screen) => {
    screen.classList.remove("active");
  });
  screens[name].classList.add("active");
}

function clearDrawCanvas() {
  drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
  points = [];

  drawCtx.lineWidth = 8;
  drawCtx.lineCap = "round";
  drawCtx.lineJoin = "round";
  drawCtx.strokeStyle = "#263238";
}

function getCanvasPos(e) {
  const rect = drawCanvas.getBoundingClientRect();
  const touch = e.touches ? e.touches[0] : e;

  return {
    x: ((touch.clientX - rect.left) / rect.width) * drawCanvas.width,
    y: ((touch.clientY - rect.top) / rect.height) * drawCanvas.height,
  };
}

function startDraw(e) {
  e.preventDefault();
  drawing = true;
  points = [];

  const pos = getCanvasPos(e);
  points.push(pos);

  drawCtx.beginPath();
  drawCtx.moveTo(pos.x, pos.y);
}

function moveDraw(e) {
  if (!drawing) return;
  e.preventDefault();

  const pos = getCanvasPos(e);
  points.push(pos);

  drawCtx.lineTo(pos.x, pos.y);
  drawCtx.stroke();
}

function endDraw(e) {
  if (!drawing) return;
  e.preventDefault();
  drawing = false;

  if (points.length > 8) {
    const first = points[0];
    drawCtx.lineTo(first.x, first.y);
    drawCtx.stroke();
  }
}

function analyzeTire() {
  if (points.length < 12) return null;

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  points.forEach((p) => {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  });

  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);
  const size = (width + height) / 2;

  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;

  const distances = points.map((p) => {
    const dx = p.x - cx;
    const dy = p.y - cy;
    return Math.sqrt(dx * dx + dy * dy);
  });

  const avg = distances.reduce((sum, v) => sum + v, 0) / distances.length;

  const variance =
    distances.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) /
    distances.length;

  const std = Math.sqrt(variance);

  return {
    roundness: clamp(100 - std * 2.1, 0, 100),
    bumpiness: clamp(std * 2.8, 0, 100),
    size: clamp(size / 2.2, 0, 100),
    wide: clamp((width / height) * 45, 0, 120),
    narrow: width < 60 || height < 60,
  };
}

function normalizeTirePoints(rawPoints) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  rawPoints.forEach((p) => {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  });

  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const scale = 38 / Math.max(maxX - minX, maxY - minY, 1);

  return rawPoints.map((p) => ({
    x: (p.x - cx) * scale,
    y: (p.y - cy) * scale,
  }));
}

function generateTerrain() {
  terrain = [];

  let x = 0;
  let y = 0;

  terrain.push({ x, y, type: "flat" });

  while (x < 9000) {
    const r = Math.random();

    let type = "flat";
    let length = 80 + Math.random() * 80;
    let dy = random(-8, 8);

    if (r < 0.24) {
      type = "flat";
      length = 90 + Math.random() * 110;
      dy = random(-6, 6);
    } else if (r < 0.50) {
      type = "rock";
      length = 35 + Math.random() * 55;
      dy = random(-34, 34);
    } else if (r < 0.68) {
      type = "slope";
      length = 110 + Math.random() * 100;
      dy = random(-58, 58);
    } else if (r < 0.85) {
      type = "valley";
      length = 70 + Math.random() * 80;
      dy = random(32, 75);
    } else {
      type = "hill";
      length = 70 + Math.random() * 90;
      dy = random(-75, -34);
    }

    x += length;
    y = clamp(y + dy, -120, 120);

    terrain.push({ x, y, type });
  }
}

function getGroundOffset(worldX) {
  for (let i = 0; i < terrain.length - 1; i++) {
    const a = terrain[i];
    const b = terrain[i + 1];

    if (worldX >= a.x && worldX <= b.x) {
      const t = (worldX - a.x) / (b.x - a.x);
      return a.y + (b.y - a.y) * t;
    }
  }

  return 0;
}

function getTerrainType(worldX) {
  let current = terrain[0];

  for (const p of terrain) {
    if (p.x <= worldX) current = p;
    else break;
  }

  return current.type;
}

function getDifficulty(type) {
  const round = tireStats.roundness;
  const bump = tireStats.bumpiness;
  const big = tireStats.size;
  const wide = tireStats.wide;

  if (type === "flat") return 0.26 - round * 0.0017;
  if (type === "rock") return 0.88 - bump * 0.0045 - big * 0.0015;
  if (type === "slope") return 0.66 - big * 0.0032 - wide * 0.0014;
  if (type === "valley") return 0.82 - big * 0.0044 - bump * 0.0022;
  if (type === "hill") return 0.76 - wide * 0.0018 - bump * 0.0028;

  return 0.45;
}

function startRace() {
  tireStats = analyzeTire();

  if (!tireStats) {
    alert("タイヤをもう少し大きく描いてください！");
    return;
  }

  tirePoints = normalizeTirePoints(points);
  generateTerrain();

  distance = 0;
  frame = 0;

  speed = 2.4 + tireStats.roundness * 0.008 + tireStats.size * 0.004;
  maxDurability = tireStats.narrow ? 55 : 85;
  durability = maxDurability;

  distanceMeter.textContent = "0m";
  staminaFill.style.width = "100%";
  commentary.textContent = "スタート！";

  showScreen("race");
  raceBgm.play().catch(() => {
    // 音源を再生できない場合も走行は続ける。
  });

  clearInterval(raceTimer);

  setRaceCanvasSize();
  drawRaceScene();

  raceTimer = setInterval(updateRace, 1000 / 60);
}

function updateRace() {
  frame++;

  const checkX = distance + 260;
  const type = getTerrainType(checkX);
  const difficulty = Math.max(0.05, getDifficulty(type));

  speed -= difficulty * 0.035;
  speed += tireStats.roundness * 0.00018;
  speed = clamp(speed, 0, 4.2);

  durability -= difficulty * 0.18;
  durability = clamp(durability, 0, maxDurability);

  distance += speed;

  const staminaPercent = clamp((durability / maxDurability) * 100, 0, 100);
  staminaFill.style.width = `${staminaPercent}%`;

  if (frame % 42 === 0) {
    showTerrainComment(type);
  }

  drawRaceScene();

  distanceMeter.textContent = `${Math.floor(distance)}m`;

if (durability <= 0) {
  finishRace();
}
}

function showTerrainComment(type) {
  const text = {
    flat: "平地だ！スイスイ進む！",
    rock: "岩場だ！タイヤが試される！",
    slope: "坂道だ！ふんばれ！",
    valley: "谷だ！乗り越えろ！",
    hill: "急な山道だ！",
  };

  commentary.textContent = text[type] || "まだまだ走る！";
}

function setRaceCanvasSize() {
  const rect = raceCanvas.getBoundingClientRect();

  const w = Math.max(300, Math.floor(rect.width));
  const h = Math.max(300, Math.floor(rect.height));

  if (raceCanvas.width !== w || raceCanvas.height !== h) {
    raceCanvas.width = w;
    raceCanvas.height = h;
  }

  raceCtx.setTransform(1, 0, 0, 1, 0, 0);
}

function drawRaceScene() {
  setRaceCanvasSize();

  const w = raceCanvas.width;
  const h = raceCanvas.height;

  raceCtx.clearRect(0, 0, w, h);

  drawBackground(w, h);
  drawTerrain(w, h);

  const carX = w * 0.45;
  const groundY = getScreenGroundY(distance + 260, h);

  const bounce =
    Math.sin(frame * 0.32) *
    (2 + tireStats.bumpiness / 16) *
    clamp(speed / 3, 0.2, 1.2);

  const carCenterY = groundY - 104 + bounce;
  const wheelRot = distance * 0.035 + frame * 0.015;

  drawTire(carX - 47, carCenterY + 66, wheelRot);
  drawTire(carX + 47, carCenterY + 66, wheelRot);

  drawCarImage(carX, carCenterY);
}

function drawBackground(w, h) {
  raceCtx.fillStyle = "#bfeeff";
  raceCtx.fillRect(0, 0, w, h);

  raceCtx.fillStyle = "#9bd36a";
  raceCtx.fillRect(0, h * 0.5, w, h * 0.5);

  raceCtx.fillStyle = "rgba(255,255,255,0.75)";

  for (let i = 0; i < 4; i++) {
    const x = ((i * 160 - distance * 0.13) % (w + 160)) - 90;
    const y = 48 + i * 28;

    raceCtx.fillRect(x, y, 58, 14);
    raceCtx.fillRect(x + 14, y - 12, 36, 14);
  }
}

function getScreenGroundY(worldX, h) {
  const baseY = h * 0.72;
  return baseY + getGroundOffset(worldX);
}

function drawTerrain(w, h) {
  raceCtx.beginPath();

  for (let sx = -40; sx <= w + 40; sx += 10) {
    const worldX = distance + sx;
    const y = getScreenGroundY(worldX, h);

    if (sx === -40) raceCtx.moveTo(sx, y);
    else raceCtx.lineTo(sx, y);
  }

  raceCtx.lineTo(w + 40, h + 40);
  raceCtx.lineTo(-40, h + 40);
  raceCtx.closePath();

  raceCtx.fillStyle = "#a98555";
  raceCtx.fill();

  raceCtx.strokeStyle = "#263238";
  raceCtx.lineWidth = 4;

  raceCtx.beginPath();

  for (let sx = -40; sx <= w + 40; sx += 10) {
    const worldX = distance + sx;
    const y = getScreenGroundY(worldX, h);

    if (sx === -40) raceCtx.moveTo(sx, y);
    else raceCtx.lineTo(sx, y);
  }

  raceCtx.stroke();

  drawRocks(w, h);
}

function drawRocks(w, h) {
  raceCtx.fillStyle = "#6f5532";
  raceCtx.strokeStyle = "#263238";
  raceCtx.lineWidth = 2;

  terrain.forEach((p) => {
    if (p.type !== "rock") return;

    const sx = p.x - distance;
    if (sx < -30 || sx > w + 30) return;

    const sy = getScreenGroundY(p.x, h) - 7;

    raceCtx.beginPath();
    raceCtx.arc(sx, sy, 8, 0, Math.PI * 2);
    raceCtx.fill();
    raceCtx.stroke();
  });
}

function drawTire(cx, cy, rotation) {
  if (tirePoints.length < 3) return;

  raceCtx.save();
  raceCtx.translate(cx, cy);
  raceCtx.rotate(rotation);

  raceCtx.fillStyle = "#ffffff";
  raceCtx.strokeStyle = "#263238";
  raceCtx.lineWidth = 4;

  raceCtx.beginPath();
  raceCtx.moveTo(tirePoints[0].x, tirePoints[0].y);

  for (let i = 1; i < tirePoints.length; i++) {
    raceCtx.lineTo(tirePoints[i].x, tirePoints[i].y);
  }

  raceCtx.closePath();
  raceCtx.fill();
  raceCtx.stroke();

  raceCtx.fillStyle = "#263238";
  raceCtx.beginPath();
  raceCtx.arc(0, 0, 4, 0, Math.PI * 2);
  raceCtx.fill();

  raceCtx.restore();
}

function drawCarImage(carX, carY) {
  const carW = 180;
  const carH = 180;

  if (!carImg.complete || carImg.naturalWidth === 0) {
    drawFallbackCar(carX, carY);
    return;
  }

  raceCtx.save();

  // car.pngは左向きなので、ゲーム内では左右反転して右向きに表示
  raceCtx.translate(carX, carY);
  raceCtx.scale(-1, 1);

  raceCtx.drawImage(
    carImg,
    -carW / 2,
    -carH / 2,
    carW,
    carH
  );

  raceCtx.restore();
}

function drawFallbackCar(carX, carY) {
  raceCtx.fillStyle = "#ffef7a";
  raceCtx.strokeStyle = "#263238";
  raceCtx.lineWidth = 4;

  raceCtx.fillRect(carX - 62, carY + 12, 124, 40);
  raceCtx.strokeRect(carX - 62, carY + 12, 124, 40);

  raceCtx.fillStyle = "#c6a0d8";
  raceCtx.beginPath();
  raceCtx.arc(carX - 8, carY - 14, 24, 0, Math.PI * 2);
  raceCtx.fill();
  raceCtx.stroke();
}

function finishRace() {
  clearInterval(raceTimer);

  const final = Math.floor(distance);
  resultDistance.textContent = `${final}m`;

  let rank = "コロコロタイヤ";
  let stars = "★☆☆";
  let comment = "コロコロ進んだよ！";

  if (final >= 3500) {
    rank = "ぶっちぎりタイヤ";
    stars = "★★★";
    comment = "山も谷もぶっちぎり！";
  } else if (final >= 2000) {
    rank = "グングンタイヤ";
    stars = "★★☆";
    comment = "グングン走れたね！";
  }

  resultStars.textContent = stars;
  resultRank.textContent = rank;
  resultComment.textContent = comment;

  currentResult = { score: final, rank, registration: "idle" };
  showScreen("result");

  revealTimer = setTimeout(() => {
    resultButtons.classList.add("show");
    enableTimer = setTimeout(() => {
      resultButtons.classList.add("ready");
      for (const button of resultButtons.children) button.disabled = false;
    }, 350);
  }, 1500);
}

function goTitle() {
  clearInterval(raceTimer);
  drawing = false;
  clearDrawCanvas();
  showScreen("title");
}

function goDraw() {
  clearDrawCanvas();
  showScreen("draw");
}

function shareResult() {
  const text = [
    "てがきタイヤで山あり谷あり！🛞🚗",
    `${currentResult.score}m`,
    `無料ブラウザゲーム「${GAME_TITLE}」`,
    `https://afoolhippo.github.io/${GAME_ID}/`,
    `#${GAME_TITLE}`,
    "#カバゲーセン",
  ].join("\n");

  const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

async function registerResult() {
  const result = currentResult;
  if (!result || result.registration !== "idle" || registerBtn.disabled) return;

  const nickname = window.prompt("ニックネームを入力してね", "匿名カバ")?.trim();
  if (!nickname) return;

  result.registration = "pending";
  registerBtn.disabled = true;
  registerBtn.textContent = "登録中...";

  try {
    scoreClient ??= window.supabase.createClient(
      "https://gmncxnybsovlallxgnkd.supabase.co",
      "sb_publishable_ly3h5OhL8HDSHhYdmJq_Fw_9pG3mhla"
    );
    const { error } = await scoreClient.from("kaba_scores").insert({
      game_id: GAME_ID,
      game_title: GAME_TITLE,
      nickname,
      rank_title: result.rank,
      score: result.score,
    });
    if (error) throw error;
  } catch (error) {
    console.error("記録の登録に失敗しました", error);
    if (currentResult !== result) return;
    result.registration = "idle";
    registerBtn.textContent = "記録を登録";
    registerBtn.disabled = false;
    alert("登録に失敗しました");
    return;
  }

  if (currentResult !== result) return;
  result.registration = "saved";
  registerBtn.textContent = "登録済み";
  alert("記録を登録しました！");
}

function random(min, max) {
  return min + Math.random() * (max - min);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

startBtn.addEventListener("click", goDraw);
backTitleBtn.addEventListener("click", goTitle);
raceTitleBtn.addEventListener("click", goTitle);
clearBtn.addEventListener("click", clearDrawCanvas);
raceBtn.addEventListener("click", startRace);
retryBtn.addEventListener("click", goTitle);
shareBtn.addEventListener("click", shareResult);
registerBtn.addEventListener("click", registerResult);

homeBtn.addEventListener("click", () => {
  location.href = "https://afoolhippo.github.io/home/?skipTitle=1";
});

drawCanvas.addEventListener("mousedown", startDraw);
drawCanvas.addEventListener("mousemove", moveDraw);
drawCanvas.addEventListener("mouseup", endDraw);
drawCanvas.addEventListener("mouseleave", endDraw);

drawCanvas.addEventListener("touchstart", startDraw, { passive: false });
drawCanvas.addEventListener("touchmove", moveDraw, { passive: false });
drawCanvas.addEventListener("touchend", endDraw, { passive: false });

clearDrawCanvas();
showScreen("title");