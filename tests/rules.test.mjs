import test from "node:test";
import assert from "node:assert/strict";
import {
  SAVE_KEY, MAX_HEARTS, initialState, normalizeState, readSave, writeSave,
  hatchPet, renamePet, growthStage, finishCare, collectStar,
  finishAdventure, buyOrEquip
} from "../src/rules.js";

test("たまごを孵すと名前・図鑑・次の案内が設定される", () => {
  const pet = hatchPet(initialState(), " ぴょん ");
  assert.equal(pet.hatched, true);
  assert.equal(pet.pet.name, "ぴょん");
  assert.equal(pet.tutorialStep, "care");
  assert.deepEqual(pet.discoveries, ["egg_hatch"]);
  assert.equal(hatchPet(pet).pet.name, "ぴょん");
});

test("名前は8文字に制限され、表示できない記号を取り除く", () => {
  const state = renamePet(initialState(), "<たしろ>うさぎちゃん");
  assert.equal(state.pet.name, "たしろうさぎち");
  assert.equal(renamePet(state, "  ").pet.name, "もふ");
});

test("ごはん・おふろ・あそぶの3種を完了するとハートが1つ増える", () => {
  let state = hatchPet(initialState());
  state = finishCare(state, "food", "carrot").state;
  state = finishCare(state, "food", "carrot").state;
  assert.equal(state.pet.hearts, 0);
  assert.equal(state.pet.careDone.food, true);
  state = finishCare(state, "bath").state;
  const result = finishCare(state, "play");
  assert.equal(result.gainedHeart, true);
  assert.equal(result.state.pet.hearts, 1);
  assert.equal(result.state.tutorialStep, "adventure");
  assert.deepEqual(result.state.pet.careDone, {food:false, bath:false, play:false});
  for (const id of ["first_food", "carrot", "first_bath", "first_play", "first_heart"])
    assert.equal(result.state.discoveries.includes(id), true);
});

test("ハート2個と6個で段階が成長し、最大12個で止まる", () => {
  let state = hatchPet(initialState());
  let transitions = 0;
  for (let i=0;i<14;i++) {
    state = finishCare(state, "food").state;
    state = finishCare(state, "bath").state;
    const result = finishCare(state, "play");
    if (result.grew) transitions++;
    state = result.state;
  }
  assert.equal(state.pet.hearts, MAX_HEARTS);
  assert.equal(growthStage(0), "baby");
  assert.equal(growthStage(2), "child");
  assert.equal(growthStage(6), "adult");
  assert.equal(transitions, 2);
  assert.equal(state.discoveries.includes("adult"), true);
});

test("冒険は星3つが必要で、クリアすると5コインと図鑑記録を獲得", () => {
  let state = hatchPet(initialState());
  assert.equal(finishAdventure(state, 2).success, false);
  assert.equal(state.coins, 0);
  state = collectStar(state);
  state = collectStar(state);
  assert.equal(state.discoveries.filter(i => i==="first_star").length, 1);
  state = {...state, tutorialStep:"adventure"};
  const result = finishAdventure(state, 3);
  assert.equal(result.success, true);
  assert.equal(result.state.coins, 5);
  assert.equal(result.state.adventure.clearCount, 1);
  assert.equal(result.state.tutorialStep, "room");
  assert.equal(result.state.discoveries.includes("first_clear"), true);
});

test("家具を購入でき、同じものを選び直しても二重課金されない", () => {
  let state = {...hatchPet(initialState()),coins:5,tutorialStep:"room"};
  const first = buyOrEquip(state,"rug_flower");
  assert.equal(first.ok,true);
  assert.equal(first.purchased,true);
  state = first.state;
  assert.equal(state.coins,0);
  assert.equal(state.room.rug,"rug_flower");
  assert.equal(state.inventory.includes("rug_flower"),true);
  assert.equal(state.tutorialStep,"done");
  const again = buyOrEquip(state,"rug_flower");
  assert.equal(again.purchased,false);
  assert.equal(again.state.coins,0);
  assert.equal(buyOrEquip(state,"bed_pink").reason,"coins");
  assert.equal(buyOrEquip(state,"not-found").reason,"not-found");
});

test("保存データを正規化し、不正な家具とコイン値を無視する", () => {
  const state = normalizeState({
    schemaVersion:1,hatched:true,
    pet:{name:"<もふ>",hearts:900,careDone:{food:true}},
    coins:-100,
    inventory:["bad","toy_bear","toy_bear"],
    room:{toy:"toy_bear",rug:"rug_star",bed:"toy_bear"},
    discoveries:["first_food","fake","first_food"],
    tutorialStep:"bad"
  });
  assert.equal(state.coins,0);
  assert.equal(state.pet.hearts,12);
  assert.equal(state.pet.name,"もふ");
  assert.equal(state.room.bed,"bed_basic");
  assert.equal(state.room.rug,null);
  assert.equal(state.room.toy,"toy_bear");
  assert.deepEqual(state.discoveries,["first_food"]);
  assert.equal(state.tutorialStep,"care");
});

test("localStorageから再開でき、保存が使えなくても初期化できる", () => {
  let data = null;
  const fakeStorage = {
    getItem(key){ assert.equal(key,SAVE_KEY); return data; },
    setItem(key,value){ assert.equal(key,SAVE_KEY); data=value; }
  };
  const saved = {...hatchPet(initialState()),coins:42};
  assert.equal(writeSave(fakeStorage,saved),true);
  assert.equal(readSave(fakeStorage).coins,42);
  assert.deepEqual(readSave({getItem(){throw new Error("blocked");}}),initialState());
  assert.equal(writeSave({setItem(){throw new Error("blocked");}},saved),false);
});
