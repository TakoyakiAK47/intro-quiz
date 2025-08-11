// --- Global Variables ---
let player;
let correctAnswer = '';
let currentVideoId = '';
let score = 0;
let totalQuestions = 0;
let answeredVideos = [];
let mode = 'menu'; // 'normal', 'timed', 'endless', 'menu'
let endlessStreak = 0;
let gameTimer = null;
let timeLeftMs = 0;
let gameData = {};
let currentPlaylist = [];
let answerChecked = false;

// --- Constants ---
const NEXT_QUESTION_DELAY = 1200;
const GAME_OVER_DELAY = 2000;

const defaultGameData = {
    settings: {
        normalQuestions: 10,
        timedDuration: 60000,
        composerFilter: 'All',
    },
    stats: {
        highScores: { normal: 0, timed: 0, endless: 0 },
        songStats: {},
    },
    achievements: {
        normal: false, hard: false, veryhard: false, hardcore: false,
        extreme: false, insane: false, torment: false, lunatic: false
    },
};

// --- Data Management ---
function saveGameData() {
    try {
        localStorage.setItem('blueArchiveQuizDataV2', JSON.stringify(gameData));
    } catch (e) {
        console.error("Failed to save game data:", e);
    }
}

function loadGameData() {
    try {
        const savedData = localStorage.getItem('blueArchiveQuizDataV2');
        gameData = savedData ? JSON.parse(savedData) : JSON.parse(JSON.stringify(defaultGameData));
        gameData.settings = { ...defaultGameData.settings, ...(gameData.settings || {}) };
        gameData.stats = { ...defaultGameData.stats, ...(gameData.stats || {}) };
        gameData.achievements = { ...defaultGameData.achievements, ...(gameData.achievements || {}) };
    } catch (e) {
        console.error("Failed to load game data:", e);
        gameData = JSON.parse(JSON.stringify(defaultGameData));
    }
}

// --- YouTube IFrame API ---
function onYouTubeIframeAPIReady() {
    document.getElementById('loading-overlay').style.display = 'none';
    player = new YT.Player('player', {
        height: '0', width: '0', videoId: '',
        playerVars: { 'playsinline': 1 },
        events: {
            'onReady': () => {
                player.setVolume(document.getElementById('volumeSlider').value);
                initGame();
            },
            'onStateChange': onPlayerStateChange
        }
    });
}

function onPlayerStateChange(event) {
    if (event.data === YT.PlayerState.CUED && ['normal', 'timed', 'endless'].includes(mode)) {
        player.playVideo();
    }
}

// --- Screen Management ---
/**
 * Manages the visibility of different screens/views.
 * @param {string} screenId The ID of the screen to show ('main-menu', 'game-view', 'settings-screen', etc.)
 */
function showScreen(screenId) {
    document.getElementById('main-menu').style.display = 'none';
    document.getElementById('game-view').style.display = 'none';
    document.querySelectorAll('.screen').forEach(el => el.style.display = 'none');

    const target = document.getElementById(screenId);
    if (target) {
        target.style.display = (screenId === 'game-view' || screenId === 'main-menu') ? 'flex' : 'block';
    }
}

// --- Game Flow & State ---
function initGame() {
    mode = 'menu';
    if (gameTimer) clearInterval(gameTimer);
    if (player && typeof player.stopVideo === 'function') player.stopVideo();
    
    showScreen('main-menu');
    
    const container = document.getElementById('main-menu');
    container.innerHTML = '';

    const modes = [
        { id: 'normal', label: 'ノーマルモード', action: () => selectMode('normal') },
        { id: 'timed', label: 'タイムアタックモード', action: () => selectMode('timed') },
        { id: 'endless', label: 'エンドレスモード', action: () => selectMode('endless') },
        { id: 'encyclopedia', label: 'ブルアカBGM図鑑', action: showEncyclopedia },
        { id: 'stats', label: '実績・統計', action: showStatsScreen }
    ];

    modes.forEach(({ id, label, action }) => {
        const btn = document.createElement('button');
        btn.textContent = label;
        btn.onclick = action;
        btn.className = `mode-${id}`;
        container.appendChild(btn);
    });
}

