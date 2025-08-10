// main.js - v5 with new achievements and UI changes
let player;
let correctAnswer = '';
let currentVideoId = '';
let score = 0;
let totalQuestions = 0;
let answeredVideos = [];
let mode = 'normal'; // 'normal', 'timed', 'encyclopedia', 'endless'
let endlessStreak = 0;

// --- Timed mode timer ---
let gameTimer = null;
let timeLeftMs = 0;

// ★ --- Game Data (Stats, Achievements, Settings) ---
let gameData = {};

const defaultGameData = {
    settings: {
        normalQuestions: 10,
        timedDuration: 60000,
    },
    stats: {
        highScores: {
            normal: 0,
            timed: 0,
            endless: 0,
        },
        songStats: {}, // { videoId: { correct: 0, incorrect: 0 } }
    },
    achievements: {
        normal: false,      // 10
        hard: false,        // 20
        veryhard: false,    // 50
        hardcore: false,    // 100
        extreme: false,     // 150
        insane: false,      // 250
        torment: false,     // 500
        lunatic: false      // 1000
    },
};

function saveGameData() {
    try {
        localStorage.setItem('blueArchiveQuizData', JSON.stringify(gameData));
    } catch (e) {
        console.error("Failed to save game data:", e);
    }
}

function loadGameData() {
    try {
        const savedData = localStorage.getItem('blueArchiveQuizData');
        if (savedData) {
            gameData = JSON.parse(savedData);
            // Ensure data structure is up-to-date with defaults
            gameData.settings = { ...defaultGameData.settings, ...gameData.settings };
            gameData.stats = { ...defaultGameData.stats, ...gameData.stats };
            // Add new achievement keys if they don't exist
            gameData.achievements = { ...defaultGameData.achievements, ...gameData.achievements };
        } else {
            gameData = JSON.parse(JSON.stringify(defaultGameData)); // Deep copy
        }
    } catch (e) {
        console.error("Failed to load game data:", e);
        gameData = JSON.parse(JSON.stringify(defaultGameData)); // Deep copy
    }
}

function resetGameData() {
    if (confirm('すべての実績とハイスコアをリセットします。よろしいですか？')) {
        gameData = JSON.parse(JSON.stringify(defaultGameData));
        saveGameData();
        showStatsScreen(); // Refresh screen
    }
}

