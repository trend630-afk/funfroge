const ROUND_LENGTH_MS = 30000;
const TIMER_INTERVAL_MS = 100;
const STORAGE_KEY = "funfroge-neon-target-rush-best";
const BASE_HIT_SCORE = 100;
const COMBO_BONUS = 25;
const MAX_COMBO_BONUS = 100;

const playfield = document.querySelector("#playfield");
const targetButton = document.querySelector("#target");
const startButton = document.querySelector("#startButton");
const startButtonLabel = document.querySelector("#startButtonLabel");
const soundButton = document.querySelector("#soundButton");
const soundLabel = document.querySelector("#soundLabel");
const scoreValue = document.querySelector("#scoreValue");
const timerValue = document.querySelector("#timerValue");
const hitsValue = document.querySelector("#hitsValue");
const comboValue = document.querySelector("#comboValue");
const bestValue = document.querySelector("#bestValue");
const fieldState = document.querySelector("#fieldState");
const gameOverlay = document.querySelector("#gameOverlay");
const overlayKicker = document.querySelector("#overlayKicker");
const overlayTitle = document.querySelector("#overlayTitle");
const overlayCopy = document.querySelector("#overlayCopy");
const roundResults = document.querySelector("#roundResults");
const finalScore = document.querySelector("#finalScore");
const finalHits = document.querySelector("#finalHits");
const finalAccuracy = document.querySelector("#finalAccuracy");
const finalBest = document.querySelector("#finalBest");
const newBestMessage = document.querySelector("#newBestMessage");
const comboToast = document.querySelector("#comboToast");
const fxLayer = document.querySelector("#fxLayer");
const gameAnnouncement = document.querySelector("#gameAnnouncement");

let phase = "ready";
let score = 0;
let hits = 0;
let misses = 0;
let decoysHit = 0;
let combo = 0;
let bestScore = readBestScore();
let deadline = 0;
let timerInterval = null;
let targetTransitionTimeout = null;
let soundEnabled = true;
let audioContext = null;
let targetKind = "normal";
let wave = 1;
let shareButton;

bestValue.textContent = String(bestScore);