function selectMode(selectedMode) {
    mode = selectedMode;
    if (mode === 'normal' || mode === 'timed') {
        showScreen('settings-screen');
        setupModeSettings();
    } else {
        const prompt = document.getElementById('start-prompt');
        prompt.style.display = 'flex';
        document.getElementById('start-prompt-btn').onclick = () => {
            prompt.style.display = 'none';
            if (player && player.getPlayerState() !== 1) {
                 player.mute();
                 player.playVideo();
                 player.pauseVideo();
                 player.unMute();
            }
            launchQuiz();
        };
    }
}

function setupModeSettings() {
    const container = document.getElementById('settings-screen');
    let settingsContent = '';
    
    if (mode === 'normal') {
        const composers = ['All', ...new Set(playlist.map(s => s.composer).filter(Boolean))];
        const options = composers.map(c => `<option value="${c}" ${gameData.settings.composerFilter === c ? 'selected' : ''}>${c}</option>`).join('');
        settingsContent = `<h2>ノーマルモード設定</h2>
            <div class="setting-item"><label for="normal-questions">問題数:</label><input type="number" id="normal-questions" min="1" max="50" value="${gameData.settings.normalQuestions}"></div>
            <div class="setting-item"><label for="composer-filter">作者で絞り込む:</label><select id="composer-filter">${options}</select></div>`;
    } else if (mode === 'timed') {
        settingsContent = `<h2>タイムアタックモード設定</h2>
            <div class="setting-item"><label for="timed-duration">制限時間(秒):</label><input type="number" id="timed-duration" min="10" max="180" step="10" value="${gameData.settings.timedDuration / 1000}"></div>`;
    }

    container.innerHTML = `${settingsContent}
        <button id="start-game-btn">ゲーム開始</button>
        <button id="settings-back-btn">戻る</button>`;
    
    document.getElementById('start-game-btn').onclick = () => {
        if (mode === 'normal') {
            gameData.settings.normalQuestions = parseInt(document.getElementById('normal-questions').value, 10);
            gameData.settings.composerFilter = document.getElementById('composer-filter').value;
        } else if (mode === 'timed') {
            gameData.settings.timedDuration = parseInt(document.getElementById('timed-duration').value, 10) * 1000;
        }
        saveGameData();
        launchQuiz();
    };
    document.getElementById('settings-back-btn').onclick = initGame;
}

function launchQuiz() {
    score = 0;
    totalQuestions = 0;
    answeredVideos = [];
    endlessStreak = 0;
    answerChecked = false;
    
    const filter = gameData.settings.composerFilter;
    currentPlaylist = (mode === 'normal' && filter !== 'All') 
        ? playlist.filter(song => song.composer === filter) 
        : [...playlist];
    
    if (currentPlaylist.length < 4) {
        alert('選択した作者の曲が4曲未満のため、クイズを開始できません。');
        initGame();
        return;
    }
    
    showScreen('game-view');
    document.getElementById('game-controls-container').style.display = 'block';

    if (mode === 'timed') {
        timeLeftMs = gameData.settings.timedDuration;
        if (gameTimer) clearInterval(gameTimer);
        gameTimer = setInterval(() => {
            timeLeftMs -= 10;
            if (timeLeftMs <= 0) {
                timeLeftMs = 0;
                endGame();
            }
            updateTimeDisplay(timeLeftMs);
        }, 10);
    }
    
    loadNextQuiz();
}

function loadNextQuiz() {
    // Check for game over conditions before loading a new question
    if ((mode === 'timed' && timeLeftMs <= 0) || (mode === 'normal' && totalQuestions >= gameData.settings.normalQuestions)) {
        endGame();
        return;
    }

    answerChecked = false;
    document.getElementById('result').innerText = '';
    updateUIState();
    
    // Improve song selection logic: only repeat songs after the entire playlist has been used.
    let available = currentPlaylist.filter(p => !answeredVideos.includes(p.videoId));
    if (available.length === 0) {
        answeredVideos = [];
        available = currentPlaylist;
    }

    const random = available[Math.floor(Math.random() * available.length)];
    correctAnswer = random.title;
    currentVideoId = random.videoId;
    answeredVideos.push(currentVideoId);
    
    displayChoices(generateChoices(correctAnswer));
    playIntroClip();
}

