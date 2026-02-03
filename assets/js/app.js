/**
 * Hangul Memory Trainer - Core Logic
 */

let focusMode = "all";
const MAX_SCORE = 5;
const UNLOCK_THRESHOLD = 3;

const hangulMap = {
    ㄱ: "g", ㄴ: "n", ㄷ: "d", ㄹ: "r", ㅁ: "m", ㅂ: "b", ㅅ: "s",
    ㅇ: "ng", ㅈ: "j", ㅊ: "ch", ㅋ: "k", ㅌ: "t", ㅍ: "p", ㅎ: "h",
    ㄲ: "kk", ㄸ: "tt", ㅃ: "pp", ㅆ: "ss", ㅉ: "jj",
    ㅏ: "a", ㅑ: "ya", ㅓ: "eo", ㅕ: "yeo", ㅗ: "o", ㅛ: "yo",
    ㅜ: "u", ㅠ: "yu", ㅡ: "eu", ㅣ: "i",
    ㅐ: "ae", ㅒ: "yae", ㅔ: "e", ㅖ: "ye", ㅘ: "wa", ㅙ: "wae",
    ㅚ: "oe", ㅝ: "wo", ㅞ: "we", ㅟ: "wi", ㅢ: "ui"
};

const allSyllables = Object.keys(hangulMap);
let memory = loadMemory();
let unlocked = getUnlocked();
let current = null;
let score = memory.session_score || 0;
let xp = memory.xp || 0;
let streak = 0;
let bestStreak = memory.best_streak || 0;
let hintTimeout;
let hintShown = false;

let history = [];
let upcomingQueue = [];

// DOM Elements
const syllableEl = document.getElementById("syllable");
const inputEl = document.getElementById("input");
const scoreEl = document.getElementById("score");
const unlockedEl = document.getElementById("unlocked");
const totalEl = document.getElementById("total");
const hintEl = document.getElementById("hint");
const levelEl = document.getElementById("level");
const xpBarEl = document.getElementById("xp-bar");
const streakEl = document.getElementById("current-streak");
const streakBadge = document.getElementById("streak-badge");
const streakCountEl = document.getElementById("streak-count");
const dailyStreakEl = document.getElementById("daily-streak");
const miniTileEl = document.getElementById("mini-tile");
const miniTileSylEl = document.getElementById("mini-tile-syllable");
const miniTileRomanEl = document.getElementById("mini-tile-roman");
const miniTileFillEl = document.getElementById("mini-tile-progress-fill");

// Initialize total count
if (totalEl) totalEl.innerText = allSyllables.length;

/**
 * Persistence Logic
 */
function loadMemory() {
    let saved = localStorage.getItem("hangul_memory_v2");
    if (saved) return JSON.parse(saved);

    // Attempt v1 migration
    let oldSaved = localStorage.getItem("hangul_memory");
    let m = {
        jamo: {},
        xp: 0,
        level: 1,
        best_streak: 0,
        session_score: 0,
        daily_streak: 0,
        last_date: null
    };

    if (oldSaved) {
        m.jamo = JSON.parse(oldSaved);
    } else {
        allSyllables.forEach((k) => (m.jamo[k] = 0));
    }
    return m;
}

function saveMemory() {
    memory.session_score = score;
    memory.xp = xp;
    memory.best_streak = Math.max(memory.best_streak || 0, bestStreak);
    localStorage.setItem("hangul_memory_v2", JSON.stringify(memory));
}

function checkDailyStreak() {
    const today = new Date().toDateString();
    if (!memory.last_date) {
        memory.daily_streak = 0;
    } else {
        const msPerDay = 24 * 60 * 60 * 1000;
        const dayDiff = Math.floor((new Date(today) - new Date(memory.last_date)) / msPerDay);

        if (dayDiff > 1) {
            memory.daily_streak = 0;
        }
    }
}

function getUnlocked() {
    const initialCount = 3;
    const masteredList = allSyllables.filter((k) => (memory.jamo[k] || 0) >= UNLOCK_THRESHOLD);
    const baseUnlockedCount = Math.max(initialCount, masteredList.length + initialCount);
    return allSyllables.slice(0, baseUnlockedCount);
}

/**
 * Game Logic
 */
