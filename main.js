// --- Constants ---
const NEXT_QUESTION_DELAY = 1200;
const GAME_OVER_DELAY = 2000;

const GAME_MODES = {
    MENU: 'menu',
    NORMAL: 'normal',
    TIMED: 'timed',
    ENDLESS: 'endless',
};

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

// --- Global Variables & State ---
let player;
let correctAnswer = '';
let currentVideoId = '';
let gameTimer = null;
let gameData = {};
let currentPlaylist = [];
let answeredVideos = [];

// State Object
let gameState = {
    mode: GAME_MODES.MENU,
    score: 0,
    totalQuestions: 0,
    endlessStreak: 0,
    timeLeftMs: 0,
    answerChecked: false,
};

// DOM Element Cache
const domElements = {};

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
    domElements.loadingOverlay.style.display = 'none';
    player = new YT.Player('player', {
        height: '0', width: '0', videoId: '',
        playerVars: { 'playsinline': 1 },
        events: { 'onReady': onPlayerReady, 'onStateChange': onPlayerStateChange }
    });
}

function onPlayerReady(event) {
    event.target.setVolume(domElements.volumeSlider.value);
    initGame();
}

function onPlayerStateChange(event) {
    if (event.data === YT.PlayerState.CUED && [GAME_MODES.NORMAL, GAME_MODES.TIMED, GAME_MODES.ENDLESS].includes(gameState.mode)) {
        player.playVideo();
    }
}

// --- Screen Management ---
function showScreen(screenId) {
    document.querySelectorAll('.screen, #main-menu, #game-view').forEach(el => el.style.display = 'none');
    const target = document.getElementById(screenId);
    if (target) {
        target.style.display = (screenId === 'game-view' || screenId === 'main-menu') ? 'flex' : 'block';
    }
}

