'use strict';

// ─────────────────────────────────────────────
//  SPRITE APPROACH:
//  All character face/expression/hand PNGs are
//  large transparent-canvas overlays designed to
//  be shown at FULL LCD size (100%×100%).
//  The artwork elements are composited within
//  the transparent image at the correct position.
//
//  Only channel indicators, lives, tummy panel,
//  and Tamara use specific % positions.
// ─────────────────────────────────────────────

// Full-screen LCD sprites (position: 0,0, size: 100%x100%)
const FULLSCREEN_SPRITES = [
    'Le_face', 'Le_smile', 'Le_frown', 'Le_tear1', 'Le_tear2',
    'Po_face', 'Po_smile', 'Po_frown', 'Po_tear1', 'Po_tear2',
    'Ri_face', 'Ri_smile', 'Ri_frown', 'Ri_tear1', 'Ri_tear2',
    'Xo_face', 'Xo_smile', 'Xo_frown', 'Xo_tear1', 'Xo_tear2',
    'Hand_1', 'Hand_2', 'Hand_3', 'Hand_4', 'Hand_5', 'Hand_6',
    'TamaraGlitch1', 'TamaraGlitch2',
];

// Positioned sprites — these have specific % placements
// (t=top%, l=left%, w=width%, h=height%)
const P = {
    Ch1: { t: 78, l: 3, w: 13, h: 14 },
    Ch2: { t: 78, l: 20, w: 13, h: 14 },
    Ch3: { t: 78, l: 37, w: 13, h: 14 },
    Ch4: { t: 78, l: 54, w: 13, h: 14 },
    Life1: { t: 79, l: 72, w: 8, h: 15 },
    Life2: { t: 79, l: 82, w: 8, h: 15 },
    Life3: { t: 79, l: 91, w: 8, h: 15 },
    Tummy: { t: 17, l: 35, w: 30, h: 44 },
};

// Hand frame currently displayed (1–6)
let handFrame = 1;

// ─────────────────────────────────────────────
//  GAME CONFIG
// ─────────────────────────────────────────────
const CHARS = ['Le', 'Po', 'Ri', 'Xo'];
const TUMMY_ITEMS = ['Tummy_treat', 'Tummy_bunny', 'Tummy_heart', 'Tummy_fleur', 'Tummy_screen'];
const CH_TO_CHAR = { 1: 'Le', 2: 'Po', 3: 'Ri', 4: 'Xo' };
const CHAR_TO_CH = { Le: 1, Po: 2, Ri: 3, Xo: 4 };

const BASE_WANT_MS = 13000;
const WANT_TIMEOUT_MS = 9000;
const TAMARA_INTERVAL = 30000;
const TAMARA_GRACE_MS = 10000;

// ─────────────────────────────────────────────
//  STATE
// ─────────────────────────────────────────────
let gameState = 'TITLE';
let selectedChannel = 1;
let lives = 3;
let score = 0;
let tamaraChannel = null;
let tamaraGlitchTimer = null;
let tamaraWarningTimer = null;
let tamaraScheduleTimer = null;

const CHAR_STATE = {};
const tearTimers = {};
let tummyTimeout = null;
let handAnimTimer = null;

function resetCharStates() {
    CHARS.forEach(c => {
        clearTimeout(CHAR_STATE[c]?.wantTimer);
        clearTimeout(CHAR_STATE[c]?.sadTimer);
        stopTears(c);
        CHAR_STATE[c] = { mood: 'happy', wantItem: null, wantTimer: null, sadTimer: null };
    });
}

// ─────────────────────────────────────────────
//  DOM HELPERS
// ─────────────────────────────────────────────
const $ = id => document.getElementById(id);
const show = id => { const e = $(id); if (e) e.style.visibility = 'visible'; };
const hide = id => { const e = $(id); if (e) e.style.visibility = 'hidden'; };
const setImg = (id, src) => { const e = $(id); if (e) e.src = src; };