function generateChoices(correct) {
    const choices = new Set([correct]);
    const distractors = currentPlaylist.filter(p => p.title !== correct).map(p => p.title);
    
    while (choices.size < 4 && distractors.length > 0) {
        const randomIndex = Math.floor(Math.random() * distractors.length);
        choices.add(distractors.splice(randomIndex, 1)[0]);
    }
    return Array.from(choices).sort(() => 0.5 - Math.random());
}

function displayChoices(choices) {
    const container = document.getElementById('choices');
    container.innerHTML = '';
    choices.forEach(choice => {
        const btn = document.createElement('button');
        btn.innerHTML = `<span>${choice}</span>`;
        btn.onclick = () => checkAnswer(choice);
        container.appendChild(btn);
    });
}

function playIntroClip() {
    if (!player || !player.loadVideoById) return;
    player.cueVideoById({ videoId: currentVideoId, startSeconds: 0 });
}

function checkAnswer(choice) {
    if (answerChecked) return;
    answerChecked = true;
    player.stopVideo();
    
    const isCorrect = (choice === correctAnswer);
    if (isCorrect) {
        score++;
        document.getElementById('result').innerText = '✅ 正解！';
        if (mode === 'endless') {
            endlessStreak++;
            updateEndlessAchievements();
        }
    } else {
        document.getElementById('result').innerText = `❌ 不正解...`;
        if (mode === 'endless') endlessStreak = 0;
    }
    
    totalQuestions++;
    updateSongStats(currentVideoId, isCorrect);
    updateUIState();
    saveGameData();
    
    document.querySelectorAll('#choices button').forEach(b => {
        b.disabled = true;
        if (b.textContent === correctAnswer) b.classList.add('correct');
        else if (b.textContent === choice) b.classList.add('incorrect');
    });

    // Special handling to show 100% progress bar on the final question
    if (mode === 'normal' && totalQuestions === gameData.settings.normalQuestions) {
        document.getElementById('progress-bar-fill').style.width = '100%';
    }
    
    const isGameOver = (mode === 'normal' && totalQuestions >= gameData.settings.normalQuestions) || 
                       (mode === 'timed' && !isCorrect);
    
    setTimeout(() => {
        if (isGameOver) {
            endGame();
        } else if (mode !== 'timed' || isCorrect) {
            loadNextQuiz();
        }
    }, isGameOver ? GAME_OVER_DELAY : NEXT_QUESTION_DELAY);
}

// --- End Game & Stats ---
function endGame() {
    if (gameTimer) clearInterval(gameTimer);
    gameTimer = null;
    answerChecked = true;
    
    // Hide unnecessary UI elements for the end screen
    document.getElementById('progress-container').style.display = 'none';
    document.getElementById('time-display').style.display = 'none';
    document.getElementById('game-controls-container').style.display = 'none';

    let resultMessage = '';
    if (mode === 'timed') {
        if (score > (gameData.stats.highScores.timed || 0)) gameData.stats.highScores.timed = score;
        resultMessage = `🎉 タイムアップ！ スコア: ${score}問`;
    } else if (mode === 'normal') {
        const accuracy = totalQuestions > 0 ? ((score / totalQuestions) * 100).toFixed(1) : 0;
        if (score > (gameData.stats.highScores.normal || 0)) gameData.stats.highScores.normal = score;
        resultMessage = `🎉 終了！ スコア: ${score}/${totalQuestions} (正答率: ${accuracy}%)`;
    }
    saveGameData();

    document.getElementById('result').innerText = resultMessage;

    const container = document.getElementById('choices');
    container.innerHTML = ''; 
    
    const againBtn = document.createElement('button');
    againBtn.textContent = 'もう一度あそぶ';
    againBtn.onclick = () => selectMode(mode);
    
    const homeBtn = document.createElement('button');
    homeBtn.textContent = 'ホームに戻る';
    homeBtn.onclick = initGame;

    container.appendChild(againBtn);
    container.appendChild(homeBtn);
}

