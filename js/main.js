const {
  PHRASES,
  COMMON_ROUTE,
  STORY_SCENES,
  applyChoiceEffect,
  calculateResonance,
  chooseOutcome,
  createInitialRun,
  updateWeights,
} = window.SummerGameLogic;

const ERROR_TEXT = '哎呀，出错了，请重启试试吧~';
const PROFILE_KEY = 'summer_unsent_letter_profile_v1';
const DEFAULT_PROTAGONIST_NAME = '陆小锋';
const VIRTUAL = { w: 390, h: 844 };
const UI_FONT = '"KaiTi", "STKaiti", "FangSong", "SimSun", serif';

const canvas = document.getElementById('game');
const errorBox = document.getElementById('error');
const savePreview = document.getElementById('save-preview');
const savePreviewImage = document.getElementById('save-preview-image');
const savePreviewHint = document.getElementById('save-preview-hint');
const savePreviewOpen = document.getElementById('save-preview-open');
const savePreviewDownload = document.getElementById('save-preview-download');
const savePreviewClose = document.getElementById('save-preview-close');
const renameDialog = document.getElementById('rename-dialog');
const renameDialogPanel = document.getElementById('rename-dialog-panel');
const renameInput = document.getElementById('rename-input');
const renameCancel = document.getElementById('rename-cancel');
const ctx = canvas.getContext('2d', { alpha: false });
const bgmAudio = createBgmAudio('./1.mp3');
let renameDialogSubmitAction = null;
let renameDialogOpenedAt = 0;
let savePreviewOpenedAt = 0;
let savePreviewObjectUrl = '';
const imageAssets = loadImageAssets({
  bgClassroom: './assets/hd/bg-classroom.jpg',
  bgLibrary: './assets/hd/bg-library.jpg',
  bgRooftop: './assets/hd/bg-rooftop.jpg',
  bgForest: './assets/hd/bg-forest.jpg',
  bgMailbox: './assets/hd/bg-mailbox.jpg',
  bgRoom: './assets/hd/bg-room.jpg',
  chibiQ: './assets/chibi/chibi-q.png',
  chibiShiqi: './assets/chibi/chibi-shiqi.png',
  chibiLiu: './assets/chibi/chibi-liu.png',
  chibiLu: './assets/chibi/chibi-lu.png',
});

const BG_ASSETS = {
  'bg-classroom': 'bgClassroom',
  'bg-library': 'bgLibrary',
  'bg-rooftop': 'bgRooftop',
  'bg-forest': 'bgForest',
  'bg-mailbox': 'bgMailbox',
  'bg-room': 'bgRoom',
};

const CHAR_ASSETS = {
  'char-q': 'chibiQ',
  'char-shiqi': 'chibiShiqi',
  'char-liu': 'chibiLiu',
  'char-lu': 'chibiLu',
};

const HEROINE_OPTIONS = [
  { id: 'q', name: 'Q', asset: 'chibiQ', accent: '#9fc7ff', gender: 'female', summary: '曾是你的同桌，嘴上像在打趣，心里却一直记得那句旧约定。' },
  { id: 'shiqi', name: '黄诗琪', asset: 'chibiShiqi', accent: '#ffcf9e', gender: 'female', summary: '安静、温柔，也愿意等你把迟到的话慢慢说完。' },
  { id: 'liu', name: '刘俊岑', asset: 'chibiLiu', accent: '#c9b5ff', gender: 'male', summary: '喜欢跑步，看起来理性克制，其实最懂那些没有说出口的遗憾。' },
];

let app;

try {
  bindSavePreview();
  bindRenameDialog();
  app = createApp();
  app.start();
} catch (error) {
  showFatal(error);
}

