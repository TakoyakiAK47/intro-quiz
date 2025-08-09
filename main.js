let player;
console.info('If you see ERR_BLOCKED_BY_CLIENT in the console, try disabling adblocker or allowlist this page to permit YouTube requests.');

let correctAnswer = '';
let currentVideoId = '';
let score = 0;
let totalQuestions = 0;
const maxQuestions = 9999;
const MAX_NORMAL_QUESTIONS = 10;
let answeredVideos = [];
let mode = 'normal';

let gameTimer = null;
let timeLeftMs = 0;

function onYouTubeIframeAPIReady() {
  player = new YT.Player('player', {
    height: '0',
    width: '0',
    videoId: '',
    events: {
      'onReady': (event) => {
        player.setVolume(20);
        document.getElementById('volumeSlider').value = 20;
        showModeSelection();
        
        setTimeout(() => {
          try {
            const iframe = document.querySelector('#player iframe');
            if (iframe) {
              iframe.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture; accelerometer; gyroscope; clipboard-write; web-share');
              console.info('Set iframe allow attributes for YouTube player.');
            }
          } catch (e) { console.warn('Failed to set iframe allow attribute:', e); }
        }, 300);
    try { ensureModeButtons(); } catch(e) {}
      }
    }
  });
}


function setSkipEnabled(enabled) {
  try {
    const controlArea = document.getElementById('control-buttons');
    let candidates = [];
    if (controlArea) {
      candidates = Array.from(controlArea.querySelectorAll('button, input[type=button], a'));
    } else {
      candidates = Array.from(document.querySelectorAll('button, input[type=button], a'));
    }

    let skipBtn = candidates.find(b => {
      try {
        const onclick = b.getAttribute && b.getAttribute('onclick');
        if (onclick && onclick.includes('loadNextQuiz')) return true;
        const text = (b.textContent || '').trim().toLowerCase();
        if (text && text.includes('スキップ')) return true;
      } catch(e) { /* ignore */ }
      return false;
    });

    if (!skipBtn) {
      skipBtn = document.querySelector('[data-skip]');
    }

    if (skipBtn) {
      try { skipBtn.disabled = !enabled; } catch(e) { /* ignore */ }
    } else {
      console.debug('setSkipEnabled: skip button not found');
    }
  } catch (e) {
    console.warn('setSkipEnabled error (ignored):', e);
  }
}


function updateTimeDisplay(ms) {
  if (ms == null) {
    document.getElementById('time-display').innerText = '';
    return;
  }
  const seconds = ms / 1000;
  document.getElementById('time-display').innerText = `残り時間: ${seconds.toFixed(2)} 秒`;
}

function updateScore() {
  document.getElementById('score').innerText = `スコア: ${score} / ${totalQuestions}`;
}

function showModeSelection() {
  document.getElementById('control-buttons').style.display = 'none';
  const container = document.getElementById('choices');
  container.innerHTML = '';
  document.getElementById('result').innerText = '';
  document.getElementById('score').innerText = '';
  document.getElementById('time-display').innerText = '';

  const modes = [
    { label: 'ノーマルモード', value: 'normal' },
    { label: 'タイムアタックモード', value: 'timed' }
  ];
  modes.forEach(({ label, value }) => {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.onclick = () => {
      mode = value;
      if (mode === 'timed') {
        startTimedMode();
      } else {
        score = 0;
        totalQuestions = 0;
        answeredVideos = [];
        setSkipEnabled(true);
        loadNextQuiz();
      }
    };
    container.appendChild(btn);
  });
}

function initGame() {
  mode = 'normal';
  score = 0;
  totalQuestions = 0;
  answeredVideos = [];
  document.getElementById('score').innerText = 'スコア: 0 / 0';
  document.getElementById('result').innerText = '';
  document.getElementById('time-display').innerText = '';
  document.getElementById('choices').innerHTML = '';
  document.getElementById('control-buttons').style.display = 'none';
  setSkipEnabled(true);
  showModeSelection();
        try { ensureModeButtons(); } catch(e) {}
}

