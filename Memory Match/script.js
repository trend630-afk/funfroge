// ==========================================
// MEMORY MATCH - COMPLETE GAME
// ==========================================

const gameBoard = document.getElementById("gameBoard");
const movesElement = document.getElementById("moves");
const matchesElement = document.getElementById("matches");
const timeElement = document.getElementById("time");
const restartBtn = document.getElementById("restartBtn");
const playAgainBtn = document.getElementById("playAgainBtn");
const message = document.getElementById("message");
const finalMoves = document.getElementById("finalMoves");
const finalTime = document.getElementById("finalTime");
const finalMatches = document.getElementById("finalMatches");
const bestScoreElement = document.getElementById("bestScore");
const scoreElement = document.getElementById("score");
const finalScore = document.getElementById("finalScore");
const finalRating = document.getElementById("finalRating");
const winMessage = document.getElementById("winMessage");
const newBest = document.getElementById("newBest");
const soundBtn = document.getElementById("soundBtn");
const difficultySelect = document.getElementById("difficulty");
const comboDisplay = document.getElementById("comboDisplay");
const boardStatus = document.getElementById("boardStatus");
const effectLayer = document.getElementById("effectLayer");
const achievementsGrid = document.getElementById("achievementsGrid");
const achievementToast = document.getElementById("achievementToast");
const resetDataBtn = document.getElementById("resetDataBtn");

const playerStatsKey = "memoryMatchPlayerStats";
const bestTimeKeys = {
    easy: "memoryMatchBestTimeEasy",
    normal: "memoryMatchBestTimeNormal",
    hard: "memoryMatchBestTimeHard"
};

const achievementDefinitions = [
    { id: "FirstWin", icon: "🏆", name: "First Win", description: "Complete your first game." },
    { id: "MemoryMaster", icon: "🧠", name: "Memory Master", description: "Complete a game with 5 stars." },
    { id: "SpeedDemon", icon: "⚡", name: "Speed Demon", description: "Complete a game in under 30 seconds." },
    { id: "PerfectMatch", icon: "🎯", name: "Perfect Match", description: "Complete a game with no incorrect pairs." },
    { id: "ComboPlayer", icon: "🔥", name: "Combo Player", description: "Get 3 correct matches consecutively." },
    { id: "HardHero", icon: "💎", name: "Hard Mode Hero", description: "Complete Hard difficulty." },
    { id: "UltimateMemory", icon: "👑", name: "Ultimate Memory", description: "Complete Hard difficulty with 5 stars." }
];

const difficultySettings = {
    easy: { pairs: 4, columns: 4, multiplier: 1 },
    normal: { pairs: 8, columns: 4, multiplier: 1.5 },
    hard: { pairs: 12, columns: 6, multiplier: 2 }
};

const ratingThresholds = {
    easy: [
        { moves: 1.5, seconds: 8 },
        { moves: 2.2, seconds: 15 },
        { moves: 3.5, seconds: 25 },
        { moves: 5, seconds: 40 }
    ],
    normal: [
        { moves: 1.35, seconds: 7 },
        { moves: 1.8, seconds: 12 },
        { moves: 2.8, seconds: 20 },
        { moves: 4.2, seconds: 35 }
    ],
    hard: [
        { moves: 1.25, seconds: 6 },
        { moves: 1.65, seconds: 10 },
        { moves: 2.4, seconds: 17 },
        { moves: 3.5, seconds: 30 }
    ]
};

const ratingMessages = {
    5: "Excellent memory!",
    4: "Great job!",
    3: "Nice work!",
    2: "Keep practicing!",
    1: "Keep practicing!"
};

const symbolPool = [
    "🚀", "💎", "👾", "🌟", "🎮", "🧠",
    "⚡", "🔥", "🌙", "🎯", "🪐", "🎲"
];

