import {
  FURNITURE, SLOTS, DISCOVERIES, MAX_HEARTS,
  initialState, readSave, writeSave, sanitizeName, growthStage,
  hatchPet, renamePet, finishCare, collectStar, finishAdventure, buyOrEquip
} from "./rules.js";

const app = document.querySelector("#app");
let state = readSave(window.localStorage);
let saveWorks = true;
let audioContext = null;
let bgmTimer = null;
const ui = {
  tab: "home", modal: null, eggTaps: 0,
  bathPopped: new Set(), playCount: 0,
  scene: 0, stars: new Set(), wrongTries: 0,
  selectedSlot: "rug", reaction: "", joyful: false, showHeart: false
};
let reactionTimer = null;

const scenes = [
  {
    id: "meadow", name: "おはなばたけ", hint: "おおきな おはなを さがそう！",
    target: "flower", backdrop: "",
    objects: [
      { id: "butterfly", emoji: "🦋", label: "ちょうちょ", at: "left" },
      { id: "flower", emoji: "🌼", label: "おはな", at: "middle" },
      { id: "tulip", emoji: "🌷", label: "チューリップ", at: "right" }
    ]
  },
  {
    id: "river", name: "かわのほとり", hint: "まるい いわを さがそう！",
    target: "rock", backdrop: "river",
    objects: [
      { id: "fish", emoji: "🐟", label: "おさかな", at: "left" },
      { id: "shell", emoji: "🐚", label: "かいがら", at: "middle" },
      { id: "rock", emoji: "🪨", label: "いわ", at: "right" }
    ]
  },
  {
    id: "tree", name: "おおきな木", hint: "きのこを さがそう！",
    target: "mushroom", backdrop: "tree",
    objects: [
      { id: "mushroom", emoji: "🍄", label: "きのこ", at: "left" },
      { id: "squirrel", emoji: "🐿️", label: "りす", at: "middle" },
      { id: "leaf", emoji: "🍂", label: "はっぱ", at: "right" }
    ]
  }
];

const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[c]));

function sound(notes = [523, 660], duration = 0.09) {
  if (!state.soundEnabled) return;
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    audioContext ||= new AudioContextClass();
    if (audioContext.state === "suspended") audioContext.resume();
    notes.forEach((frequency, index) => {
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const start = audioContext.currentTime + index * duration;
      osc.type = "sine";
      osc.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.065, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration * 0.95);
      osc.connect(gain).connect(audioContext.destination);
      osc.start(start);
      osc.stop(start + duration);
    });
  } catch {
    // Browsers may block audio; the game remains fully playable in silence.
  }
}
function updateBgm() {
  if (bgmTimer) clearInterval(bgmTimer);
  bgmTimer = null;
  if (!state.soundEnabled) return;
  bgmTimer = setInterval(() => {
    if (!document.hidden && state.soundEnabled && !ui.modal) {
      sound([392, 523, 659, 523], 0.22);
    }
  }, 12000);
}
updateBgm();

function persist() {
  saveWorks = writeSave(window.localStorage, state);
}
function changeState(next) {
  state = next;
  persist();
  render();
}
function react(message, joyful = false) {
  ui.reaction = message;
  ui.joyful = joyful;
  ui.showHeart = joyful;
  clearTimeout(reactionTimer);
  reactionTimer = setTimeout(() => {
    ui.reaction = "";
    ui.joyful = false;
    ui.showHeart = false;
    render();
  }, 2200);
}
function titleGrowth() {
  const stage = growthStage(state.pet.hearts);
  return stage === "baby" ? "あかちゃん" : stage === "child" ? "こども" : "おとな";
}