function readBestScore() {
  try { const n = Number(localStorage.getItem(STORAGE_KEY)); return Number.isFinite(n) && n > 0 ? n : 0; }
  catch { return 0; }
}
function saveBestScore() {
  try { localStorage.setItem(STORAGE_KEY, String(bestScore)); }
  catch { gameAnnouncement.textContent = "Best score could not be saved in this browser."; }
}
function getAudioContext() {
  if (!soundEnabled) return null;
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return null;
  try { audioContext ??= new Ctor(); if (audioContext.state === "suspended") audioContext.resume(); return audioContext; }
  catch { return null; }
}
function playTone(frequency, duration, offset = 0, type = "sine") {
  const context = getAudioContext(); if (!context) return;
  const oscillator = context.createOscillator(); const gain = context.createGain();
  const start = context.currentTime + offset;
  oscillator.type = type; oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(.0001, start); gain.gain.exponentialRampToValueAtTime(.08, start + .012);
  gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
  oscillator.connect(gain); gain.connect(context.destination); oscillator.start(start); oscillator.stop(start + duration + .02);
}
function playSound(effect) {
  if (!soundEnabled) return;
  if (effect === "hit") playTone(610,.11,0,"triangle");
  else if (effect === "gold") { playTone(740,.14,0,"triangle"); playTone(1100,.2,.07,"triangle"); }
  else if (effect === "slow") { playTone(420,.18,0,"sine"); playTone(620,.2,.1,"sine"); }
  else if (effect === "decoy") playTone(170,.2,0,"sawtooth");
  else if (effect === "combo") { playTone(720,.16,0,"triangle"); playTone(960,.18,.07,"triangle"); }
  else if (effect === "end") { playTone(440,.2,0); playTone(330,.28,.14); }
  else if (effect === "button") playTone(480,.06,0);
}
function formatTime(ms) { return `00:${String(Math.max(0,Math.ceil(ms/1000))).padStart(2,"0")}`; }
function updateScoreboard() {
  scoreValue.textContent = String(score); hitsValue.textContent = String(hits);
  comboValue.textContent = `x${Math.max(1,combo)}`;
}
function currentWave() { return Math.min(5, 1 + Math.floor((ROUND_LENGTH_MS - Math.max(0, deadline - performance.now())) / 6000)); }
function placeTarget() {
  const w = playfield.clientWidth, h = playfield.clientHeight;
  if (w < 30 || h < 30) return;
  const roll = Math.random();
  targetKind = roll < .13 ? "gold" : roll < .23 ? "slow" : roll < .34 ? "decoy" : "normal";
  const small = Math.random() < .25;
  const base = 62 + Math.random() * 15;
  const waveScale = 1 - (wave - 1) * 0.055;
  const size = Math.round(Math.max(30,Math.min((small ? 42 + Math.random()*8 : base) * waveScale,w-16,h-70)));
  const xSpace = Math.max(0,w-size-12), ySpace = Math.max(0,h-size-12);
  targetButton.style.setProperty("--target-size",`${size}px`);
  targetButton.style.left = `${6 + Math.random()*xSpace}px`;
  targetButton.style.top = `${6 + Math.random()*ySpace}px`;
  targetButton.classList.remove("is-hit","is-gold","is-slow","is-decoy","is-moving");
  targetButton.textContent = targetKind === "gold" ? "★" : targetKind === "slow" ? "Ⅱ" : targetKind === "decoy" ? "×" : "";
  targetButton.setAttribute("aria-label", targetKind === "gold" ? "Gold bonus target" : targetKind === "slow" ? "Time slow target" : targetKind === "decoy" ? "Decoy target: avoid" : "Neon target");
  if (targetKind !== "normal") targetButton.classList.add(`is-${targetKind}`);
  if (Math.random() < .28 + (wave - 1) * .09) targetButton.classList.add("is-moving");
  targetButton.style.setProperty("--drift-duration", `${Math.max(.55, 1.15 - (wave - 1) * .12)}s`);
  targetButton.hidden = false;
}
function createHitEffects(x,y,points,color) {
  const pop = document.createElement("span"); pop.className="score-pop"; pop.textContent = points >= 0 ? `+${points}` : String(points);
  pop.style.left=`${x}px`; pop.style.top=`${y}px`; if(color) pop.style.color=color; fxLayer.append(pop);
  for(let i=0;i<9;i++) { const p=document.createElement("span"), a=2*Math.PI*i/9, d=25+Math.random()*24;
    p.className="particle"; p.style.left=`${x}px`; p.style.top=`${y}px`;
    p.style.setProperty("--dx",`${Math.cos(a)*d}px`); p.style.setProperty("--dy",`${Math.sin(a)*d}px`);
    p.style.setProperty("--particle-color",color || (i%3===0?"var(--cyan)":"var(--lime)")); fxLayer.append(p); }
}
function showComboToast(message = `COMBO x${combo}`) {
  comboToast.textContent=message; comboToast.classList.remove("is-visible"); void comboToast.offsetWidth; comboToast.classList.add("is-visible");
}
function onTargetHit(event) {
  if(phase!=="playing" || targetTransitionTimeout!==null || targetButton.hidden) return;
  event.stopPropagation();
  const b=targetButton.getBoundingClientRect(), f=playfield.getBoundingClientRect();
  const x=(event.clientX || b.left+b.width/2)-f.left, y=(event.clientY || b.top+b.height/2)-f.top;
  let points=BASE_HIT_SCORE, color="var(--cyan)";
  if(targetKind==="decoy") {
    decoysHit++; misses++; combo=0; score=Math.max(0,score-150); points=-150; color="#ff668e";
    gameAnnouncement.textContent="Decoy hit! Minus 150 points. Watch the symbols."; playSound("decoy");
  } else {
    hits++; combo++;
    const bonus=Math.min(Math.max(0,combo-1)*COMBO_BONUS,MAX_COMBO_BONUS);
    points=targetKind==="gold" ? 250+bonus : BASE_HIT_SCORE+bonus;
    score+=points;
    if(targetKind==="gold") { color="#ffd76a"; gameAnnouncement.textContent=`Gold target! ${points} points.`; playSound("gold"); }
    else if(targetKind==="slow") { deadline += 3000; color="#aaaaff"; gameAnnouncement.textContent="Time bonus! Three extra seconds."; playSound("slow"); }
    else { gameAnnouncement.textContent=combo>1?`Combo x${combo}. ${points} points.`:`${points} points.`; playSound(combo>1?"combo":"hit"); }
    if(combo>1) showComboToast(targetKind==="gold"?`GOLD BONUS +${points}`:targetKind==="slow"?"TIME SLOWED":`COMBO x${combo}`);
  }
  updateScoreboard(); createHitEffects(x,y,points,color); targetButton.classList.add("is-hit");
  targetTransitionTimeout=window.setTimeout(()=>{targetTransitionTimeout=null;if(phase==="playing") placeTarget();},110);
}
function onEmptyFieldTap(event) {
  if(phase!=="playing" || event.target!==playfield) return;
  misses++; combo=0; comboValue.textContent="x1"; gameAnnouncement.textContent="Miss. Combo reset.";
  playfield.classList.remove("is-miss"); void playfield.offsetWidth; playfield.classList.add("is-miss");
}
function updateTimer() {
  const remaining=deadline-performance.now(); timerValue.textContent=formatTime(remaining);
  timerValue.setAttribute("aria-label",`${Math.max(0,Math.ceil(remaining/1000))} seconds remaining`);
  const nextWave=currentWave();
  if(nextWave!==wave) { wave=nextWave; showComboToast(`WAVE ${wave} · FASTER`); gameAnnouncement.textContent=`Wave ${wave}. Targets are getting faster.`; }
  const hudWave=document.querySelector("#neonWaveValue"); if(hudWave) hudWave.textContent=String(wave);
  if(remaining<=0) finishGame();
}
function clearRoundTimers() {
  if(timerInterval!==null){clearInterval(timerInterval);timerInterval=null;}
  if(targetTransitionTimeout!==null){clearTimeout(targetTransitionTimeout);targetTransitionTimeout=null;}
}
function ensureUpgradeHud() {
  if(!document.querySelector("#neonUpgradeHud")) {
    const hud=document.createElement("div"); hud.id="neonUpgradeHud"; hud.className="neon-upgrade-hud";
    hud.innerHTML='<span class="neon-upgrade-chip">WAVE <strong id="neonWaveValue">1</strong>/5</span><span class="neon-upgrade-chip">★ GOLD +250</span><span class="neon-upgrade-chip">Ⅱ +3 SEC</span><span class="neon-upgrade-chip">× AVOID DECOYS</span>';
    playfield.append(hud);
  }
  if(!shareButton && roundResults) {
    shareButton=document.createElement("button"); shareButton.type="button"; shareButton.className="neon-share-button";
    shareButton.textContent="Share my score"; shareButton.addEventListener("click",shareResult); roundResults.append(shareButton);
  }
}
async function shareResult() {
  const accuracy=hits+misses===0?0:Math.round(hits/(hits+misses)*100);
  const message=`I scored ${score} in Neon Target Rush on FunFroge Games! ${hits} hits · ${accuracy}% accuracy. Can you beat me? https://trend630-afk.github.io/funfroge/Neon%20Target%20Rush/`;
  try {
    if(navigator.share) await navigator.share({title:"My Neon Target Rush score",text:message});
    else if(navigator.clipboard?.writeText) { await navigator.clipboard.writeText(message); shareButton.textContent="Score copied!"; }
    else { shareButton.textContent="Sharing unavailable"; }
  } catch(error) { if(error.name!=="AbortError") shareButton.textContent="Could not share"; }
}
function startGame() {
  clearRoundTimers(); ensureUpgradeHud(); phase="playing"; score=0; hits=0; misses=0; decoysHit=0; combo=0; wave=1;
  deadline=performance.now()+ROUND_LENGTH_MS; comboToast.classList.remove("is-visible"); fxLayer.replaceChildren();
  newBestMessage.hidden=true; roundResults.hidden=true; gameOverlay.hidden=true; playfield.classList.remove("is-miss");
  playfield.classList.add("is-active"); fieldState.textContent="IN PLAY"; overlayKicker.textContent="30-SECOND ARCADE RUN";
  overlayTitle.textContent="Ready to rush?"; overlayCopy.textContent="Hit neon targets. Gold stars are worth 250. Purple targets slow time. Avoid red decoys!";
  startButtonLabel.textContent="Start game"; timerValue.textContent="00:30"; timerValue.setAttribute("aria-label","30 seconds remaining");
  updateScoreboard(); playSound("button"); placeTarget(); targetButton.focus({preventScroll:true});
  timerInterval=window.setInterval(updateTimer,TIMER_INTERVAL_MS);
}
function finishGame() {
  if(phase!=="playing") return; phase="over"; clearRoundTimers(); targetButton.hidden=true;
  playfield.classList.remove("is-active","is-miss"); fieldState.textContent="ROUND OVER"; timerValue.textContent="00:00"; timerValue.setAttribute("aria-label","0 seconds remaining");
  const accuracy=hits+misses===0?0:Math.round(hits/(hits+misses)*100), isNewBest=score>bestScore;
  if(isNewBest){bestScore=score;bestValue.textContent=String(bestScore);saveBestScore();}
  finalScore.textContent=String(score); finalHits.textContent=String(hits); finalAccuracy.textContent=`${accuracy}%`; finalBest.textContent=String(bestScore);
  roundResults.hidden=false; newBestMessage.hidden=!isNewBest; overlayKicker.textContent="ROUND COMPLETE"; overlayTitle.textContent="TIME'S UP!";
  overlayCopy.textContent=`${decoysHit} decoys hit · ${wave} waves reached. Ready to beat that score?`; startButtonLabel.textContent="Play again"; gameOverlay.hidden=false;
  gameAnnouncement.textContent=`Time's up. Final score ${score}. ${hits} hits. Accuracy ${accuracy} percent.${isNewBest?" New best score.":""}`;
  playSound("end"); startButton.focus({preventScroll:true});
}
function toggleSound() {
  soundEnabled=!soundEnabled; soundButton.setAttribute("aria-pressed",String(soundEnabled));
  soundButton.setAttribute("aria-label",soundEnabled?"Turn sound off":"Turn sound on"); soundLabel.textContent=soundEnabled?"Sound on":"Sound off";
  if(soundEnabled) playSound("button");
}
startButton.addEventListener("click",startGame);
targetButton.addEventListener("click",onTargetHit);
playfield.addEventListener("pointerdown",onEmptyFieldTap);
soundButton.addEventListener("click",toggleSound);
fxLayer.addEventListener("animationend",event=>{if(event.target.matches(".score-pop, .particle"))event.target.remove();});
function handlePlayfieldResize(){if(phase==="playing"&&targetTransitionTimeout===null)placeTarget();}
if("ResizeObserver" in window){const observer=new ResizeObserver(handlePlayfieldResize);observer.observe(playfield);}else window.addEventListener("resize",handlePlayfieldResize);
ensureUpgradeHud();