let firstCard = null;
let secondCard = null;
let lockBoard = false;
let moves = 0;
let matches = 0;
let seconds = 0;
let currentScore = 0;
let currentRating = 0;
let combo = 0;
let madeWrongMatch = false;
let gameCounted = false;
let timer = null;
let gameStarted = false;
let soundEnabled = true;
let audioContext = null;
let mismatchTimeoutId = null;
let winTimeoutId = null;
let comboTimeoutId = null;
let statusTimeoutId = null;
let effectTimeoutIds = [];
let currentDifficulty = difficultySelect ? difficultySelect.value : "normal";

// STORAGE
function getCurrentPairCount() {
    return difficultySettings[currentDifficulty].pairs;
}

function getCurrentBoardColumns() {
    return difficultySettings[currentDifficulty].columns;
}

function getBestScoreKey() {
    return `memoryMatchBest${currentDifficulty[0].toUpperCase()}${currentDifficulty.slice(1)}`;
}

function getBestScoreValue() {
    const savedBest = Number(localStorage.getItem(getBestScoreKey()));
    return Number.isFinite(savedBest) && savedBest > 0 ? savedBest : null;
}

function updateBestScoreDisplay() {
    if (!bestScoreElement) return;

    const bestScore = getBestScoreValue();
    bestScoreElement.textContent = bestScore === null ? "--" : String(bestScore);
}

// PLAYER STATISTICS
function getPlayerStats() {
    const defaults = {
        gamesPlayed: 0,
        gamesWon: 0,
        fiveStarWins: 0,
        highestScore: 0
    };

    try {
        const savedStats = JSON.parse(localStorage.getItem(playerStatsKey));
        if (!savedStats || typeof savedStats !== "object") return defaults;

        return Object.keys(defaults).reduce((stats, key) => {
            const value = Number(savedStats[key]);
            stats[key] = Number.isFinite(value) && value >= 0 ? value : defaults[key];
            return stats;
        }, defaults);
    } catch (error) {
        return defaults;
    }
}

function savePlayerStats(stats) {
    localStorage.setItem(playerStatsKey, JSON.stringify(stats));
}

function getStoredBestTime(difficulty) {
    const rawTime = localStorage.getItem(bestTimeKeys[difficulty]);
    if (rawTime === null) return null;

    const savedTime = Number(rawTime);
    return Number.isFinite(savedTime) && savedTime >= 0 ? savedTime : null;
}

function formatStoredTime(value) {
    return value === null ? "--" : formatTime(value);
}

function updatePlayerStatsDisplay() {
    const stats = getPlayerStats();
    const winRate = stats.gamesPlayed === 0 ? 0 : Math.round((stats.gamesWon / stats.gamesPlayed) * 100);
    const elements = {
        gamesPlayed: stats.gamesPlayed,
        gamesWon: stats.gamesWon,
        winRate: `${winRate}%`,
        highestScore: stats.highestScore,
        bestEasyMoves: getBestScoreValueFor("easy"),
        bestNormalMoves: getBestScoreValueFor("normal"),
        bestHardMoves: getBestScoreValueFor("hard"),
        bestEasyTime: formatStoredTime(getStoredBestTime("easy")),
        bestNormalTime: formatStoredTime(getStoredBestTime("normal")),
        bestHardTime: formatStoredTime(getStoredBestTime("hard")),
        fiveStarWins: stats.fiveStarWins
    };

    Object.entries(elements).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) element.textContent = String(value);
    });
}

function getBestScoreValueFor(difficulty) {
    const savedBest = Number(localStorage.getItem(`memoryMatchBest${difficulty[0].toUpperCase()}${difficulty.slice(1)}`));
    return Number.isFinite(savedBest) && savedBest > 0 ? savedBest : "--";
}

function recordGameStarted() {
    if (gameCounted) return;

    const stats = getPlayerStats();
    stats.gamesPlayed += 1;
    savePlayerStats(stats);
    gameCounted = true;
    updatePlayerStatsDisplay();
}