function bunnySvg() {
  const stage = growthStage(state.pet.hearts);
  const isBaby = stage === "baby";
  const isAdult = stage === "adult";
  const eyes = ui.reaction && ui.joyful
    ? '<path d="M78 121 Q87 111 96 121 M144 121 Q153 111 162 121" fill="none" stroke="#594b4c" stroke-width="5" stroke-linecap="round"/>'
    : '<ellipse class="bunny-eye" cx="87" cy="121" rx="5.8" ry="8" fill="#4b4648"/><ellipse class="bunny-eye" cx="153" cy="121" rx="5.8" ry="8" fill="#4b4648"/>';
  return `
    <svg class="bunny-svg ${stage} ${ui.joyful ? "joy" : ""}" viewBox="0 0 240 260" role="img" aria-label="しろいうさぎの ${escapeHtml(state.pet.name)}">
      <ellipse cx="92" cy="59" rx="22" ry="54" fill="#fffdf8" stroke="#e5d8cb" stroke-width="3" transform="rotate(-10 92 59)"/>
      <ellipse cx="148" cy="59" rx="22" ry="54" fill="#fffdf8" stroke="#e5d8cb" stroke-width="3" transform="rotate(10 148 59)"/>
      <ellipse cx="92" cy="57" rx="10" ry="39" fill="#f6c3cb" transform="rotate(-10 92 57)"/>
      <ellipse cx="148" cy="57" rx="10" ry="39" fill="#f6c3cb" transform="rotate(10 148 57)"/>
      <ellipse cx="120" cy="206" rx="${isBaby ? 55 : 62}" ry="${isBaby ? 45 : 51}" fill="#fffdf8" stroke="#e5d8cb" stroke-width="3"/>
      <ellipse cx="77" cy="240" rx="26" ry="13" fill="#fffdf8" stroke="#e5d8cb" stroke-width="3"/>
      <ellipse cx="163" cy="240" rx="26" ry="13" fill="#fffdf8" stroke="#e5d8cb" stroke-width="3"/>
      <circle cx="120" cy="135" r="${isBaby ? 72 : 77}" fill="#fffdf8" stroke="#e5d8cb" stroke-width="3"/>
      <ellipse cx="64" cy="153" rx="18" ry="12" fill="#f9d5d7"/>
      <ellipse cx="176" cy="153" rx="18" ry="12" fill="#f9d5d7"/>
      ${eyes}
      <path d="M114 145 Q120 139 126 145 L120 150 Z" fill="#eaa4ab"/>
      <path d="M120 150 Q112 163 106 154 M120 150 Q128 163 134 154" fill="none" stroke="#8e7573" stroke-width="2.8" stroke-linecap="round"/>
      <ellipse cx="77" cy="216" rx="16" ry="12" fill="#fffdf8" stroke="#e5d8cb" stroke-width="3"/>
      <ellipse cx="163" cy="216" rx="16" ry="12" fill="#fffdf8" stroke="#e5d8cb" stroke-width="3"/>
      ${isAdult ? '<path d="M91 67 L106 42 L120 62 L134 42 L149 67 L146 84 L94 84 Z" fill="#f6cb69" stroke="#d7a24e" stroke-width="3"/><circle cx="120" cy="56" r="5" fill="#ee9eaa"/>' : ""}
      ${isBaby ? '<circle cx="120" cy="202" r="9" fill="#f6d3d6"/>' : '<path d="M105 204 L120 212 L135 204 L127 229 L113 229 Z" fill="#a9caa8" opacity=".85"/>'}
    </svg>`;
}