function showStatsScreen() {
    showScreen('stats-screen');
    const container = document.getElementById('stats-screen');
    const unlockedCount = Object.values(gameData.achievements).filter(Boolean).length;
    const achievementTiers = [
        { key: 'normal',   label: 'NORMAL',   desc: 'エンドレスモードで10問連続正解' },
        { key: 'hard',     label: 'HARD',     desc: 'エンドレスモードで20問連続正解' },
        { key: 'veryhard', label: 'VERYHARD', desc: 'エンドレスモードで50問連続正解' },
        { key: 'hardcore', label: 'HARDCORE', desc: 'エンドレスモードで100問連続正解' },
        { key: 'extreme',  label: 'EXTREME',  desc: 'エンドレスモードで150問連続正解' },
        { key: 'insane',   label: 'INSANE',   desc: 'エンドレスモードで250問連続正解' },
        { key: 'torment',  label: 'TORMENT',  desc: 'エンドレスモードで500問連続正解' },
        { key: 'lunatic',  label: 'LUNATIC',  desc: 'エンドレスモードで1000問連続正解' }
    ];
    
    const achievementsHTML = `
        <div class="achievements-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1em;">
            ${achievementTiers.map(tier => `
                <div class="achievement ${gameData.achievements[tier.key] ? 'unlocked' : ''}" style="padding: 1em; border: 1px solid var(--border-color); border-radius: 8px; background: ${gameData.achievements[tier.key] ? 'var(--blue-secondary)' : '#f9f9f9'}; color: ${gameData.achievements[tier.key] ? 'white' : 'inherit'}; transition: all 0.3s ease;">
                    <div class="ach-title" style="font-weight: bold;">${tier.label}</div>
                    <div class="ach-desc" style="font-size: 0.9em; margin-top: 0.5em;">${tier.desc}</div>
                </div>
            `).join('')}
        </div>
    `;

    container.innerHTML = `
        <h2>実績 & 統計</h2>
        <div class="stats-container">
            <h3>ハイスコア</h3>
            <div class="stat-item">ノーマルモード: <strong>${gameData.stats.highScores.normal || 0}</strong> 問</div>
            <div class="stat-item">タイムアタックモード: <strong>${gameData.stats.highScores.timed || 0}</strong> 問</div>
            <div class="stat-item">エンドレスモード: <strong>${gameData.stats.highScores.endless || 0}</strong> 連続正解</div>
            <h3 style="margin-top: 2em;">実績 (${unlockedCount} / ${achievementTiers.length})</h3>
            ${achievementsHTML}
        </div>
        <button id="stats-back-btn">ホームに戻る</button>
        <button id="reset-data-btn" style="background-color: var(--red-primary); color:white;">データリセット</button>
    `;

    document.getElementById('stats-back-btn').onclick = initGame;
    document.getElementById('reset-data-btn').onclick = () => {
        if (confirm('すべての実績とハイスコアをリセットします。よろしいですか？')) {
            gameData = JSON.parse(JSON.stringify(defaultGameData));
            saveGameData();
            showStatsScreen();
        }
    };
}

// --- UI Helpers ---
function updateUIState() {
    updateScore();
    updateProgressIndicator();
    updateTimeDisplay(mode === 'timed' ? timeLeftMs : null);
}

function updateScore() {
    const scoreEl = document.getElementById('score');
    let scoreText = '';
    if (mode === 'normal' || mode === 'timed') {
        scoreText = `Score: ${score}`;
    } else if (mode === 'endless') {
        scoreText = `High Score: ${gameData.stats.highScores.endless || 0}`;
    }
    scoreEl.innerText = scoreText;
}

