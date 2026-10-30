// Pure game rules. No external service, account, or time-based penalties.
export const MAX_HEARTS = 12;
export const FURNITURE = [
  { id: "bed_basic", name: "きのベッド", slot: "bed", price: 0, emoji: "🛏️" },
  { id: "wall_sky", name: "あおぞらのかべ", slot: "wall", price: 0, emoji: "☀️" },
  { id: "rug_flower", name: "おはなのラグ", slot: "rug", price: 5, emoji: "🌸" },
  { id: "rug_star", name: "おほしさまラグ", slot: "rug", price: 8, emoji: "⭐" },
  { id: "toy_bear", name: "くまのぬいぐるみ", slot: "toy", price: 5, emoji: "🧸" },
  { id: "toy_ball", name: "にじいろボール", slot: "toy", price: 8, emoji: "🏀" },
  { id: "bed_pink", name: "ピンクのベッド", slot: "bed", price: 10, emoji: "🛌" },
  { id: "wall_rainbow", name: "にじいろのかべ", slot: "wall", price: 12, emoji: "🌈" }
];
export const SLOTS = [
  { id: "bed", name: "ベッド", icon: "🛏️" },
  { id: "rug", name: "ラグ", icon: "🌸" },
  { id: "toy", name: "おもちゃ", icon: "🧸" },
  { id: "wall", name: "かべがみ", icon: "🌈" }
];
export const DISCOVERIES = [
  { id: "egg_hatch", title: "もふが うまれた", icon: "🥚" },
  { id: "first_food", title: "はじめての ごはん", icon: "🥕" },
  { id: "carrot", title: "にんじん だいすき", icon: "💗" },
  { id: "first_bath", title: "はじめての おふろ", icon: "🫧" },
  { id: "first_play", title: "はじめての ボール", icon: "🏀" },
  { id: "first_heart", title: "なかよしに なった", icon: "💞" },
  { id: "child", title: "おおきく なった", icon: "🐇" },
  { id: "first_star", title: "ほしを みつけた", icon: "⭐" },
  { id: "first_clear", title: "たからばこ はっけん", icon: "🎁" },
  { id: "first_furniture", title: "はじめての かぐ", icon: "🪑" },
  { id: "adult", title: "りっぱに そだった", icon: "👑" }
];
const KNOWN_FURNITURE = new Set(FURNITURE.map(item => item.id));
const KNOWN_DISCOVERIES = new Set(DISCOVERIES.map(item => item.id));
export const SAVE_KEY = "mofumofu-forest-v1";

export function initialState() {
  return {
    schemaVersion: 1,
    hatched: false,
    pet: {
      species: "rabbit", name: "もふ", hearts: 0,
      careDone: { food: false, bath: false, play: false }
    },
    coins: 0,
    adventure: { clearCount: 0 },
    inventory: ["bed_basic", "wall_sky"],
    room: { bed: "bed_basic", wall: "wall_sky", rug: null, toy: null },
    discoveries: [],
    tutorialStep: "egg",
    soundEnabled: false
  };
}

export function sanitizeName(value) {
  const text = String(value ?? "").trim().replace(/[<>]/g, "");
  return Array.from(text).slice(0, 8).join("") || "もふ";
}

const integer = (value, min, max, fallback) =>
  Number.isSafeInteger(value) ? Math.min(max, Math.max(min, value)) : fallback;

export function normalizeState(raw) {
  const base = initialState();
  if (!raw || typeof raw !== "object" || raw.schemaVersion !== 1) return base;
  const pet = raw.pet && typeof raw.pet === "object" ? raw.pet : {};
  const room = raw.room && typeof raw.room === "object" ? raw.room : {};
  const care = pet.careDone && typeof pet.careDone === "object" ? pet.careDone : {};
  const inventory = [...new Set([
    "bed_basic", "wall_sky",
    ...(Array.isArray(raw.inventory) ? raw.inventory.filter(id => KNOWN_FURNITURE.has(id)) : [])
  ])];
  const fitted = {};
  for (const slot of SLOTS) {
    const candidate = room[slot.id];
    fitted[slot.id] = typeof candidate === "string" &&
      inventory.includes(candidate) &&
      FURNITURE.some(item => item.id === candidate && item.slot === slot.id)
      ? candidate : base.room[slot.id];
  }
  const validSteps = ["egg", "care", "adventure", "room", "done"];
  return {
    ...base,
    hatched: raw.hatched === true,
    pet: {
      species: "rabbit",
      name: sanitizeName(pet.name),
      hearts: integer(pet.hearts, 0, MAX_HEARTS, 0),
      careDone: {
        food: care.food === true,
        bath: care.bath === true,
        play: care.play === true
      }
    },
    coins: integer(raw.coins, 0, 999999, 0),
    adventure: { clearCount: integer(raw.adventure?.clearCount, 0, 999999, 0) },
    inventory, room: fitted,
    discoveries: [...new Set(
      (Array.isArray(raw.discoveries) ? raw.discoveries : [])
        .filter(id => KNOWN_DISCOVERIES.has(id))
    )],
    tutorialStep: validSteps.includes(raw.tutorialStep) ? raw.tutorialStep : (raw.hatched ? "care" : "egg"),
    soundEnabled: raw.soundEnabled === true
  };
}