function header() {
  return `<header class="topbar">
    <div class="brand"><span class="brand-kicker">MOFUMOFU FOREST</span><h1>🌳 もふもふの森</h1></div>
    <div class="top-actions">
      <div class="pill" aria-label="コイン ${state.coins}まい">🪙 ${state.coins}</div>
      <button class="icon-btn" data-action="open-settings" aria-label="せってい">⚙️</button>
    </div>
  </header>`;
}
function nav() {
  const tabs = [
    ["home", "🏠", "おうち"], ["adventure", "🌳", "ぼうけん"],
    ["room", "🪑", "おへや"], ["album", "📖", "ずかん"]
  ];
  return `<nav class="bottom-nav" aria-label="ゲームのメニュー">${tabs.map(([tab, emoji, name]) =>
    `<button class="nav-item ${ui.tab === tab ? "active" : ""}" data-action="tab" data-tab="${tab}" ${ui.tab === tab ? 'aria-current="page"' : ""}>
      <span class="nav-emoji" aria-hidden="true">${emoji}</span>${name}</button>`
  ).join("")}</nav>`;
}
function tutorialHint() {
  const hints = {
    care: ["🥕", "もふと なかよくなろう！", "ごはん・おふろ・あそぶを ためしてね"],
    adventure: ["⭐", "ぼうけんに いこう！", "森で ほしを 3つ みつけよう"],
    room: ["🪑", "おへやを かざろう！", "コインで すきな かぐを えらんでね"]
  };
  if (state.tutorialStep === "done" || !hints[state.tutorialStep]) return "";
  const [icon, title, copy] = hints[state.tutorialStep];
  return `<div class="story-card"><span class="story-icon">${icon}</span>
    <div class="story-content"><strong>${title}</strong><p>${copy}</p></div></div>`;
}
function roomScene(compact = false) {
  const wall = state.room.wall === "wall_rainbow" ? "rainbow-wall" : "";
  const bed = state.room.bed === "bed_pink" ? "pink" : "";
  const rug = state.room.rug
    ? `<div class="rug-furniture ${state.room.rug === "rug_star" ? "star-rug" : ""}">${state.room.rug === "rug_star" ? "⭐" : "🌼"}</div>` : "";
  const toy = state.room.toy
    ? `<div class="toy-furniture" aria-hidden="true">${state.room.toy === "toy_bear" ? "🧸" : "🏀"}</div>` : "";
  return `<section class="scene room-scene ${wall} ${compact ? "compact" : ""}" aria-label="もふの おへや">
    <div class="wall-dots"></div>
    <div class="room-window"><span class="sun">☀️</span></div>
    <div class="room-frame">🌷</div>
    <div class="room-floor-edge"></div>
    <div class="floor-shadow"></div>
    <div class="bed-furniture ${bed}" aria-hidden="true">🛏️</div>
    ${rug}${toy}<div class="flower-pot" aria-hidden="true">🪴</div>
    ${!compact ? `<div class="pet-speech">${escapeHtml(ui.reaction || (state.pet.hearts >= 2 ? "いっしょに あそぼ♪" : "こんにちは！"))}</div>` : ""}
    ${ui.showHeart && !compact ? '<div class="float-heart">💗</div>' : ""}
    <div class="pet-area"><button class="pet-click" data-action="pet" aria-label="もふを なでる">${bunnySvg()}</button></div>
  </section>`;
}
function homeScreen() {
  const care = state.pet.careDone;
  const done = Object.values(care).filter(Boolean).length;
  return `${tutorialHint()}
    <div class="state-strip"><span class="pet-name">🐰 ${escapeHtml(state.pet.name)}</span>
      <span class="growth-label">${titleGrowth()}</span>
      <span class="heart-display">💗 ${state.pet.hearts}/${MAX_HEARTS}</span></div>
    ${roomScene()}
    <div class="care-grid">
      <button class="care-btn" data-action="food"><span class="emoji">🥕</span><strong>ごはん</strong><span class="done">${care.food ? "✓ できた！" : "あげる"}</span></button>
      <button class="care-btn" data-action="bath"><span class="emoji">🫧</span><strong>おふろ</strong><span class="done">${care.bath ? "✓ できた！" : "あらう"}</span></button>
      <button class="care-btn" data-action="play"><span class="emoji">🧸</span><strong>あそぶ</strong><span class="done">${care.play ? "✓ できた！" : "いっしょに"}</span></button>
    </div>
    <div class="care-progress"><div class="progress-top"><span>💞 なかよしチャレンジ</span><span>${done}/3</span></div>
      <div class="progress-track"><div class="progress-fill" style="width:${(done / 3) * 100}%"></div></div>
      <p class="caption" style="margin:7px 0 0">3つの おせわで ハートが 1つ ふえるよ！</p>
    </div>
    <div class="bottom-note">うさぎを タップすると よろこぶよ ♡</div>`;
}

