const { ipcRenderer } = require('electron');

let workMinutes = 50;
let breakMinutes = 10;
let eyeBreakMinutes = 20;
const EYE_BREAK_DURATION = 20;
const TOTAL_CYCLES = 4;

let isWorking = true;
let isRunning = false;
let isOverlayActive = false;
let soundEnabled = true;
let completedCycles = 0;

let mainTimeRemaining = workMinutes * 60;
let eyeBreakRemaining = eyeBreakMinutes * 60;

let mainEndTime = null;
let eyeBreakEndTime = null;
let ticker = null;

const breakTips = [
  "SYS.POSTURE // Levante-se e alongue a coluna. Caminhe alguns passos para reativar a circulação.",
  "CORPO // Rotação suave dos ombros para trás e incline a cabeça devagar para cada lado.",
  "ERGONOMIA // Estique os braços acima da cabeça, entrelace os dedos e respire fundo.",
  "CIRCULAÇÃO // Afaste-se da tela, beba um copo de água e movimente as pernas.",
  "RESET FÍSICO // Alivie a tensão dos pulsos e antebraços com movimentos circulares.",
  "FOCO // Olhe para a linha do horizonte ou pela janela enquanto solta os ombros."
];

const timerDisplay = document.getElementById('timerDisplay');
const modeBadge = document.getElementById('modeBadge');
const nextEyeBreak = document.getElementById('nextEyeBreak');
const breakTip = document.getElementById('breakTip');
const tipText = document.getElementById('tipText');
const startBtn = document.getElementById('startBtn');
const resetBtn = document.getElementById('resetBtn');
const minBtn = document.getElementById('minBtn');
const closeBtn = document.getElementById('closeBtn');
const windchimeAudio = document.getElementById('windchimeAudio');

const cycleCountEl = document.getElementById('cycleCount');
const cells = document.querySelectorAll('.matrix-grid .cell');

const configBtn = document.getElementById('configBtn');
const configModal = document.getElementById('configModal');
const saveConfigBtn = document.getElementById('saveConfigBtn');
const closeConfigBtn = document.getElementById('closeConfigBtn');
const workInput = document.getElementById('workInput');
const breakInput = document.getElementById('breakInput');
const soundToggle = document.getElementById('soundToggle');

function formatTime(seconds) {
  const m = String(Math.floor(Math.max(0, seconds) / 60)).padStart(2, '0');
  const s = String(Math.floor(Math.max(0, seconds) % 60)).padStart(2, '0');
  return `${m}:${s}`;
}

function updateDisplays() {
  timerDisplay.textContent = formatTime(mainTimeRemaining);

  if (isWorking) {
    nextEyeBreak.textContent = `Descanso visual em: ${formatTime(eyeBreakRemaining)}`;
    nextEyeBreak.style.display = 'block';
    breakTip.style.display = 'none';
  } else {
    nextEyeBreak.style.display = 'none';
    breakTip.style.display = 'flex';
  }
}

function updateCycleUI() {
  const currentInRound = completedCycles % TOTAL_CYCLES;
  cycleCountEl.textContent = `${currentInRound}/${TOTAL_CYCLES}`;

  cells.forEach((cell, index) => {
    if (index < currentInRound) {
      cell.classList.add('filled');
    } else {
      cell.classList.remove('filled');
    }
  });
}

function playWindchime() {
  if (soundEnabled && windchimeAudio) {
    windchimeAudio.currentTime = 0;
    windchimeAudio.volume = 0.5;
    windchimeAudio.play().catch(() => {});
  }
}

function startTimer() {
  isRunning = true;
  startBtn.textContent = 'Pausar';

  const now = Date.now();
  mainEndTime = now + (mainTimeRemaining * 1000);
  eyeBreakEndTime = now + (eyeBreakRemaining * 1000);

  clearInterval(ticker);
  ticker = setInterval(updateLoop, 250);
}

function pauseTimer() {
  isRunning = false;
  startBtn.textContent = isWorking ? 'Iniciar' : 'Iniciar Descanso';
  clearInterval(ticker);
  ticker = null;
}