// ─────────────────────────────────────────────
//  SPRITE BUILDER
//  Two types:
//   fullscreen — 100%×100%, transparent overlay
//   positioned — specific % bounding box
// ─────────────────────────────────────────────
function buildSprites() {
    const screen = $('lcd-screen');

    // ── Fullscreen LCD overlays ──
    // These comprise: all face/expression images and hand frames
    for (const name of FULLSCREEN_SPRITES) {
        const id = name.replace(/\s/g, '_');
        const img = document.createElement('img');
        img.id = id;
        img.src = `${name}.png`;
        img.className = 'sprite fullscreen';
        img.draggable = false;
        img.style.cssText = `
      position:absolute;top:0;left:0;
      width:100%;height:100%;
      visibility:hidden;
      pointer-events:none;
      object-fit:fill;
      z-index:3;
    `;
        screen.appendChild(img);
    }

    // ── Positioned sprites ──
    function mkPos(id, src, p) {
        const img = document.createElement('img');
        img.id = id;
        img.src = src;
        img.className = 'sprite positioned';
        img.draggable = false;
        img.style.cssText = `
      position:absolute;
      top:${p.t}%;left:${p.l}%;
      width:${p.w}%;height:${p.h}%;
      visibility:hidden;
      pointer-events:none;
      object-fit:contain;
      z-index:3;
    `;
        screen.appendChild(img);
    }

    // Channel indicators
    for (let i = 1; i <= 4; i++) {
        mkPos(`Ch${i}_ON`, `Channel${i}_ON.png`, P[`Ch${i}`]);
        mkPos(`Ch${i}_OFF`, `Channel${i}_OFF.png`, P[`Ch${i}`]);
    }

    // Lives
    mkPos('Life1', 'Life1.png', P.Life1);
    mkPos('Life2', 'Life2.png', P.Life2);
    mkPos('Life3', 'Life3.png', P.Life3);

    // Tummy center panel
    mkPos('tummy-sprite', '', P.Tummy);

    // ── Hand sprite alias — points to the current hand frame ──
    // We'll just show/hide the Hand_N fullscreen sprites directly
}

// ─────────────────────────────────────────────
//  RENDER HELPERS
// ─────────────────────────────────────────────
function renderChar(c) {
    const mood = CHAR_STATE[c].mood;
    // Clear expressions
    hide(`${c}_smile`); hide(`${c}_frown`);
    hide(`${c}_tear1`); hide(`${c}_tear2`);

    if (mood === 'invaded') {
        hide(`${c}_face`);
        return;
    }
    show(`${c}_face`);
    if (mood === 'happy') show(`${c}_smile`);
    if (mood === 'wanting') show(`${c}_frown`);
    if (mood === 'sad') show(`${c}_frown`);
}

function renderAllChars() {
    CHARS.forEach(c => renderChar(c));
}

function renderChannels() {
    for (let i = 1; i <= 4; i++) {
        if (i === selectedChannel) { show(`Ch${i}_ON`); hide(`Ch${i}_OFF`); }
        else { hide(`Ch${i}_ON`); show(`Ch${i}_OFF`); }
    }
}

function renderLives() {
    for (let i = 1; i <= 3; i++) {
        i <= lives ? show(`Life${i}`) : hide(`Life${i}`);
    }
}

// ─────────────────────────────────────────────
//  HAND POINTER  (uses fullscreen Hand_N images)
// ─────────────────────────────────────────────
function showHand(frame = 1) {
    // Hide all hand frames
    for (let i = 1; i <= 6; i++) hide(`Hand_${i}`);
    handFrame = frame;
    show(`Hand_${frame}`);
}

function animateHand(cb) {
    clearInterval(handAnimTimer);
    let f = 1;
    showHand(f);
    handAnimTimer = setInterval(() => {
        f = (f % 6) + 1;
        showHand(f);
        if (f >= 6) {
            clearInterval(handAnimTimer);
            showHand(1);
            if (cb) cb();
        }
    }, 65);
}

// ─────────────────────────────────────────────
//  TUMMY PANEL
// ─────────────────────────────────────────────
function showTummy(item, ms = 1500) {
    clearTimeout(tummyTimeout);
    const s = $('tummy-sprite');
    if (!s) return;
    s.src = item ? `${item}.png` : '';
    show('tummy-sprite');
    tummyTimeout = setTimeout(() => hide('tummy-sprite'), ms);
}

