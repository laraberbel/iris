const { ipcRenderer } = require('electron');

let workMinutes = 50;
let breakMinutes = 10;
let eyeBreakMinutes = 20;
const EYE_BREAK_DURATION = 20;
const TOTAL_CYCLES = 4;

let isWorking = true;
let isRunning = false;
let isOverlayActive = false;
let completedCycles = 0;

let mainTimeRemaining = workMinutes * 60;
let eyeBreakRemaining = eyeBreakMinutes * 60;

let mainEndTime = null;
let eyeBreakEndTime = null;
let ticker = null;

const timerDisplay = document.getElementById('timerDisplay');
const modeBadge = document.getElementById('modeBadge');
const nextEyeBreak = document.getElementById('nextEyeBreak');
const startBtn = document.getElementById('startBtn');
const resetBtn = document.getElementById('resetBtn');
const minBtn = document.getElementById('minBtn');
const closeBtn = document.getElementById('closeBtn');

const cycleCountEl = document.getElementById('cycleCount');
const cells = document.querySelectorAll('.matrix-grid .cell');

const configBtn = document.getElementById('configBtn');
const configModal = document.getElementById('configModal');
const saveConfigBtn = document.getElementById('saveConfigBtn');
const closeConfigBtn = document.getElementById('closeConfigBtn');
const workInput = document.getElementById('workInput');
const breakInput = document.getElementById('breakInput');

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
  } else {
    nextEyeBreak.style.display = 'none';
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
  startBtn.textContent = 'Iniciar';
  clearInterval(ticker);
  ticker = null;
}

function updateLoop() {
  if (isOverlayActive || !isRunning) return;

  const now = Date.now();

  if (isWorking) {
    const eyeDiff = Math.round((eyeBreakEndTime - now) / 1000);
    eyeBreakRemaining = Math.max(0, eyeDiff);

    if (eyeBreakRemaining <= 0) {
      isOverlayActive = true;
      mainTimeRemaining = Math.max(0, Math.round((mainEndTime - now) / 1000));
      ipcRenderer.send('show-eye-break', EYE_BREAK_DURATION);
      return;
    }
  }

  const mainDiff = Math.round((mainEndTime - now) / 1000);
  mainTimeRemaining = Math.max(0, mainDiff);

  if (mainTimeRemaining <= 0) {
    if (isWorking) {
      isWorking = false;
      completedCycles++;
      updateCycleUI();

      mainTimeRemaining = breakMinutes * 60;
      modeBadge.textContent = 'MOD // DESCANSO';
      modeBadge.classList.add('break');
      startBtn.classList.add('break');

      new Notification('IRIS // ALERTA', {
        body: `Bloco de foco concluído. Descanso longo iniciado (${breakMinutes}m).`
      });
    } else {
      isWorking = true;
      mainTimeRemaining = workMinutes * 60;
      eyeBreakRemaining = eyeBreakMinutes * 60;

      modeBadge.textContent = 'MOD // FOCO';
      modeBadge.classList.remove('break');
      startBtn.classList.remove('break');

      new Notification('IRIS // ALERTA', {
        body: `Intervalo finalizado. Iniciando bloco de trabalho (${workMinutes}m).`
      });
    }

    const resetNow = Date.now();
    mainEndTime = resetNow + (mainTimeRemaining * 1000);
    eyeBreakEndTime = resetNow + (eyeBreakRemaining * 1000);
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

  updateDisplays();
  updateCycleUI();
});

configBtn.addEventListener('click', () => {
  workInput.value = workMinutes;
  breakInput.value = breakMinutes;
  configModal.classList.add('active');
});

closeConfigBtn.addEventListener('click', () => {
  configModal.classList.remove('active');
});

saveConfigBtn.addEventListener('click', () => {
  const newWork = parseInt(workInput.value, 10);
  const newBreak = parseInt(breakInput.value, 10);

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