function createApp() {
  const state = {
    scene: 'title',
    run: createInitialRun(),
    profile: loadProfile(),
    pointer: { x: VIRTUAL.w / 2, y: VIRTUAL.h / 2, down: false, visible: false, type: 'mouse' },
    buttons: [],
    particles: [],
    cursorTrail: [],
    clickEffects: [],
    time: 0,
    last: 0,
    lastCursorTrailAt: 0,
    windPhase: 0,
    foldProgress: 0,
    foldSealProgress: 0,
    foldAutoSeal: false,
    dragStart: null,
    foldDragPoint: null,
    storyIndex: 0,
    sceneIndex: 0,
    beatIndex: 0,
    beatChoices: [],
    selectedReply: '',
    sceneReveal: '',
    selectedHeroineId: 'q',
    heroineFocusId: null,
    view: { scale: 1, ox: 0, oy: 0 },
    outcome: null,
    resonance: 0,
    newBest: false,
    message: '',
    cardSaved: false,
    resetProfilePrompt: false,
    musicEnabled: true,
  };

  function start() {
    resize();
    window.addEventListener('resize', safe(resize));
    window.addEventListener('orientationchange', safe(resize));
    document.addEventListener('visibilitychange', () => {
      state.last = performance.now();
      if (document.hidden) {
        bgmAudio?.pause?.();
        return;
      }
      syncBgmPlayback();
    });
    bindPointer();
    syncBgmPlayback();
    requestAnimationFrame(loop);
  }

  function loop(now) {
    try {
      const dt = Math.min(40, now - (state.last || now));
      state.last = now;
      state.time += dt;
      state.windPhase += dt * 0.002;
      update(dt);
      draw();
      requestAnimationFrame(loop);
    } catch (error) {
      showFatal(error);
    }
  }

  function resize() {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, window.innerWidth);
    const height = Math.max(1, window.innerHeight);
    canvas.width = Math.floor(width * ratio);
    canvas.height = Math.floor(height * ratio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  function bindPointer() {
    canvas.addEventListener('pointerdown', safe((event) => {
      canvas.setPointerCapture?.(event.pointerId);
      const point = syncPointer(event, true);
      spawnCursorTrail(point, true);
      spawnPointerPressEffect(point, event.pointerType || 'mouse');
      handleDown(point);
      syncBgmPlayback();
    }));
    canvas.addEventListener('pointermove', safe((event) => {
      const point = syncPointer(event, state.pointer.down);
      spawnCursorTrail(point, state.pointer.down);
      handleMove(point);
    }));
    canvas.addEventListener('pointerup', safe((event) => {
      const point = syncPointer(event, false);
      handleUp(point);
    }));
    canvas.addEventListener('pointerleave', safe(() => {
      state.pointer.down = false;
      state.pointer.visible = false;
      state.dragStart = null;
      state.foldDragPoint = null;
    }));
    canvas.addEventListener('pointercancel', safe(() => {
      state.pointer.down = false;
      state.pointer.visible = false;
      state.dragStart = null;
      state.foldDragPoint = null;
    }));
  }

  function toVirtual(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left - state.view.ox) / state.view.scale,
      y: (event.clientY - rect.top - state.view.oy) / state.view.scale,
    };
  }

  function syncPointer(event, down = state.pointer.down) {
    const point = toVirtual(event);
    state.pointer = {
      ...state.pointer,
      ...point,
      down,
      visible: (event.pointerType || state.pointer.type || 'mouse') !== 'touch',
      type: event.pointerType || state.pointer.type || 'mouse',
    };
    return point;
  }

  function spawnCursorTrail(point, force = false) {
    if (!state.pointer.visible) return;
    const interval = state.pointer.down ? 18 : 42;
    if (!force && state.time - state.lastCursorTrailAt < interval) return;
    state.lastCursorTrailAt = state.time;
    const burst = state.pointer.down ? 3 : 1;
    for (let index = 0; index < burst; index += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (state.pointer.down ? 0.028 : 0.014) + Math.random() * (state.pointer.down ? 0.03 : 0.018);
      const life = (state.pointer.down ? 280 : 180) + Math.random() * (state.pointer.down ? 180 : 120);
      const warmGlow = Math.random() > 0.45;
      state.cursorTrail.push({
        x: point.x + (Math.random() - 0.5) * (state.pointer.down ? 10 : 5),
        y: point.y + (Math.random() - 0.5) * (state.pointer.down ? 10 : 5),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - (state.pointer.down ? 0.01 : 0.004),
        life,
        maxLife: life,
        size: (state.pointer.down ? 3.5 : 2.4) + Math.random() * (state.pointer.down ? 4 : 2.5),
        rotation: Math.random() * Math.PI * 2,
        spinSpeed: (Math.random() - 0.5) * 0.012,
        color: warmGlow ? '#fff1a6' : '#9bdc7d',
      });
    }
    if (state.cursorTrail.length > 80) {
      state.cursorTrail.splice(0, state.cursorTrail.length - 80);
    }
  }

  function spawnPointerPressEffect(point, pointerType = 'mouse') {
    const isTouch = pointerType === 'touch';
    const baseLife = isTouch ? 520 : 420;
    const ringSize = isTouch ? 14 : 10;
    state.clickEffects.push({
      kind: 'ring',
      x: point.x,
      y: point.y,
      life: baseLife,
      maxLife: baseLife,
      radius: ringSize,
      growth: isTouch ? 0.072 : 0.058,
      lineWidth: isTouch ? 4.8 : 3.6,
      color: isTouch ? '#fff1b5' : '#f7e48b',
      glow: isTouch ? '#fff8df' : '#fff7d3',
    });

    const burst = isTouch ? 9 : 6;
    for (let index = 0; index < burst; index += 1) {
      const angle = (Math.PI * 2 * index) / burst + Math.random() * 0.3;
      const speed = (isTouch ? 0.04 : 0.03) + Math.random() * (isTouch ? 0.028 : 0.022);
      const life = baseLife - 60 + Math.random() * 140;
      state.clickEffects.push({
        kind: 'spark',
        x: point.x,
        y: point.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - (isTouch ? 0.012 : 0.008),
        life,
        maxLife: life,
        size: (isTouch ? 4.6 : 3.4) + Math.random() * (isTouch ? 3 : 2.2),
        rotation: angle,
        spinSpeed: (Math.random() - 0.5) * 0.018,
        color: index % 2 ? '#9bdc7d' : '#fff1ad',
      });
    }

    if (state.clickEffects.length > 90) {
      state.clickEffects.splice(0, state.clickEffects.length - 90);
    }
  }

  function handleDown(point) {
    const hit = state.buttons.find((button) => pointInRect(point, button));
    if (hit) {
      hit.action();
      return;
    }
    if (state.scene === 'story') {
      nextStory();
      return;
    }
    if (state.scene === 'fold') {
      if (state.foldAutoSeal) return;
      const foldHotspot = { x: 46, y: 136, w: 84, h: 84 };
      if (pointInRect(point, foldHotspot)) {
        state.dragStart = point;
        state.foldDragPoint = point;
        state.message = '';
      }
    }
  }

  function handleMove(point) {
    if (state.scene !== 'fold' || state.foldAutoSeal || !state.dragStart || !state.pointer.down) return;
    const dragPoint = {
      x: clamp(point.x, 74, 58 + 274 - 8),
      y: clamp(point.y, 164, 148 + 318 - 8),
    };
    state.foldDragPoint = dragPoint;
    state.foldProgress = projectFoldProgress(dragPoint, 58, 148, 274, 318);
  }

  function handleUp(point) {
    if (state.scene === 'fold' && state.dragStart) {
      const releasePoint = {
        x: clamp(point.x, 74, 58 + 274 - 8),
        y: clamp(point.y, 164, 148 + 318 - 8),
      };
      state.foldDragPoint = releasePoint;
      state.foldProgress = projectFoldProgress(releasePoint, 58, 148, 274, 318);
      if (state.foldProgress < 0.08) {
        state.dragStart = null;
        state.foldDragPoint = null;
        state.message = '请从左上角把纸角拖向右下角。';
        return;
      }
      state.dragStart = null;
      if (state.foldProgress < 0.9) {
        state.message = '再往右下角多拉一点，先把上层纸角完全折过去。';
        return;
      }
      state.foldAutoSeal = true;
      state.foldProgress = 1;
      state.foldDragPoint = { x: 58 + 274 - 8, y: 148 + 318 - 8 };
      state.foldSealProgress = 0;
      state.message = '正在收起下边翻盖...';
      return;
    }
    if (state.scene === 'post') {
      const envelope = {
        x: 162,
        y: 244 + Math.sin(state.windPhase * 2) * 8,
        w: 66,
        h: 50,
      };
      if (pointInRect(point, envelope)) {
        const wind = (Math.sin(state.windPhase) + 1) / 2;
        state.run.windScore = Math.round(30 + wind * 70);
        state.resonance = calculateResonance(state.run);
        state.newBest = updateBestResonance(state.resonance);
        state.outcome = personalizeOutcome(chooseOutcome(state.run), currentHeroine());
        spawnRevealParticles();
        changeScene('reveal');
      }
    }
  }

  function changeScene(scene) {
    state.scene = scene;
    state.time = 0;
    state.buttons = [];
    state.cardSaved = false;
    hideSavePreview();
    hideRenameDialog();
    if (scene !== 'title') state.resetProfilePrompt = false;
    if (scene !== 'fold') {
      state.foldDragPoint = null;
      state.foldSealProgress = 0;
      state.foldAutoSeal = false;
    }
  }

  function update(dt) {
    for (const particle of state.particles) {
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.life -= dt;
      particle.spin += particle.spinSpeed * dt;
    }
    state.particles = state.particles.filter((particle) => particle.life > 0);
    for (const particle of state.cursorTrail) {
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.life -= dt;
      particle.rotation += particle.spinSpeed * dt;
    }
    state.cursorTrail = state.cursorTrail.filter((particle) => particle.life > 0);
    for (const effect of state.clickEffects) {
      effect.life -= dt;
      if (effect.kind === 'ring') {
        effect.radius += effect.growth * dt;
        continue;
      }
      effect.x += effect.vx * dt;
      effect.y += effect.vy * dt;
      effect.rotation += effect.spinSpeed * dt;
    }
    state.clickEffects = state.clickEffects.filter((effect) => effect.life > 0);
    if (state.scene === 'fold' && state.foldAutoSeal) {
      state.foldSealProgress = clamp(state.foldSealProgress + dt * 0.0014, 0, 1);
      if (state.foldSealProgress >= 1) {
        state.foldAutoSeal = false;
        state.run.foldScore = Math.round(35 + state.foldProgress * 65);
        state.message = state.run.foldScore > 80 ? '信纸折得很稳，像终于说出口的勇气。' : '信封有些松，但风还是接住了它。';
        changeScene('post');
      }
    }
    if (state.scene === 'reveal' && state.time > 2600) changeScene('ending');
  }

  function draw() {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    ctx.save();
    ctx.clearRect(0, 0, width, height);
    drawViewportBackground(width, height);
    const scale = Math.min(width / VIRTUAL.w, height / VIRTUAL.h);
    const ox = (width - VIRTUAL.w * scale) / 2;
    const oy = (height - VIRTUAL.h * scale) / 2;
    state.view = { scale, ox, oy };
    ctx.translate(ox, oy);
    ctx.scale(scale, scale);
    state.buttons = [];

    drawSceneBase();
    if (state.scene === 'title') drawTitle();
    if (state.scene === 'story') drawStory();
    if (state.scene === 'heroine') drawHeroineSelect();
    if (state.scene === 'school') drawSchoolScene();
    if (state.scene === 'write') drawWrite();
    if (state.scene === 'fold') drawFold();
    if (state.scene === 'post') drawPost();
    if (state.scene === 'reveal') drawReveal();
    if (state.scene === 'ending') drawEnding();
    drawGlobalHud();
    if (state.resetProfilePrompt) {
      state.buttons = state.buttons.filter((button) => button.global);
      drawResetProfileOverlay();
    }
    drawParticles();
    drawCursorTrail();
    drawPointerPressEffects();
    drawCustomCursor();
    ctx.restore();
  }

  function drawSceneBase() {
    drawBackgroundAsset('bg-forest');
    drawLeaves();
  }

  function drawTitle() {
    drawBackgroundAsset('bg-mailbox');
    darken(0.14);
    drawTitlePlaque(72, 48, 246, 118);
    centerText('风信来信', 102, 36, '#22314a', 900, VIRTUAL.w / 2, {
      stroke: 'rgba(255, 248, 232, .96)',
      strokeWidth: 5,
      shadow: 'rgba(37, 48, 71, .24)',
    });
    centerText('风信邮筒', 144, 21, '#466153', 800, VIRTUAL.w / 2, {
      stroke: 'rgba(255, 248, 232, .94)',
      strokeWidth: 4,
      shadow: 'rgba(37, 48, 71, .18)',
    });
    drawPanel(36, 572, 318, 110, '');
    fittedCenterText('把没说出口的话折成信，交给夏天的风。', 618, 282, 34, 19, '#3a4a66', 700, VIRTUAL.w / 2, {
      stroke: 'rgba(255, 252, 236, .92)',
      strokeWidth: 3,
    });
    centerText(`主角：${state.profile.protagonistName}  最高夏风共鸣度：${state.profile.bestResonance}`, 656, 14, '#59647a', 700);
    imageButton(78, 704, 234, 50, '开始游戏', () => startStory());
    imageButton(78, 770, 234, 42, '主角改名', () => renameProtagonist());
  }

  function drawStory() {
    const lineData = COMMON_ROUTE[state.storyIndex] || COMMON_ROUTE[0];
    drawBackgroundAsset(lineData.bg);
    darken(0.08);
    if (lineData.speaker !== '旁白' && lineData.speaker !== '系统' && lineData.char) {
      const asset = CHAR_ASSETS[lineData.char];
      drawSceneCharacter(asset, storyCharacterLayout(lineData));
    }
    drawDialogueBox(lineData.speaker, lineData.text);
  }

  function drawSchoolScene() {
    const schoolScene = STORY_SCENES[state.sceneIndex] || STORY_SCENES[0];
    const beat = schoolScene.beats[state.beatIndex];
    const heroine = currentHeroine();
    const displaySpeaker = beat.speaker === 'Q'
      ? heroine.name
      : beat.speaker === DEFAULT_PROTAGONIST_NAME
        ? heroine.name
        : beat.speaker;
    drawBackgroundAsset(schoolScene.bg);
    darken(0.1);
    fittedCenterText(shortSchoolTitle(schoolScene.title), 72, 250, 28, 24, '#1d2b43', 900, VIRTUAL.w / 2, {
      stroke: 'rgba(255, 248, 232, .96)',
      strokeWidth: 4,
      shadow: 'rgba(37, 48, 71, .26)',
    });
    fittedCenterText(schoolScene.page, 108, 168, 18, 18, '#4d6a59', 800, VIRTUAL.w / 2, {
      stroke: 'rgba(255, 252, 236, .92)',
      strokeWidth: 3,
      shadow: 'rgba(37, 48, 71, .16)',
    });
    drawAffinityHud(42, 132);

    if (state.sceneReveal) {
      drawDialogueBox('旁白', adaptHeroineText(`${state.selectedReply}\n${schoolScene.reveal}`, heroine), false, heroine, '旁白');
      imageButton(244, 754, 104, 42, state.sceneIndex >= STORY_SCENES.length - 1 ? '去写信' : '下一页', () => nextSchoolScene());
      return;
    }

    if (beat.speaker !== '旁白') {
      drawSceneCharacter(heroine.asset);
    }
    drawDialogueBox(displaySpeaker, adaptHeroineText(`${state.selectedReply ? `${state.selectedReply}\n` : ''}${beat.text}`, heroine), false, heroine, beat.speaker);
    state.beatChoices.forEach((choice, index) => {
      choiceButton(56, 240 + index * 54, 278, 42, adaptHeroineText(choice.label, heroine), () => chooseSchoolOption(choice));
    });
  }

  function drawHeroineSelect() {
    drawBackgroundAsset('bg-classroom');
    darken(0.08);
    fittedCenterText('先选一位同学，陪你翻开后面的同学录。', 72, 320, 32, 21, '#1d2b43', 900, VIRTUAL.w / 2, {
      stroke: 'rgba(255, 248, 232, .96)',
      strokeWidth: 4,
      shadow: 'rgba(37, 48, 71, .26)',
    });

    HEROINE_OPTIONS.forEach((heroine, index) => {
      const y = 146 + index * 168;
      drawHeroineCard(42, y, 306, 132, heroine, () => chooseHeroine(heroine.id));
    });
  }