function loadNextQuiz() {
  if (mode === 'normal' && totalQuestions >= MAX_NORMAL_QUESTIONS) { endGame(); return; }
  if (mode === 'timed' && timeLeftMs <= 0) {
    endGame();
    return;
  }

  document.getElementById('result').innerText = '';
  try { const playerEl = document.getElementById('player'); if (playerEl) playerEl.style.display = ''; } catch(e) {}
  document.getElementById('choices').innerHTML = '';
  document.getElementById('control-buttons').style.display = 'flex';

  let available = playlist.filter(p => !answeredVideos.includes(p.videoId));
  if (available.length === 0) available = playlist.slice();

  const random = available[Math.floor(Math.random() * available.length)];
  correctAnswer = random.title;
  currentVideoId = random.videoId;
  answeredVideos.push(currentVideoId);

  const choices = generateChoices(correctAnswer);
  displayChoices(choices);
  playIntroClip();
  updateScore();
}

function generateChoices(correct) {
  const others = playlist.map(p => p.title).filter(t => t !== correct);
  const sample = others.sort(() => 0.5 - Math.random()).slice(0, 3);
  sample.push(correct);
  return sample.sort(() => 0.5 - Math.random());
}

function displayChoices(choices) {
  const container = document.getElementById('choices');
  choices.forEach(choice => {
    const btn = document.createElement('button');
    btn.textContent = choice;
    btn.onclick = () => checkAnswer(choice);
    container.appendChild(btn);
  });
}

function playIntroClip() {
  if (!player || !player.loadVideoById) return;
    try {
    if (mode === 'timed' && player && player.mute) { player.mute(); console.info('Muted player to allow autoplay in timed mode'); }
  } catch(e) { console.warn('mute failed', e); }
player.loadVideoById({ videoId: currentVideoId, startSeconds: 0 });
}

document.addEventListener('DOMContentLoaded', () => {
  const replayBtn = document.getElementById('replayBtn');
  const pauseBtn = document.getElementById('pauseBtn');
  replayBtn.onclick = () => {
    if (player && player.seekTo) {
      player.seekTo(0);
      player.playVideo();
    }
  };
  pauseBtn.onclick = () => {
    if (!player || !player.getPlayerState) return;
    const state = player.getPlayerState();
    if (state === 1) player.pauseVideo();
    else player.playVideo();
  };

  const vol = document.getElementById('volumeSlider');
  vol.addEventListener('input', (e) => {
    const v = parseInt(e.target.value, 10);
    if (player && player.setVolume) player.setVolume(v);
  });
});

function checkAnswer(choice) {
  if (!choice) return;

  if (mode === 'timed') {
    totalQuestions++;
    if (choice === correctAnswer) {
      score++;
      document.getElementById('result').innerText = '✅ 正解！';
      updateScore();
      setTimeout(() => {
        if (timeLeftMs > 0) loadNextQuiz();
        else endGame();
      }, 400);
    } else {
      document.getElementById('result').innerText = `❌ 不正解。正解は: ${correctAnswer}`;
      updateScore();
      endGame();
    }
    document.querySelectorAll('#choices button').forEach(b => b.disabled = true);
    return;
  }

  if (mode === 'normal') {
    totalQuestions++;
    if (choice === correctAnswer) {
      score++;
      document.getElementById('result').innerText = '✅ 正解！';
    } else {
      document.getElementById('result').innerText = `❌ 不正解。正解は: ${correctAnswer}`;
    }
    document.querySelectorAll('#choices button').forEach(btn => btn.disabled = true);
    updateScore();

    if (totalQuestions >= MAX_NORMAL_QUESTIONS) {
      endGame();
      return;
    }

    setTimeout(loadNextQuiz, 1200);
  }
}


function startTimedMode() {
  score = 0;
  totalQuestions = 0;
  answeredVideos = [];
  timeLeftMs = 60000;
  updateTimeDisplay(timeLeftMs);
  try { const playerEl = document.getElementById('player'); if (playerEl) playerEl.style.display = ''; } catch(e) {}
  document.getElementById('result').innerText = '';
  document.getElementById('score').innerText = 'スコア: 0 / 0';

  setSkipEnabled(false);

  if (gameTimer) clearInterval(gameTimer);

  gameTimer = setInterval(() => {
    timeLeftMs -= 10;
    if (timeLeftMs < 0) timeLeftMs = 0;
    updateTimeDisplay(timeLeftMs);
    if (timeLeftMs <= 0) {
      endGame();
    }
  }, 10);

  mode = 'timed';
  loadNextQuiz();
}