// ─────────────────────────────────────────────
//  TEARS
// ─────────────────────────────────────────────
function startTears(c) {
    stopTears(c);
    let ph = 0;
    tearTimers[c] = setInterval(() => {
        if (ph === 0) { show(`${c}_tear1`); hide(`${c}_tear2`); }
        else { show(`${c}_tear2`); hide(`${c}_tear1`); }
        ph ^= 1;
    }, 400);
}
function stopTears(c) {
    clearInterval(tearTimers[c]);
    hide(`${c}_tear1`); hide(`${c}_tear2`);
}

// ─────────────────────────────────────────────
//  WANT SYSTEM
// ─────────────────────────────────────────────
function scheduleWant(c) {
    clearTimeout(CHAR_STATE[c].wantTimer);
    CHAR_STATE[c].wantTimer = setTimeout(
        () => makeWant(c),
        BASE_WANT_MS + Math.random() * 8000
    );
}

function makeWant(c) {
    if (!CHAR_STATE[c] || CHAR_STATE[c].mood === 'invaded') return;
    CHAR_STATE[c].mood = 'wanting';
    CHAR_STATE[c].wantItem = TUMMY_ITEMS[Math.floor(Math.random() * TUMMY_ITEMS.length)];
    renderChar(c);
    if (CH_TO_CHAR[selectedChannel] === c) showTummy(CHAR_STATE[c].wantItem, 1200);

    CHAR_STATE[c].sadTimer = setTimeout(() => {
        if (CHAR_STATE[c].mood !== 'wanting') return;
        CHAR_STATE[c].mood = 'sad';
        renderChar(c);
        startTears(c);
        loseLife();
        CHAR_STATE[c].wantTimer = setTimeout(() => {
            if (CHAR_STATE[c].mood === 'sad') {
                stopTears(c); CHAR_STATE[c].mood = 'happy';
                renderChar(c); scheduleWant(c);
            }
        }, 5000);
    }, WANT_TIMEOUT_MS);
}

// ─────────────────────────────────────────────
//  TAMARA INVASION
// ─────────────────────────────────────────────
function triggerTamara() {
    if (tamaraChannel !== null || gameState !== 'PLAYING') return;
    const candidates = CHARS.filter(c => CHAR_STATE[c].mood !== 'invaded');
    if (!candidates.length) return;
    const c = candidates[Math.floor(Math.random() * candidates.length)];
    tamaraChannel = CHAR_TO_CH[c];
    CHAR_STATE[c].mood = 'invaded';
    renderChar(c);

    let gFrame = 1;
    show('TamaraGlitch1');
    tamaraGlitchTimer = setInterval(() => {
        gFrame = gFrame === 1 ? 2 : 1;
        hide('TamaraGlitch1'); hide('TamaraGlitch2');
        show(`TamaraGlitch${gFrame}`);
    }, 220);

    showTummy('Tummy_tamara1', 99999);

    tamaraWarningTimer = setTimeout(() => {
        if (tamaraChannel !== null) {
            banishTamara(false);
            loseLife();
        }
    }, TAMARA_GRACE_MS);
}

function banishTamara(success) {
    clearInterval(tamaraGlitchTimer);
    clearTimeout(tamaraWarningTimer);
    hide('TamaraGlitch1'); hide('TamaraGlitch2');
    hide('tummy-sprite'); clearTimeout(tummyTimeout);

    if (tamaraChannel !== null) {
        const c = CH_TO_CHAR[tamaraChannel];
        CHAR_STATE[c].mood = success ? 'happy' : 'sad';
        if (!success) startTears(c);
        renderChar(c);
        scheduleWant(c);
        if (success) { score += 5; updateScore(); }
    }
    tamaraChannel = null;
    scheduleTamara();
}

function scheduleTamara() {
    clearTimeout(tamaraScheduleTimer);
    if (gameState !== 'PLAYING') return;
    tamaraScheduleTimer = setTimeout(() => triggerTamara(),
        TAMARA_INTERVAL + Math.random() * 15000);
}

// ─────────────────────────────────────────────
//  LIVES & FLASH
// ─────────────────────────────────────────────
function loseLife() {
    lives = Math.max(0, lives - 1);
    renderLives();
    flashScreen();
    if (lives === 0) setTimeout(triggerGameOver, 700);
}