export function readSave(storage) {
  try {
    const raw = storage.getItem(SAVE_KEY);
    return raw ? normalizeState(JSON.parse(raw)) : initialState();
  } catch {
    return initialState();
  }
}

export function writeSave(storage, state) {
  try {
    storage.setItem(SAVE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function growthStage(hearts) {
  return hearts >= 6 ? "adult" : hearts >= 2 ? "child" : "baby";
}

export function recordDiscovery(state, id) {
  if (!KNOWN_DISCOVERIES.has(id) || state.discoveries.includes(id)) return state;
  return { ...state, discoveries: [...state.discoveries, id] };
}

export function hatchPet(state, name = "もふ") {
  if (state.hatched) return state;
  let next = {
    ...state, hatched: true,
    pet: { ...state.pet, name: sanitizeName(name) },
    tutorialStep: "care"
  };
  return recordDiscovery(next, "egg_hatch");
}

export function renamePet(state, name) {
  return { ...state, pet: { ...state.pet, name: sanitizeName(name) } };
}

export function finishCare(state, type, food = null) {
  if (!state.hatched || !["food", "bath", "play"].includes(type)) {
    return { state, gainedHeart: false, grew: false };
  }
  const beforeStage = growthStage(state.pet.hearts);
  let next = state;
  if (type === "food") {
    next = recordDiscovery(next, "first_food");
    if (food === "carrot") next = recordDiscovery(next, "carrot");
  }
  if (type === "bath") next = recordDiscovery(next, "first_bath");
  if (type === "play") next = recordDiscovery(next, "first_play");
  const wasDone = next.pet.careDone[type];
  const careDone = { ...next.pet.careDone, [type]: true };
  const completed = Object.values(careDone).every(Boolean);
  const gainedHeart = completed && !wasDone && next.pet.hearts < MAX_HEARTS;
  const hearts = gainedHeart ? next.pet.hearts + 1 : next.pet.hearts;
  next = {
    ...next,
    pet: {
      ...next.pet, hearts,
      careDone: completed ? { food: false, bath: false, play: false } : careDone
    },
    tutorialStep: gainedHeart && next.tutorialStep === "care" ? "adventure" : next.tutorialStep
  };
  if (hearts >= 1) next = recordDiscovery(next, "first_heart");
  if (hearts >= 2) next = recordDiscovery(next, "child");
  if (hearts >= 6) next = recordDiscovery(next, "adult");
  return { state: next, gainedHeart, grew: beforeStage !== growthStage(hearts) };
}

export function collectStar(state) {
  return recordDiscovery(state, "first_star");
}

export function finishAdventure(state, starsFound) {
  if (!state.hatched || starsFound !== 3) return { state, success: false };
  let next = {
    ...state,
    coins: Math.min(999999, state.coins + 5),
    adventure: { clearCount: state.adventure.clearCount + 1 },
    tutorialStep: state.tutorialStep === "adventure" ? "room" : state.tutorialStep
  };
  next = recordDiscovery(next, "first_clear");
  return { state: next, success: true };
}

export function buyOrEquip(state, id) {
  const item = FURNITURE.find(entry => entry.id === id);
  if (!item) return { state, ok: false, reason: "not-found" };
  const owned = state.inventory.includes(id);
  if (!owned && state.coins < item.price) return { state, ok: false, reason: "coins" };
  let next = {
    ...state,
    coins: owned ? state.coins : state.coins - item.price,
    inventory: owned ? state.inventory : [...state.inventory, id],
    room: { ...state.room, [item.slot]: id },
    tutorialStep: !owned && state.tutorialStep === "room" ? "done" : state.tutorialStep
  };
  if (!owned) next = recordDiscovery(next, "first_furniture");
  return { state: next, ok: true, purchased: !owned };
}