function updateLoop() {
  if (isOverlayActive || !isRunning) return;

  const now = Date.now();

  // Contador de micropausa de 20s (apenas no modo foco)
  if (isWorking) {
    const eyeDiff = Math.round((eyeBreakEndTime - now) / 1000);
    eyeBreakRemaining = Math.max(0, eyeDiff);

    if (eyeBreakRemaining <= 0) {
      isOverlayActive = true;
      mainTimeRemaining = Math.max(0, Math.round((mainEndTime - now) / 1000));
      ipcRenderer.send('show-eye-break', { seconds: EYE_BREAK_DURATION, sound: soundEnabled });
      return;
    }
  }

  // Contador do Bloco Principal
  const mainDiff = Math.round((mainEndTime - now) / 1000);
  mainTimeRemaining = Math.max(0, mainDiff);

  if (mainTimeRemaining <= 0) {
    if (isWorking) {
      pauseTimer();
      isWorking = false;
      completedCycles++;
      updateCycleUI();

      mainTimeRemaining = breakMinutes * 60;
      eyeBreakRemaining = eyeBreakMinutes * 60;

      modeBadge.textContent = 'MOD // DESCANSO';
      modeBadge.classList.add('break');
      startBtn.classList.add('break');
      startBtn.textContent = 'Iniciar Descanso';

      const randomTip = breakTips[Math.floor(Math.random() * breakTips.length)];
      tipText.textContent = randomTip;

      ipcRenderer.send('focus-main-window');
      playWindchime();

      new Notification('IRIS // ALERTA', {
        body: `Bloco de foco concluído. Clique para iniciar o descanso de ${breakMinutes} minutos.`
      });
    } else {
      pauseTimer();
      isWorking = true;
      mainTimeRemaining = workMinutes * 60;
      eyeBreakRemaining = eyeBreakMinutes * 60;

      modeBadge.textContent = 'MOD // FOCO';
      modeBadge.classList.remove('break');
      startBtn.classList.remove('break');
      startBtn.textContent = 'Iniciar';

      ipcRenderer.send('focus-main-window');
      playWindchime();

      new Notification('IRIS // ALERTA', {
        body: `Intervalo finalizado. Pronto para iniciar o bloco de trabalho de ${workMinutes} minutos.`
      });
    }
  }

  updateDisplays();
}

ipcRenderer.on('eye-break-completed', () => {
  isOverlayActive = false;
  eyeBreakRemaining = eyeBreakMinutes * 60;

  if (isRunning) {
    const now = Date.now();
    mainEndTime = now + (mainTimeRemaining * 1000);
    eyeBreakEndTime = now + (eyeBreakRemaining * 1000);
  }

  updateDisplays();
});

startBtn.addEventListener('click', () => {
  if (isRunning) {
    pauseTimer();
  } else {
    startTimer();
  }
});

resetBtn.addEventListener('click', () => {
  pauseTimer();
  isWorking = true;
  isOverlayActive = false;
  completedCycles = 0;

  mainTimeRemaining = workMinutes * 60;
  eyeBreakRemaining = eyeBreakMinutes * 60;

  modeBadge.textContent = 'MOD // FOCO';
  modeBadge.classList.remove('break');
  startBtn.classList.remove('break');
  startBtn.textContent = 'Iniciar';

  updateDisplays();
  updateCycleUI();
});

configBtn.addEventListener('click', () => {
  workInput.value = workMinutes;
  breakInput.value = breakMinutes;
  soundToggle.checked = soundEnabled;
  configModal.classList.add('active');
});

closeConfigBtn.addEventListener('click', () => {
  configModal.classList.remove('active');
});

saveConfigBtn.addEventListener('click', () => {
  const newWork = parseInt(workInput.value, 10);
  const newBreak = parseInt(breakInput.value, 10);
  soundEnabled = soundToggle.checked;

  if (newWork > 0 && newBreak > 0) {
    workMinutes = newWork;
    breakMinutes = newBreak;

    if (!isRunning && isWorking) {
      mainTimeRemaining = workMinutes * 60;
      updateDisplays();
    }
  }
  configModal.classList.remove('active');
});

minBtn.addEventListener('click', () => ipcRenderer.send('window-minimize'));
closeBtn.addEventListener('click', () => ipcRenderer.send('window-close'));

updateDisplays();
updateCycleUI();