function drawHeroineCard(x, y, w, h, heroine, action) {
  const focusedId = appState().heroineFocusId;
  const selected = focusedId === heroine.id;

  ctx.save();
  ctx.shadowColor = 'rgba(48, 63, 92, .18)';
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 8;
  rounded(x, y, w, h, 20);
  ctx.fillStyle = 'rgba(255, 249, 236, .94)';
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = heroine.accent;
  ctx.lineWidth = selected ? 3 : 2;
  rounded(x, y, w, h, 20);
  ctx.stroke();

  rounded(x + 8, y + 8, 92, h - 16, 16);
  ctx.fillStyle = 'rgba(255, 255, 255, .5)';
  ctx.fill();

  ctx.save();
  rounded(x + 8, y + 8, 92, h - 16, 16);
  ctx.clip();
  const artGlow = ctx.createLinearGradient(x + 8, y + 8, x + 100, y + h - 8);
  artGlow.addColorStop(0, `${heroine.accent}aa`);
  artGlow.addColorStop(1, 'rgba(255, 255, 255, .22)');
  ctx.fillStyle = artGlow;
  ctx.fillRect(x + 8, y + 8, 92, h - 16);
  drawAsset(heroine.asset, x + 14, y + 10, 80, h - 20);
  ctx.restore();

  rounded(x + 108, y + 14, 80, 24, 12);
  ctx.fillStyle = heroine.accent;
  ctx.fill();
  clippedText(heroine.name, x + 120, y + 27, 118, 24, 18, '#24324a', 800, {
    stroke: 'rgba(255, 250, 239, .92)',
    strokeWidth: 3,
    shadow: 'rgba(37, 48, 71, .16)',
  });

  wrapText(heroine.summary, x + 116, y + 52, 104, 19, '#4e5f77', 14, 700, 4);

  drawGameButtonFrame(x + 236, y + 86, 54, 30, {
    active: selected,
  });
  centerText(selected ? '确认' : '选择', y + 101, 13, '#fff8dc', 800, x + 263, {
    stroke: '#4a4d30',
    strokeWidth: 3,
    shadow: 'rgba(20, 38, 24, .55)',
  });

  if (selected) {
    rounded(x + w - 106, y + 14, 88, 22, 11);
    ctx.fillStyle = heroine.accent;
    ctx.globalAlpha = 0.34;
    ctx.fill();
    ctx.globalAlpha = 1;
    centerText('再次点击确认', y + 25, 12, '#31425d', 800, x + w - 62, {
      stroke: 'rgba(255, 250, 239, .88)',
      strokeWidth: 2,
    });
  }

  appButton(x, y, w, h, action);
}

  function drawWrite() {
    drawBackgroundAsset('bg-room');
    drawTitlePlaque(34, 20, 322, 72, 0.64);
    fittedCenterText('选择 2-3 句没说出口的话', 58, 292, 34, 24, '#1d2b43', 900, VIRTUAL.w / 2, {
      stroke: 'rgba(255, 248, 232, .96)',
      strokeWidth: 5,
      shadow: 'rgba(37, 48, 71, .3)',
    });
    drawPaper(32, 92, 326, 448);
    const selected = new Set(state.pendingPhraseIds || []);
    PHRASES.forEach((phrase, index) => {
      const y = 118 + index * 49;
      phraseButton(54, y, 282, 37, phrase.text, selected.has(phrase.id), () => togglePhrase(phrase));
    });
    const count = selected.size;
    centerText(`已选择 ${count}/3`, 570, 20, '#4e5f84', 800, VIRTUAL.w / 2, {
      stroke: 'rgba(255, 248, 232, .94)',
      strokeWidth: 4,
      shadow: 'rgba(37, 48, 71, .22)',
    });
    imageButton(52, 616, 286, 50, count >= 2 ? '折好这封信' : '至少选择两句', () => {
      if (count < 2) return;
      const selectedPhrases = PHRASES.filter((phrase) => selected.has(phrase.id));
      state.run = updateWeights(state.run, selectedPhrases);
      state.foldProgress = 0;
      state.foldSealProgress = 0;
      state.foldAutoSeal = false;
      changeScene('fold');
    }, count >= 2);
  }

  function drawFold() {
    drawBackgroundAsset('bg-library');
    drawTitlePlaque(42, 26, 306, 62);
    fittedCenterText('从左上角拖向右下角，折成信封', 58, 276, 30, 22, '#22314a', 900, VIRTUAL.w / 2, {
      stroke: 'rgba(255, 248, 232, .96)',
      strokeWidth: 4,
      shadow: 'rgba(37, 48, 71, .24)',
    });
    drawPaper(58, 148, 274, 318);
    drawFoldedCorner(58, 148, 274, 318, state.foldDragPoint, state.foldProgress);
    drawBottomEnvelopeFlap(58, 148, 274, 318, state.foldSealProgress);
    centerText(`${Math.round(state.foldProgress * 100)}%`, 510, 32, '#3f7e58', 900, VIRTUAL.w / 2, {
      stroke: 'rgba(255, 248, 232, .96)',
      strokeWidth: 4,
      shadow: 'rgba(37, 48, 71, .24)',
    });
    drawPanel(42, 604, 306, 76, state.message || '手指或鼠标拖动时，纸角会跟随移动。折痕越稳，夏风越容易读懂心意。');
  }

  function drawPost() {
    drawBackgroundAsset('bg-mailbox');
    drawTitlePlaque(34, 20, 322, 72, 0.64);
    fittedCenterText('等风顺起来，点击信封投递', 58, 292, 34, 24, '#1d2b43', 900, VIRTUAL.w / 2, {
      stroke: 'rgba(255, 248, 232, .96)',
      strokeWidth: 5,
      shadow: 'rgba(37, 48, 71, .3)',
    });
    drawWindMeter();
    drawEnvelope(168, 250 + Math.sin(state.windPhase * 2) * 8, 54, 38);
    drawPanel(42, 616, 306, 88, state.message || '点击上方信封，把信交给夏风。');
  }

  function drawReveal() {
    drawBackgroundAsset('bg-mailbox');
    fittedCenterText('夏风正在读信...', 70, 240, 30, 24, '#1d2b43', 900, VIRTUAL.w / 2, {
      stroke: 'rgba(255, 248, 232, .96)',
      strokeWidth: 4,
      shadow: 'rgba(37, 48, 71, .26)',
    });
    fittedCenterText('字、叶与光在邮筒边重组成一封回信。', 102, 280, 22, 15, '#59647a', 700, VIRTUAL.w / 2, {
      stroke: 'rgba(255, 252, 236, .92)',
      strokeWidth: 3,
      shadow: 'rgba(37, 48, 71, .16)',
    });
  }

  function drawEnding() {
    drawBackgroundAsset('bg-forest');
    drawCard(34, 76, 322, 492, state.outcome);
    if (state.message) {
      fittedCenterText(state.message, 584, 292, 16, 14, '#52636c', 700, VIRTUAL.w / 2, {
        stroke: 'rgba(255, 251, 240, .9)',
        strokeWidth: 3,
      });
    }
    imageButton(52, 604, 286, 48, '保存回信卡', () => saveCard());
    imageButton(52, 664, 286, 44, '再寄一封', () => startStory());
    imageButton(52, 720, 286, 42, '返回标题', () => changeScene('title'));
  }

  function startStory() {
    state.run = createInitialRun();
    state.pendingPhraseIds = [];
    state.outcome = null;
    state.resonance = 0;
    state.newBest = false;
    state.message = '';
    state.particles = [];
    state.resetProfilePrompt = false;
    state.storyIndex = 0;
    state.sceneIndex = 0;
    state.beatIndex = 0;
    state.beatChoices = [];
    state.selectedHeroineId = 'q';
    state.heroineFocusId = null;
    state.selectedReply = '';
    state.sceneReveal = '';
    changeScene('story');
  }

  function startRun() {
    state.pendingPhraseIds = [];
    state.outcome = null;
    state.resonance = 0;
    state.newBest = false;
    state.message = '';
    state.particles = [];
    changeScene('write');
  }

  function nextStory() {
    if (state.storyIndex < COMMON_ROUTE.length - 1) {
      state.storyIndex += 1;
      state.time = 0;
      return;
    }
    state.heroineFocusId = null;
    changeScene('heroine');
  }

  function startSchoolScenes() {
    state.sceneIndex = 0;
    state.beatIndex = 0;
    state.beatChoices = shuffledBeatChoices(0, 0);
    state.selectedReply = STORY_SCENES[0]?.intro || '';
    state.sceneReveal = '';
    changeScene('school');
  }

  function chooseHeroine(id) {
    const nextId = HEROINE_OPTIONS.find((option) => option.id === id)?.id || 'q';
    if (state.heroineFocusId !== nextId) {
      state.heroineFocusId = nextId;
      return;
    }
    state.selectedHeroineId = nextId;
    startSchoolScenes();
  }

  function chooseSchoolOption(choice) {
    state.run = applyChoiceEffect(state.run, choice.effect);
    state.selectedReply = choice.reply;
    if (state.beatIndex < STORY_SCENES[state.sceneIndex].beats.length - 1) {
      state.beatIndex += 1;
      state.beatChoices = shuffledBeatChoices(state.sceneIndex, state.beatIndex);
      return;
    }
    state.beatChoices = [];
    state.sceneReveal = STORY_SCENES[state.sceneIndex].reveal;
  }

  function nextSchoolScene() {
    if (state.sceneIndex < STORY_SCENES.length - 1) {
      state.sceneIndex += 1;
      state.beatIndex = 0;
      state.beatChoices = shuffledBeatChoices(state.sceneIndex, 0);
      state.selectedReply = STORY_SCENES[state.sceneIndex].intro;
      state.sceneReveal = '';
      return;
    }
    state.beatChoices = [];
    state.selectedReply = '';
    state.sceneReveal = '';
    startRun();
  }

  function togglePhrase(phrase) {
    const ids = state.pendingPhraseIds || [];
    if (ids.includes(phrase.id)) {
      state.pendingPhraseIds = ids.filter((id) => id !== phrase.id);
      return;
    }
    if (ids.length >= 3) return;
    state.pendingPhraseIds = [...ids, phrase.id];
  }

  function renameProtagonist() {
    showRenameDialog(state.profile.protagonistName, (next) => {
      const protagonistName = String(next).trim().slice(0, 8) || DEFAULT_PROTAGONIST_NAME;
      state.profile.protagonistName = protagonistName;
      saveProfile(state.profile);
      state.message = `主角已改名为 ${protagonistName}`;
    });
  }

  function updateBestResonance(score) {
    if (score <= (state.profile.bestResonance || 0)) return false;
    state.profile.bestResonance = score;
    saveProfile(state.profile);
    return true;
  }

  function syncBgmPlayback() {
    if (!bgmAudio) return;
    if (!state.musicEnabled) {
      bgmAudio.pause();
      return;
    }
    const playPromise = bgmAudio.play?.();
    playPromise?.catch?.(() => {});
  }

  function currentHeroine() {
    return HEROINE_OPTIONS.find((option) => option.id === state.selectedHeroineId) || HEROINE_OPTIONS[0];
  }

  function personalizeOutcome(outcome, heroine) {
    if (!outcome) return outcome;
    if (!heroine) return outcome;
    return {
      ...outcome,
      recipient: outcome.recipient === 'Q' ? heroine.name : outcome.recipient,
      line: adaptHeroineText(outcome.line, heroine),
    };
  }

  function spawnRevealParticles() {
    state.particles = [];
    const chars = [...state.outcome.title, ...state.outcome.keywords.join('')];
    for (let i = 0; i < 90; i++) {
      state.particles.push({
        x: 195 + Math.cos(i) * 24,
        y: 390 + Math.sin(i) * 28,
        vx: (Math.random() - 0.5) * 0.13,
        vy: -0.05 - Math.random() * 0.1,
        life: 1100 + Math.random() * 1400,
        spin: Math.random() * 6,
        spinSpeed: (Math.random() - 0.5) * 0.01,
        text: chars[i % chars.length],
        color: i % 3 ? state.outcome.tone : '#ffffff',
      });
    }
  }

  async function saveCard() {
    try {
      const cardCanvas = document.createElement('canvas');
      cardCanvas.width = 900;
      cardCanvas.height = 1400;
      const cardCtx = cardCanvas.getContext('2d');
      drawShareCard(cardCtx, 900, 1400, state.outcome, state.resonance, state.run.selectedPhrases);
      const touchLike = isTouchLikeDevice();
      const pngFileName = buildCardFileName(state.outcome?.title, 'png');
      const pngDataUrl = cardCanvas.toDataURL('image/png');
      const pngFile = dataUrlToFile(pngDataUrl, pngFileName);

      if (!touchLike && window.showSaveFilePicker) {
        try {
          const handle = await window.showSaveFilePicker({
            suggestedName: pngFileName,
            types: [
              { description: 'PNG 图片', accept: { 'image/png': ['.png'] } },
              { description: 'JPG 图片', accept: { 'image/jpeg': ['.jpg', '.jpeg'] } },
            ],
          });
          const fileName = normalizeCardFileName(handle.name || pngFileName);
          const mimeType = inferCardMimeType(fileName);
          const exportFile = await canvasToFile(cardCanvas, fileName, mimeType);
          if (!exportFile) throw new Error('empty image');
          const writable = await handle.createWritable();
          await writable.write(exportFile);
          await writable.close();
          state.cardSaved = true;
          state.message = `已保存回信卡（${mimeType === 'image/jpeg' ? 'JPG' : 'PNG'}）。`;
          return;
        } catch (error) {
          if (error?.name === 'AbortError') return;
        }
      }

      if (navigator.share && pngFile && (!navigator.canShare || navigator.canShare({ files: [pngFile] }))) {
        try {
          await navigator.share({
            title: '风信来信回信卡',
            text: '这是我在风信来信里收到的一封回信。',
            files: [pngFile],
          });
          state.cardSaved = true;
          state.message = '已打开系统分享，可直接保存到相册。';
          return;
        } catch (error) {
          if (error?.name === 'AbortError') return;
        }
      }

      if (touchLike) {
        const previewUrl = pngFile ? URL.createObjectURL(pngFile) : pngDataUrl;
        const restrictedHint = isRestrictedImageSaveContainer()
          ? '当前容器可能会拦截直接下载，建议先点“打开原图”，再长按图片保存；如果仍不支持，可直接截图保存。'
          : '手机上可长按图片保存到相册，也可以点“打开原图”后再保存。';
        showSavePreview(previewUrl, pngFileName, {
          openUrl: previewUrl,
          hint: restrictedHint,
        });
        state.cardSaved = true;
        state.message = isRestrictedImageSaveContainer()
          ? '已打开预览；若当前容器拦截保存，请点“打开原图”后再长按保存。'
          : '已打开预览，长按图片即可保存到相册。';
        return;
      }

      const link = document.createElement('a');
      link.href = pngDataUrl;
      link.download = pngFileName;
      link.rel = 'noopener';
      document.body.appendChild(link);
      link.click();
      link.remove();
      state.cardSaved = true;
      state.message = '已触发图片下载。';
    } catch {
      state.message = '图片保存失败，可以打开预览后截图保存这张回信卡。';
    }
  }

  return { start, __state: state };

  function safe(fn) {
    return (...args) => {
      try {
        return fn(...args);
      } catch (error) {
        showFatal(error);
        return undefined;
      }
    };
  }
}