function recordCompletedGame() {
    const stats = getPlayerStats();
    stats.gamesWon += 1;
    if (currentRating === 5) stats.fiveStarWins += 1;
    if (currentScore > stats.highestScore) stats.highestScore = currentScore;
    savePlayerStats(stats);
    updatePlayerStatsDisplay();
}

// ACHIEVEMENTS
function isAchievementUnlocked(id) {
    return localStorage.getItem(`memoryMatchAchievement${id}`) === "true";
}

function renderAchievements() {
    if (!achievementsGrid) return;

    achievementsGrid.replaceChildren();
    achievementDefinitions.forEach((achievement) => {
        const unlocked = isAchievementUnlocked(achievement.id);
        const card = document.createElement("article");
        card.className = `achievement-card${unlocked ? " unlocked" : ""}`;
        card.innerHTML = `
            <div class="achievement-icon" aria-hidden="true">${unlocked ? achievement.icon : "🔒"}</div>
            <div class="achievement-copy">
                <h3>${achievement.name}</h3>
                <p>${achievement.description}</p>
                <strong>${unlocked ? "🏆 Unlocked" : "🔒 Locked"}</strong>
            </div>
        `;
        achievementsGrid.appendChild(card);
    });
}

function showAchievementNotification(achievement) {
    if (!achievementToast) return;

    achievementToast.textContent = `${achievement.icon} ${achievement.name} unlocked!`;
    achievementToast.classList.remove("show");
    window.requestAnimationFrame(() => achievementToast.classList.add("show"));
    window.setTimeout(() => achievementToast.classList.remove("show"), 3200);
}

function unlockAchievement(id) {
    if (isAchievementUnlocked(id)) return;

    const achievement = achievementDefinitions.find((item) => item.id === id);
    if (!achievement) return;

    localStorage.setItem(`memoryMatchAchievement${id}`, "true");
    renderAchievements();
    showAchievementNotification(achievement);
}

function unlockCompletionAchievements() {
    unlockAchievement("FirstWin");
    if (currentRating === 5) unlockAchievement("MemoryMaster");
    if (seconds < 30) unlockAchievement("SpeedDemon");
    if (!madeWrongMatch) unlockAchievement("PerfectMatch");
    if (currentDifficulty === "hard") unlockAchievement("HardHero");
    if (currentDifficulty === "hard" && currentRating === 5) unlockAchievement("UltimateMemory");
}

// BEST TIMES
function updateBestTime() {
    const savedTime = getStoredBestTime(currentDifficulty);
    if (savedTime === null || seconds < savedTime) {
        localStorage.setItem(bestTimeKeys[currentDifficulty], String(seconds));
    }
}

// COMBO SYSTEM
function updateComboDisplay() {
    if (!comboDisplay) return;

    if (combo < 2) {
        comboDisplay.classList.add("hidden");
        comboDisplay.classList.remove("show");
        if (comboTimeoutId) window.clearTimeout(comboTimeoutId);
        comboTimeoutId = null;
        return;
    }

    comboDisplay.textContent = combo === 2 ? "Nice! x2" : combo === 3 ? "🔥 COMBO x3!" : `🔥 x${combo}`;
    comboDisplay.classList.remove("hidden", "show");
    window.requestAnimationFrame(() => comboDisplay.classList.add("show"));
    if (comboTimeoutId) window.clearTimeout(comboTimeoutId);
    comboTimeoutId = window.setTimeout(() => {
        comboDisplay.classList.remove("show");
        comboTimeoutId = window.setTimeout(() => {
            comboDisplay.classList.add("hidden");
            comboTimeoutId = null;
        }, 220);
    }, 1500);
}

// SCORE SYSTEM
function calculateScore() {
    const settings = difficultySettings[currentDifficulty];
    const baseScore = settings.pairs * 1000;
    const movePenalty = moves * 20;
    const timePenalty = seconds * 5;
    const score = Math.round((baseScore - movePenalty - timePenalty) * settings.multiplier);

    return Number.isFinite(score) ? Math.max(0, score) : 0;
}

