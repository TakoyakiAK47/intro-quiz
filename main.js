const NEXT_QUESTION_DELAY = 1000;
const GAME_OVER_DELAY = 1000;
const EXTENDED_RESULT_DELAY = 2000; // 結果を少し長く表示（曲名を確認するため）

const GAME_MODES = {
    MENU: 'menu',
    NORMAL: 'normal',
    TIMED: 'timed',
    ENDLESS: 'endless',
    COMPOSER_QUIZ: 'composer_quiz' // 新しいモードを追加
};

const defaultGameData = {
    settings: {
        normalQuestions: 10,
        timedDuration: 60000,
        composerFilter: 'All',
    },
    stats: {
        highScores: { normal: 0, timed: 0, endless: 0, composer_quiz: 0 },
        songStats: {},
    },
    achievements: {
        normal: false, hard: false, veryhard: false, hardcore: false,
        extreme: false, insane: false, torment: false, lunatic: false
    },
};

const TITLE_SCREEN_VIDEO_ID = 'ISZ8lKOVapA';
const SUB_SCREEN_VIDEO_ID = 'I7A-xuDS-rA';

// 作曲者当てクイズ用の固定選択肢
const TARGET_COMPOSERS = ['Mitsukiyo', 'Nor', 'KARUT', 'EmoCosine'];

let player;
let correctAnswer = '';
let currentVideoId = '';
let currentSongTitle = ''; // 作曲者クイズ用に曲名を保持
let gameTimer = null;
let gameData = {};
let currentPlaylist = [];
let answeredVideos = [];

let gameState = {
    mode: GAME_MODES.MENU,
    score: 0,
    totalQuestions: 0,
    endlessStreak: 0,
    timeLeftMs: 0,
    answerChecked: false,
};


const domElements = {};


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
        
        // 新しいモード用のハイスコア初期化
        if (gameData.stats.highScores.composer_quiz === undefined) {
            gameData.stats.highScores.composer_quiz = 0;
        }
    } catch (e) {
        console.error("Failed to load game data:", e);
        gameData = JSON.parse(JSON.stringify(defaultGameData));
    }
}


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
    
    if (player && typeof player.loadVideoById === 'function') {
        player.loadVideoById({ 
            videoId: TITLE_SCREEN_VIDEO_ID, 
            startSeconds: 0, 
            playerVars: { 'playsinline': 1, 'autoplay': 0 } 
        });
        player.mute();
    }
    
    initGame();
}

function onPlayerReady(event) {
    // 追加: 最初にミュートを強制してブラウザの制限を回避する
    event.target.mute(); 
    
    event.target.setVolume(domElements.volumeSlider.value);
    
    if (player && typeof player.loadVideoById === 'function') {
        player.loadVideoById({ 
            videoId: TITLE_SCREEN_VIDEO_ID, 
            startSeconds: 0, 
            playerVars: { 'playsinline': 1, 'autoplay': 0 } 
        });
        // 修正: 初期ロード時はミュートのままにする
        player.mute(); 
    }
    
    initGame();
}
             player.seekTo(0); 
             player.playVideo();
}


function showScreen(screenId) {
    document.querySelectorAll('.screen, #main-menu, #game-view').forEach(el => el.style.display = 'none');
    const target = document.getElementById(screenId);
    if (target) {
        target.style.display = (screenId === 'game-view' || screenId === 'main-menu') ? 'flex' : 'block';
    }
}