function introScreen() {
  return `<h1 class="welcome-title">🌳 もふもふの森 🌳</h1>
    <p class="welcome-sub">ふしぎな たまごを みつけたよ！</p>
    <div class="egg-scene">
      <button class="egg" data-action="egg" aria-label="たまごを トントンする">${ui.eggTaps === 0 ? "🥚" : "🥚"}</button>
      <p>${ui.eggTaps === 0 ? "たまごを トントン してみよう！" : ui.eggTaps === 1 ? "あと 2かい！" : "あと 1かい！"}</p>
      <div class="progress-dots">${[0,1,2].map(i => `<span class="${i < ui.eggTaps ? "current" : ""}"></span>`).join("")}</div>
    </div><p class="caption">たまごを 3かい タップしてね ☝️</p>`;
}

function adventureScreen() {
  const scene = scenes[ui.scene];
  const starCount = ui.stars.size;
  const star = ui.stars.has(ui.scene);
  return `${tutorialHint()}
    <div class="panel" style="margin-bottom:12px;text-align:center">
      <h2>🌳 ${scene.name}</h2><div class="star-strip" aria-label="みつけた ほし ${starCount}こ">${"⭐".repeat(starCount)}${"☆".repeat(3 - starCount)}</div>
      <div class="small-label">${starCount}/3 こ みつけたよ</div>
    </div>
    <section class="scene adventure-scene ${scene.backdrop}" aria-label="${scene.name}">
      <div class="cloud one">☁️</div><div class="cloud two">☁️</div>
      <div class="adventure-hill"></div><div class="adventure-hill two"></div>
      ${ui.scene === 1 ? '<div class="river-stream"></div>' : ""}
      ${ui.scene === 2 ? '<div class="big-tree" aria-hidden="true">🌳</div>' : ""}
      ${scene.objects.map(object => `<button class="target ${object.at}" data-action="search" data-id="${object.id}" aria-label="${object.label}を さがす">
          <span class="shape">${object.emoji}</span><small>${object.label}</small>
          ${star && object.id === scene.target ? '<span class="found-star">⭐</span>' : ""}
        </button>`).join("")}
      ${ui.scene === 2 && starCount === 3 ?
        '<button class="chest-btn" data-action="chest"><span class="emoji">🎁</span>たからばこを あける！</button>' : ""}
    </section>
    <div class="quick-message" aria-live="polite">${escapeHtml(ui.reaction || (star ? "ここの ほしは みつかったよ！" : scene.hint))}</div>
    <div class="progress-dots" aria-hidden="true">${scenes.map((_, i) => `<span class="${i === ui.scene ? "current" : ""}"></span>`).join("")}</div>
    <div class="adventure-foot">
      <button class="big-button secondary" data-action="scene-prev" ${ui.scene === 0 ? "disabled" : ""}>← まえ</button>
      <span class="small-label">${ui.scene + 1} / 3</span>
      <button class="big-button mint" data-action="scene-next" ${ui.scene === 2 ? "disabled" : ""}>つぎ →</button>
    </div>
    ${ui.scene === 2 && starCount < 3 ? '<p class="caption">ほしが 3つ そろったら たからばこが あくよ！</p>' : ""}`;
}