function flashScreen() {
    const s = $('lcd-screen');
    if (!s) return;
    const orig = s.style.filter;
    s.style.filter = 'sepia(100%) saturate(600%) hue-rotate(300deg) brightness(2)';
    setTimeout(() => s.style.filter = 'sepia(10%) saturate(85%) hue-rotate(20deg)', 300);
}

function updateScore() {
    const h = $('score-hud');
    if (h) h.textContent = `SCR:${score}`;
    const g = $('gameover-score');
    if (g) g.textContent = `SCORE: ${score}`;
}

// ─────────────────────────────────────────────
//  BUTTON HANDLERS
// ─────────────────────────────────────────────
function onChannel() {
    if (gameState === 'TITLE') { startGame(); return; }
    if (gameState === 'GAMEOVER') { restartGame(); return; }
    selectedChannel = (selectedChannel % 4) + 1;
    showHand(1);
    renderChannels();
    const c = CH_TO_CHAR[selectedChannel];
    if (CHAR_STATE[c].mood === 'wanting') showTummy(CHAR_STATE[c].wantItem, 1200);
    else if (CHAR_STATE[c].mood === 'invaded') showTummy('Tummy_tamara1', 1200);
}

function onLock() {
    if (gameState === 'TITLE') { startGame(); return; }
    if (gameState === 'GAMEOVER') { restartGame(); return; }

    const c = CH_TO_CHAR[selectedChannel];
    const cs = CHAR_STATE[c];

    animateHand(() => {
        if (cs.mood === 'invaded' && tamaraChannel === selectedChannel) {
            banishTamara(true);
            showHand(1);
            return;
        }
        if (cs.mood === 'wanting') {
            clearTimeout(cs.sadTimer);
            showTummy(cs.wantItem, 1400);
            cs.mood = 'happy'; cs.wantItem = null;
            renderChar(c); score++; updateScore();
            scheduleWant(c);
            showHand(1);
            return;
        }
        showTummy('Tummy_screen', 700);
    });
}

// ─────────────────────────────────────────────
//  GAME STATES
// ─────────────────────────────────────────────
function startGame() {
    const ts = $('title-screen');
    if (ts) {
        ts.style.opacity = '0';
        ts.style.transition = 'opacity 0.4s';
        setTimeout(() => ts.style.display = 'none', 400);
    }

    gameState = 'PLAYING';
    lives = 3; score = 0; selectedChannel = 1; tamaraChannel = null;

    resetCharStates();
    updateScore();
    renderAllChars();
    renderChannels();
    renderLives();
    showHand(1);

    const sh = $('score-hud');
    if (sh) sh.style.display = 'block';

    const stagger = [2500, 6000, 9500, 13000];
    CHARS.forEach((c, i) => {
        CHAR_STATE[c].wantTimer = setTimeout(() => scheduleWant(c), stagger[i]);
    });

    scheduleTamara();
}

function triggerGameOver() {
    gameState = 'GAMEOVER';
    clearTimeout(tamaraScheduleTimer);
    clearInterval(tamaraGlitchTimer);
    clearTimeout(tamaraWarningTimer);
    CHARS.forEach(c => {
        clearTimeout(CHAR_STATE[c]?.wantTimer);
        clearTimeout(CHAR_STATE[c]?.sadTimer);
        stopTears(c);
    });
    for (let i = 1; i <= 6; i++) hide(`Hand_${i}`);
    hide('tummy-sprite');
    hide('TamaraGlitch1'); hide('TamaraGlitch2');
    updateScore();
    const go = $('gameover-screen');
    if (go) go.classList.add('visible');
}

function restartGame() {
    const go = $('gameover-screen');
    if (go) go.classList.remove('visible');
    setTimeout(startGame, 100);
}

// ─────────────────────────────────────────────
//  KEYBOARD
// ─────────────────────────────────────────────
document.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    if (k === 'c' || k === 'arrowleft' || k === 'arrowright') onChannel();
    if (k === ' ' || k === 'enter' || k === 'l') { e.preventDefault(); onLock(); }
});

// ─────────────────────────────────────────────
//  INIT
// ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    buildSprites();
    $('btn-channel').addEventListener('click', onChannel);
    $('btn-lock').addEventListener('click', onLock);
    $('title-screen').addEventListener('click', startGame);
    $('gameover-screen').addEventListener('click', restartGame);
});
