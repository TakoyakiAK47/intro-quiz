// main.js - clean implementation with proper Timed Mode (60.00s), millisecond display, skip disabled during timed mode
let player;
// Advisory: If you see ERR_BLOCKED_BY_CLIENT in the console, an extension (e.g. adblocker) is blocking requests.
console.info('If you see ERR_BLOCKED_BY_CLIENT in the console, try disabling adblocker or allowlist this page to permit YouTube requests.');

let correctAnswer = '';
let currentVideoId = '';
let score = 0;
let totalQuestions = 0;
const maxQuestions = 9999; // legacy
const MAX_NORMAL_QUESTIONS = 10; // normal mode limit
let answeredVideos = [];
let mode = 'normal'; // 'normal' or 'timed'

// Timed mode timers (milliseconds)
let gameTimer = null;
let timeLeftMs = 0; // remaining milliseconds in timed mode (e.g. 60000)

// YouTube IFrame API ready
function onYouTubeIframeAPIReady() {
  player = new YT.Player('player', {
    height: '0',
    width: '0',
    videoId: '',
    events: {
      'onReady': (event) => {
        player.setVolume(20);
        document.getElementById('volumeSlider').value = 20;
        // Ensure mode selection is visible when API is ready
        showModeSelection();
        
        // Try to ensure the YouTube iframe has a permissive 'allow' attribute so widget API can use features.
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

// --- UI helpers ---

function setSkipEnabled(enabled) {
  try {
    // Try to find a skip button inside #control-buttons by common heuristics:
    // 1) button with onclick that calls loadNextQuiz
    // 2) button with visible text including 'スキップ'
    // 3) [data-skip] attribute fallback
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
      // no skip button found; silently ignore (do not throw)
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

// --- Mode selection & initialization ---
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
        // normal mode init
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

// --- Quiz flow ---
function loadNextQuiz() {
  if (mode === 'normal' && totalQuestions >= MAX_NORMAL_QUESTIONS) { endGame(); return; }
  // If in timed mode and no time left, end game
  if (mode === 'timed' && timeLeftMs <= 0) {
    endGame();
    return;
  }

  document.getElementById('result').innerText = '';
  // ensure player is visible (may have been hidden at endGame)
  try { const playerEl = document.getElementById('player'); if (playerEl) playerEl.style.display = ''; } catch(e) {}
  document.getElementById('choices').innerHTML = '';
  document.getElementById('control-buttons').style.display = 'flex';

  // choose random unused video
  let available = playlist.filter(p => !answeredVideos.includes(p.videoId));
  if (available.length === 0) available = playlist.slice(); // reset if exhausted

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

// Play the intro clip from start (short preview)
function playIntroClip() {
  if (!player || !player.loadVideoById) return;
  // play from 0 seconds; you can tweak startSeconds and endSeconds if desired
    try {
    if (mode === 'timed' && player && player.mute) { player.mute(); console.info('Muted player to allow autoplay in timed mode'); }
  } catch(e) { console.warn('mute failed', e); }
player.loadVideoById({ videoId: currentVideoId, startSeconds: 0 });
}

// Replay and pause button handlers
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

  // volume slider
  const vol = document.getElementById('volumeSlider');
  vol.addEventListener('input', (e) => {
    const v = parseInt(e.target.value, 10);
    if (player && player.setVolume) player.setVolume(v);
  });
});

// --- Answer checking ---
function checkAnswer(choice) {
  // If no choice (shouldn't happen) ignore
  if (!choice) return;

  // timed mode behavior: correct -> next question, incorrect -> immediate end
  if (mode === 'timed') {
    totalQuestions++;
    if (choice === correctAnswer) {
      score++;
      document.getElementById('result').innerText = '✅ 正解！';
      updateScore();
      // quick delay then next question (keep remaining time)
      setTimeout(() => {
        // prevent going to next if time finished in the meantime
        if (timeLeftMs > 0) loadNextQuiz();
        else endGame();
      }, 400);
    } else {
      document.getElementById('result').innerText = `❌ 不正解。正解は: ${correctAnswer}`;
      updateScore();
      endGame();
    }
    // disable choice buttons after answer to avoid double clicks
    document.querySelectorAll('#choices button').forEach(b => b.disabled = true);
    return;
  }

  // normal mode (existing behavior: counts up to maxQuestions)
  if (mode === 'normal') {
    // clear any timed state (safety)
    totalQuestions++;
    if (choice === correctAnswer) {
      score++;
      document.getElementById('result').innerText = '✅ 正解！';
    } else {
      document.getElementById('result').innerText = `❌ 不正解。正解は: ${correctAnswer}`;
    }
    document.querySelectorAll('#choices button').forEach(btn => btn.disabled = true);
    updateScore();

    // If we've reached the max normal questions, end the game; otherwise continue
    if (totalQuestions >= MAX_NORMAL_QUESTIONS) {
      endGame();
      return;
    }

    setTimeout(loadNextQuiz, 1200);
  }
}


// --- Timed mode implementation ---
function startTimedMode() {
  // reset state
  score = 0;
  totalQuestions = 0;
  answeredVideos = [];
  // 60 seconds = 60000 ms
  timeLeftMs = 60000;
  updateTimeDisplay(timeLeftMs);
  try { const playerEl = document.getElementById('player'); if (playerEl) playerEl.style.display = ''; } catch(e) {}
  document.getElementById('result').innerText = '';
  document.getElementById('score').innerText = 'スコア: 0 / 0';

  // disable skip button during timed mode
  setSkipEnabled(false);

  // clear existing timer if any
  if (gameTimer) clearInterval(gameTimer);

  // 10ms tick for smooth display (reasonable balance)
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
const finishedMode = mode; // remember which mode ended
  // stop timer
  if (gameTimer) {
    clearInterval(gameTimer);
    gameTimer = null;
  }
  // stop video playback
  if (player && player.stopVideo) player.stopVideo();

  // Hide YouTube player to prevent overlay issues
  try {
    const playerEl = document.getElementById('player');
    if (playerEl) {
      playerEl.style.display = 'none';
    }
  } catch (e) { console.warn('hide player failed', e); }

  // ensure display shows 0.00 if timed out; hide time display for normal mode
  if (finishedMode === 'normal') {
    const timeDisplay = document.getElementById('time-display');
    if (timeDisplay) { timeDisplay.style.display = 'none'; }
  } else {
    updateTimeDisplay(0);
  }

  // show result summary (format depends on mode)
  if (finishedMode === 'normal') {
    document.getElementById('result').innerText = `
🎉 プレイ終了！スコア: ${score}/${MAX_NORMAL_QUESTIONS}`;
  } else {
    document.getElementById('result').innerText = `
🎉 タイムアタック終了！スコア: ${score}問`;
  }

  // clear choices and add fresh buttons
  const container = document.getElementById('choices');
  container.innerHTML = '';

  const againBtn = document.createElement('button');
  againBtn.type = 'button';
  againBtn.textContent = 'もう一度あそぶ';
  againBtn.tabIndex = 0;
  againBtn.disabled = false;
  againBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    // restore player display
    try { const playerEl = document.getElementById('player'); if (playerEl) playerEl.style.display = ''; } catch(e){}
    if (finishedMode === 'timed') {
      setTimeout(() => startTimedMode(), 50);
    } else {
      // restart normal mode
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
    // restore player display and go home
    try { const playerEl = document.getElementById('player'); if (playerEl) playerEl.style.display = ''; } catch(e){}
    setSkipEnabled(true);
    setTimeout(() => initGame(), 50);
  });
  container.appendChild(homeBtn);

  // hide control buttons area to avoid overlaps
  const ctrl = document.getElementById('control-buttons');
  if (ctrl) ctrl.style.display = 'none';

  // re-enable skip when leaving timed mode
  setSkipEnabled(true);
  mode = 'normal';

  // Force buttons clickable and on top
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
    // If container already has visible buttons, do nothing
    const hasButtons = Array.from(container.children).some(c => c.tagName === 'BUTTON');
    if (hasButtons) return;
    // Otherwise, call showModeSelection (safe)
    try { showModeSelection();
        try { ensureModeButtons(); } catch(e) {} } catch (e) {
      // If showModeSelection is not defined for some reason, build minimal buttons here
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
    // make sure choices area is visible and not overlapped
    container.style.display = 'block';
    container.style.zIndex = '1000';
    // ensure pointer events enabled on body
    document.body.style.pointerEvents = 'auto';
  } catch (err) {
    console.warn('ensureModeButtons error:', err);
  }
}

window.addEventListener('load', () => {
  // attempt to show mode selection right away
  try { showModeSelection();
        try { ensureModeButtons(); } catch(e) {} } catch (e) { /* ignore if DOM not ready */ }
  // Also call initGame to set things up
  try { initGame(); } catch (e) { /* ignore */ }
});