function imageButton(x, y, w, h, label, action, enabled = true) {
  drawGameButtonFrame(x, y, w, h, { enabled });
  centerText(label, y + h / 2 + 1, 17, enabled ? '#fff8dc' : '#d2d7c5', 800, x + w / 2, {
    stroke: '#4a4d30',
    strokeWidth: 3,
    shadow: 'rgba(20, 38, 24, .55)',
  });
  appButton(x, y, w, h, enabled ? action : () => {});
}

function cornerHudButton(x, y, w, h, label, action, active = false) {
  ctx.save();
  ctx.shadowColor = 'rgba(36, 51, 32, .2)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 4;
  rounded(x, y, w, h, 10);
  ctx.fillStyle = 'rgba(255, 248, 232, .82)';
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(122, 156, 95, .78)';
  ctx.lineWidth = 2;
  rounded(x, y, w, h, 10);
  ctx.stroke();
  centerText(label, y + h / 2, 15, '#294733', 800, x + w / 2, {
    stroke: 'rgba(255, 252, 236, .9)',
    strokeWidth: 3,
  });
  if (active) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 243, 182, .95)';
    ctx.lineWidth = 2;
    rounded(x + 4, y + 4, w - 8, h - 8, 8);
    ctx.stroke();
    ctx.restore();
  }
  appButton(x, y, w, h, action, { global: true });
}

function phraseButton(x, y, w, h, label, active, action) {
  drawGameButtonFrame(x, y, w, h, { active });
  clippedText(label, x + 14, y + h / 2, w - 28, h - 8, 14, '#fff8dc', 800, {
    stroke: '#4a4d30',
    strokeWidth: 3,
    shadow: 'rgba(20, 38, 24, .55)',
  });
  appButton(x, y, w, h, action);
}

function choiceButton(x, y, w, h, label, action) {
  drawGameButtonFrame(x, y, w, h);
  clippedText(label, x + 16, y + h / 2, w - 32, h - 8, 15, '#fff8dc', 800, {
    stroke: '#4a4d30',
    strokeWidth: 3,
    shadow: 'rgba(20, 38, 24, .55)',
  });
  appButton(x, y, w, h, action);
}

function drawGameButtonFrame(x, y, w, h, options = {}) {
  const enabled = options.enabled !== false;
  const active = Boolean(options.active);
  ctx.save();
  ctx.globalAlpha = enabled ? 1 : 0.58;

  rounded(x + 1, y + 2, w, h, 7);
  ctx.fillStyle = 'rgba(70, 58, 35, .24)';
  ctx.fill();

  const outer = ctx.createLinearGradient(x, y, x, y + h);
  outer.addColorStop(0, active ? '#f6e6a6' : '#f0df9b');
  outer.addColorStop(0.5, '#c6ad6d');
  outer.addColorStop(1, '#f9ecc3');
  rounded(x, y, w, h, 7);
  ctx.fillStyle = outer;
  ctx.fill();

  rounded(x + 5, y + 5, w - 10, h - 10, 5);
  const inner = ctx.createLinearGradient(x, y + 5, x, y + h - 5);
  inner.addColorStop(0, active ? '#708452' : '#60794a');
  inner.addColorStop(0.55, active ? '#415c3f' : '#344f3b');
  inner.addColorStop(1, active ? '#526c45' : '#405c41');
  ctx.fillStyle = inner;
  ctx.fill();

  ctx.save();
  rounded(x + 5, y + 5, w - 10, h - 10, 5);
  ctx.clip();
  drawButtonLeafTexture(x, y, w, h);
  ctx.restore();

  ctx.strokeStyle = 'rgba(255, 246, 203, .72)';
  ctx.lineWidth = 1.4;
  rounded(x + 3, y + 3, w - 6, h - 6, 6);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(83, 65, 33, .45)';
  ctx.lineWidth = 1.2;
  rounded(x + 6, y + 6, w - 12, h - 12, 4);
  ctx.stroke();

  drawButtonCorner(x + 6, y + 6, 1, 1);
  drawButtonCorner(x + w - 6, y + 6, -1, 1);
  drawButtonCorner(x + 6, y + h - 6, 1, -1);
  drawButtonCorner(x + w - 6, y + h - 6, -1, -1);
  ctx.restore();
}

function drawButtonLeafTexture(x, y, w, h) {
  ctx.strokeStyle = 'rgba(247, 230, 154, .2)';
  ctx.lineWidth = 1;
  for (let i = 0; i < Math.max(3, Math.floor(w / 70)); i++) {
    const sx = x + 18 + i * 58;
    const sy = y + 10 + ((i * 17) % Math.max(12, h - 18));
    line(sx, sy + 14, sx + 30, sy + 2);
    ctx.fillStyle = 'rgba(196, 218, 123, .22)';
    ellipse(sx + 8, sy + 8, 8, 3);
    ellipse(sx + 20, sy + 6, 7, 3);
  }
  ctx.fillStyle = 'rgba(255, 247, 203, .18)';
  for (let i = 0; i < Math.max(4, Math.floor(w / 48)); i++) {
    circle(x + 14 + i * 43, y + 8 + ((i * 11) % Math.max(10, h - 16)), 1.8);
  }
}

function drawButtonCorner(x, y, sx, sy) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(sx, sy);
  ctx.strokeStyle = 'rgba(244, 228, 165, .95)';
  ctx.lineWidth = 1.4;
  line(0, 0, 12, 0);
  line(0, 0, 0, 12);
  ctx.fillStyle = '#f3df92';
  circle(0, 0, 3);
  ctx.fillStyle = 'rgba(179, 207, 112, .72)';
  ellipse(10, 4, 5, 2.5);
  ellipse(4, 10, 2.5, 5);
  ctx.restore();
}

function drawAffinityHud(x, y) {
  const affinity = appState().run?.affinity || { qFavor: 0, regret: 0, honesty: 0, distance: 0 };
  const w = 170;
  const h = 76;
  rounded(x, y, w, h, 14);
  ctx.fillStyle = 'rgba(255,255,255,.82)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(109,153,95,.42)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const row1 = y + 25;
  const row2 = y + 53;
  const leftLabelX = x + 18;
  const leftValueX = x + 74;
  const rightLabelX = x + 92;
  const rightValueX = x + w - 18;

  ctx.textAlign = 'left';
  text('好感', leftLabelX, row1, 15, '#43506a', 700);
  text('真诚', rightLabelX, row1, 15, '#43506a', 700);
  text('遗憾', leftLabelX, row2, 15, '#43506a', 700);
  text('距离', rightLabelX, row2, 15, '#43506a', 700);

  ctx.textAlign = 'right';
  text(String(affinity.qFavor), leftValueX, row1, 15, '#43506a', 700);
  text(String(affinity.honesty), rightValueX, row1, 15, '#43506a', 700);
  text(String(affinity.regret), leftValueX, row2, 15, '#43506a', 700);
  text(String(affinity.distance), rightValueX, row2, 15, '#43506a', 700);

  ctx.textAlign = 'left';
}

