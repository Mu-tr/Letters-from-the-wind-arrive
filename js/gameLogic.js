(function () {
  const KEYWORDS = ['遗憾', '歉意', '喜欢', '逃避', '勇气', '自由'];

  const PHRASES = [
    { id: 'sorry_day', text: '那天我其实想道歉。', weights: { '歉意': 3, '遗憾': 2 }, affinity: { regret: 2, honesty: 2 } },
    { id: 'summer_memory', text: '我一直记得那个夏天。', weights: { '遗憾': 2, '喜欢': 2 }, affinity: { qFavor: 1, regret: 1 } },
    { id: 'silence_escape', text: '如果沉默能解决一切就好了。', weights: { '逃避': 3, '遗憾': 1 }, affinity: { distance: 2, regret: 1 } },
    { id: 'say_all', text: '这一次，我想把话说完。', weights: { '勇气': 3, '喜欢': 1 }, affinity: { honesty: 2, qFavor: 1 } },
    { id: 'not_fault', text: '也许我们都不该一直责怪自己。', weights: { '歉意': 2, '勇气': 2 }, affinity: { honesty: 1, regret: 1 } },
    { id: 'free_once', text: '我想为自己活一次。', weights: { '自由': 2, '勇气': 2 }, affinity: { honesty: 1 } },
    { id: 'still_like', text: '我还是想靠近你。', weights: { '喜欢': 3, '勇气': 1 }, affinity: { qFavor: 2, honesty: 1 } },
    { id: 'past_self', text: '如果能见到过去的自己，我想抱抱他。', weights: { '遗憾': 3, '歉意': 1 }, affinity: { regret: 2, honesty: 1 } },
  ];

  const COMMON_ROUTE = [
    { bg: 'bg-classroom', speaker: '旁白', char: 'char-lu', text: '二月的期末考试结束后，寒假像一张空白信纸，轻轻铺在陆小锋面前。' },
    { bg: 'bg-library', speaker: '旁白', char: 'char-lu', text: '他仍旧独来独往，在教室、图书馆和老梧桐林之间安静地移动。' },
    { bg: 'bg-forest', speaker: '路人', char: '', text: '听说了吗？梧桐林深处有一座风信邮筒，能把没说出口的话寄给过去。' },
    { bg: 'bg-mailbox', speaker: '陆小锋', char: 'char-lu', text: '如果真的能寄到过去……我想给那个人写一封迟到的信。' },
    { bg: 'bg-forest', speaker: 'Q', char: 'char-q', text: '你也在找那座邮筒？别摆出一副“我只是路过”的表情啦。' },
    { bg: 'bg-library', speaker: '黄诗琪', char: 'char-shiqi', text: '有些话一直压在心里，会比错过本身更沉。你可以慢慢说。' },
    { bg: 'bg-rooftop', speaker: '刘俊岑', char: 'char-liu', text: '不是所有遗憾都要被大声宣布。被自己看见，也算一种开始。' },
    { bg: 'bg-mailbox', speaker: '旁白', char: 'char-q', text: '他们都曾把信投进风信邮筒，也都藏着无法释怀的盛夏遗憾。' },
    { bg: 'bg-classroom', speaker: '系统', char: 'char-lu', text: '真正开始之前，先回到同学录翻开的那一天。你的选择，会写进最后寄出的信。' },
  ];

  const STORY_SCENES = [
    {
      id: 'classroom_likes',
      title: '场景一：教室',
      page: '喜欢的东西',
      bg: 'bg-classroom',
      char: 'char-q',
      intro: '高一开学后的自习课。同学录从前排传来，她把本子递到陆小锋桌上。',
      reveal: '场末揭示：陆小锋其实还留着初中时写给她、但没有交出去的同学录页。',
      beats: [
        {
          speaker: 'Q',
          text: '这次别又写到一半就不见了。',
          choices: [
            { label: '叫她初中绰号', reply: '“小汽水？你居然还记得这本。”她愣了一下，笑意先藏进眼睛里。', effect: { qFavor: 2, regret: 1 } },
            { label: '正式打招呼', reply: '“好久不见，Q。”距离礼貌得像刚擦过的黑板。', effect: { honesty: 1, distance: 1 } },
            { label: '故作玩笑', reply: '“这次保证不潜逃。”话说轻了，心却没有跟着轻起来。', effect: { qFavor: 1, distance: 1 } },
          ],
        },
        {
          speaker: '旁白',
          text: '同学录第一页写着“喜欢的东西”。她的笔尖停在饮料一栏。',
          choices: [
            { label: '承认还记得她喜欢的饮料', reply: '“橘子汽水，少冰。”她小声说：“你还记得啊。”', effect: { qFavor: 2, honesty: 1 } },
            { label: '假装忘记', reply: '“应该……是可乐？”她没有拆穿，只把答案写得很慢。', effect: { regret: 1, distance: 2 } },
            { label: '反问她现在喜欢什么', reply: '“那你现在呢？”她转过头，像把几年空白也递了回来。', effect: { qFavor: 1, honesty: 1 } },
          ],
        },
        {
          speaker: '陆小锋',
          text: '轮到他写“喜欢的东西”了。真实答案在笔尖发烫。',
          choices: [
            { label: '写真实答案', reply: '他写下“橘子汽水、旧操场、和没说完的话”。', effect: { qFavor: 2, honesty: 2, regret: 1 } },
            { label: '写安全答案', reply: '他写下“漫画、音乐、睡觉”。每个字都很安全，也很远。', effect: { distance: 2 } },
            { label: '问她是否还留着初中的东西', reply: '她说：“有啊。只是有一页，一直没等到。”', effect: { regret: 2, honesty: 1 } },
          ],
        },
      ],
    },
    {
      id: 'rainy_library',
      title: '场景二：走廊与图书角',
      page: '想去的地方',
      bg: 'bg-library',
      char: 'char-q',
      intro: '高二某个雨天放学后，雨把两人困在走廊和图书角附近。',
      reveal: '场末揭示：女主当年以为陆小锋是故意没有留下联系方式。',
      beats: [
        {
          speaker: 'Q',
          text: '“想去的地方”……你还记得吗？初中时我们说过要一起去看海。',
          choices: [
            { label: '接住看海的话题', reply: '“记得。还说要在退潮的时候捡贝壳。”雨声忽然变得很近。', effect: { qFavor: 2, regret: 1, honesty: 1 } },
            { label: '用玩笑转移', reply: '“那时候谁没说过想看海。”她合上本子，指尖停得很轻。', effect: { distance: 2, regret: 1 } },
            { label: '说约定只是随口一提', reply: '她看着窗外：“原来你是这么想的。”', effect: { distance: 3, regret: 1 } },
          ],
        },
        {
          speaker: '旁白',
          text: '图书角的灯亮起来，雨水沿着玻璃一行一行往下写。',
          choices: [
            { label: '邀请她周末去旧书店', reply: '“如果雨停了，去旧书店吧。那里有海边摄影集。”她点头。', effect: { qFavor: 2, honesty: 1 } },
            { label: '只递过去一把伞', reply: '伞柄在两人之间停住，像一个没有说出口的邀请。', effect: { qFavor: 1, regret: 1 } },
            { label: '低头整理书包', reply: '他错过了她抬头的一瞬间，也错过了一句“可以一起走吗”。', effect: { distance: 2, regret: 1 } },
          ],
        },
        {
          speaker: 'Q',
          text: '“初中毕业后，你为什么突然不见了？”',
          choices: [
            { label: '认真道歉', reply: '“对不起。我以为沉默比较不麻烦，却让你等了那么久。”', effect: { qFavor: 2, regret: 2, honesty: 2 } },
            { label: '解释搬家和号码丢失', reply: '他说得很慢。她听完后，雨也慢了下来。', effect: { qFavor: 1, honesty: 2 } },
            { label: '说都过去了', reply: '“嗯，过去了。”她这样回答，可眼神并没有过去。', effect: { distance: 2, regret: 2 } },
          ],
        },
      ],
    },
    {
      id: 'graduation_photo',
      title: '场景三：高考后拍毕业照',
      page: '毕业留言',
      bg: 'bg-rooftop',
      char: 'char-q',
      intro: '高考结束后的返校日，操场上到处是签名、合照和被风吹乱的校服。',
      reveal: '场末揭示：那张没交出去的旧同学录页，终于到了可以交出的时刻。',
      beats: [
        {
          speaker: 'Q',
          text: '毕业照这次别躲到最后一排了。',
          choices: [
            { label: '站近一点', reply: '他往前站了一步，肩膀几乎碰到她的袖口。', effect: { qFavor: 2, honesty: 1 } },
            { label: '退到最后一排', reply: '人群把她的身影隔开，他又一次站在了安全的位置。', effect: { distance: 3, regret: 1 } },
            { label: '说“你站哪我站哪”', reply: '她假装嫌弃地笑了：“现在才这么会说？”', effect: { qFavor: 2, honesty: 1 } },
          ],
        },
        {
          speaker: '旁白',
          text: '风把她额前的刘海吹乱，摄影老师开始倒数。',
          choices: [
            { label: '帮她整理刘海', reply: '他伸手的瞬间，两个人都安静了一秒。快门声替他们记住了。', effect: { qFavor: 2, honesty: 1 } },
            { label: '提醒她自己整理', reply: '“刘海乱了。”她抬手整理，笑着说：“谢谢。”', effect: { qFavor: 1 } },
            { label: '假装没看见', reply: '照片里的风很明显，他的犹豫也很明显。', effect: { distance: 2, regret: 1 } },
          ],
        },
        {
          speaker: 'Q',
          text: '她把同学录最后一页递来：“毕业留言，写点真的吧。”',
          choices: [
            { label: '写一句真心话', reply: '“我喜欢的东西，原来一直都没有变。”她看了很久，眼眶有一点亮。', effect: { qFavor: 3, honesty: 3 } },
            { label: '写道歉', reply: '“对不起，让你等过一页空白。”她轻轻说：“这次我收到了。”', effect: { qFavor: 2, regret: 2, honesty: 2 } },
            { label: '交出旧同学录页', reply: '旧纸页被风吹起一角。那年没交出去的话，终于落到她手心。', effect: { qFavor: 3, regret: 3, honesty: 2 } },
            { label: '写安全祝福', reply: '“毕业快乐，前程似锦。”字很漂亮，像一扇关好的门。', effect: { distance: 2, regret: 1 } },
          ],
        },
      ],
    },
  ];

  const OUTCOMES = [
    { id: 'graduation_side_by_side', minResonance: 274, recipient: 'Q', title: '并肩的毕业照', tone: '#8bcf75', line: '这一次你没有躲到最后一排。照片里的距离，终于比遗憾更近。', keywords: ['喜欢', '勇气'] },
    { id: 'late_classmate_page', minResonance: 170, recipient: 'Q', title: '迟到的同学录', tone: '#ffb35c', line: '那页迟到很多年的答案，终于被她认真读完。', keywords: ['遗憾', '歉意'] },
    { id: 'unposted_first_page', minResonance: 66, recipient: '旧同学录', title: '没寄出的第一页', tone: '#c9b5ff', line: '你还在练习把真心写出来。空白没有责怪你，它只是等下一次落笔。', keywords: ['遗憾', '逃避'] },
    { id: 'last_row_wind', minResonance: 0, recipient: '夏风', title: '最后一排的风', tone: '#b8c2cc', line: '风吹过最后一排，把那些没说出口的话又轻轻还给你。', keywords: ['逃避'] },
    { id: 'orange_soda_sea', minResonance: 222, recipient: 'Q', title: '橘子汽水与海', tone: '#9fc7ff', line: '喜欢的东西、想去的地方、毕业留言，都在同一阵夏风里接上了。', keywords: ['喜欢', '自由'] },
    { id: 'summer_reply', minResonance: 118, recipient: '风信邮筒', title: '夏风回信', tone: '#ffd6a5', line: '不是所有答案都会立刻出现，但愿意寄出本身就是改变。', keywords: ['勇气'] },
  ];

  function createInitialRun() {
    return {
      selectedPhrases: [],
      weights: {},
      affinity: createAffinity(),
      foldScore: 0,
      windScore: 0,
    };
  }

  function createAffinity() {
    return { qFavor: 0, regret: 0, honesty: 0, distance: 0 };
  }

  function applyChoiceEffect(run, effect = {}) {
    return {
      ...run,
      affinity: mergeAffinity(run.affinity, effect),
    };
  }

  function updateWeights(run, selectedPhrases) {
    const weights = {};
    let affinity = run.affinity || createAffinity();
    for (const phrase of selectedPhrases) {
      for (const [key, value] of Object.entries(phrase.weights)) {
        weights[key] = (weights[key] || 0) + value;
      }
      affinity = mergeAffinity(affinity, phrase.affinity || {});
    }
    return {
      ...run,
      selectedPhrases: selectedPhrases.map((phrase) => phrase.text),
      weights,
      affinity,
    };
  }

  function calculateResonance(run) {
    const affinity = run.affinity || createAffinity();
    const emotionalCore = affinity.qFavor * 7 + affinity.honesty * 7 - affinity.regret * 5 - affinity.distance * 5;
    const windBonus = Math.min(run.windScore || 0, 80) * 0.18;
    return Math.max(0, Math.round(70 + emotionalCore + windBonus));
  }

  function chooseOutcome(run) {
    const weights = run.weights || {};
    const affinity = run.affinity || createAffinity();
    const regretScore = affinity.regret + (weights['遗憾'] || 0) + (weights['歉意'] || 0);
    const warmth = affinity.qFavor + (weights['喜欢'] || 0);
    const honesty = affinity.honesty + (weights['勇气'] || 0);
    const distance = affinity.distance + (weights['逃避'] || 0);
    const resonance = calculateResonance(run);
    const graduation = byId('graduation_side_by_side');
    const orangeSodaSea = byId('orange_soda_sea');
    const lateClassmatePage = byId('late_classmate_page');
    const summerReply = byId('summer_reply');
    const unpostedFirstPage = byId('unposted_first_page');

    if (resonance >= graduation.minResonance && warmth >= 12 && honesty >= 10 && distance <= 4) return graduation;
    if (resonance >= orangeSodaSea.minResonance && warmth >= 9 && honesty >= 8 && distance <= 5 && (weights['自由'] || 0) > 0) return orangeSodaSea;
    if (resonance >= lateClassmatePage.minResonance && warmth >= 10 && regretScore >= 12) return lateClassmatePage;
    if (resonance >= summerReply.minResonance) return summerReply;
    if (resonance >= unpostedFirstPage.minResonance && regretScore >= 10) return unpostedFirstPage;
    return byId('last_row_wind');
  }

  function addCollectionRecord(collection, outcome, selectedPhrases, resonance, affinity = createAffinity()) {
    const unlocked = collection.unlocked.includes(outcome.id)
      ? collection.unlocked
      : [...collection.unlocked, outcome.id];
    const record = {
      id: `${outcome.id}-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      outcomeId: outcome.id,
      title: outcome.title,
      recipient: outcome.recipient,
      line: outcome.line,
      keywords: outcome.keywords,
      selectedPhrases,
      resonance,
      affinity,
      createdAt: new Date().toLocaleString('zh-CN'),
    };
    return {
      unlocked,
      records: [record, ...collection.records].slice(0, 24),
    };
  }

  function mergeAffinity(base = createAffinity(), effect = {}) {
    return {
      qFavor: (base.qFavor || 0) + (effect.qFavor || 0),
      regret: (base.regret || 0) + (effect.regret || 0),
      honesty: (base.honesty || 0) + (effect.honesty || 0),
      distance: (base.distance || 0) + (effect.distance || 0),
    };
  }

  function byId(id) {
    return OUTCOMES.find((outcome) => outcome.id === id) || OUTCOMES[0];
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  window.SummerGameLogic = {
    KEYWORDS,
    PHRASES,
    COMMON_ROUTE,
    STORY_SCENES,
    OUTCOMES,
    addCollectionRecord,
    applyChoiceEffect,
    calculateResonance,
    chooseOutcome,
    createAffinity,
    createInitialRun,
    updateWeights,
  };
})();