function roomScreen() {
  const slotInfo = SLOTS.find(s => s.id === ui.selectedSlot);
  const items = FURNITURE.filter(item => item.slot === ui.selectedSlot);
  return `${tutorialHint()}
    <h2 class="section-title">🪑 おへやを かわいくしよう！</h2>
    ${roomScene(true)}
    <div class="slot-grid">${SLOTS.map(slot =>
      `<button class="slot-btn ${slot.id === ui.selectedSlot ? "active" : ""}" data-action="slot" data-slot="${slot.id}">
        <span>${slot.icon}</span>${slot.name}</button>`
    ).join("")}</div>
    <div class="panel"><h2>${slotInfo.icon} ${slotInfo.name}を えらぼう</h2>
      <div class="shop-grid">${items.map(item => {
        const owned = state.inventory.includes(item.id);
        const selected = state.room[item.slot] === item.id;
        return `<button class="item-card ${selected ? "selected" : ""} ${!owned ? "locked" : ""}" data-action="item" data-id="${item.id}">
          <span class="item-emoji">${item.emoji}</span><strong>${item.name}</strong>
          <small>${selected ? "✓ おへやに あるよ" : owned ? "もっているよ" : "🪙 " + item.price + " まい"}</small></button>`;
      }).join("")}</div>
    </div>
    ${ui.reaction ? `<div class="quick-message" aria-live="polite">${escapeHtml(ui.reaction)}</div>` : ""}
    <div class="bottom-note">かった かぐは なんどでも おけるよ ♡</div>`;
}
function albumScreen() {
  return `<div class="album-stats"><h2 class="section-title" style="margin:0">📖 もふの おもいで</h2>
    <span class="pill">${state.discoveries.length} / ${DISCOVERIES.length}</span></div>
    <p class="caption" style="text-align:left;margin:-4px 0 16px">いろんなことを すると おもいでが ふえるよ！</p>
    <div class="album-grid">${DISCOVERIES.map(discovery => {
      const found = state.discoveries.includes(discovery.id);
      return `<div class="album-item ${found ? "" : "locked"}">
        <span class="album-emoji">${found ? discovery.icon : "❔"}</span>
        <strong>${found ? discovery.title : "？？？"}</strong></div>`;
    }).join("")}</div>
    ${state.pet.hearts >= MAX_HEARTS ? '<div class="quick-message">🏆 ずっと なかよし！ とくべつな おもいで</div>' : ""}
    <div class="bottom-note">あせらず ゆっくり みつけよう 🌼</div>`;
}
function modalFrame(title, hero, body, closable = true) {
  return `<div class="overlay" role="presentation"><div class="dialog" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
    ${closable ? '<button class="dialog-close" data-action="close" aria-label="とじる">✕</button>' : ""}
    <span class="dialog-hero" aria-hidden="true">${hero}</span><h2>${title}</h2>${body}</div></div>`;
}
function modalHtml() {
  if (!ui.modal) return "";
  if (ui.modal === "name") return modalFrame("なまえを つけよう！", "🐰",
    `<p>かわいい うさぎが うまれたよ！</p>
     <label class="field">うさぎの なまえ<input id="pet-name-input" maxlength="8" value="${escapeHtml(state.pet.name)}" autocomplete="off"></label>
     <button class="big-button full" data-action="save-name">この なまえで はじめる ♡</button>`, false);
  if (ui.modal === "food") return modalFrame("なにを たべる？", "🍽️",
    `<p>すきな ごはんを えらんでね</p>
    <div class="food-options">
      <button class="food-option" data-action="choose-food" data-id="carrot"><span>🥕</span>にんじん</button>
      <button class="food-option" data-action="choose-food" data-id="apple"><span>🍎</span>りんご</button>
      <button class="food-option" data-action="choose-food" data-id="strawberry"><span>🍓</span>いちご</button>
    </div>`);
  if (ui.modal === "bath") return modalFrame("あわを けそう！", "🛁",
    `<p>あわを 3つ タップして きれいにしよう</p>
    <div class="bath-bubbles">${[0,1,2].map(i => `<button class="bubble ${ui.bathPopped.has(i) ? "popped" : ""}" data-action="bubble" data-id="${i}" aria-label="あわ ${i+1}">${ui.bathPopped.has(i) ? "✨" : "🫧"}</button>`).join("")}</div>
    <p>あと ${3 - ui.bathPopped.size} こ！</p>`);
  if (ui.modal === "play") return modalFrame("ボールで あそぼう！", "🐰",
    `<p>ボールを 3かい タップしてね</p>
    <button class="ball-toy" data-action="ball" aria-label="ボールを ころがす">🏀</button>
    <p>${ui.playCount} / 3 かい！</p>`);
  if (ui.modal === "heart") return modalFrame("なかよしに なったよ！", "💗",
    `<p>ハートが 1つ ふえたよ！<br>もふが うれしそう！</p>
    <button class="big-button full" data-action="close">やったー！</button>`, false);
  if (ui.modal === "growth") return modalFrame("おおきく なったよ！", "🎉",
    `<div style="width:165px;margin:0 auto">${bunnySvg()}</div><p>${escapeHtml(state.pet.name)}は <strong>${titleGrowth()}</strong> に なったよ！</p>
    <button class="big-button full" data-action="close">ばんざーい！</button>`, false);
  if (ui.modal === "victory") return modalFrame("ぼうけん だいせいこう！", "🎁",
    `<p>ほしを 3つ みつけたよ！<br><strong>🪙 5コイン</strong> もらったよ！</p>
    <div class="dialog-actions"><button class="big-button full mint" data-action="go-room">おへやを かざろう！</button>
    <button class="big-button full secondary" data-action="repeat-adventure">もういちど ぼうけん！</button></div>`, false);
  if (ui.modal === "settings") return modalFrame("せってい", "⚙️",
    `<div class="setting-row"><span>🔈 おとを ならす</span>
      <button class="toggle ${state.soundEnabled ? "on" : ""}" data-action="toggle-sound" aria-pressed="${state.soundEnabled}">${state.soundEnabled ? "ON ♪" : "OFF"}</button></div>
      <p style="text-align:left">おせわも ぼうけんも いつでも あそべるよ。おやすみしても もふは げんき！</p>
      ${!saveWorks ? '<p style="color:#a64f42">⚠️ このブラウザでは セーブが できないみたい。</p>' : ""}
      <button class="big-button full secondary" data-action="rename">✏️ なまえを かえる</button>
      <button class="muted-button" data-action="confirm-reset">はじめから やりなおす（おとなと いっしょに）</button>`);
  if (ui.modal === "confirm-reset") return modalFrame("ほんとうに けす？", "🧺",
    `<p>ハート・コイン・かぐ・おもいでが ぜんぶ なくなるよ。おとなと いっしょに かくにんしてね。</p>
    <div class="dialog-actions"><button class="big-button full secondary" data-action="close">やめる</button>
    <button class="big-button full" data-action="reset">ぜんぶ けして はじめる</button></div>`);
  return "";
}
function render() {
  app.innerHTML = (state.hatched ? header() : "") +
    `<main class="screen ${state.hatched ? "with-nav" : ""}" id="main-content">
      ${!state.hatched ? introScreen() : ui.tab === "home" ? homeScreen() : ui.tab === "adventure" ? adventureScreen() : ui.tab === "room" ? roomScreen() : albumScreen()}
    </main>` + (state.hatched ? nav() : "") + modalHtml();
}