// PERFORMANCE RATING
function calculateRating() {
    const settings = difficultySettings[currentDifficulty];
    const movesPerPair = moves / settings.pairs;
    const secondsPerPair = seconds / settings.pairs;
    const thresholds = ratingThresholds[currentDifficulty];
    let rating = 1;

    for (let index = 0; index < thresholds.length; index += 1) {
        const threshold = thresholds[index];
        if (movesPerPair <= threshold.moves && secondsPerPair <= threshold.seconds) {
            rating = 5 - index;
            break;
        }
    }

    return Math.min(5, Math.max(1, rating));
}

function renderRating(rating) {
    if (!finalRating) return;

    finalRating.replaceChildren();
    for (let index = 1; index <= 5; index += 1) {
        const star = document.createElement("span");
        star.textContent = index <= rating ? "★" : "☆";
        star.style.animationDelay = `${(index - 1) * 220}ms`;
        if (rating === 5 && index === 5) star.classList.add("final-star");
        finalRating.appendChild(star);
    }
    finalRating.setAttribute("aria-label", `${rating} out of 5 stars`);
}

// ANIMATIONS
function animateScore(targetScore) {
    if (!finalScore) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
        finalScore.textContent = String(targetScore);
        return;
    }

    const duration = 700;
    const startTime = performance.now();
    const update = (now) => {
        const progress = Math.min(1, (now - startTime) / duration);
        finalScore.textContent = String(Math.round(targetScore * progress));
        if (progress < 1) window.requestAnimationFrame(update);
    };

    window.requestAnimationFrame(update);
}

// GAME LOGIC
function shuffle(array) {
    const shuffled = [...array];

    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    return shuffled;
}

function formatTime(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
    const remainingSeconds = (totalSeconds % 60).toString().padStart(2, "0");
    return `${minutes}:${remainingSeconds}`;
}

function startAudio() {
    if (!audioContext) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return false;
        audioContext = new AudioContext();
    }

    if (audioContext.state === "suspended") {
        audioContext.resume().catch(() => {});
    }

    return true;
}

function playSound(frequency, duration, type = "sine", volume = 0.08) {
    if (!soundEnabled) return;

    try {
        if (!startAudio()) return;
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();

        oscillator.type = type;
        oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);

        gain.gain.setValueAtTime(volume, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);

        oscillator.connect(gain);
        gain.connect(audioContext.destination);
        oscillator.start();
        oscillator.stop(audioContext.currentTime + duration);
    } catch (error) {
        console.warn("Sound error:", error);
    }
}

function flipSound() {
    playSound(500, 0.08, "sine", 0.06);
}

function matchSound() {
    playSound(523, 0.12, "sine", 0.08);
    setTimeout(() => playSound(659, 0.15, "sine", 0.08), 120);
}

function wrongSound() {
    playSound(180, 0.2, "square", 0.04);
}

function winSound() {
    playSound(523, 0.12, "sine", 0.08);
    setTimeout(() => playSound(659, 0.12, "sine", 0.08), 120);
    setTimeout(() => playSound(784, 0.12, "sine", 0.08), 240);
    setTimeout(() => playSound(1047, 0.35, "sine", 0.1), 360);
}

function updateDifficultyBoard() {
    if (!gameBoard) return;
    const columns = getCurrentBoardColumns();
    gameBoard.style.gridTemplateColumns = `repeat(${columns}, minmax(0, 1fr))`;
}