function drawSceneCharacter(assetName, layout = {}) {
  if (!Object.keys(layout).length) {
    drawAsset(assetName, 56, 430, 96, 142);
    return;
  }
  const x = layout.x ?? 56;
  const y = layout.y ?? 430;
  const w = layout.w ?? 96;
  const h = layout.h ?? 142;
  drawAsset(assetName, x, y, w, h);
}

function storyCharacterLayout(lineData) {
  if (lineData.bg === 'bg-mailbox' && lineData.char === 'char-lu') {
    return { x: 26, y: 418, w: 112, h: 164 };
  }
  return {};
}

function shortSchoolTitle(value) {
  return String(value).replace(/^场景[一二三四五六七八九十]+：/, '');
}

function appButton(x, y, w, h, action, options = {}) {
  appState().buttons.push({ x, y, w, h, action, ...options });
}

function appState() {
  return app ? app.__state : currentStateFallback;
}

const currentStateFallback = { buttons: [] };

function drawGlobalHud() {
  cornerHudButton(12, 14, 58, 34, '重置', () => {
    appState().resetProfilePrompt = true;
  });
  cornerHudButton(76, 14, 58, 34, '音乐', () => {
    const state = appState();
    state.musicEnabled = !state.musicEnabled;
    if (!state.musicEnabled) {
      bgmAudio?.pause?.();
      return;
    }
    const playPromise = bgmAudio?.play?.();
    playPromise?.catch?.(() => {});
  }, appState().musicEnabled);
}

function drawResetProfileOverlay() {
  ctx.save();
  ctx.fillStyle = 'rgba(24, 32, 46, .32)';
  ctx.fillRect(0, 0, VIRTUAL.w, VIRTUAL.h);
  ctx.restore();
  rounded(44, 280, 302, 196, 18);
  ctx.fillStyle = 'rgba(255, 249, 236, .96)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(122, 156, 95, .46)';
  ctx.lineWidth = 2;
  ctx.stroke();
  fittedCenterText('确认重置吗？', 322, 190, 30, 25, '#22314a', 900, VIRTUAL.w / 2, {
    stroke: 'rgba(255, 248, 232, .96)',
    strokeWidth: 4,
  });
  wrapText('确认后会清空最高夏风共鸣度。', 72, 364, 246, 22, '#43506a', 16, 700, 3);
  imageButton(68, 418, 114, 42, '取消', () => {
    appState().resetProfilePrompt = false;
  });
  imageButton(208, 418, 114, 42, '确认', () => {
    const state = appState();
    state.profile = {
      protagonistName: DEFAULT_PROTAGONIST_NAME,
      bestResonance: 0,
    };
    saveProfile(state.profile);
    state.resetProfilePrompt = false;
    state.message = '已重置主角名字和最高夏风共鸣度。';
  });
}

function shuffledBeatChoices(sceneIndex, beatIndex) {
  const beat = STORY_SCENES[sceneIndex]?.beats?.[beatIndex];
  return shuffleArray(beat?.choices || []);
}

function drawBackgroundAsset(bgKey) {
  const assetName = BG_ASSETS[bgKey] || 'bgForest';
  const image = imageAssets[assetName];
  if (image && image.complete && image.naturalWidth) {
    drawImageCover(image, 0, 0, VIRTUAL.w, VIRTUAL.h);
  } else {
    drawViewportBackground(VIRTUAL.w, VIRTUAL.h);
  }
}

function drawDialogueBox(speaker, body, showContinue = true, heroine = null, rawSpeaker = speaker) {
  const displaySpeaker = replaceProtagonistName(speaker);
  const displayBody = replaceProtagonistName(body);
  const accent = resolveDialogueAccent(rawSpeaker, displaySpeaker, heroine);
  const nameplateFill = dialogueNameplateFill(rawSpeaker, displaySpeaker, heroine);
  const nameplateStroke = dialogueNameplateStroke(rawSpeaker, displaySpeaker, heroine);
  rounded(28, 594, 334, 172, 10);
  ctx.fillStyle = 'rgba(255, 252, 236, .92)';
  ctx.fill();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  ctx.stroke();
  rounded(48, 574, 112, 34, 12);
  ctx.fillStyle = nameplateFill;
  ctx.fill();
  ctx.strokeStyle = nameplateStroke;
  ctx.stroke();
  centerText(displaySpeaker, 591, 15, '#294733', 800, 104);
  wrapText(displayBody, 54, 632, 284, 24, '#293247', 17, 700, 4);
  if (showContinue) centerText('点击空白处继续', 728, 13, '#6f7f68', 600);
}

function dialogueNameplateFill(rawSpeaker, displaySpeaker, heroine) {
  return isFixedGreenSpeaker(rawSpeaker, displaySpeaker) ? '#e7f5d6' : resolveDialogueAccent(rawSpeaker, displaySpeaker, heroine);
}

function dialogueNameplateStroke(rawSpeaker, displaySpeaker, heroine) {
  return isFixedGreenSpeaker(rawSpeaker, displaySpeaker) ? '#8cbf72' : resolveDialogueAccent(rawSpeaker, displaySpeaker, heroine);
}

function matchDialogueHeroine(rawSpeaker, displaySpeaker) {
  const speakerValues = [displaySpeaker, rawSpeaker]
    .filter((value) => value != null)
    .map((value) => String(value));
  for (const value of speakerValues) {
    const matchedHeroine = HEROINE_OPTIONS.find((option) =>
      option.id === value
      || option.name === value
      || (option.id === 'q' && value === 'Q')
    );
    if (matchedHeroine) return matchedHeroine;
  }
  return null;
}

function isFixedGreenSpeaker(rawSpeaker, displaySpeaker = rawSpeaker) {
  const rawValue = String(rawSpeaker || '');
  const displayValue = String(displaySpeaker || rawValue);
  if (rawValue === '旁白' || displayValue === '旁白' || rawValue === '路人' || displayValue === '路人') return true;
  if (matchDialogueHeroine(rawValue, displayValue)) return false;
  const protagonistName = appState().profile?.protagonistName || DEFAULT_PROTAGONIST_NAME;
  return rawValue === DEFAULT_PROTAGONIST_NAME
    || rawValue === protagonistName
    || displayValue === protagonistName;
}

function resolveDialogueAccent(rawSpeaker, displaySpeaker, heroine) {
  const matchedHeroine = matchDialogueHeroine(rawSpeaker, displaySpeaker);
  if (matchedHeroine) return matchedHeroine.accent || '#8cbf72';
  if (heroine && !isFixedGreenSpeaker(rawSpeaker, displaySpeaker)) return heroine.accent || '#8cbf72';
  return '#8cbf72';
}

function drawPanel(x, y, w, h, body) {
  rounded(x, y, w, h, 14);
  ctx.fillStyle = 'rgba(255,255,255,.82)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(109,153,95,.42)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  wrapText(body, x + 18, y + 28, w - 36, 18, '#43506a', 15, 600, Math.max(1, Math.floor((h - 22) / 18)));
}

function drawPaper(x, y, w, h) {
  rounded(x, y, w, h, 14);
  ctx.fillStyle = '#fff8e8';
  ctx.fill();
  ctx.strokeStyle = 'rgba(116,144,75,.32)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(216,181,108,.2)';
  ctx.lineWidth = 1;
  for (let yy = y + 42; yy < y + h - 20; yy += 34) line(x + 22, yy, x + w - 22, yy);
}

function drawAsset(name, x, y, w, h) {
  const image = imageAssets[name];
  if (image && image.complete && image.naturalWidth) drawImageContain(image, x, y, w, h);
}