function onCareCompleted(type, food) {
  const result = finishCare(state, type, food);
  ui.modal = result.gainedHeart ? (result.grew ? "growth" : "heart") : null;
  const message = type === "food"
    ? food === "carrot" ? "にんじん だいすき！ もぐもぐ♪" : "おいしい！ ありがとう♪"
    : type === "bath" ? "ぴかぴか！ きもちいい！" : "わーい！ もっと あそぼう！";
  react(message, true);
  sound(result.gainedHeart ? [523, 659, 784, 1046] : [494, 659, 784], .11);
  changeState(result.state);
}

app.addEventListener("click", event => {
  const button = event.target.closest("[data-action]");
  if (!button || button.disabled) return;
  const action = button.dataset.action;
  const id = button.dataset.id;
  if (action === "egg") {
    ui.eggTaps++;
    sound([494, 620], .08);
    if (ui.eggTaps >= 3) {
      state = hatchPet(state);
      ui.modal = "name";
      persist();
      sound([523, 659, 784, 1046], .13);
    }
    render();
    return;
  }
  if (action === "save-name") {
    const input = document.querySelector("#pet-name-input");
    state = renamePet(state, input?.value);
    ui.modal = null; persist(); render(); return;
  }
  if (action === "rename") { ui.modal = "name"; render(); return; }
  if (action === "tab") {
    if (ui.tab === "adventure" && button.dataset.tab !== "adventure") {
      ui.scene = 0; ui.stars = new Set(); ui.wrongTries = 0;
    }
    ui.tab = button.dataset.tab;
    ui.reaction = ""; ui.joyful = false;
    render();
    document.querySelector("#main-content")?.scrollTo(0, 0);
    return;
  }
  if (action === "pet") {
    sound([660, 784], .09); react("えへへ！ なでてくれて ありがとう♡", true); render(); return;
  }
  if (action === "food") { ui.modal = "food"; render(); return; }
  if (action === "choose-food") { onCareCompleted("food", id); return; }
  if (action === "bath") { ui.bathPopped = new Set(); ui.modal = "bath"; render(); return; }
  if (action === "bubble") {
    ui.bathPopped.add(Number(id));
    sound([730], .08);
    if (ui.bathPopped.size >= 3) onCareCompleted("bath");
    else render();
    return;
  }
  if (action === "play") { ui.playCount = 0; ui.modal = "play"; render(); return; }
  if (action === "ball") {
    ui.playCount++;
    sound([523, 659], .09);
    if (ui.playCount >= 3) onCareCompleted("play");
    else render();
    return;
  }
  if (action === "search") {
    const scene = scenes[ui.scene];
    if (id !== scene.target) {
      ui.wrongTries++;
      react(ui.wrongTries >= 2 ? "ヒント！ " + scene.hint : "ここには ないみたい！ ほかを さがそう");
      sound([440], .09);
    } else if (ui.stars.has(ui.scene)) {
      react("ここの ほしは もう みつけたよ！");
    } else {
      ui.stars.add(ui.scene);
      state = collectStar(state);
      persist();
      sound([523, 784, 1046], .12);
      react("⭐ ほしを みつけたよ！", true);
    }
    render(); return;
  }
  if (action === "scene-prev" || action === "scene-next") {
    ui.scene = Math.max(0, Math.min(2, ui.scene + (action === "scene-next" ? 1 : -1)));
    ui.wrongTries = 0; ui.reaction = "";
    sound([530], .1); render(); return;
  }
  if (action === "chest") {
    if (ui.scene !== 2 || ui.stars.size !== 3) return;
    const result = finishAdventure(state, ui.stars.size);
    if (!result.success) return;
    state = result.state; persist();
    ui.stars = new Set(); ui.scene = 0; ui.wrongTries = 0;
    ui.modal = "victory";
    sound([523, 659, 784, 988, 1046], .16);
    render(); return;
  }
  if (action === "go-room") { ui.modal = null; ui.tab = "room"; render(); return; }
  if (action === "repeat-adventure") { ui.modal = null; ui.tab = "adventure"; render(); return; }
  if (action === "slot") { ui.selectedSlot = button.dataset.slot; ui.reaction = ""; sound([523], .08); render(); return; }
  if (action === "item") {
    const result = buyOrEquip(state, id);
    if (!result.ok) {
      const item = FURNITURE.find(i => i.id === id);
      react(item ? "あと " + (item.price - state.coins) + " コイン ひつようだよ！" : "えらべないみたい！");
      render(); return;
    }
    sound(result.purchased ? [523, 659, 784] : [587, 784], .1);
    react(result.purchased ? "🎉 あたらしい かぐを かったよ！" : "おへやに おいたよ！");
    changeState(result.state); return;
  }
  if (action === "open-settings") { ui.modal = "settings"; render(); return; }
  if (action === "toggle-sound") {
    state = { ...state, soundEnabled: !state.soundEnabled };
    persist(); updateBgm(); sound([523, 659], .1); render(); return;
  }
  if (action === "confirm-reset") { ui.modal = "confirm-reset"; render(); return; }
  if (action === "reset") {
    state = initialState();
    ui.tab = "home"; ui.modal = null; ui.eggTaps = 0; ui.scene = 0;
    ui.stars = new Set(); ui.reaction = ""; ui.showHeart = false;
    persist(); updateBgm(); render(); return;
  }
  if (action === "close") { ui.modal = null; render(); return; }
});
render();