function createBoard() {
    if (!gameBoard) return;

    gameBoard.innerHTML = "";
    updateDifficultyBoard();

    const pairCount = getCurrentPairCount();
    const cards = shuffle(
        symbolPool
            .slice(0, pairCount)
            .flatMap((symbol) => [symbol, symbol])
    );

    cards.forEach((symbol, index) => {
        const card = document.createElement("div");
        card.className = "card";
        card.setAttribute("role", "button");
        card.setAttribute("tabindex", "0");
        card.setAttribute("aria-label", "Hidden memory card");
        card.setAttribute("aria-pressed", "false");
        card.dataset.symbol = symbol;
        card.dataset.index = index;
        card.innerHTML = `
            <div class="card-face card-front">?</div>
            <div class="card-face card-back">${symbol}</div>
        `;
        card.addEventListener("click", flipCard);
        card.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                flipCard.call(card);
            }
        });
        gameBoard.appendChild(card);
    });
}

function updateStats() {
    if (movesElement) {
        movesElement.textContent = String(moves);
    }

    if (matchesElement) {
        matchesElement.textContent = `${matches} / ${getCurrentPairCount()}`;
    }

    if (timeElement) {
        timeElement.textContent = formatTime(seconds);
    }
}

function startTimer() {
    if (timer !== null) return;
    const timerStat = timeElement ? timeElement.closest(".stat") : null;
    if (timerStat) timerStat.classList.add("timer-started");

    timer = window.setInterval(() => {
        seconds += 1;
        if (timeElement) {
            timeElement.textContent = formatTime(seconds);
            const currentTimerStat = timeElement.closest(".stat");
            if (currentTimerStat) currentTimerStat.classList.toggle("timer-warning", seconds >= 25 && seconds <= 30);
        }
    }, 1000);
}

function stopTimer() {
    if (timer) {
        window.clearInterval(timer);
        timer = null;
    }
    const timerStat = timeElement ? timeElement.closest(".stat") : null;
    if (timerStat) timerStat.classList.remove("timer-warning", "timer-started");
}

function setBoardStatus(text, temporary = false) {
    if (!boardStatus) return;
    if (statusTimeoutId) window.clearTimeout(statusTimeoutId);
    boardStatus.textContent = text;
    boardStatus.classList.toggle("status-pulse", text === "Match!");
    if (temporary) {
        statusTimeoutId = window.setTimeout(() => {
            if (boardStatus.textContent === text) boardStatus.textContent = "Find the matching pairs!";
            boardStatus.classList.remove("status-pulse");
            statusTimeoutId = null;
        }, 1100);
    }
}

function showMatchEffects(cardA, cardB) {
    if (!effectLayer) return;
    const layerRect = effectLayer.getBoundingClientRect();
    const firstRect = cardA.getBoundingClientRect();
    const secondRect = cardB.getBoundingClientRect();
    const popup = document.createElement("span");
    popup.className = "score-popup";
    popup.textContent = "+100";
    popup.style.left = `${((firstRect.left + firstRect.right + secondRect.left + secondRect.right) / 4) - layerRect.left}px`;
    popup.style.top = `${Math.min(firstRect.top, secondRect.top) - layerRect.top + 8}px`;
    effectLayer.appendChild(popup);
    const popupTimeoutId = window.setTimeout(() => {
        popup.remove();
        effectTimeoutIds = effectTimeoutIds.filter((id) => id !== popupTimeoutId);
    }, 1000);
    effectTimeoutIds.push(popupTimeoutId);
}