// --- Game Flow & State ---
function initGame() {
    gameState.mode = GAME_MODES.MENU;
    if (gameTimer) clearInterval(gameTimer);
    if (player && typeof player.stopVideo === 'function') player.stopVideo();
    
    showScreen('main-menu');
    const container = domElements.mainMenu;
    container.innerHTML = '';

    const modes = [
        { id: GAME_MODES.NORMAL, label: 'ノーマルモード', action: () => selectMode(GAME_MODES.NORMAL) },
        { id: GAME_MODES.TIMED, label: 'タイムアタックモード', action: () => selectMode(GAME_MODES.TIMED) },
        { id: GAME_MODES.ENDLESS, label: 'エンドレスモード', action: () => selectMode(GAME_MODES.ENDLESS) },
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
    gameState.mode = selectedMode;
    if (gameState.mode === GAME_MODES.NORMAL || gameState.mode === GAME_MODES.TIMED) {
        showScreen('settings-screen');
        setupModeSettings();
    } else {
        domElements.startPrompt.style.display = 'flex';
        domElements.startPromptBtn.onclick = () => {
            domElements.startPrompt.style.display = 'none';
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
    const container = domElements.settingsScreen;
    let settingsContent = '';
    
    if (gameState.mode === GAME_MODES.NORMAL) {
        const composers = ['All', ...new Set(playlist.map(s => s.composer).filter(Boolean))];
        const options = composers.map(c => `<option value="${c}" ${gameData.settings.composerFilter === c ? 'selected' : ''}>${c}</option>`).join('');
        settingsContent = `<h2>ノーマルモード設定</h2>
            <div class="setting-item"><label for="normal-questions">問題数:</label><input type="number" id="normal-questions" min="1" max="50" value="${gameData.settings.normalQuestions}"></div>
            <div class="setting-item"><label for="composer-filter">作者で絞り込む:</label><select id="composer-filter">${options}</select></div>`;
    } else if (gameState.mode === GAME_MODES.TIMED) {
        settingsContent = `<h2>タイムアタックモード設定</h2>
            <div class="setting-item"><label for="timed-duration">制限時間(秒):</label><input type="number" id="timed-duration" min="10" max="180" step="10" value="${gameData.settings.timedDuration / 1000}"></div>`;
    }

    container.innerHTML = `${settingsContent}
        <button id="start-game-btn">ゲーム開始</button>
        <button id="settings-back-btn">戻る</button>`;
    
    document.getElementById('start-game-btn').onclick = () => {
        if (gameState.mode === GAME_MODES.NORMAL) {
            gameData.settings.normalQuestions = parseInt(document.getElementById('normal-questions').value, 10);
            gameData.settings.composerFilter = document.getElementById('composer-filter').value;
        } else if (gameState.mode === GAME_MODES.TIMED) {
            gameData.settings.timedDuration = parseInt(document.getElementById('timed-duration').value, 10) * 1000;
        }
        saveGameData();
        launchQuiz();
    };
    document.getElementById('settings-back-btn').onclick = initGame;
}

function launchQuiz() {
    gameState.score = 0;
    gameState.totalQuestions = 0;
    gameState.endlessStreak = 0;
    gameState.answerChecked = false;
    answeredVideos = [];
    
    // クイズ対象の曲のみをフィルタリング
    const quizPlaylist = playlist.filter(song => song.quiz !== false);
    
    const filter = gameData.settings.composerFilter;
    currentPlaylist = (gameState.mode === GAME_MODES.NORMAL && filter !== 'All') 
        ? quizPlaylist.filter(song => song.composer === filter) 
        : [...quizPlaylist];
    
    if (currentPlaylist.length < 4) {
        alert('選択した作者の曲が4曲未満のため、クイズを開始できません。');
        initGame();
        return;
    }
    
    showScreen('game-view');
    domElements.gameControlsContainer.style.display = 'block';

    if (gameState.mode === GAME_MODES.TIMED) {
        gameState.timeLeftMs = gameData.settings.timedDuration;
        if (gameTimer) clearInterval(gameTimer);
        gameTimer = setInterval(() => {
            gameState.timeLeftMs -= 10;
            if (gameState.timeLeftMs <= 0) {
                gameState.timeLeftMs = 0;
                endGame();
            }
            updateTimeDisplay(gameState.timeLeftMs);
        }, 10);
    }
    
    loadNextQuiz();
}

function loadNextQuiz() {
    if ((gameState.mode === GAME_MODES.TIMED && gameState.timeLeftMs <= 0) || (gameState.mode === GAME_MODES.NORMAL && gameState.totalQuestions >= gameData.settings.normalQuestions)) {
        endGame();
        return;
    }

    gameState.answerChecked = false;
    domElements.result.innerText = '';
    domElements.answerDetails.innerText = '';
    domElements.answerDetails.style.display = 'none';
    updateUIState();
    
    let available = currentPlaylist.filter(p => !answeredVideos.includes(p.videoId));
    if (available.length < 4) {
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
    const correctSongObject = currentPlaylist.find(song => song.title === correct);

    if (correctSongObject && correctSongObject.similarGroup) {
        const similarSongs = currentPlaylist.filter(song => 
            song.similarGroup === correctSongObject.similarGroup && song.title !== correct
        );
        if (similarSongs.length > 0) {
            choices.add(similarSongs[Math.floor(Math.random() * similarSongs.length)].title);
        }
    }
    
    const distractors = currentPlaylist.filter(p => !choices.has(p.title)).map(p => p.title);
    
    while (choices.size < 4 && distractors.length > 0) {
        const randomIndex = Math.floor(Math.random() * distractors.length);
        choices.add(distractors.splice(randomIndex, 1)[0]);
    }
    
    return Array.from(choices).sort(() => 0.5 - Math.random());
}

function displayChoices(choices) {
    const container = domElements.choices;
    container.innerHTML = '';
    choices.forEach(choice => {
        const btn = document.createElement('button');
        btn.innerHTML = `<span>${choice}</span>`;
        btn.onclick = () => checkAnswer(choice);
        container.appendChild(btn);
    });
}

function playIntroClip() {
    if (!player || !player.cueVideoById) return;
    player.cueVideoById({ videoId: currentVideoId, startSeconds: 0 });
}

function checkAnswer(selectedChoice) {
    if (gameState.answerChecked) return;
    gameState.answerChecked = true;
    player.stopVideo();

    const isCorrect = (selectedChoice === correctAnswer);
    
    if (isCorrect) {
        processCorrectAnswer();
    } else {
        processIncorrectAnswer();
    }

    const correctSongObject = playlist.find(song => song.title === correctAnswer);
    if (correctSongObject && correctSongObject.context) {
        domElements.answerDetails.innerText = `💡 豆知識: ${correctSongObject.context}`;
        domElements.answerDetails.style.display = 'block';
    }
    
    gameState.totalQuestions++;
    updateSongStats(currentVideoId, isCorrect);
    updateChoiceButtonsUI(selectedChoice);
    updateUIState();
    saveGameData();
    scheduleNextStep(isCorrect);
}

function processCorrectAnswer() {
    gameState.score++;
    domElements.result.innerText = '✅ 正解！';
    if (gameState.mode === GAME_MODES.ENDLESS) {
        gameState.endlessStreak++;
        updateEndlessAchievements();
    }
}

function processIncorrectAnswer() {
    domElements.result.innerText = `❌ 不正解... (正解は「${correctAnswer}」)`;
    if (gameState.mode === GAME_MODES.ENDLESS) {
        gameState.endlessStreak = 0;
    }
}

function updateChoiceButtonsUI(selectedChoice) {
    domElements.choices.querySelectorAll('button').forEach(b => {
        b.disabled = true;
        if (b.textContent === correctAnswer) {
            b.classList.add('correct');
        } else if (b.textContent === selectedChoice) {
            b.classList.add('incorrect');
        }
    });
}

function scheduleNextStep(isCorrect) {
    const isNormalGameOver = gameState.mode === GAME_MODES.NORMAL && gameState.totalQuestions >= gameData.settings.normalQuestions;
    const isTimedGameOver = gameState.mode === GAME_MODES.TIMED && gameState.timeLeftMs <= 0;
    const isEndlessGameOver = gameState.mode === GAME_MODES.ENDLESS && !isCorrect;

    const isGameOver = isNormalGameOver || isTimedGameOver || isEndlessGameOver;
    
    if (isNormalGameOver) {
        domElements.progressBarFill.style.width = '100%';
    }
    
    setTimeout(() => {
        if (isGameOver) {
            endGame();
        } else {
            loadNextQuiz();
        }
    }, isGameOver ? GAME_OVER_DELAY : NEXT_QUESTION_DELAY);
}

function shareResult() {
    const title = "Blue Archive BGMイントロクイズ";
    const hashtag = "ブルアカイントロクイズ";
    let modeText = '', resultText = '';

    switch (gameState.mode) {
        case GAME_MODES.NORMAL:
            const accuracy = gameState.totalQuestions > 0 ? ((gameState.score / gameState.totalQuestions) * 100).toFixed(1) : 0;
            modeText = "ノーマルモード";
            resultText = `結果: ${gameState.score}/${gameState.totalQuestions}問正解 (正答率: ${accuracy}%)`;
            break;
        case GAME_MODES.TIMED:
            const duration = gameData.settings.timedDuration / 1000;
            modeText = `タイムアタックモード(${duration}秒)`;
            resultText = `スコア: ${gameState.score}問`;
            break;
        case GAME_MODES.ENDLESS:
            modeText = "エンドレスモード";
            resultText = `連続正解記録: ${gameData.stats.highScores.endless}問`;
            break;
    }
    const fullText = `${title}\n${modeText}でプレイしました！\n${resultText}\n\n#${hashtag}`;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(fullText)}`, '_blank');
}

function endGame() {
    if (gameTimer) clearInterval(gameTimer);
    gameTimer = null;
    gameState.answerChecked = true;
    
    domElements.progressContainer.style.display = 'none';
    domElements.timeDisplay.style.display = 'none';
    domElements.gameControlsContainer.style.display = 'none';

    let resultMessage = '';
    if (gameState.mode === GAME_MODES.TIMED) {
        if (gameState.score > (gameData.stats.highScores.timed || 0)) gameData.stats.highScores.timed = gameState.score;
        resultMessage = `🎉 タイムアップ！ スコア: ${gameState.score}問`;
    } else if (gameState.mode === GAME_MODES.NORMAL) {
        if (gameState.score > (gameData.stats.highScores.normal || 0)) gameData.stats.highScores.normal = gameState.score;
        const accuracy = gameState.totalQuestions > 0 ? ((gameState.score / gameState.totalQuestions) * 100).toFixed(1) : 0;
        resultMessage = `🎉 終了！ スコア: ${gameState.score}/${gameState.totalQuestions} (正答率: ${accuracy}%)`;
    } else if (gameState.mode === GAME_MODES.ENDLESS) {
        resultMessage = `🎉 ゲームオーバー！ 今回の記録: ${gameState.endlessStreak}問`;
    }
    saveGameData();

    domElements.result.innerText = resultMessage;

    const container = domElements.choices;
    container.innerHTML = ''; 
    
    const shareBtn = document.createElement('button');
    shareBtn.textContent = '結果をXでシェア';
    shareBtn.onclick = shareResult;

    const againBtn = document.createElement('button');
    againBtn.textContent = 'もう一度あそぶ';
    againBtn.onclick = () => selectMode(gameState.mode);
    
    const homeBtn = document.createElement('button');
    homeBtn.textContent = 'ホームに戻る';
    homeBtn.onclick = initGame;
    
    container.appendChild(shareBtn);
    container.appendChild(againBtn);
    container.appendChild(homeBtn);
}

function showStatsScreen() {
    showScreen('stats-screen');
    const container = document.getElementById('stats-screen');
    const unlockedCount = Object.values(gameData.achievements).filter(Boolean).length;
    const achievementTiers = [
        { key: 'normal', label: 'NORMAL', desc: 'エンドレスモードで10問連続正解' },
        { key: 'hard', label: 'HARD', desc: 'エンドレスモードで20問連続正解' },
        { key: 'veryhard', label: 'VERYHARD', desc: 'エンドレスモードで50問連続正解' },
        { key: 'hardcore', label: 'HARDCORE', desc: 'エンドレスモードで100問連続正解' },
        { key: 'extreme', label: 'EXTREME', desc: 'エンドレスモードで150問連続正解' },
        { key: 'insane', label: 'INSANE', desc: 'エンドレスモードで250問連続正解' },
        { key: 'torment', label: 'TORMENT', desc: 'エンドレスモードで500問連続正解' },
        { key: 'lunatic', label: 'LUNATIC', desc: 'エンドレスモードで1000問連続正解' }
    ];
    
    const achievementsHTML = achievementTiers.map(tier => `
        <div class="achievement ${gameData.achievements[tier.key] ? 'unlocked' : ''}" style="padding: 1em; border: 1px solid var(--border-color); border-radius: 8px; background: ${gameData.achievements[tier.key] ? 'var(--blue-secondary)' : '#f9f9f9'}; color: ${gameData.achievements[tier.key] ? 'white' : 'inherit'};">
            <div style="font-weight: bold;">${tier.label}</div>
            <div style="font-size: 0.9em; margin-top: 0.5em;">${tier.desc}</div>
        </div>`).join('');

    container.innerHTML = `
        <h2>実績 & 統計</h2>
        <h3>ハイスコア</h3>
        <div>ノーマル: <strong>${gameData.stats.highScores.normal || 0}</strong> 問</div>
        <div>タイムアタック: <strong>${gameData.stats.highScores.timed || 0}</strong> 問</div>
        <div>エンドレス: <strong>${gameData.stats.highScores.endless || 0}</strong> 連続正解</div>
        <h3 style="margin-top: 2em;">実績 (${unlockedCount}/${achievementTiers.length})</h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1em;">${achievementsHTML}</div>
        <button id="stats-back-btn">ホームに戻る</button>
        <button id="reset-data-btn" style="background-color: var(--red-primary); color:white;">データリセット</button>`;

    document.getElementById('stats-back-btn').onclick = initGame;
    document.getElementById('reset-data-btn').onclick = () => {
        if (confirm('すべての実績とハイスコアをリセットします。よろしいですか？')) {
            gameData = JSON.parse(JSON.stringify(defaultGameData));
            saveGameData();
            showStatsScreen();
        }
    };
}

function updateUIState() {
    updateScore();
    updateProgressIndicator();
    updateTimeDisplay(gameState.mode === GAME_MODES.TIMED ? gameState.timeLeftMs : null);
}

function updateScore() {
    let scoreText = '';
    if (gameState.mode === GAME_MODES.NORMAL || gameState.mode === GAME_MODES.TIMED) {
        scoreText = `Score: ${gameState.score}`;
    } else if (gameState.mode === GAME_MODES.ENDLESS) {
        scoreText = `High Score: ${gameData.stats.highScores.endless || 0} | Current: ${gameState.endlessStreak}`;
    }
    domElements.score.innerText = scoreText;
}

function updateProgressIndicator() {
    const container = domElements.progressContainer;
    container.style.display = 'none'; 
    
    if (gameState.mode === GAME_MODES.NORMAL) {
        const maxQ = gameData.settings.normalQuestions;
        domElements.progressText.textContent = `Question ${gameState.totalQuestions + 1} / ${maxQ}`;
        domElements.progressBarFill.style.width = `${(gameState.totalQuestions / maxQ) * 100}%`;
        container.style.display = 'block';
        domElements.progressBarWrapper.style.display = 'block';
    } else if (gameState.mode === GAME_MODES.ENDLESS) {
        domElements.progressText.textContent = `Current Streak: ${gameState.endlessStreak}`;
        container.style.display = 'block';
        domElements.progressBarWrapper.style.display = 'none';
    }
}

function updateTimeDisplay(ms) {
    if (ms != null && gameState.mode === GAME_MODES.TIMED) {
        domElements.timeDisplay.style.display = 'block';
        domElements.timeDisplay.innerText = `残り時間: ${(ms / 1000).toFixed(2)} 秒`;
    } else {
        domElements.timeDisplay.style.display = 'none';
    }
}

function updateSongStats(videoId, isCorrect) {
    if (!gameData.stats.songStats[videoId]) {
        gameData.stats.songStats[videoId] = { correct: 0, incorrect: 0 };
    }
    isCorrect ? gameData.stats.songStats[videoId].correct++ : gameData.stats.songStats[videoId].incorrect++;
}

function updateEndlessAchievements() {
    if (gameState.endlessStreak > (gameData.stats.highScores.endless || 0)) {
        gameData.stats.highScores.endless = gameState.endlessStreak;
    }
    const achievements = {10: 'normal', 20: 'hard', 50: 'veryhard', 100: 'hardcore', 150: 'extreme', 250: 'insane', 500: 'torment', 1000: 'lunatic'};
    for (const [streak, achievement] of Object.entries(achievements)) {
        if (gameState.endlessStreak >= streak) gameData.achievements[achievement] = true;
    }
}

// ▼▼▼ BGM図鑑の表示ロジックを更新 ▼▼▼
function showEncyclopedia() {
    showScreen('encyclopedia');
    const container = document.getElementById('encyclopedia');
    container.innerHTML = `
        <h2>ブルアカBGM図鑑 (全${playlist.length}曲)</h2>
        <input type="text" id="encyclopedia-search" placeholder="曲名や作者名で検索..." onkeyup="filterSongs()">
        <div id="encyclopedia-content">
            <div id="song-list"></div>
            <div id="encyclopedia-details">
                <div id="now-playing-container">左のリストから曲を選択してください。</div>
                <div id="song-context-display" style="margin-top: 1em;"></div>
            </div>
        </div>
        <button id="enc-back-btn" style="margin-top: 1em;" onclick="initGame()">ホームに戻る</button>
    `;

    const songListContainer = document.getElementById('song-list');
    const nowPlayingContainer = document.getElementById('now-playing-container');
    const contextDisplay = document.getElementById('song-context-display');
    
    playlist.forEach(song => {
        const songButton = document.createElement('button');
        songButton.className = 'song-item';
        songButton.innerHTML = `${song.title} <br><small style="color: #555;">${song.composer || 'N/A'}</small>`;
        songButton.onclick = () => {
            player.stopVideo();
            player.loadVideoById(song.videoId);
            
            nowPlayingContainer.innerHTML = `<strong>再生中:</strong> ${song.title}`;
            contextDisplay.innerHTML = `<strong>曲の解説:</strong><br>${song.context || 'この曲の解説は現在準備中です。'}`;
            
            document.querySelectorAll('.song-item.playing').forEach(b => b.classList.remove('playing'));
            songButton.classList.add('playing');
        };
        songListContainer.appendChild(songButton);
    });
}
// ▲▲▲ BGM図鑑の表示ロジックを更新ここまで ▲▲▲

function filterSongs() {
    const filterText = document.getElementById('encyclopedia-search').value.toLowerCase();
    document.querySelectorAll('#song-list .song-item').forEach(song => {
        song.style.display = song.textContent.toLowerCase().includes(filterText) ? 'block' : 'none';
    });
}

document.addEventListener('DOMContentLoaded', () => {
    const ids = ['loading-overlay', 'main-menu', 'choices', 'result', 'answer-details', 'score', 'time-display', 'progress-container', 'progress-text', 'progress-bar-fill', 'game-controls-container', 'volumeSlider', 'settings-screen', 'start-prompt', 'start-prompt-btn'];
    ids.forEach(id => {
        let camelCaseId = id.replace(/-(\w)/g, (_, c) => c.toUpperCase());
        domElements[camelCaseId] = document.getElementById(id);
    });
    domElements.progressBarWrapper = document.querySelector('.progress-bar-wrapper');

    domElements.loadingOverlay.style.display = 'flex';
    loadGameData();

    document.getElementById('replayBtn').onclick = () => {
        if (player && player.seekTo && !gameState.answerChecked) {
            player.seekTo(0);
            player.playVideo();
        }
    };

    document.getElementById('pauseBtn').onclick = () => {
        if (!player || typeof player.getPlayerState !== 'function') return;
        const state = player.getPlayerState();
        (state === YT.PlayerState.PLAYING) ? player.pauseVideo() : player.playVideo();
    };

    domElements.volumeSlider.addEventListener('input', (e) => {
        if (player && player.setVolume) player.setVolume(parseInt(e.target.value, 10));
    });
});