function initGame() {
    gameState.mode = GAME_MODES.MENU;
    if (gameTimer) clearInterval(gameTimer);
    
    if (player && typeof player.loadVideoById === 'function') {
        player.loadVideoById({ 
            videoId: TITLE_SCREEN_VIDEO_ID, 
            startSeconds: 0, 
            playerVars: { 'playsinline': 1, 'autoplay': 0 } 
        });
        player.mute(); 
        player.playVideo();
        player.pauseVideo();
    }
    
    showScreen('main-menu');
    if (domElements.footer) domElements.footer.style.display = 'none'; 
    const container = domElements.mainMenu;
    container.innerHTML = '';

    const modes = [
        { id: GAME_MODES.NORMAL, label: 'ノーマルモード', action: () => selectMode(GAME_MODES.NORMAL) },
        { id: GAME_MODES.TIMED, label: 'タイムアタックモード', action: () => selectMode(GAME_MODES.TIMED) },
        { id: GAME_MODES.ENDLESS, label: 'エンドレスモード', action: () => selectMode(GAME_MODES.ENDLESS) },
        // サウンドアーカイブを置き換え
        { id: GAME_MODES.COMPOSER_QUIZ, label: '作曲者当てクイズ', action: () => selectMode(GAME_MODES.COMPOSER_QUIZ) },
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


function showStartPrompt() {
    domElements.startPrompt.style.display = 'flex';
    domElements.startPromptBtn.onclick = () => {
        domElements.startPrompt.style.display = 'none';
        
        if (player && player.getPlayerState() !== YT.PlayerState.PLAYING) {
             player.unMute();
             player.playVideo();
        }
        
        launchQuiz();
    };
}

function selectMode(selectedMode) {
    gameState.mode = selectedMode;
    
    if (gameState.mode === GAME_MODES.NORMAL || gameState.mode === GAME_MODES.TIMED) {
        showScreen('settings-screen');
        setupModeSettings();
    } else { 
        // エンドレスモードと作曲者クイズは即スタート
        showStartPrompt();
    }
}

function setupModeSettings() {
    const container = domElements.settingsScreen;
    if (domElements.footer) domElements.footer.style.display = 'none';
    let settingsContent = '';
    
    if (gameState.mode === GAME_MODES.NORMAL) {
        const composers = ['All', ...new Set(playlist.map(s => s.composer).filter(c => c && c !== 'Unknown').sort())];
        const options = composers.map(c => `<option value="${c}" ${gameData.settings.composerFilter === c ? 'selected' : ''}>${c}</option>`).join('');
        settingsContent = `<h2>ノーマルモード設定</h2>
            <div class="setting-item"><label for="normal-questions">問題数:</label><input type="number" id="normal-questions" min="1" max="50" value="${gameData.settings.normalQuestions}"></div>
            <div class="setting-item"><label for="composer-filter">作曲者で絞り込む:</label><select id="composer-filter">${options}</select></div>`;
    } else if (gameState.mode === GAME_MODES.TIMED) {
        settingsContent = `<h2>タイムアタックモード設定</h2>
            <div class="setting-item"><label for="timed-duration">制限時間(秒):</label><input type="number" id="timed-duration" min="10" max="180" step="10" value="${gameData.settings.timedDuration / 1000}"></div>`;
    }

    container.innerHTML = `${settingsContent}
        <div style="margin-top: 2em;">
            <button id="settings-back-btn">戻る</button>
            <button id="start-game-btn">クイズ開始</button>
        </div>`;
    
    document.getElementById('start-game-btn').onclick = () => {
        if (gameState.mode === GAME_MODES.NORMAL) {
            gameData.settings.normalQuestions = parseInt(document.getElementById('normal-questions').value, 10);
            gameData.settings.composerFilter = document.getElementById('composer-filter').value;
        } else if (gameState.mode === GAME_MODES.TIMED) {
            gameData.settings.timedDuration = parseInt(document.getElementById('timed-duration').value, 10) * 1000;
        }
        saveGameData();
        
        showStartPrompt();
    };
    document.getElementById('settings-back-btn').onclick = initGame;
}

function launchQuiz() {
    gameState.score = 0;
    gameState.totalQuestions = 0;
    gameState.endlessStreak = 0;
    gameState.answerChecked = false;
    answeredVideos = [];
    
    if (player && typeof player.stopVideo === 'function') {
        player.stopVideo(); 
    }
    
    const quizPlaylist = playlist.filter(song => song.quiz !== false);
    
    // プレイリストの構築
    if (gameState.mode === GAME_MODES.COMPOSER_QUIZ) {
        // 作曲者クイズの場合は指定の4名のみにフィルタリング
        currentPlaylist = quizPlaylist.filter(song => TARGET_COMPOSERS.includes(song.composer));
    } else {
        const filter = gameData.settings.composerFilter;
        currentPlaylist = (gameState.mode === GAME_MODES.NORMAL && filter !== 'All') 
            ? quizPlaylist.filter(song => song.composer === filter) 
            : [...quizPlaylist];
    }
    
    if (currentPlaylist.length < 4) {
        alert('選択した条件に該当する楽曲が少なすぎるため、クイズを開始できません。');
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
    // 終了判定
    const isTimeUp = gameState.mode === GAME_MODES.TIMED && gameState.timeLeftMs <= 0;
    const isNormalFinished = gameState.mode === GAME_MODES.NORMAL && gameState.totalQuestions >= gameData.settings.normalQuestions;

    if (isTimeUp || isNormalFinished) {
        endGame();
        return;
    }
    
    gameState.answerChecked = false;
    domElements.result.innerText = '';
    domElements.answerDetails.innerText = '';
    domElements.answerDetails.style.display = 'none';
    if (domElements.footer) domElements.footer.style.display = 'none'; 
    updateUIState();
    
    // 未回答の曲から選択（エンドレス・作曲者クイズで曲が尽きた場合はリセット）
    let available = currentPlaylist.filter(p => !answeredVideos.includes(p.videoId));
    if (available.length < 1) { // 選択肢生成には4曲必要だが、作曲者クイズの場合は固定選択肢なので1曲あればOK
        if (gameState.mode === GAME_MODES.ENDLESS || gameState.mode === GAME_MODES.COMPOSER_QUIZ) {
             // 既出リストをリセットして継続
            answeredVideos = [];
            available = currentPlaylist;
        } else {
            // ここには来ないはずだが念のため
            available = currentPlaylist; 
        }
    }

    const random = available[Math.floor(Math.random() * available.length)];
    
    if (!random) {
        console.error("No songs available in the playlist. Ending game.");
        endGame();
        return;
    }

    currentVideoId = random.videoId;
    currentSongTitle = random.title; // 曲名を保存
    answeredVideos.push(currentVideoId);

    // モードによって正解データを設定
    if (gameState.mode === GAME_MODES.COMPOSER_QUIZ) {
        correctAnswer = random.composer; // 正解は作曲者名
    } else {
        correctAnswer = random.title; // 正解は曲名
    }

    if (player && player.getPlayerState() === YT.PlayerState.PLAYING) {
        player.pauseVideo();
    }
    
    playIntroClip();
    displayChoices(generateChoices(random));
}

function generateChoices(correctSongObject) {
    // 作曲者クイズの場合、固定の4択をシャッフルして返す
    if (gameState.mode === GAME_MODES.COMPOSER_QUIZ) {
        return [...TARGET_COMPOSERS].sort(() => 0.5 - Math.random());
    }

    // 通常の曲名当てクイズ
    const correctTitle = correctSongObject.title;
    const choices = new Set([correctTitle]);

    if (correctSongObject && correctSongObject.similarGroup) {
        const similarSongs = currentPlaylist.filter(song => 
            song.similarGroup === correctSongObject.similarGroup && song.title !== correctTitle
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
    if (!player || !player.loadVideoById) return;
    player.loadVideoById({ 
        videoId: currentVideoId, 
        startSeconds: 0,
        playerVars: { 'playsinline': 1 } 
    });
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

    // --- ヒントおよび詳細表示の修正箇所 ---
    const correctSongObject = playlist.find(song => song.videoId === currentVideoId);
    if (correctSongObject) {
        let displayHint = "💡 ヒント: ";
        
        if (correctSongObject.context) {
            const contextParts = correctSongObject.context.split('\n');
            const ostInfo = contextParts[0] ? contextParts[0].trim() : "";
            const detailInfo = contextParts[1] ? contextParts[1].replace(/メモロビ:\s*「準備中」/g, '').trim() : "";

            // 順番: OST番号 「曲名」 メモロビ:キャラ名...
            displayHint += `${ostInfo} 「${correctSongObject.title}」`;
            
            if (detailInfo) {
                // カッコを外し、手前にスペースを入れて結合
                displayHint += ` ${detailInfo}`;
            }
        } else {
            displayHint += `「${correctSongObject.title}」`;
        }

        domElements.answerDetails.innerText = displayHint;
        domElements.answerDetails.style.display = 'block';
    }
    // ------------------------------------
    
    if (domElements.footer) domElements.footer.style.display = 'block'; 
    
    gameState.totalQuestions++;
    
    // 全モードで統計を更新
    updateSongStats(currentVideoId, isCorrect);
    
    updateChoiceButtonsUI(selectedChoice); 
    updateUIState();
    saveGameData();
    scheduleNextStep(isCorrect);
}


function updateChoiceButtonsUI(selectedChoice) {
    document.querySelectorAll('#choices button').forEach(btn => {
        btn.disabled = true; 
        const choiceText = btn.textContent.trim();
        if (choiceText === correctAnswer) {
            btn.classList.add('correct'); 
        } else if (choiceText === selectedChoice) {
            btn.classList.add('incorrect'); 
        }
        
        btn.style.pointerEvents = 'none'; 
    });
}


function processCorrectAnswer() {
    gameState.score++;
    
    // 作曲者クイズの場合は、正解の曲名も表示する
    if (gameState.mode === GAME_MODES.COMPOSER_QUIZ) {
        domElements.result.innerText = `✅ 正解！ (曲: ${currentSongTitle})`;
    } else {
        domElements.result.innerText = '✅ 正解！';
    }

    if (gameState.mode === GAME_MODES.ENDLESS || gameState.mode === GAME_MODES.COMPOSER_QUIZ) {
        gameState.endlessStreak++;
        if (gameState.mode === GAME_MODES.ENDLESS) {
            updateEndlessAchievements();
        } else {
            // 作曲者クイズ用のハイスコア更新
            if (gameState.endlessStreak > (gameData.stats.highScores.composer_quiz || 0)) {
                gameData.stats.highScores.composer_quiz = gameState.endlessStreak;
            }
        }
    }
}

function processIncorrectAnswer() {
    // 作曲者クイズの場合は、正解の曲名も含める
    if (gameState.mode === GAME_MODES.COMPOSER_QUIZ) {
        domElements.result.innerText = `❌ 不正解... (正解: ${correctAnswer} / 曲: ${currentSongTitle})`;
    } else {
        domElements.result.innerText = `❌ 不正解... (正解は「${correctAnswer}」)`;
    }
}

function scheduleNextStep(isCorrect) {
    const isNormalGameOver = gameState.mode === GAME_MODES.NORMAL && gameState.totalQuestions >= gameData.settings.normalQuestions;
    const isTimedGameOver = gameState.mode === GAME_MODES.TIMED && gameState.timeLeftMs <= 0;
    
    // エンドレスモードまたは作曲者クイズモードで不正解なら終了
    const isEndlessGameOver = (gameState.mode === GAME_MODES.ENDLESS || gameState.mode === GAME_MODES.COMPOSER_QUIZ) && !isCorrect;

    const isGameOver = isNormalGameOver || isTimedGameOver || isEndlessGameOver;
    
    if (isNormalGameOver) {
        domElements.progressBarFill.style.width = '100%';
    }
    
    let delay;
    if (isGameOver) {
        delay = GAME_OVER_DELAY; 
    } else if (gameState.mode === GAME_MODES.TIMED) {
        delay = NEXT_QUESTION_DELAY; 
    } else {
        // 曲名を確認できるよう少し長めに待つ
        delay = EXTENDED_RESULT_DELAY; 
    }

    setTimeout(() => {
        if (isGameOver) {
            endGame();
        } else {
            loadNextQuiz();
        }
    }, delay);
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
        case GAME_MODES.COMPOSER_QUIZ:
            modeText = "作曲者当てクイズ";
            resultText = `連続正解記録: ${gameData.stats.highScores.composer_quiz}問`;
            break;
    }
    const fullText = `${title}\n${modeText}でプレイしました！\n${resultText}`;
    const url = `https://x.com/intent/tweet?text=${encodeURIComponent(fullText)}&hashtags=${encodeURIComponent(hashtag)}`;
    window.open(url, '_blank');
}

function endGame() {
    if (gameTimer) clearInterval(gameTimer);
    gameTimer = null;
    gameState.answerChecked = true;
    
    domElements.progressContainer.style.display = 'none';
    domElements.timeDisplay.style.display = 'none';
    domElements.gameControlsContainer.style.display = 'none';

    if (player && typeof player.loadVideoById === 'function') {
        player.loadVideoById({ 
            videoId: SUB_SCREEN_VIDEO_ID, 
            startSeconds: 0, 
            playerVars: { 'playsinline': 1, 'autoplay': 1, 'loop': 1, 'playlist': SUB_SCREEN_VIDEO_ID } 
        });
        player.unMute(); 
    }

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
    } else if (gameState.mode === GAME_MODES.COMPOSER_QUIZ) {
        resultMessage = `🎉 作曲者クイズ終了！ 連続正解: ${gameState.endlessStreak}問`;
    }
    saveGameData();

    domElements.result.innerText = resultMessage;

    const container = domElements.choices;
    container.innerHTML = `
      <div>
        <button id="share-btn">結果をXでシェア</button>
        <button id="again-btn">もう一度あそぶ</button>
        <button id="home-btn">ホームに戻る</button>
      </div>
    `; 
    
    document.getElementById('share-btn').onclick = shareResult;
    document.getElementById('again-btn').onclick = () => selectMode(gameState.mode);
    document.getElementById('home-btn').onclick = initGame;
}

function showStatsScreen() {
    showScreen('stats-screen');
    if (domElements.footer) domElements.footer.style.display = 'none';

    if (player && typeof player.loadVideoById === 'function') {
        player.loadVideoById({ 
            videoId: SUB_SCREEN_VIDEO_ID, 
            startSeconds: 0, 
            playerVars: { 'playsinline': 1, 'autoplay': 1, 'loop': 1, 'playlist': SUB_SCREEN_VIDEO_ID } 
        });
        player.unMute(); 
    }

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
    
    const achievementsHTML = achievementTiers.map(tier => `
        <div class="achievement ${gameData.achievements[tier.key] ? 'unlocked' : ''}" style="padding: 1em; border: 1px solid var(--border-color); border-radius: 8px; background: ${gameData.achievements[tier.key] ? 'var(--blue-secondary)' : '#f9f9f9'}; color: ${gameData.achievements[tier.key] ? 'white' : 'inherit'};">
            <div style="font-weight: bold;">${tier.label}</div>
            <div style="font-size: 0.9em; margin-top: 0.5em;">${tier.desc}</div>
        </div>`).join('');

    container.innerHTML = `
        <h2>実績 & 統計</h2>
        <h3>ハイスコア</h3>
        <p>ノーマル: <strong>${gameData.stats.highScores.normal || 0}</strong></p>
        <p>タイムアタック: <strong>${gameData.stats.highScores.timed || 0}</strong></p>
        <p>エンドレス: <strong>${gameData.stats.highScores.endless || 0}</strong></p>
        <p>作曲者クイズ: <strong>${gameData.stats.highScores.composer_quiz || 0}</strong></p>
        <h3 style="margin-top: 2em;">実績 (${unlockedCount}/${achievementTiers.length})</h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1em; margin-bottom: 2em;">
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
    } else if (gameState.mode === GAME_MODES.COMPOSER_QUIZ) {
        scoreText = `High Score: ${gameData.stats.highScores.composer_quiz || 0} | Current: ${gameState.endlessStreak}`;
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
    } else if (gameState.mode === GAME_MODES.ENDLESS || gameState.mode === GAME_MODES.COMPOSER_QUIZ) {
        domElements.progressText.textContent = `連続正解数: ${gameState.endlessStreak}`;
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
    const song = playlist.find(s => s.videoId === videoId) || 
                 (typeof characterSongPlaylist !== 'undefined' ? characterSongPlaylist.find(s => s.videoId === videoId) : null);
    
    if (song && song.quiz === false) return; 

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

document.addEventListener('DOMContentLoaded', () => {
    // encylopedia IDはHTMLから削除されていない前提ですが、不要なIDは無視されます
    const ids = ['loading-overlay', 'main-menu', 'game-view', 'choices', 'result', 'answer-details', 'score', 'time-display', 'progress-container', 'progress-text', 'progress-bar-fill', 'game-controls-container', 'volumeSlider', 'settings-screen', 'start-prompt', 'start-prompt-btn', 'encyclopedia'];
    ids.forEach(id => {
        domElements[id.replace(/-(\w)/g, (_, c) => c.toUpperCase())] = document.getElementById(id);
    });
    domElements.progressBarWrapper = document.querySelector('.progress-bar-wrapper');
    domElements.footer = document.querySelector('footer'); 

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
    
    document.addEventListener('keydown', (event) => {
        if (gameState.mode !== GAME_MODES.MENU && !gameState.answerChecked && domElements.gameView.style.display !== 'none') {
            const choices = document.querySelectorAll('#choices button');
            let keyIndex = -1;

            switch(event.key.toLowerCase()) {
                case '1':
                    keyIndex = 0;
                    break;
                case '2':
                    keyIndex = 1;
                    break;
                case '3':
                    keyIndex = 2;
                    break;
                case '4':
                    keyIndex = 3;
                    break;
            }

            if (keyIndex !== -1 && choices.length > keyIndex) {
                event.preventDefault(); 
                
                const selectedButton = choices[keyIndex];
                const selectedChoice = selectedButton.textContent.trim();
                checkAnswer(selectedChoice);
            }
        }
    });
});