function drawImageContain(image, x, y, w, h) {
  const ratio = Math.min(w / image.naturalWidth, h / image.naturalHeight);
  const dw = image.naturalWidth * ratio;
  const dh = image.naturalHeight * ratio;
  ctx.drawImage(image, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

function drawImageCover(image, x, y, w, h) {
  const ratio = Math.max(w / image.naturalWidth, h / image.naturalHeight);
  const sw = w / ratio;
  const sh = h / ratio;
  const sx = (image.naturalWidth - sw) / 2;
  const sy = (image.naturalHeight - sh) / 2;
  ctx.drawImage(image, sx, sy, sw, sh, x, y, w, h);
}

function drawFoldedCorner(x, y, w, h, pointer, progress) {
  const fold = clamp(progress, 0, 1);
  const grip = { x: x + 16, y: y + 16 };
  const targetCorner = { x: x + w - 8, y: y + h - 8 };
  const fallbackTip = { x: x + 24 + fold * (w * 0.9), y: y + 24 + fold * (h * 0.9) };
  const live = pointer || fallbackTip;
  const tip = {
    x: fold > 0.96 ? targetCorner.x : clamp(live.x, x + 24, targetCorner.x),
    y: fold > 0.96 ? targetCorner.y : clamp(live.y, y + 24, targetCorner.y),
  };
  const topEdge = { x: x + 20 + fold * (w * 0.9), y };
  const leftEdge = { x, y: y + 20 + fold * (h * 0.9) };
  const shadowAlpha = 0.08 + fold * 0.12;

  if (fold < 0.02) {
    ctx.save();
    ctx.strokeStyle = 'rgba(133, 171, 95, .72)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(grip.x, grip.y, 11, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.72)';
    ctx.beginPath();
    ctx.arc(grip.x, grip.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  ctx.save();
  ctx.shadowColor = `rgba(97, 64, 28, ${shadowAlpha})`;
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 8;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(topEdge.x, topEdge.y);
  ctx.lineTo(tip.x, tip.y);
  ctx.lineTo(leftEdge.x, leftEdge.y);
  ctx.closePath();
  const flapFill = ctx.createLinearGradient(x, y, tip.x, tip.y);
  flapFill.addColorStop(0, '#f2dcba');
  flapFill.addColorStop(0.55, '#edd0a6');
  flapFill.addColorStop(1, '#dfbe91');
  ctx.fillStyle = flapFill;
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(topEdge.x, topEdge.y);
  ctx.lineTo(tip.x, tip.y);
  ctx.lineTo(leftEdge.x, leftEdge.y);
  ctx.closePath();
  ctx.clip();
  for (let i = 1; i <= 3; i += 1) {
    const start = {
      x: topEdge.x * (1 - i / 4) + leftEdge.x * (i / 4),
      y: topEdge.y * (1 - i / 4) + leftEdge.y * (i / 4),
    };
    const bend = 8 + fold * 18;
    ctx.strokeStyle = `rgba(157, 117, 73, ${0.12 + fold * 0.12})`;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.quadraticCurveTo(
      start.x + (tip.x - start.x) * 0.52 + (i - 2) * bend * 0.35,
      start.y + (tip.y - start.y) * 0.46 + (2 - i) * bend * 0.45,
      start.x + (tip.x - start.x) * 0.92,
      start.y + (tip.y - start.y) * 0.92,
    );
    ctx.stroke();
  }
  ctx.restore();

  ctx.strokeStyle = 'rgba(176, 129, 78, .68)';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(topEdge.x, topEdge.y);
  ctx.lineTo(leftEdge.x, leftEdge.y);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255, 247, 223, .68)';
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(topEdge.x + 7, topEdge.y + 3);
  ctx.lineTo(leftEdge.x + 3, leftEdge.y + 7);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(164, 119, 74, .54)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(topEdge.x, topEdge.y);
  ctx.lineTo(tip.x, tip.y);
  ctx.lineTo(leftEdge.x, leftEdge.y);
  ctx.stroke();

  ctx.fillStyle = 'rgba(255,255,255,.30)';
  ctx.beginPath();
  ctx.arc(tip.x, tip.y, 10, 0, Math.PI * 2);
  ctx.fill();
}

function drawBottomEnvelopeFlap(x, y, w, h, sealProgress) {
  const fold = clamp(sealProgress, 0, 1);
  if (fold <= 0) return;
  const bottomY = y + h;
  const lift = h * 0.36 * fold;
  const leftBase = { x: x + 24, y: bottomY - 2 };
  const rightBase = { x: x + w - 24, y: bottomY - 2 };
  const tip = { x: x + w / 2, y: bottomY - lift - 10 };

  ctx.save();
  ctx.shadowColor = `rgba(95, 68, 34, ${0.12 + fold * 0.1})`;
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = -2;
  ctx.beginPath();
  ctx.moveTo(leftBase.x, leftBase.y);
  ctx.quadraticCurveTo(x + w * 0.26, bottomY - lift * 0.25, tip.x, tip.y);
  ctx.quadraticCurveTo(x + w * 0.74, bottomY - lift * 0.25, rightBase.x, rightBase.y);
  ctx.closePath();
  const flapFill = ctx.createLinearGradient(x, bottomY, x, tip.y);
  flapFill.addColorStop(0, '#f0dcc0');
  flapFill.addColorStop(1, '#e3c79f');
  ctx.fillStyle = flapFill;
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = 'rgba(176, 129, 78, .72)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255, 247, 223, .7)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(leftBase.x + 10, bottomY - 10);
  ctx.quadraticCurveTo(x + w / 2, bottomY - lift * 0.75, rightBase.x - 10, bottomY - 10);
  ctx.stroke();
}

function drawPosterMailbox(x, y, s = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.shadowColor = 'rgba(8, 39, 31, .32)';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 10;
  rounded(10, 46, 90, 142, 12);
  ctx.fillStyle = '#0f4f3d';
  ctx.fill();
  ctx.shadowColor = 'transparent';
  rounded(0, 8, 110, 54, 26);
  ctx.fillStyle = '#0d3f32';
  ctx.fill();
  rounded(20, 72, 70, 15, 3);
  ctx.fillStyle = '#071f1a';
  ctx.fill();
  ctx.textAlign = 'center';
  text('风信邮筒', 55, 130, 13, '#f5efd1', 700);
  text('寄出遗憾', 55, 150, 11, '#e8d789', 600);
  rounded(45, 184, 20, 102, 5);
  ctx.fillStyle = '#174233';
  ctx.fill();
  ctx.restore();
}

function drawEnvelope(x, y, w, h) {
  rounded(x, y, w, h, 7);
  ctx.fillStyle = '#fff8e8';
  ctx.fill();
  ctx.strokeStyle = 'rgba(178,129,74,.45)';
  ctx.stroke();
  line(x, y, x + w / 2, y + h / 2);
  line(x + w, y, x + w / 2, y + h / 2);
}

function drawWindMeter() {
  const wind = (Math.sin(appState().windPhase || 0) + 1) / 2;
  drawPanel(46, 118, 298, 72, '顺风时投递，更容易收到温柔的回信。');
  centerText('风', 206, 15, '#3e4f68', 800, 195, {
    stroke: 'rgba(255, 252, 236, .9)',
    strokeWidth: 3,
  });
  text('逆', 68, 223, 13, '#607165', 700, {
    stroke: 'rgba(255, 252, 236, .88)',
    strokeWidth: 2,
  });
  text('顺', 320, 223, 13, '#607165', 700, {
    stroke: 'rgba(255, 252, 236, .88)',
    strokeWidth: 2,
  });
  rounded(80, 216, 230, 14, 7);
  ctx.fillStyle = 'rgba(255,255,255,.65)';
  ctx.fill();
  rounded(80, 216, 230 * wind, 14, 7);
  ctx.fillStyle = '#8bcf75';
  ctx.fill();
}

function drawParticles() {
  for (const p of appState().particles || []) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.spin);
    ctx.fillStyle = p.color;
    ctx.globalAlpha = clamp(p.life / 900, 0, 1);
    text(p.text, 0, 0, 18, p.color, 700);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

function drawCursorTrail() {
  const state = appState();
  for (const particle of state.cursorTrail || []) {
    const alpha = clamp(particle.life / particle.maxLife, 0, 1);
    ctx.save();
    ctx.translate(particle.x, particle.y);
    ctx.rotate(particle.rotation);
    ctx.globalAlpha = alpha * 0.72;
    ctx.fillStyle = particle.color;
    ellipse(0, 0, particle.size * 1.6, particle.size * 0.9);
    ctx.fill();
    ctx.globalAlpha = alpha * 0.38;
    ctx.fillStyle = '#fff9dd';
    ellipse(-particle.size * 0.18, -particle.size * 0.12, particle.size * 0.7, particle.size * 0.34);
    ctx.fill();
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

function drawPointerPressEffects() {
  const state = appState();
  for (const effect of state.clickEffects || []) {
    const alpha = clamp(effect.life / effect.maxLife, 0, 1);
    ctx.save();
    ctx.translate(effect.x, effect.y);
    if (effect.kind === 'ring') {
      ctx.globalAlpha = alpha * 0.8;
      ctx.strokeStyle = effect.color;
      ctx.lineWidth = Math.max(1.2, effect.lineWidth * (0.4 + alpha * 0.6));
      ctx.shadowColor = effect.glow;
      ctx.shadowBlur = 10 + alpha * 8;
      circle(0, 0, effect.radius);
      ctx.stroke();
      ctx.globalAlpha = alpha * 0.22;
      ctx.fillStyle = effect.glow;
      circle(0, 0, effect.radius * 0.44);
      ctx.fill();
      ctx.restore();
      continue;
    }
    ctx.rotate(effect.rotation);
    ctx.globalAlpha = alpha * 0.82;
    ctx.fillStyle = effect.color;
    ellipse(0, 0, effect.size * 1.35, effect.size * 0.56);
    ctx.fill();
    ctx.globalAlpha = alpha * 0.45;
    ctx.fillStyle = '#fff9db';
    ellipse(-effect.size * 0.2, -effect.size * 0.12, effect.size * 0.55, effect.size * 0.2);
    ctx.fill();
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

function drawCustomCursor() {
  const state = appState();
  const pointer = state.pointer || {};
  if (!pointer.visible || pointer.type === 'touch') return;
  const pulse = (Math.sin(state.time * 0.014) + 1) / 2;
  ctx.save();
  ctx.translate(pointer.x, pointer.y);
  ctx.rotate(-0.94 + Math.sin(state.time * 0.008) * 0.05);

  ctx.globalAlpha = pointer.down ? 0.24 : 0.18;
  ctx.fillStyle = '#fff2c2';
  ellipse(1, -1, 18 + pulse * 2, 12 + pulse * 1.4);
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(-1, -13);
  ctx.quadraticCurveTo(9, -10, 13, 0);
  ctx.quadraticCurveTo(8, 11, -3, 16);
  ctx.quadraticCurveTo(-13, 6, -11, -5);
  ctx.quadraticCurveTo(-8, -11, -1, -13);
  const featherGradient = ctx.createLinearGradient(-10, -12, 12, 16);
  featherGradient.addColorStop(0, '#fff6d6');
  featherGradient.addColorStop(0.4, '#ecd7a4');
  featherGradient.addColorStop(1, '#b88752');
  ctx.fillStyle = featherGradient;
  ctx.fill();
  ctx.strokeStyle = 'rgba(132, 94, 55, .92)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(252, 245, 227, .76)';
  ctx.lineWidth = 0.8;
  line(-7, -6, 9, 8);
  ctx.stroke();
  ctx.restore();

  ctx.strokeStyle = 'rgba(120, 82, 46, .95)';
  ctx.lineWidth = 1.5;
  line(-8, -7, 11, 10);
  ctx.stroke();

  ctx.save();
  ctx.translate(12.5, 11.5);
  const penMetal = ctx.createLinearGradient(-5, -3, 4, 5);
  penMetal.addColorStop(0, '#fff9ef');
  penMetal.addColorStop(0.45, '#d6b271');
  penMetal.addColorStop(1, '#8d6431');
  ctx.fillStyle = penMetal;
  ctx.beginPath();
  ctx.moveTo(-3.8, -2.6);
  ctx.lineTo(2.6, -1.4);
  ctx.lineTo(5.3, 0);
  ctx.lineTo(2.6, 1.4);
  ctx.lineTo(-3.8, 2.6);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(108, 74, 34, .94)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-1.4, -0.9);
  ctx.lineTo(2.8, 0);
  ctx.lineTo(-1.4, 0.9);
  ctx.stroke();
  ctx.restore();

  ctx.globalAlpha = 0.95;
  ctx.fillStyle = '#fffdf7';
  circle(0, 0, pointer.down ? 2.4 : 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(255, 251, 230, .9)';
  ctx.lineWidth = 1.1;
  line(-6, 0, -2.6, 0);
  ctx.stroke();
  line(6, 0, 2.6, 0);
  ctx.stroke();
  line(0, -6, 0, -2.6);
  ctx.stroke();
  line(0, 6, 0, 2.6);
  ctx.stroke();
  ctx.restore();
}

function drawLeaves() {
  const state = appState();
  for (let i = 0; i < 20; i++) {
    const x = (i * 67 + state.time * 0.012 * (i % 3 + 1)) % (VIRTUAL.w + 70) - 35;
    const y = 90 + ((i * 43 + Math.sin(state.windPhase + i) * 18) % 540);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.sin(state.windPhase + i) * 0.9);
    ctx.fillStyle = i % 2 ? 'rgba(118, 190, 92, .5)' : 'rgba(255, 218, 111, .42)';
    ellipse(0, 0, 10, 4);
    ctx.restore();
  }
}

function drawCard(x, y, w, h, outcome) {
  const resonance = appState().resonance || 0;
  rounded(x, y, w, h, 18);
  ctx.fillStyle = '#fff8e8';
  ctx.fill();
  ctx.strokeStyle = outcome.tone;
  ctx.lineWidth = 4;
  ctx.stroke();
  centerText('夏风回信卡', y + 44, 18, '#59647a', 800, x + w / 2);
  centerText(outcome.title, y + 94, 27, '#253047', 800, x + w / 2);
  centerText(`回信人：${outcome.recipient}`, y + 132, 16, '#59647a', 700, x + w / 2);
  wrapText(outcome.line, x + 34, y + 194, w - 68, 24, '#253047', 21, 700, 4);
  wrapText(`关键词：${outcome.keywords.join('、')}`, x + 34, y + 334, w - 68, 18, '#637553', 16, 700, 2);
  drawEndingResonanceLine(x + 34, y + 374, resonance);
  wrapText(`共鸣评价：${resonanceComment(resonance)}`, x + 34, y + 406, w - 68, 18, '#637553', 16, 700, 2);
  if (has328EasterEgg(resonance)) drawCard328EasterEgg(x, y, w);
  centerText('愿所有未寄出的信，都被温柔接住。', y + h - 48, 14, '#8a7560', 600, x + w / 2);
}

function drawShareCard(cardCtx, width, height, outcome, resonance, phrases) {
  const grad = cardCtx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, '#9edaf2');
  grad.addColorStop(0.55, '#fff0ba');
  grad.addColorStop(1, '#a9db88');
  cardCtx.fillStyle = grad;
  cardCtx.fillRect(0, 0, width, height);
  cardCtx.fillStyle = 'rgba(255,248,232,.94)';
  roundRect(cardCtx, 90, 140, 720, 1080, 36);
  cardCtx.fill();
  cardCtx.strokeStyle = outcome.tone;
  cardCtx.lineWidth = 10;
  cardCtx.stroke();
  cardCtx.textAlign = 'center';
  cardCtx.fillStyle = '#253047';
  cardCtx.font = `700 54px ${UI_FONT}`;
  cardCtx.fillText('夏风回信卡', width / 2, 250);
  cardCtx.font = `800 70px ${UI_FONT}`;
  cardCtx.fillText(outcome.title, width / 2, 370);
  cardCtx.font = `600 34px ${UI_FONT}`;
  cardCtx.fillStyle = '#59647a';
  cardCtx.fillText(`回信人：${outcome.recipient}`, width / 2, 440);
  drawWrapped(cardCtx, outcome.line, 150, 560, 600, 48, '#253047', `700 42px ${UI_FONT}`);
  drawWrapped(cardCtx, `你寄出的句子：${phrases.join(' / ')}`, 150, 810, 600, 34, '#637553', `500 28px ${UI_FONT}`);
  cardCtx.textAlign = 'center';
  cardCtx.font = `600 32px ${UI_FONT}`;
  cardCtx.fillStyle = '#637553';
  cardCtx.fillText(`关键词：${outcome.keywords.join('、')}`, width / 2, 1018);
  drawShareResonanceLine(cardCtx, width / 2, 1068, resonance);
  drawWrapped(cardCtx, `共鸣评价：${resonanceComment(resonance)}`, 150, 1106, 600, 30, '#637553', `600 24px ${UI_FONT}`);
  if (has328EasterEgg(resonance)) drawShareCard328EasterEgg(cardCtx, width, height);
  cardCtx.font = `500 28px ${UI_FONT}`;
  cardCtx.fillText('《风信来信：风信邮筒》', width / 2, 1148);
}

function has328EasterEgg(score) {
  return score === 328;
}

function drawCard328EasterEgg(x, y, w) {
  centerText('恭喜你达成了完美攻略！', y + 476, 12, '#b17834', 800, x + w / 2, {
    stroke: 'rgba(255, 248, 226, .86)',
    strokeWidth: 2,
  });
}

function drawShareCard328EasterEgg(cardCtx, width, height) {
  drawWrapped(cardCtx, '恭喜你达成了完美攻略！', 150, 1174, 600, 28, '#b17834', `800 24px ${UI_FONT}`);
}

function drawEndingResonanceLine(x, y, resonance) {
  const label = '夏风共鸣度：';
  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `700 16px ${UI_FONT}`;
  ctx.fillStyle = '#637553';
  ctx.fillText(label, x, y);
  const labelWidth = ctx.measureText(label).width;
  if (has328EasterEgg(resonance)) {
    drawGoldScoreText(ctx, String(resonance), x + labelWidth + 6, y, 19, 'left');
  } else {
    ctx.fillText(String(resonance), x + labelWidth + 6, y);
  }
  ctx.restore();
}

function drawShareResonanceLine(targetCtx, centerX, y, resonance) {
  const label = '共鸣度：';
  targetCtx.save();
  targetCtx.textAlign = 'left';
  targetCtx.textBaseline = 'alphabetic';
  targetCtx.font = `600 32px ${UI_FONT}`;
  const labelWidth = targetCtx.measureText(label).width;
  let valueWidth = targetCtx.measureText(String(resonance)).width;
  if (has328EasterEgg(resonance)) {
    targetCtx.font = `900 38px ${UI_FONT}`;
    valueWidth = targetCtx.measureText(String(resonance)).width;
    targetCtx.font = `600 32px ${UI_FONT}`;
  }
  const startX = centerX - (labelWidth + valueWidth + 12) / 2;
  targetCtx.fillStyle = '#637553';
  targetCtx.fillText(label, startX, y);
  if (has328EasterEgg(resonance)) {
    drawGoldScoreText(targetCtx, String(resonance), startX + labelWidth + 12, y, 38, 'left');
  } else {
    targetCtx.fillText(String(resonance), startX + labelWidth + 12, y);
  }
  targetCtx.restore();
}

function drawGoldScoreText(targetCtx, value, x, y, size, align = 'left') {
  targetCtx.save();
  const gold = targetCtx.createLinearGradient(x, 0, x + size * 3.6, 0);
  gold.addColorStop(0, '#a76410');
  gold.addColorStop(0.35, '#f6c65a');
  gold.addColorStop(0.55, '#fff4b8');
  gold.addColorStop(0.78, '#f2bd48');
  gold.addColorStop(1, '#b26f18');
  targetCtx.textAlign = align;
  targetCtx.textBaseline = 'alphabetic';
  targetCtx.font = `900 ${size}px ${UI_FONT}`;
  targetCtx.lineJoin = 'round';
  targetCtx.shadowColor = 'rgba(255, 233, 159, .42)';
  targetCtx.shadowBlur = Math.max(4, size * 0.3);
  targetCtx.strokeStyle = 'rgba(92, 54, 10, .7)';
  targetCtx.lineWidth = Math.max(4, size * 0.22);
  targetCtx.strokeText(value, x, y);
  targetCtx.shadowBlur = 0;
  targetCtx.strokeStyle = 'rgba(255, 248, 220, .92)';
  targetCtx.lineWidth = Math.max(1.5, size * 0.08);
  targetCtx.strokeText(value, x, y);
  targetCtx.fillStyle = gold;
  targetCtx.fillText(value, x, y);
  targetCtx.restore();
}

function drawViewportBackground(width, height) {
  const fill = ctx.createLinearGradient(0, 0, 0, height);
  fill.addColorStop(0, '#9edaf2');
  fill.addColorStop(0.55, '#fff0ba');
  fill.addColorStop(1, '#a9db88');
  ctx.fillStyle = fill;
  ctx.fillRect(0, 0, width, height);
}

function darken(alpha) {
  ctx.fillStyle = `rgba(255,255,255,${alpha})`;
  ctx.fillRect(0, 0, VIRTUAL.w, VIRTUAL.h);
}

function drawTitlePlaque(x, y, w, h, alpha = 0.52) {
  ctx.save();
  ctx.shadowColor = 'rgba(78, 98, 63, .14)';
  ctx.shadowBlur = 20;
  ctx.shadowOffsetY = 6;
  rounded(x, y, w, h, 24);
  ctx.fillStyle = `rgba(255, 249, 233, ${alpha})`;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  rounded(x + 8, y + 8, w - 16, h - 16, 18);
  ctx.fillStyle = 'rgba(255, 255, 255, .18)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(250, 239, 198, .82)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

function loadProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return { protagonistName: DEFAULT_PROTAGONIST_NAME, bestResonance: 0 };
    const parsed = JSON.parse(raw);
    return {
      protagonistName: typeof parsed.protagonistName === 'string' && parsed.protagonistName.trim()
        ? parsed.protagonistName.trim().slice(0, 8)
        : DEFAULT_PROTAGONIST_NAME,
      bestResonance: Number.isFinite(parsed.bestResonance) ? parsed.bestResonance : 0,
    };
  } catch {
    return { protagonistName: DEFAULT_PROTAGONIST_NAME, bestResonance: 0 };
  }
}

function saveProfile(profile) {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify({
      protagonistName: profile.protagonistName || DEFAULT_PROTAGONIST_NAME,
      bestResonance: profile.bestResonance || 0,
    }));
  } catch {
    // Single-session play still works when storage is unavailable.
  }
}

function bindSavePreview() {
  savePreviewClose?.addEventListener('click', hideSavePreview);
  savePreview?.addEventListener('click', (event) => {
    if (Date.now() - savePreviewOpenedAt < 320) return;
    if (event.target === savePreview) hideSavePreview();
  });
}

function bindRenameDialog() {
  renameCancel?.addEventListener('click', hideRenameDialog);
  renameDialog?.addEventListener('click', (event) => {
    if (Date.now() - renameDialogOpenedAt < 320) return;
    if (event.target === renameDialog) hideRenameDialog();
  });
  renameDialogPanel?.addEventListener('submit', (event) => {
    event.preventDefault();
    const next = String(renameInput?.value || '').trim().slice(0, 8) || DEFAULT_PROTAGONIST_NAME;
    renameDialogSubmitAction?.(next);
    hideRenameDialog();
  });
}

function showRenameDialog(currentName, onSubmit) {
  renameDialogSubmitAction = typeof onSubmit === 'function' ? onSubmit : null;
  if (renameInput) {
    renameInput.value = currentName || '';
    renameInput.placeholder = DEFAULT_PROTAGONIST_NAME;
  }
  renameDialogOpenedAt = Date.now();
  if (renameDialog) renameDialog.hidden = false;
  window.setTimeout(() => {
    renameInput?.focus?.();
    renameInput?.select?.();
  }, 30);
}

function hideRenameDialog() {
  renameDialogSubmitAction = null;
  if (renameDialog) renameDialog.hidden = true;
  renameInput?.blur?.();
}

function showSavePreview(dataUrl, fileName, options = {}) {
  if (!savePreview || !savePreviewImage || !savePreviewDownload || !savePreviewOpen) return;
  releaseSavePreviewObjectUrl();
  if (String(dataUrl).startsWith('blob:')) savePreviewObjectUrl = dataUrl;
  const openUrl = options.openUrl || dataUrl;
  savePreviewImage.src = dataUrl;
  savePreviewOpen.href = openUrl;
  savePreviewOpen.target = isRestrictedImageSaveContainer() ? '_self' : '_blank';
  savePreviewDownload.href = dataUrl;
  savePreviewDownload.download = fileName;
  if (savePreviewHint) {
    savePreviewHint.textContent = options.hint || (isTouchLikeDevice()
      ? '手机上可长按图片保存到相册，也可以点“下载图片”后再保存。'
      : '如果浏览器没有直接下载，也可以右键或另存这张图片。');
  }
  savePreviewOpenedAt = Date.now();
  savePreview.hidden = false;
}

function hideSavePreview() {
  if (savePreview) savePreview.hidden = true;
  if (savePreviewImage) savePreviewImage.src = '';
  if (savePreviewOpen) savePreviewOpen.href = '#';
  if (savePreviewDownload) savePreviewDownload.href = '#';
  releaseSavePreviewObjectUrl();
}

function isTouchLikeDevice() {
  return (navigator.maxTouchPoints || 0) > 0
    || window.matchMedia?.('(pointer: coarse)')?.matches
    || /Android|iPhone|iPad|iPod|HarmonyOS|Mobile/i.test(navigator.userAgent || '');
}

function isRestrictedImageSaveContainer() {
  return /aweme|douyin|ttwebview|snssdk|toutiao/i.test(navigator.userAgent || '');
}

function releaseSavePreviewObjectUrl() {
  if (!savePreviewObjectUrl) return;
  URL.revokeObjectURL(savePreviewObjectUrl);
  savePreviewObjectUrl = '';
}

function buildCardFileName(title = '回信卡', extension = 'png') {
  const safeTitle = String(title || '回信卡').replace(/[\\/:*?"<>|]/g, '').trim() || '回信卡';
  const normalizedExtension = String(extension || 'png').toLowerCase() === 'jpg' ? 'jpg' : 'png';
  return `风信来信-${safeTitle}.${normalizedExtension}`;
}

function normalizeCardFileName(fileName) {
  const rawName = String(fileName || '').trim() || '风信来信-回信卡.png';
  if (/\.(png|jpe?g)$/i.test(rawName)) return rawName;
  return `${rawName}.png`;
}

function inferCardMimeType(fileName) {
  return /\.jpe?g$/i.test(String(fileName || '')) ? 'image/jpeg' : 'image/png';
}

function canvasToBlob(canvas, mimeType, quality = 0.92) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), mimeType, quality);
  });
}