function updateProgressIndicator() {
    const container = document.getElementById('progress-container');
    const textEl = document.getElementById('progress-text');
    const barFillEl = document.getElementById('progress-bar-fill');
    const barWrapper = document.querySelector('.progress-bar-wrapper');

    container.style.display = 'none'; // Default to hidden
    
    if (mode === 'normal') {
        const maxQ = gameData.settings.normalQuestions;
        textEl.textContent = `Question ${totalQuestions + 1} / ${maxQ}`;
        barFillEl.style.width = `${(totalQuestions / maxQ) * 100}%`;
        container.style.display = 'block';
        barWrapper.style.display = 'block';
    } else if (mode === 'endless') {
        textEl.textContent = `Current Streak: ${endlessStreak}`;
        container.style.display = 'block';
        barWrapper.style.display = 'none';
    }
}

function updateTimeDisplay(ms) {
    const timeEl = document.getElementById('time-display');
    if (ms != null && mode === 'timed') {
        timeEl.style.display = 'block';
        timeEl.innerText = `残り時間: ${(ms / 1000).toFixed(2)} 秒`;
    } else {
        timeEl.style.display = 'none';
    }
}

function updateSongStats(videoId, isCorrect) {
    if (!gameData.stats.songStats[videoId]) {
        gameData.stats.songStats[videoId] = { correct: 0, incorrect: 0 };
    }
    isCorrect ? gameData.stats.songStats[videoId].correct++ : gameData.stats.songStats[videoId].incorrect++;
}

function updateEndlessAchievements() {
    if (endlessStreak > (gameData.stats.highScores.endless || 0)) {
        gameData.stats.highScores.endless = endlessStreak;
    }
    if (endlessStreak >= 10)   gameData.achievements.normal = true;
    if (endlessStreak >= 20)   gameData.achievements.hard = true;
    if (endlessStreak >= 50)   gameData.achievements.veryhard = true;
    if (endlessStreak >= 100)  gameData.achievements.hardcore = true;
    if (endlessStreak >= 150)  gameData.achievements.extreme = true;
    if (endlessStreak >= 250)  gameData.achievements.insane = true;
    if (endlessStreak >= 500)  gameData.achievements.torment = true;
    if (endlessStreak >= 1000) gameData.achievements.lunatic = true;
}

function showEncyclopedia() {
    showScreen('encyclopedia');
    const container = document.getElementById('encyclopedia');
    container.innerHTML = `
        <h2>ブルアカBGM図鑑 (全${playlist.length}曲)</h2>
        <div id="now-playing-container">曲名をクリックすると再生されます。</div>
        <input type="text" id="encyclopedia-search" placeholder="曲名や作者名で検索..." onkeyup="filterSongs()">
        <div id="song-list"></div>
        <button id="enc-back-btn" style="margin-top: 1em;" onclick="initGame()">ホームに戻る</button>
    `;

    const songListContainer = document.getElementById('song-list');
    playlist.forEach(song => {
        const songButton = document.createElement('button');
        songButton.className = 'song-item';
        songButton.innerHTML = `${song.title} <br><small style="color: #555;">${song.composer || 'N/A'}</small>`;
        songButton.onclick = () => {
            player.stopVideo();
            player.loadVideoById(song.videoId);
            document.getElementById('now-playing-container').innerHTML = `<strong>再生中:</strong> ${song.title}`;
            document.querySelectorAll('.song-item.playing').forEach(b => b.classList.remove('playing'));
            songButton.classList.add('playing');
        };
        songListContainer.appendChild(songButton);
    });
}

function filterSongs() {
    const filterText = document.getElementById('encyclopedia-search').value.toLowerCase();
    document.querySelectorAll('#song-list .song-item').forEach(song => {
        song.style.display = song.textContent.toLowerCase().includes(filterText) ? 'block' : 'none';
    });
}

// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('loading-overlay').style.display = 'flex';
    loadGameData();

    document.getElementById('replayBtn').onclick = () => {
        if (player && player.seekTo && !answerChecked) {
            player.seekTo(0);
            player.playVideo();
        }
    };

    document.getElementById('pauseBtn').onclick = () => {
        if (!player || typeof player.getPlayerState !== 'function') return;
        const state = player.getPlayerState();
        (state === YT.PlayerState.PLAYING) ? player.pauseVideo() : player.playVideo();
    };

    document.getElementById('volumeSlider').addEventListener('input', (e) => {
        if (player && player.setVolume) player.setVolume(parseInt(e.target.value, 10));
    });
});