function decomposeHangul(syllable) {
    const code = syllable.charCodeAt(0) - 0xAC00;
    if (code < 0 || code > 11171) return { initial: syllable, vowel: null };
    const initial = Math.floor(code / 588);
    const medial = Math.floor((code % 588) / 28);
    const initials = ["ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];
    const vowels = ["ㅏ", "ㅐ", "ㅑ", "ㅒ", "ㅓ", "ㅔ", "ㅕ", "ㅖ", "ㅗ", "ㅘ", "ㅙ", "ㅚ", "ㅛ", "ㅜ", "ㅝ", "ㅞ", "ㅟ", "ㅠ", "ㅡ", "ㅢ", "ㅣ"];
    return { initial: initials[initial], vowel: vowels[medial] };
}

function getNextSyllable() {
    let candidates = unlocked.filter((s) => {
        if ((memory.jamo[s] || 0) >= MAX_SCORE) return false;
        if (focusMode === "vowel") {
            const { vowel } = decomposeHangul(s);
            return ["ㅏ", "ㅗ", "ㅜ"].includes(vowel);
        } else if (focusMode === "consonant") {
            const { initial } = decomposeHangul(s);
            return ["ㄱ", "ㅁ", "ㅂ"].includes(initial);
        }
        return true;
    });
    if (candidates.length === 0) candidates = unlocked;
    return candidates[Math.floor(Math.random() * candidates.length)];
}

function getNextUpcoming() {
    if (upcomingQueue.length === 0) {
        // First initialization
        while (upcomingQueue.length < 3) {
            upcomingQueue.push(generateNextCandidate());
        }
    } else {
        upcomingQueue.push(generateNextCandidate());
    }
    return upcomingQueue.shift();
}

function generateNextCandidate() {
    let candidates = unlocked.filter((s) => (memory.jamo[s] || 0) < MAX_SCORE);
    if (candidates.length === 0) candidates = unlocked;

    // Avoid immediate repetition if possible
    let lastInQueue = upcomingQueue[upcomingQueue.length - 1];
    let filtered = candidates.filter(s => s !== lastInQueue && s !== current);
    let finalSource = filtered.length > 0 ? filtered : candidates;

    return finalSource[Math.floor(Math.random() * finalSource.length)];
}

function updatePreviewQueue() {
    const prev2 = document.getElementById("prev-2");
    const prev1 = document.getElementById("prev-1");
    const curr = document.getElementById("curr-preview");
    const next1 = document.getElementById("next-1");
    const next2 = document.getElementById("next-2");

    if (!curr) return; // Not on home page

    // Update Recent
    if (prev2) prev2.innerText = history[history.length - 2] || "";
    if (prev1) prev1.innerText = history[history.length - 1] || "";

    // Update Current
    if (curr) curr.innerText = current || "";

    // Update Upcoming
    if (next1) next1.innerText = upcomingQueue[0] || "";
    if (next2) next2.innerText = upcomingQueue[1] || "";
}

/**
 * Event Handlers
 */
window.onFocusChange = function () {
    focusMode = document.getElementById("focus-mode").value;
    current = getNextSyllable();
    updateUI();
};

window.resetProgress = function () {
    if (confirm("Are you sure you want to reset all progress?")) {
        localStorage.removeItem("hangul_memory_v2");
        localStorage.removeItem("hangul_memory");
        memory = loadMemory();
        unlocked = getUnlocked();
        score = 0;
        xp = 0;
        streak = 0;
        bestStreak = 0;
        current = getNextSyllable();
        updateUI();
        updateStreakUI();
    }
};

/**
 * UI Updates
 */
function showHint() {
    hintEl.innerText = `Hint: ${hangulMap[current]}`;
    hintEl.classList.add("visible");
    if (!hintShown) {
        memory.jamo[current] = Math.max(0, (memory.jamo[current] || 0) - 1);
        saveMemory();
        hintShown = true;
        playSound("hint-sound");
        streak = 0;
        updateStreakUI();
    }
}

function playSound(id) {
    const sound = document.getElementById(id);
    if (sound) {
        sound.currentTime = 0;
        sound.play().catch(() => { });
    }
}

function notify(type, text) {
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.innerText = text;
    const wrapper = document.querySelector(".input-wrapper");
    if (wrapper) {
        wrapper.appendChild(toast);
        setTimeout(() => toast.remove(), 1000);
    }
}

function celebrateMastery() {
    if (window.confetti) {
        confetti({
            particleCount: 150,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#800000', '#ffffff', '#a52a2a']
        });
    }
}

function celebrateLevelUp(lvl) {
    playSound("correct-sound");
    if (window.confetti) {
        confetti({
            particleCount: 200,
            spread: 90,
            origin: { y: 0.6 },
            colors: ['#800000', '#ffffff', '#a52a2a']
        });
    }
    notify("correct", `LEVEL UP! Level ${lvl}`);
}

function updateUI() {
    if (syllableEl) syllableEl.innerText = current;
    if (scoreEl) scoreEl.innerText = score;
    if (unlockedEl) unlockedEl.innerText = unlocked.length;
    if (hintEl) {
        hintEl.innerText = "";
        hintEl.classList.remove("visible");
    }
    clearTimeout(hintTimeout);
    hintShown = false;
    if (syllableEl) hintTimeout = setTimeout(showHint, 4000);
    renderProgress();
    updateGamificationUI();

    if (syllableEl) {
        syllableEl.classList.remove("syllable-pulse");
        void syllableEl.offsetWidth;
        syllableEl.classList.add("syllable-pulse");
    }
    updateMiniProgress();
}

function updateMiniProgress() {
    if (!miniTileEl || !current) return;

    const sylScore = memory.jamo[current] || 0;
    const percent = Math.min((sylScore / MAX_SCORE) * 100, 100);

    if (miniTileSylEl) miniTileSylEl.innerText = current;
    if (miniTileRomanEl) miniTileRomanEl.innerText = hangulMap[current];
    if (miniTileFillEl) {
        miniTileFillEl.style.width = `${percent}%`;
        // Change color if mastered
        if (sylScore >= MAX_SCORE) {
            miniTileFillEl.style.background = 'var(--primary)';
        } else {
            miniTileFillEl.style.background = 'var(--secondary)';
        }
    }

    // Animate mini tile on change
    miniTileEl.style.transform = 'scale(1.1)';
    setTimeout(() => {
        miniTileEl.style.transform = 'scale(1)';
    }, 200);
}

function updateGamificationUI() {
    const level = Math.floor(Math.sqrt(xp / 100)) + 1;
    const currentLevelXP = Math.pow(level - 1, 2) * 100;
    const nextLevelXP = Math.pow(level, 2) * 100;
    const progress = ((xp - currentLevelXP) / (nextLevelXP - currentLevelXP)) * 100;

    if (levelEl) levelEl.innerText = level;
    if (xpBarEl) xpBarEl.style.width = `${progress}%`;
    if (streakEl) streakEl.innerText = streak;
    if (dailyStreakEl) dailyStreakEl.innerText = memory.daily_streak || 0;

    if (level > (memory.level || 1)) {
        celebrateLevelUp(level);
        memory.level = level;
        saveMemory();
    }

    // Simplified Progress for Home Page
    updateMasterySummary();
}

function updateMasterySummary() {
    const masteryEl = document.getElementById("mastery-percent");
    const masteryBarEl = document.getElementById("mastery-bar-fill");
    if (!masteryEl && !masteryBarEl) return;

    const masteredCount = allSyllables.filter(s => (memory.jamo[s] || 0) >= MAX_SCORE).length;
    const percent = Math.floor((masteredCount / allSyllables.length) * 100);

    if (masteryEl) masteryEl.innerText = `${percent}% Mastery`;
    if (masteryBarEl) masteryBarEl.style.width = `${percent}%`;
}

function updateStreakUI() {
    if (streakEl) streakEl.innerText = streak;
    if (streakBadge) {
        if (streak >= 3) {
            streakBadge.classList.add("visible");
            if (streakCountEl) streakCountEl.innerText = streak;
        } else {
            streakBadge.classList.remove("visible");
        }
    }
}

function renderProgress() {
    const gridEl = document.getElementById("progress-grid");
    if (!gridEl) return;
    gridEl.innerHTML = "";
    allSyllables.forEach((syl) => {
        const sylScore = memory.jamo[syl] || 0;
        const percent = Math.min((sylScore / MAX_SCORE) * 100, 100);
        const isMastered = sylScore >= MAX_SCORE;
        const tile = document.createElement("div");
        tile.className = `tile ${isMastered ? 'tile-mastered' : ''}`;
        tile.innerHTML = `
      <div class="tile-syllable">${syl}</div>
      <div class="tile-roman">${hangulMap[syl]}</div>
      <div class="tile-progress" style="width: ${percent}%"></div>
    `;
        gridEl.appendChild(tile);
    });
}

/**
 * Input Handling
 */
if (inputEl) {
    inputEl.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            const roman = inputEl.value.trim().toLowerCase();
            if (roman === hangulMap[current]) {
                const prevScore = memory.jamo[current] || 0;
                score++;
                streak++;
                bestStreak = Math.max(bestStreak, streak);
                xp += 10 + (Math.floor(streak / 5) * 5);

                memory.jamo[current] = Math.min(MAX_SCORE, (memory.jamo[current] || 0) + 1);
                notify("correct", "Correct!");
                playSound("correct-sound");
                if (prevScore < MAX_SCORE && memory.jamo[current] === MAX_SCORE) {
                    celebrateMastery();
                }

                // Daily streak update
                const today = new Date().toDateString();
                if (memory.last_date !== today) {
                    if (memory.last_date) {
                        const msPerDay = 24 * 60 * 60 * 1000;
                        const dayDiff = Math.floor((new Date(today) - new Date(memory.last_date)) / msPerDay);
                        if (dayDiff === 1) memory.daily_streak++;
                        else memory.daily_streak = 1;
                    } else {
                        memory.daily_streak = 1;
                    }
                    memory.last_date = today;
                }

                updateStreakUI();
            } else {
                memory.jamo[current] = Math.max(0, (memory.jamo[current] || 0) - 1);
                notify("wrong", "Try again");
                playSound("wrong-sound");
                streak = 0;
                updateStreakUI();
                const appEl = document.getElementById("app");
                if (appEl) {
                    appEl.classList.remove("shake");
                    void appEl.offsetWidth;
                    appEl.classList.add("shake");
                }
            }
            saveMemory();
            unlocked = getUnlocked();

            // Move current to history
            if (current) {
                history.push(current);
                if (history.length > 5) history.shift();
            }

            current = getNextUpcoming();
            inputEl.value = "";
            updateUI();
            updatePreviewQueue();
        }
    });
}

// Start the game
// Initialize queue
while (upcomingQueue.length < 2) {
    upcomingQueue.push(generateNextCandidate());
}
current = generateNextCandidate();
checkDailyStreak();
updateUI();
updateStreakUI();
updateGamificationUI();
updatePreviewQueue();