function celebrateWin() {
    if (!effectLayer || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const layerRect = effectLayer.getBoundingClientRect();
    const fragment = document.createDocumentFragment();
    for (let index = 0; index < 34; index += 1) {
        const particle = document.createElement("span");
        particle.className = "confetti-particle";
        particle.style.left = `${Math.random() * layerRect.width}px`;
        particle.style.setProperty("--drift", `${Math.round(Math.random() * 150 - 75)}px`);
        particle.style.setProperty("--delay", `${Math.random() * 0.35}s`);
        particle.style.setProperty("--hue", `${Math.round(Math.random() * 360)}`);
        fragment.appendChild(particle);
    }
    effectLayer.appendChild(fragment);
    const cleanupId = window.setTimeout(() => {
        effectLayer.querySelectorAll(".confetti-particle").forEach((particle) => particle.remove());
        effectTimeoutIds = effectTimeoutIds.filter((id) => id !== cleanupId);
    }, 2400);
    effectTimeoutIds.push(cleanupId);
}

function resetTurn() {
    firstCard = null;
    secondCard = null;
    lockBoard = false;
}

function flipCard() {
    if (lockBoard || this === firstCard || this.classList.contains("matched")) return;

    if (!gameStarted) {
        gameStarted = true;
        recordGameStarted();
        startTimer();
    }

    this.classList.add("flipped");
    this.setAttribute("aria-label", `Card ${this.dataset.symbol}`);
    this.setAttribute("aria-pressed", "true");
    flipSound();

    if (!firstCard) {
        firstCard = this;
        setBoardStatus("Find its match!");
        return;
    }

    secondCard = this;
    moves += 1;
    updateStats();
    checkMatch();
}

function checkMatch() {
    const isMatch = firstCard.dataset.symbol === secondCard.dataset.symbol;

    if (isMatch) {
        combo += 1;
        updateComboDisplay();
        setBoardStatus("Match!", true);
        showMatchEffects(firstCard, secondCard);
        if (combo >= 3) unlockAchievement("ComboPlayer");
        matchSound();
        disableMatchedCards();
    } else {
        madeWrongMatch = true;
        combo = 0;
        updateComboDisplay();
        setBoardStatus("Try again!", true);
        firstCard.classList.add("mismatch");
        secondCard.classList.add("mismatch");
        wrongSound();
        unflipCards();
    }
}

function disableMatchedCards() {
    firstCard.classList.add("matched");
    secondCard.classList.add("matched");
    firstCard.setAttribute("aria-label", `Matched ${firstCard.dataset.symbol}`);
    secondCard.setAttribute("aria-label", `Matched ${secondCard.dataset.symbol}`);
    matches += 1;
    updateStats();
    resetTurn();

    if (matches === getCurrentPairCount()) {
        endGame();
    }
}

function unflipCards() {
    lockBoard = true;

    mismatchTimeoutId = window.setTimeout(() => {
        firstCard.classList.remove("flipped");
        secondCard.classList.remove("flipped");
        firstCard.classList.remove("mismatch");
        secondCard.classList.remove("mismatch");
        firstCard.setAttribute("aria-label", "Hidden memory card");
        secondCard.setAttribute("aria-label", "Hidden memory card");
        firstCard.setAttribute("aria-pressed", "false");
        secondCard.setAttribute("aria-pressed", "false");
        mismatchTimeoutId = null;
        resetTurn();
    }, 850);
}

// WIN LOGIC
function endGame() {
    stopTimer();
    winSound();
    celebrateWin();
    if (comboDisplay) comboDisplay.classList.add("hidden");

    currentScore = calculateScore();
    currentRating = calculateRating();
    const savedBest = getBestScoreValue();
    const isNewBest = savedBest === null || moves < savedBest;

    if (scoreElement) scoreElement.textContent = String(currentScore);
    if (finalScore) finalScore.textContent = "0";
    animateScore(currentScore);
    renderRating(currentRating);
    if (winMessage) winMessage.textContent = ratingMessages[currentRating];
    if (newBest) newBest.classList.toggle("hidden", !isNewBest);

    if (finalMoves) {
        finalMoves.textContent = String(moves);
    }

    if (finalTime) {
        finalTime.textContent = timeElement ? timeElement.textContent : "00:00";
    }

    if (finalMatches) {
        finalMatches.textContent = `${matches}/${getCurrentPairCount()}`;
    }

    if (isNewBest) {
        localStorage.setItem(getBestScoreKey(), String(moves));
    }

    updateBestTime();
    recordCompletedGame();
    unlockCompletionAchievements();

    updateBestScoreDisplay();

    winTimeoutId = window.setTimeout(() => {
        if (message) {
            message.classList.remove("hidden");
        }
        if (newBest && !newBest.classList.contains("hidden")) newBest.classList.add("celebrate");
        winTimeoutId = null;
    }, 500);
}

function resetGame() {
    stopTimer();
    if (mismatchTimeoutId) {
        window.clearTimeout(mismatchTimeoutId);
        mismatchTimeoutId = null;
    }
    if (winTimeoutId) {
        window.clearTimeout(winTimeoutId);
        winTimeoutId = null;
    }
    if (comboTimeoutId) {
        window.clearTimeout(comboTimeoutId);
        comboTimeoutId = null;
    }
    if (statusTimeoutId) {
        window.clearTimeout(statusTimeoutId);
        statusTimeoutId = null;
    }
    effectTimeoutIds.forEach((timeoutId) => window.clearTimeout(timeoutId));
    effectTimeoutIds = [];
    if (effectLayer) effectLayer.replaceChildren();

    firstCard = null;
    secondCard = null;
    lockBoard = false;
    moves = 0;
    matches = 0;
    seconds = 0;
    currentScore = 0;
    currentRating = 0;
    combo = 0;
    madeWrongMatch = false;
    gameCounted = false;
    gameStarted = false;

    if (message) {
        message.classList.add("hidden");
    }

    if (finalMoves) {
        finalMoves.textContent = "0";
    }

    if (finalTime) {
        finalTime.textContent = "00:00";
    }

    if (finalMatches) {
        finalMatches.textContent = `0/${getCurrentPairCount()}`;
    }

    if (scoreElement) scoreElement.textContent = "--";
    if (finalScore) finalScore.textContent = "0";
    if (finalRating) {
        finalRating.replaceChildren();
        finalRating.setAttribute("aria-label", "No rating yet");
    }
    if (winMessage) winMessage.textContent = "Amazing! You found every pair.";
    if (newBest) {
        newBest.classList.add("hidden");
        newBest.classList.remove("celebrate");
    }
    setBoardStatus("Find the matching pairs!");
    updateComboDisplay();

    updateBestScoreDisplay();
    updateStats();
    createBoard();
}

if (soundBtn) {
    soundBtn.addEventListener("click", () => {
        startAudio();
        soundEnabled = !soundEnabled;
        soundBtn.textContent = soundEnabled ? "🔊 Sound" : "🔇 Sound Off";
        soundBtn.setAttribute("aria-pressed", String(soundEnabled));

        if (soundEnabled) {
            playSound(700, 0.15, "sine", 0.08);
        }
    });
}

if (restartBtn) {
    restartBtn.addEventListener("click", resetGame);
}

if (playAgainBtn) {
    playAgainBtn.addEventListener("click", resetGame);
}

if (difficultySelect) {
    difficultySelect.addEventListener("change", (event) => {
        currentDifficulty = event.target.value;
        resetGame();
    });
}

// RESET DATA
if (resetDataBtn) {
    resetDataBtn.addEventListener("click", () => {
        const shouldReset = window.confirm("Reset all Memory Match statistics, achievements, Best Moves, and Best Times?");
        if (!shouldReset) return;

        localStorage.removeItem(playerStatsKey);
        Object.values(bestTimeKeys).forEach((key) => localStorage.removeItem(key));
        ["easy", "normal", "hard"].forEach((difficulty) => {
            localStorage.removeItem(`memoryMatchBest${difficulty[0].toUpperCase()}${difficulty.slice(1)}`);
        });
        achievementDefinitions.forEach((achievement) => {
            localStorage.removeItem(`memoryMatchAchievement${achievement.id}`);
        });

        if (achievementToast) {
            achievementToast.classList.remove("show");
            achievementToast.textContent = "";
        }
        renderAchievements();
        updatePlayerStatsDisplay();
        resetGame();
    });
}

renderAchievements();
updatePlayerStatsDisplay();
updateBestScoreDisplay();
resetGame();