function endGame() {
  try {
const finishedMode = mode;
  if (gameTimer) {
    clearInterval(gameTimer);
    gameTimer = null;
  }
  if (player && player.stopVideo) player.stopVideo();

  try {
    const playerEl = document.getElementById('player');
    if (playerEl) {
      playerEl.style.display = 'none';
    }
  } catch (e) { console.warn('hide player failed', e); }

  if (finishedMode === 'normal') {
    const timeDisplay = document.getElementById('time-display');
    if (timeDisplay) { timeDisplay.style.display = 'none'; }
  } else {
    updateTimeDisplay(0);
  }

  if (finishedMode === 'normal') {
    document.getElementById('result').innerText = `
🎉 プレイ終了！スコア: ${score}/${MAX_NORMAL_QUESTIONS}`;
  } else {
    document.getElementById('result').innerText = `
🎉 タイムアタック終了！スコア: ${score}問`;
  }

  const container = document.getElementById('choices');
  container.innerHTML = '';

  const againBtn = document.createElement('button');
  againBtn.type = 'button';
  againBtn.textContent = 'もう一度あそぶ';
  againBtn.tabIndex = 0;
  againBtn.disabled = false;
  againBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    try { const playerEl = document.getElementById('player'); if (playerEl) playerEl.style.display = ''; } catch(e){}
    if (finishedMode === 'timed') {
      setTimeout(() => startTimedMode(), 50);
    } else {
      score = 0; totalQuestions = 0; answeredVideos = [];
      setSkipEnabled(true);
      setTimeout(() => loadNextQuiz(), 50);
    }
  });
  container.appendChild(againBtn);

  const homeBtn = document.createElement('button');
  homeBtn.type = 'button';
  homeBtn.textContent = 'ホームに戻る';
  homeBtn.tabIndex = 0;
  homeBtn.disabled = false;
  homeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    try { const playerEl = document.getElementById('player'); if (playerEl) playerEl.style.display = ''; } catch(e){}
    setSkipEnabled(true);
    setTimeout(() => initGame(), 50);
  });
  container.appendChild(homeBtn);

  const ctrl = document.getElementById('control-buttons');
  if (ctrl) ctrl.style.display = 'none';

  setSkipEnabled(true);
  mode = 'normal';

  try {
    if (container) {
      container.style.position = 'relative';
      container.style.zIndex = '9999';
      container.querySelectorAll('button').forEach(btn => {
        btn.style.position = 'relative';
        btn.style.zIndex = '10000';
        btn.style.pointerEvents = 'auto';
      });
    }
    document.body.style.pointerEvents = 'auto';
  } catch (e) { console.warn('force z-index failed', e); }
  } catch (e) {
    console.error('endGame error (caught by patch):', e);
  } finally {
    try { __robustEndGameCleanup(); } catch(e) { console.warn('cleanup failed', e); }
  }
}



function ensureModeButtons() {
  try {
    const container = document.getElementById('choices');
    if (!container) return;
    const hasButtons = Array.from(container.children).some(c => c.tagName === 'BUTTON');
    if (hasButtons) return;
    try { showModeSelection();
        try { ensureModeButtons(); } catch(e) {} } catch (e) {
      container.innerHTML = '';
      const normal = document.createElement('button');
      normal.textContent = 'ノーマルモード';
      normal.addEventListener('click', () => { mode = 'normal'; score=0; totalQuestions=0; answeredVideos=[]; setSkipEnabled(true); loadNextQuiz(); });
      container.appendChild(normal);
      const timed = document.createElement('button');
      timed.textContent = 'タイムアタックモード';
      timed.addEventListener('click', () => { mode = 'timed'; startTimedMode(); });
      container.appendChild(timed);
    }
    container.style.display = 'block';
    container.style.zIndex = '1000';
    document.body.style.pointerEvents = 'auto';
  } catch (err) {
    console.warn('ensureModeButtons error:', err);
  }
}

window.addEventListener('load', () => {
  try { showModeSelection();
        try { ensureModeButtons(); } catch(e) {} } catch (e) { /* ignore if DOM not ready */ }
  try { initGame(); } catch (e) { /* ignore */ }
});