// --- YouTube IFrame API ---
function onYouTubeIframeAPIReady() {
    player = new YT.Player('player', {
        height: '0',
        width: '0',
        videoId: '',
        playerVars: { 'playsinline': 1 },
        events: {
            'onReady': () => {
                player.setVolume(20);
                document.getElementById('volumeSlider').value = 20;
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
function showScreen(screenId) {
    ['main-menu', 'choices', 'control-buttons', 'encyclopedia', 'settings-screen', 'stats-screen', 'start-prompt'].forEach(id => {
        document.getElementById(id).style.display = 'none';
    });
    if (screenId) {
        const el = document.getElementById(screenId);
        if (el) {
          el.style.display = (screenId === 'control-buttons' || screenId === 'start-prompt') ? 'flex' : 'block';
        }
    }
}

// --- Game State & Mode Selection ---
function initGame() {
    mode = 'normal';
    if (gameTimer) clearInterval(gameTimer);
    showScreen('main-menu');
    const container = document.getElementById('main-menu');
    container.innerHTML = '';
    document.getElementById('result').innerText = '';
    document.getElementById('score').innerText = '';
    updateTimeDisplay(null);
    if (player && player.stopVideo) player.stopVideo();

    const modes = [
        { label: 'ノーマルモード', action: () => selectMode('normal') },
        { label: 'タイムアタックモード', action: () => selectMode('timed') },
        { label: 'エンドレスモード', action: () => selectMode('endless'), className: 'endless-btn' },
        { label: 'ブルアカBGM図鑑', action: showEncyclopedia, className: 'encyclopedia-btn' },
        { label: '実績・統計', action: showStatsScreen, className: 'stats-btn' }
    ];

    modes.forEach(({ label, action, className }) => {
        const btn = document.createElement('button');
        btn.textContent = label;
        btn.onclick = action;
        if (className) btn.className = className;
        container.appendChild(btn);
    });
}

// ★ Entry point for starting a game mode
function selectMode(selectedMode) {
    mode = selectedMode;
    // For modes with settings, show settings screen. Otherwise, show start prompt.
    if (mode === 'normal' || mode === 'timed') {
        showModeSettings();
    } else {
        const prompt = document.getElementById('start-prompt');
        prompt.style.display = 'flex';
        document.getElementById('start-prompt-btn').onclick = () => {
            prompt.style.display = 'none';
            // Prime the player to allow autoplay
            player.mute();
            player.playVideo();
            player.pauseVideo();
            player.unMute();
            launchQuiz();
        };
    }
}

function showModeSettings() {
    showScreen('settings-screen');
    const container = document.getElementById('settings-screen');
    container.innerHTML = '';

    let settingsContent = '';
    if (mode === 'normal') {
        container.innerHTML += `<h2>ノーマルモード設定</h2>`;
        settingsContent = `
            <div class="setting-item">
                <label for="normal-questions">問題数:</label>
                <input type="number" id="normal-questions" min="1" max="${playlist.length}" value="${gameData.settings.normalQuestions}">
            </div>`;
    } else if (mode === 'timed') {
        container.innerHTML += `<h2>タイムアタックモード設定</h2>`;
        settingsContent = `
            <div class="setting-item">
                <label for="timed-duration">制限時間(秒):</label>
                <input type="number" id="timed-duration" min="10" max="180" step="10" value="${gameData.settings.timedDuration / 1000}">
            </div>`;
    }

    container.innerHTML += settingsContent;
    
    const startBtn = document.createElement('button');
    startBtn.textContent = 'ゲーム開始';
    startBtn.onclick = () => {
        // Save settings and launch
        if (mode === 'normal') {
            gameData.settings.normalQuestions = parseInt(document.getElementById('normal-questions').value, 10);
        } else if (mode === 'timed') {
            gameData.settings.timedDuration = parseInt(document.getElementById('timed-duration').value, 10) * 1000;
        }
        saveGameData();
        launchQuiz();
    };

    const backBtn = document.createElement('button');
    backBtn.textContent = '戻る';
    backBtn.onclick = initGame;
    
    container.appendChild(startBtn);
    container.appendChild(backBtn);
}


function launchQuiz() {
    score = 0;
    totalQuestions = 0;
    answeredVideos = [];
    endlessStreak = 0;
    
    if (mode === 'timed') {
        timeLeftMs = gameData.settings.timedDuration;
        updateTimeDisplay(timeLeftMs);
        document.getElementById('result').innerText = '';
        if (gameTimer) clearInterval(gameTimer);
        gameTimer = setInterval(() => {
            timeLeftMs -= 10;
            if (timeLeftMs <= 0) {
                timeLeftMs = 0;
                updateTimeDisplay(timeLeftMs);
                endGame();
            } else {
                updateTimeDisplay(timeLeftMs);
            }
        }, 10);
    }
    
    loadNextQuiz();
}

// --- Quiz Flow ---
function loadNextQuiz() {
    // ★ Bug Fix: Handle empty playlist
    if (!playlist || playlist.length === 0) {
        showScreen(null);
        document.getElementById('result').innerText = 'エラー: BGMリストが読み込めません。';
        const homeBtn = document.createElement('button');
        homeBtn.textContent = 'ホームに戻る';
        homeBtn.onclick = initGame;
        document.getElementById('choices').innerHTML = '';
        document.getElementById('choices').appendChild(homeBtn);
        return;
    }

    if (mode === 'timed' && timeLeftMs <= 0) {
        if (gameTimer) endGame();
        return;
    }

    showScreen('choices');
    document.getElementById('control-buttons').style.display = 'flex';
    document.getElementById('result').innerText = '';

    let available = playlist.filter(p => !answeredVideos.includes(p.videoId));
    if (available.length === 0) {
        answeredVideos = [];
        available = playlist;
    }

    const random = available[Math.floor(Math.random() * available.length)];
    correctAnswer = random.title;
    currentVideoId = random.videoId;
    answeredVideos.push(currentVideoId);
    
    displayChoices(generateChoices(correctAnswer));
    playIntroClip();
    updateScore();
}

// ★ Bug Fix: Prevent duplicate choices using a Set
function generateChoices(correct) {
    const choices = new Set();
    choices.add(correct);
    const others = playlist.map(p => p.title).filter(t => t !== correct);
    while (choices.size < 4 && others.length > 0) {
        const randomIndex = Math.floor(Math.random() * others.length);
        choices.add(others[randomIndex]);
        others.splice(randomIndex, 1);
    }
    return Array.from(choices).sort(() => 0.5 - Math.random());
}

function displayChoices(choices) {
    const container = document.getElementById('choices');
    container.innerHTML = '';
    choices.forEach(choice => {
        const btn = document.createElement('button');
        btn.textContent = choice;
        btn.onclick = () => checkAnswer(choice);
        container.appendChild(btn);
    });
}

function playIntroClip() {
    if (!player || !player.loadVideoById) return;
    player.cueVideoById({ videoId: currentVideoId, startSeconds: 0 });
}

// --- Answer Checking & Stats/Achievement Logic ---
function checkAnswer(choice) {
    if (!choice) return;
    document.querySelectorAll('#choices button').forEach(b => b.disabled = true);

    const isCorrect = (choice === correctAnswer);
    totalQuestions++;
    
    // ★ Stats Tracking
    if (!gameData.stats.songStats[currentVideoId]) {
        gameData.stats.songStats[currentVideoId] = { correct: 0, incorrect: 0 };
    }

    if (isCorrect) {
        score++;
        document.getElementById('result').innerText = '✅ 正解！';
        gameData.stats.songStats[currentVideoId].correct++;
        if (mode === 'endless') {
            endlessStreak++;
            if (endlessStreak > gameData.stats.highScores.endless) {
                gameData.stats.highScores.endless = endlessStreak;
            }
            // ★ NEW Achievement Tracking
            if (endlessStreak >= 10) gameData.achievements.normal = true;
            if (endlessStreak >= 20) gameData.achievements.hard = true;
            if (endlessStreak >= 50) gameData.achievements.veryhard = true;
            if (endlessStreak >= 100) gameData.achievements.hardcore = true;
            if (endlessStreak >= 150) gameData.achievements.extreme = true;
            if (endlessStreak >= 250) gameData.achievements.insane = true;
            if (endlessStreak >= 500) gameData.achievements.torment = true;
            if (endlessStreak >= 1000) gameData.achievements.lunatic = true;
        }
    } else {
        document.getElementById('result').innerText = `❌ 不正解。正解は: ${correctAnswer}`;
        gameData.stats.songStats[currentVideoId].incorrect++;
        if (mode === 'endless') {
            endlessStreak = 0;
        }
    }
    updateScore();
    saveGameData();

    // Game flow logic
    if (mode === 'timed') {
        if (isCorrect) {
            setTimeout(() => {
                if (timeLeftMs > 0) loadNextQuiz();
                else if (gameTimer) endGame();
            }, 400);
        } else {
            setTimeout(endGame, 1200);
        }
        return;
    }

    if (mode === 'normal') {
        if (totalQuestions >= gameData.settings.normalQuestions) {
            endGame();
        } else {
            setTimeout(loadNextQuiz, 1200);
        }
    } else if (mode === 'endless') {
        setTimeout(loadNextQuiz, 1200);
    }
}

// --- End Game Screen ---
function endGame() {
    if (gameTimer) clearInterval(gameTimer);
    if (player && player.stopVideo) player.stopVideo();

    // ★ Update High Scores
    let resultMessage = '';
    if (mode === 'timed') {
        updateTimeDisplay(0);
        if (score > gameData.stats.highScores.timed) {
            gameData.stats.highScores.timed = score;
        }
        resultMessage = `\n🎉 タイムアタック終了！スコア: ${score}問`;
    } else if (mode === 'normal') {
        if (score > gameData.stats.highScores.normal) {
            gameData.stats.highScores.normal = score;
        }
        resultMessage = `\n🎉 終了！スコア: ${score}/${totalQuestions}`;
    }
    saveGameData();
    document.getElementById('result').innerText += resultMessage;

    showScreen('choices');
    document.getElementById('control-buttons').style.display = 'none';
    const container = document.getElementById('choices');
    container.innerHTML = '';
    container.appendChild(document.getElementById('result'));
    
    const againBtn = document.createElement('button');
    againBtn.textContent = 'もう一度あそぶ';
    againBtn.onclick = () => selectMode(mode);
    container.appendChild(againBtn);

    const homeBtn = document.createElement('button');
    homeBtn.textContent = 'ホームに戻る';
    homeBtn.onclick = initGame;
    container.appendChild(homeBtn);
}

// --- Stats Screen ---
function showStatsScreen() {
    showScreen('stats-screen');
    const container = document.getElementById('stats-screen');

    const achievementTiers = [
        { key: 'normal',   label: 'NORMAL',   desc: 'エンドレスモードで10問連続正解する' },
        { key: 'hard',     label: 'HARD',     desc: 'エンドレスモードで20問連続正解する' },
        { key: 'veryhard', label: 'VERYHARD', desc: 'エンドレスモードで50問連続正解する' },
        { key: 'hardcore', label: 'HARDCORE', desc: 'エンドレスモードで100問連続正解する' },
        { key: 'extreme',  label: 'EXTREME',  desc: 'エンドレスモードで150問連続正解する' },
        { key: 'insane',   label: 'INSANE',   desc: 'エンドレスモードで250問連続正解する' },
        { key: 'torment',  label: 'TORMENT',  desc: 'エンドレスモードで500問連続正解する' },
        { key: 'lunatic',  label: 'LUNATIC',  desc: 'エンドレスモードで1000問連続正解する' }
    ];

    const achievementsHTML = `
        <div class="achievements-grid">
            ${achievementTiers.map(tier => `
                <div class="achievement ${gameData.achievements[tier.key] ? 'unlocked' : ''}">
                    <div class="ach-title">${tier.label}</div>
                    <div class="ach-desc">${tier.desc}</div>
                </div>
            `).join('')}
        </div>
    `;
    
    const unlockedCount = Object.values(gameData.achievements).filter(Boolean).length;

    container.innerHTML = `
        <h2>実績 & 統計</h2>
        <div class="stats-container">
            <h3>ハイスコア</h3>
            <div class="stat-item">ノーマルモード: <strong>${gameData.stats.highScores.normal}</strong> 問</div>
            <div class="stat-item">タイムアタックモード: <strong>${gameData.stats.highScores.timed}</strong> 問</div>
            <div class="stat-item">エンドレスモード: <strong>${gameData.stats.highScores.endless}</strong> 連続正解</div>
            <h3>実績 (${unlockedCount} / ${achievementTiers.length})</h3>
            ${achievementsHTML}
        </div>
        <button id="back-to-home-btn">ホームに戻る</button>
        <button id="reset-data-btn" style="background-color:#dc3545; color:white;">データリセット</button>
    `;

    document.getElementById('back-to-home-btn').onclick = initGame;
    document.getElementById('reset-data-btn').onclick = resetGameData;
}


// --- UI Helpers & Other functions (updateScore, updateTimeDisplay, Encyclopedia etc.) ---
function updateScore() {
    let scoreText = `スコア: ${score}`;
    if (mode === 'normal' || mode === 'timed') {
        scoreText += ` / ${totalQuestions}`;
    } else if (mode === 'endless') {
        scoreText = `連続正解: ${endlessStreak} (ハイスコア: ${gameData.stats.highScores.endless})`;
    }
    document.getElementById('score').innerText = scoreText;
}

function updateTimeDisplay(ms) {
  if (ms == null) {
    document.getElementById('time-display').innerText = '';
    return;
  }
  const seconds = ms / 1000;
  document.getElementById('time-display').innerText = `残り時間: ${seconds.toFixed(2)} 秒`;
}

// BGM図鑑
function showEncyclopedia() {
    showScreen('encyclopedia');
    const container = document.getElementById('encyclopedia');
    container.innerHTML = ''; // Clear previous content
    
    const header = document.createElement('div');
    header.innerHTML = `<h2>ブルアカBGM図鑑 (全${playlist.length}曲)</h2>`;
    container.appendChild(header);

    const nowPlayingContainer = document.createElement('div');
    nowPlayingContainer.id = 'now-playing-container';
    nowPlayingContainer.innerHTML = '曲名をクリックすると再生されます。';
    container.appendChild(nowPlayingContainer);

    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.id = 'encyclopedia-search';
    searchInput.placeholder = '曲名や作者名で検索...';
    searchInput.onkeyup = filterSongs;
    container.appendChild(searchInput);

    const songListContainer = document.createElement('div');
    songListContainer.id = 'song-list';
    container.appendChild(songListContainer);

    // MODIFIED: Use original playlist order (removed sort)
    playlist.forEach(song => {
        const songButton = document.createElement('button');
        songButton.className = 'song-item';
        // MODIFIED: Removed "(Composer: ...)" text
        songButton.innerHTML = `${song.title} <br><small style="color: #555;">${song.composer || 'N/A'}</small>`;
        songButton.onclick = () => {
            if (player && typeof player.playVideo === 'function') {
                player.stopVideo();
                player.loadVideoById(song.videoId);
                player.playVideo();
                nowPlayingContainer.innerHTML = `<strong>再生中:</strong> ${song.title}`;
                document.querySelectorAll('.song-item.playing').forEach(b => b.classList.remove('playing'));
                songButton.classList.add('playing');
            }
        };
        songListContainer.appendChild(songButton);
    });

    const homeBtn = document.createElement('button');
    homeBtn.textContent = 'ホームに戻る';
    homeBtn.style.marginTop = '1em';
    homeBtn.onclick = initGame;
    container.appendChild(homeBtn);
}

function filterSongs() {
    const filterText = document.getElementById('encyclopedia-search').value.toLowerCase();
    document.querySelectorAll('#song-list .song-item').forEach(song => {
        song.style.display = song.textContent.toLowerCase().includes(filterText) ? '' : 'none';
    });
}

// --- Initial Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
    loadGameData(); // ★ Load saved data on start

    document.getElementById('replayBtn').onclick = () => {
        if (player && player.seekTo) {
            player.seekTo(0);
            player.playVideo();
        }
    };
    document.getElementById('pauseBtn').onclick = () => {
        if (!player || typeof player.getPlayerState !== 'function') return;
        const state = player.getPlayerState();
        if (state === YT.PlayerState.PLAYING) player.pauseVideo();
        else player.playVideo();
    };
    document.getElementById('volumeSlider').addEventListener('input', (e) => {
        if (player && player.setVolume) player.setVolume(parseInt(e.target.value, 10));
    });
});