async function canvasToFile(canvas, fileName, mimeType) {
  const blob = await canvasToBlob(canvas, mimeType, mimeType === 'image/jpeg' ? 0.92 : 1);
  if (!blob) return null;
  if (typeof File !== 'undefined') return new File([blob], fileName, { type: mimeType });
  return new Blob([blob], { type: mimeType });
}

function dataUrlToFile(dataUrl, fileName) {
  try {
    const [header, body] = String(dataUrl).split(',');
    if (!header || !body) return null;
    const mime = header.match(/data:(.*?);base64/)?.[1] || 'image/png';
    const binary = atob(body);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    if (typeof File !== 'undefined') return new File([bytes], fileName, { type: mime });
    return new Blob([bytes], { type: mime });
  } catch {
    return null;
  }
}

function replaceProtagonistName(value) {
  if (value == null) return '';
  return String(value).split(DEFAULT_PROTAGONIST_NAME).join(appState().profile?.protagonistName || DEFAULT_PROTAGONIST_NAME);
}

function resonanceComment(score) {
  if (score >= 180) return '几乎没有错过，这一封信终于稳稳落进了对方心里。';
  if (score >= 150) return '你接住了那阵夏风，也接住了迟到很久的回应。';
  if (score >= 120) return '那些绕远的心事，终于开始朝彼此靠近。';
  if (score >= 90) return '风已经替你推开了一点门，剩下的话也许还能慢慢说。';
  if (score >= 60) return '你把心意寄了出去，只是还差一点勇气让它抵达。';
  return '这封信先落回了自己手里，但夏风会记得你曾认真写下它。';
}

function adaptHeroineText(value, heroine = appState().selectedHeroineId ? appState().selectedHeroineId : null) {
  if (value == null) return '';
  const targetHeroine = typeof heroine === 'string'
    ? HEROINE_OPTIONS.find((option) => option.id === heroine) || HEROINE_OPTIONS[0]
    : heroine || HEROINE_OPTIONS[0];
  const source = String(value).replaceAll('Q', targetHeroine.name);
  if (targetHeroine.gender !== 'male') return source;
  return source
    .replaceAll('女主', '男主')
    .replaceAll('她的', '他的')
    .replaceAll('她', '他');
}

function loadImageAssets(sources) {
  const images = {};
  for (const [key, src] of Object.entries(sources)) {
    const image = new Image();
    image.decoding = 'async';
    image.src = src;
    images[key] = image;
  }
  return images;
}

function createBgmAudio(src) {
  try {
    const audio = new Audio(src);
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = 0.58;
    return audio;
  } catch {
    return null;
  }
}

function showFatal(error) {
  console.error(error);
  if (errorBox) {
    errorBox.textContent = ERROR_TEXT;
    errorBox.hidden = false;
  }
}

function pointInRect(point, rect) {
  return point.x >= rect.x && point.x <= rect.x + rect.w && point.y >= rect.y && point.y <= rect.y + rect.h;
}

function projectFoldProgress(point, x, y, w, h) {
  const target = { x: x + w * 0.78, y: y + h * 0.76 };
  const vx = target.x - x;
  const vy = target.y - y;
  const wx = point.x - x;
  const wy = point.y - y;
  return clamp((wx * vx + wy * vy) / (vx * vx + vy * vy), 0, 1);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function shuffleArray(items) {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
}

function rounded(x, y, w, h, r) {
  roundRect(ctx, x, y, w, h, r);
}

function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

function ellipse(x, y, rx, ry) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

function circle(x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function line(x1, y1, x2, y2) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function centerText(value, y, size, color, weight = 500, x = VIRTUAL.w / 2, effects = {}) {
  ctx.textAlign = 'center';
  text(value, x, y, size, color, weight, effects);
}

function fittedCenterText(value, y, maxWidth, maxHeight, size, color, weight = 500, x = VIRTUAL.w / 2, effects = {}) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x - maxWidth / 2 - 2, y - maxHeight / 2, maxWidth + 4, maxHeight);
  ctx.clip();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let fontSize = size;
  ctx.font = `${weight} ${fontSize}px ${UI_FONT}`;
  while (ctx.measureText(value).width > maxWidth && fontSize > 11) {
    fontSize -= 1;
    ctx.font = `${weight} ${fontSize}px ${UI_FONT}`;
  }
  ctx.fillStyle = color;
  if (effects.shadow) {
    ctx.shadowColor = effects.shadow;
    ctx.shadowBlur = 3;
    ctx.shadowOffsetY = 1;
  }
  if (effects.stroke) {
    ctx.lineWidth = effects.strokeWidth || 2;
    ctx.strokeStyle = effects.stroke;
    ctx.strokeText(value, x, y);
  }
  ctx.fillText(value, x, y);
  ctx.restore();
}

function text(value, x, y, size, color, weight = 500, effects = {}) {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px ${UI_FONT}`;
  ctx.textBaseline = 'middle';
  if (effects.shadow) {
    ctx.shadowColor = effects.shadow;
    ctx.shadowBlur = 3;
    ctx.shadowOffsetY = 1;
  }
  if (effects.stroke) {
    ctx.lineWidth = effects.strokeWidth || 2;
    ctx.strokeStyle = effects.stroke;
    ctx.strokeText(value, x, y);
  }
  ctx.fillText(value, x, y);
  ctx.shadowColor = 'transparent';
}

function clippedText(value, x, y, maxWidth, maxHeight, size, color, weight = 500, effects = {}) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x - 2, y - maxHeight / 2, maxWidth + 4, maxHeight);
  ctx.clip();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  let fontSize = size;
  ctx.font = `${weight} ${fontSize}px ${UI_FONT}`;
  while (ctx.measureText(value).width > maxWidth && fontSize > 11) {
    fontSize -= 1;
    ctx.font = `${weight} ${fontSize}px ${UI_FONT}`;
  }
  ctx.fillStyle = color;
  if (effects.shadow) {
    ctx.shadowColor = effects.shadow;
    ctx.shadowBlur = 3;
    ctx.shadowOffsetY = 1;
  }
  if (effects.stroke) {
    ctx.lineWidth = effects.strokeWidth || 2;
    ctx.strokeStyle = effects.stroke;
    ctx.strokeText(value, x, y);
  }
  ctx.fillText(value, x, y);
  ctx.restore();
}

function wrapText(value, x, y, maxWidth, lineHeight, color, size = 15, weight = 500, maxLines = 99) {
  ctx.textAlign = 'left';
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px ${UI_FONT}`;
  ctx.textBaseline = 'middle';
  let lines = 0;
  for (const paragraph of String(value).split('\n')) {
    const chars = [...paragraph];
    let lineValue = '';
    for (const char of chars) {
      const next = lineValue + char;
      if (ctx.measureText(next).width > maxWidth && lineValue) {
        if (lines >= maxLines) return;
        ctx.fillText(lineValue, x, y);
        y += lineHeight;
        lines += 1;
        lineValue = char;
      } else {
        lineValue = next;
      }
    }
    if (lineValue && lines < maxLines) {
      ctx.fillText(lineValue, x, y);
      y += lineHeight;
      lines += 1;
    }
  }
}

function drawWrapped(c, value, x, y, maxWidth, lineHeight, color, font) {
  c.textAlign = 'left';
  c.fillStyle = color;
  c.font = font;
  const chars = [...String(value)];
  let lineValue = '';
  for (const char of chars) {
    const next = lineValue + char;
    if (c.measureText(next).width > maxWidth && lineValue) {
      c.fillText(lineValue, x, y);
      y += lineHeight;
      lineValue = char;
    } else {
      lineValue = next;
    }
  }
  if (lineValue) c.fillText(lineValue, x, y);
}
