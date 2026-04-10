(function () {
  "use strict";

  const STORAGE_KEY = "airadar_v1";
  const RESULT_KEY = "airadar_result_v1";

  const DIMENSIONS = {
    cognition: { label: "AI 认知", short: "认知" },
    practice: { label: "AI 实践", short: "实践" },
    domain: { label: "专业应用", short: "专业" },
    habit: { label: "协作习惯", short: "习惯" },
  };

  /** @type {{ id: string, dim: keyof typeof DIMENSIONS, text: string }[]} */
  const QUESTIONS = [
    { id: "c1", dim: "cognition", text: "我能说清「大模型概率输出」和「传统确定性程序」的本质区别。" },
    { id: "c2", dim: "cognition", text: "我理解上下文窗口有限时，需要拆分任务或外挂记忆（如文档、知识库）。" },
    { id: "c3", dim: "cognition", text: "我知道「幻觉」常见成因，并会在关键结论上要求可核验来源或自行核对。" },
    { id: "c4", dim: "cognition", text: "我能区分「单次问答」与「多步智能体/工作流」在能力与风险上的差异。" },
    { id: "c5", dim: "cognition", text: "我了解不同模态（文/图/代码）在工具链里的典型边界与短板。" },
    { id: "c6", dim: "cognition", text: "我会根据任务选「生成」还是「检索+生成」，而不是一律聊天解决。" },
    { id: "c7", dim: "cognition", text: "我清楚数据与提示词进入第三方服务时可能涉及的隐私与合规风险。" },
    { id: "p1", dim: "practice", text: "我每周会多次把 AI 用在真实工作/学习产出里，而不只是尝鲜。" },
    { id: "p2", dim: "practice", text: "我会对同一任务多轮迭代提示词，直到质量可交付。" },
    { id: "p3", dim: "practice", text: "我会把 AI 输出当作草稿，再做事实核对、结构重组或人工定稿。" },
    { id: "p4", dim: "practice", text: "我用过至少两种不同类型的 AI 工具（如对话、编程助手、图像、自动化）。" },
    { id: "p5", dim: "practice", text: "我会为复杂任务写清：目标、约束、输出格式、反面例子或验收标准。" },
    { id: "p6", dim: "practice", text: "当结果不理想时，我会先改提示/拆步骤，而不是直接放弃或盲信。" },
    { id: "p7", dim: "practice", text: "我愿意为高频场景花时间做模板、脚本或小工具，而不是每次都从零打字。" },
    { id: "d1", dim: "domain", text: "在我的专业领域里，我能判断哪些环节适合人机分工。" },
    { id: "d2", dim: "domain", text: "我会要求 AI 按行业术语与标准格式输出，并纠正其外行表述。" },
    { id: "d3", dim: "domain", text: "我会把领域资料（规范、样例、数据）喂给模型或 RAG，而不是只问常识。" },
    { id: "d4", dim: "domain", text: "我能评估 AI 在专业任务上的错误类型（事实、逻辑、合规），并设防线。" },
    { id: "d5", dim: "domain", text: "我会记录「好用提示词/坏案例」形成可复用的领域资产。" },
    { id: "d6", dim: "domain", text: "我了解本领域常见的 AI 应用形态（如辅助写作、代码、仿真、客服等）。" },
    { id: "d7", dim: "domain", text: "我能向同事清楚说明：在某项工作上 AI 能做什么、不能做什么。" },
    { id: "h1", dim: "habit", text: "我有相对固定的「人机协作」节奏（如先大纲→再扩写→再校对）。" },
    { id: "h2", dim: "habit", text: "我会整理个人提示词库、片段库或快捷指令，而不是依赖临时发挥。" },
    { id: "h3", dim: "habit", text: "我会在项目里约定团队对 AI 的使用规范（保密、署名、审核）。" },
    { id: "h4", dim: "habit", text: "我有意识控制「无脑复制粘贴」，对关键段落会保留自己的判断与改写。" },
    { id: "h5", dim: "habit", text: "我会定期复盘：哪些场景 ROI 高、哪些只是在浪费时间。" },
    { id: "h6", dim: "habit", text: "我把学习 AI 当作持续技能，而不是一次性「学完就忘」。" },
    { id: "h7", dim: "habit", text: "遇到新工具时，我会先小范围试点再推广，而不是全员硬上。" },
  ];

  const LIKERT = [
    { v: 1, label: "完全不符合" },
    { v: 2, label: "较少符合" },
    { v: 3, label: "有时符合" },
    { v: 4, label: "大多符合" },
    { v: 5, label: "非常符合" },
  ];

  /**
   * @param {Record<string, number>} scores
   * @returns {{
   *   title: string, sub: string, match: number,
   *   deepInsight: string, hook: string, tags: string[]
   * }}
   */
  function pickArchetype(scores) {
    const c = scores.cognition;
    const p = scores.practice;
    const d = scores.domain;
    const h = scores.habit;
    const avg = (c + p + d + h) / 4;
    const hi = (x) => x >= 68;
    const lo = (x) => x < 42;

    if (hi(c) && hi(p) && hi(d) && hi(h)) {
      return {
        title: "全域协作者",
        sub: "四轴都在高位——你更像在「编排人机分工」，而不是偶尔问一句。",
        match: Math.round(88 + (avg - 70) * 0.4),
        deepInsight:
          "你同时具备理解边界、动手交付、领域校准与流程固化四类能力。风险不在『会不会用』，而在『过度依赖默认答案』：建议把关键决策与复核点写进固定清单，让优势可复制、可审计。对外协作时，你往往能成为团队的『人机接口』——这是稀缺资产。",
        hook: "四轴均衡偏高：你已经在用 AI 做「系统」，而不是做「热闹」。",
        tags: ["系统编排", "可交付", "领域感", "习惯固化"],
      };
    }
    if (hi(c) && lo(p)) {
      return {
        title: "星图测绘员",
        sub: "概念清晰，但高频练习仍不足——想法在天上，手还没形成肌肉记忆。",
        match: Math.round(72 + c * 0.15),
        deepInsight:
          "你擅长建立心智模型：知道模型会错、知道何时该 RAG、知道风险点在哪里。真正卡住你的，往往是『启动成本』：把知识变成每周三次、每次 20 分钟的固定练习，比再读十篇概念文更有效。你的特征是先想明白再动手——下一步要让『动手』也变成默认动作。",
        hook: "脑子已经上路，手还需要固定练习回合。",
        tags: ["概念强", "练习缺口", "需节奏", "可塑性强"],
      };
    }
    if (hi(p) && lo(c)) {
      return {
        title: "手感型游牧民",
        sub: "你打得快、试得多；偶尔在『为什么翻车』上少一层解释框架。",
        match: Math.round(70 + p * 0.18),
        deepInsight:
          "你的优势是迭代速度与场景嗅觉：你能快速换工具、换提示、换工作流。短板是当结果异常时，解释路径偏『经验』而非『机制』——这会让你在团队协作与培训他人时吃亏。补一层底层认知，不是为了变学术，而是为了让试错更省时间、复盘更可教。",
        hook: "手感敏锐，补上「机制感」就能从快变成稳。",
        tags: ["高频实践", "迭代快", "机制感待补", "场景嗅觉"],
      };
    }
    if (d >= c && d >= p && d >= h && d >= 62) {
      return {
        title: "垂直领域猎手",
        sub: "专业场景是你的主场：你知道什么叫『像内行一样交付』。",
        match: Math.round(75 + d * 0.2),
        deepInsight:
          "你把 AI 当『领域加速器』而不是聊天玩具：术语、格式、边界条件、合规风险都在你的雷达里。下一步是把个人经验资产化：模板、样例库、错误类型清单——让别人也能站在你的肩膀上。若认知或习惯分数偏低，优先补『模型翻车模式』与『团队规范』，避免个人强、系统弱。",
        hook: "专业纵深突出：把个人绝活沉淀成可复用资产。",
        tags: ["领域纵深", "交付标准", "资产化", "协作规范"],
      };
    }
    if (h >= c && h >= p && h >= d && h >= 62) {
      return {
        title: "流程建筑师",
        sub: "你擅长把协作变成可重复的节奏与规范——这是组织级能力的前身。",
        match: Math.round(74 + h * 0.2),
        deepInsight:
          "你天然关注可持续：模板、复盘、边界、团队约定。你的风险是『流程正确但产出平庸』——当实践或专业不足时，规范会变成空转。建议每个流程节点绑定一个可验收的产出样例，让习惯与结果对齐。你很适合成为团队里的『协作标准制定者』。",
        hook: "习惯与规范很强：让流程对准可验收结果。",
        tags: ["节奏感", "规范意识", "复盘", "可规模化"],
      };
    }
    if (lo(c) && lo(p) && lo(d) && lo(h)) {
      return {
        title: "观测席常客",
        sub: "你还在围观区——不是能力问题，多半是启动场景还没被选中。",
        match: Math.round(55 + avg * 0.35),
        deepInsight:
          "这份画像常见于『知道很多产品，但没绑到高频任务』的阶段。你的突破点不是再学一个工具，而是选一个每周必做的小事：邮件、纪要、表格、翻译……把它连续用满两周。四轴会一起被拖起来，因为信心来自具体胜利，而不是抽象兴趣。",
        hook: "从一个小而具体的高频任务开始，比再收藏一篇攻略更有用。",
        tags: ["待启动", "高频场景", "小胜利", "可快速提升"],
      };
    }
    if (c + p > d + h + 15) {
      return {
        title: "双引擎试飞员",
        sub: "认知与实践走在前面；领域沉淀与习惯系统还在追赶。",
        match: Math.round(78 + (c + p) * 0.1),
        deepInsight:
          "你属于『先飞起来再调参』的类型：愿意试、也愿意想。接下来最值得做的是把试飞记录变成资产：哪些任务值得自动化、哪些必须人工终审、哪些提示词可复用。把『专业』与『习惯』补上来，你会从个人高效走向团队可复制。",
        hook: "认知+实践双高：把试飞记录沉淀成团队能用的资产。",
        tags: ["学习曲线陡", "试飞频繁", "待沉淀", "爆发力强"],
      };
    }
    if (d + h > c + p + 15) {
      return {
        title: "阵地工兵",
        sub: "领域与流程已扎根；底层直觉与日常练习量可再抬一档。",
        match: Math.round(77 + (d + h) * 0.1),
        deepInsight:
          "你更相信『在工作里用起来』而不是追新。你的风险是工具迭代快时，更新滞后；补一点认知与实践频率，会让你在选型、排错、培训他人时更省力。你适合作为业务侧的『落地推动者』，而不是概念传播者。",
        hook: "落地与规范强：补一点底层直觉，选型排错会更省力。",
        tags: ["落地派", "业务侧", "稳健", "可补认知"],
      };
    }
    return {
      title: "混态进化体",
      sub: "没有单一标签能框住你——你在多轴之间摆动，正是继续精细调参的黄金期。",
      match: Math.round(70 + avg * 0.25),
      deepInsight:
        "你的四轴呈现『有长有短』的混合状态：这意味着你正处于快速塑形期。建议只看最低的二维做 14 天小实验，其它维度先维持。混态不是混乱，而是说明你还没把偏好固化成路径——这时候的刻意练习回报率最高。",
      hook: "多轴混搭：用 14 天小实验专攻最短板，收益最大。",
      tags: ["塑形期", "不均衡", "高回报练习", "待定型"],
    };
  }

  /** @param {keyof typeof DIMENSIONS} k @param {number} v 0-100 */
  function dimensionNarrative(k, v) {
    const L = DIMENSIONS[k].label;
    if (v < 40) {
      const map = {
        cognition: `${L}偏低：你可能还在用「聊天」替代「方法」。建议先建立最小概念骨架：概率输出、窗口、幻觉与核验。`,
        practice: `${L}偏低：工具接触不少，但尚未嵌入高频真实产出。请绑定一个每周重复的具体任务练手。`,
        domain: `${L}偏低：通用对话多，领域语料与标准少。把术语表、样例与禁区写进提示或附件，会立刻改观。`,
        habit: `${L}偏低：即兴使用为主，缺少模板与复盘。从「保存三条好用提示词」开始即可。`,
      };
      return map[k];
    }
    if (v < 68) {
      const map = {
        cognition: `${L}中等：关键概念有印象，但未形成稳定判断。用「同一任务三种提示」做对照实验，进步最快。`,
        practice: `${L}中等：能完成不少任务，但质量波动。给任务加验收标准与反面例子，会显著压缩返工。`,
        domain: `${L}中等：能在专业场景使用 AI，但资产沉淀不足。建议记录三类坏案例：事实错、逻辑错、合规风险。`,
        habit: `${L}中等：有一定节奏，但未体系化。把个人 SOP 画成三步流程图，再决定哪步可自动化。`,
      };
      return map[k];
    }
    const map = {
      cognition: `${L}突出：你能讨论边界与机制，而不只讨论功能。适合承担团队里的选型与风险解释角色。`,
      practice: `${L}突出：你能稳定把 AI 用在交付链上。注意别在低价值任务上过度自动化，保持 ROI 意识。`,
      domain: `${L}突出：你能把 AI 输出校准到「像这一行的人写的」。下一步是资产化与同伴培训。`,
      habit: `${L}突出：你的协作方式可复盘、可迭代、可教别人。这是从个人到团队的关键跳板。`,
    };
    return map[k];
  }

  /** 去掉「某某维度偏低：」式前缀，避免与卡片标题重复 */
  function narrativeBodyOnly(k, v) {
    const t = dimensionNarrative(k, v);
    const i = t.indexOf("：");
    return i >= 0 ? t.slice(i + 1) : t;
  }

  function clamp(n, a, b) {
    return Math.max(a, Math.min(b, n));
  }

  function computeScores(answers) {
    const sums = { cognition: 0, practice: 0, domain: 0, habit: 0 };
    const counts = { cognition: 0, practice: 0, domain: 0, habit: 0 };
    QUESTIONS.forEach((q, i) => {
      const v = answers[i];
      if (v >= 1 && v <= 5) {
        sums[q.dim] += v;
        counts[q.dim] += 1;
      }
    });
    const out = {};
    Object.keys(sums).forEach((k) => {
      const avg = counts[k] ? sums[k] / counts[k] : 1;
      out[k] = Math.round(((avg - 1) / 4) * 100);
    });
    return out;
  }

  function weakestDims(scores) {
    const entries = Object.entries(scores).map(([k, v]) => ({ k, v }));
    entries.sort((a, b) => a.v - b.v);
    return entries.slice(0, 2).map((e) => e.k);
  }

  const RECOMMEND = {
    cognition: [
      "精读 1 篇讲清「概率输出 / 上下文 / RAG / 智能体」的文章，并手绘一张概念关系图。",
      "同一问题分别用「零示例 / 少示例 / 给反例」三种提示各跑一遍，对照差异写三行结论。",
    ],
    practice: [
      "锁定「每周 3 次、每次 20 分钟」的交付型小任务（邮件、纪要、脚本均可），连续两周不打断。",
      "建一页「提示词迭代日志」：原提示、改动点、结果变化各一行，只记不评判。",
    ],
    domain: [
      "整理「领域术语表 + 3 个标杆样例 + 3 条禁区」作为固定系统提示或附件。",
      "选一条真实工作流画人机泳道图，标出必须人工复核的节点与依据。",
    ],
    habit: [
      "把最高频场景做成模板库（命名 + 标签），每周只新增 1 条「验证过好用」的条目。",
      "与同伴约定最小规范：哪些数据不进公网模型、成品如何署名与复核。",
    ],
  };

  function buildActions(weak) {
    const lines = [];
    weak.forEach((k) => {
      const pair = RECOMMEND[k];
      if (pair) lines.push(pair[0], pair[1]);
    });
    if (!lines.length) lines.push("教别人一遍你的协作流程——能讲清楚，才算真掌握。");
    return lines;
  }

  function radarPath(scores) {
    const keys = ["cognition", "practice", "domain", "habit"];
    const labels = keys.map((k) => DIMENSIONS[k].short);
    const cx = 100;
    const cy = 100;
    const rMax = 72;
    const angles = keys.map((_, i) => (-Math.PI / 2) + (i * 2 * Math.PI) / keys.length);

    function pointFor(value, i) {
      const t = value / 100;
      const r = rMax * t;
      return [cx + r * Math.cos(angles[i]), cy + r * Math.sin(angles[i])];
    }

    let d = "";
    keys.forEach((k, i) => {
      const [x, y] = pointFor(scores[k], i);
      d += (i === 0 ? "M" : "L") + x.toFixed(2) + "," + y.toFixed(2) + " ";
    });
    d += "Z";

    const grid = [];
    for (let g = 1; g <= 4; g++) {
      const rr = (rMax * g) / 4;
      let gd = "";
      angles.forEach((ang, i) => {
        const x = cx + rr * Math.cos(ang);
        const y = cy + rr * Math.sin(ang);
        gd += (i === 0 ? "M" : "L") + x.toFixed(2) + "," + y.toFixed(2) + " ";
      });
      gd += "Z";
      grid.push(`<path d="${gd}" fill="none" stroke="rgba(120,53,15,0.1)" stroke-width="1"/>`);
    }

    const axis = angles
      .map((ang, i) => {
        const x2 = cx + rMax * Math.cos(ang);
        const y2 = cy + rMax * Math.sin(ang);
        const lx = cx + (rMax + 14) * Math.cos(ang);
        const ly = cy + (rMax + 14) * Math.sin(ang);
        const t = `<text x="${lx}" y="${ly}" fill="#78716c" font-size="9" font-weight="600" text-anchor="middle" dominant-baseline="middle">${labels[i]}</text>`;
        return `<line x1="${cx}" y1="${cy}" x2="${x2}" y2="${y2}" stroke="rgba(234,88,12,0.2)" stroke-width="1"/>${t}`;
      })
      .join("");

    const fill = `<path d="${d}" fill="rgba(249,115,22,0.22)" stroke="#ea580c" stroke-width="1.8" stroke-linejoin="round"/>`;
    return grid.join("") + axis + fill;
  }

  function renderBars(scores) {
    const el = document.getElementById("bars");
    el.innerHTML = "";
    const keys = ["cognition", "practice", "domain", "habit"];
    keys.forEach((k) => {
      const row = document.createElement("div");
      row.className = "bar-row";
      row.innerHTML = `<span class="bar-row__dim">${DIMENSIONS[k].short}</span><div class="bar-track"><div class="bar-fill" style="width:0%"></div></div><span class="bar-row__num">${scores[k]}</span>`;
      el.appendChild(row);
      requestAnimationFrame(() => {
        row.querySelector(".bar-fill").style.width = scores[k] + "%";
      });
    });
  }

  function formatShareDate() {
    const t = new Date();
    const y = t.getFullYear();
    const m = String(t.getMonth() + 1).padStart(2, "0");
    const d = String(t.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  /** 将长洞察拆成「导语 + 分段正文」，便于排版扫读 */
  function formatInsightHTML(text) {
    const sentences = text
      .split("。")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => s + "。");
    if (!sentences.length) return "";
    const [lead, ...rest] = sentences;
    let html = `<p class="insight-lead">${lead}</p>`;
    rest.forEach((p) => {
      html += `<p class="insight-para">${p}</p>`;
    });
    return html;
  }

  const views = {
    landing: document.getElementById("view-landing"),
    quiz: document.getElementById("view-quiz"),
    result: document.getElementById("view-result"),
  };

  function show(view) {
    Object.values(views).forEach((el) => el.classList.remove("active"));
    views[view].classList.add("active");
  }

  let answers = QUESTIONS.map(() => 0);
  let index = 0;

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const o = JSON.parse(raw);
      if (o.answers && o.answers.length === QUESTIONS.length) return o;
    } catch (_) {}
    return null;
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ answers, index, savedAt: Date.now() }));
  }

  function clearState() {
    localStorage.removeItem(STORAGE_KEY);
  }

  function renderQuestion() {
    const q = QUESTIONS[index];
    document.getElementById("q-dim").textContent = DIMENSIONS[q.dim].label;
    document.getElementById("q-text").textContent = q.text;
    const pct = Math.round(((index + (answers[index] ? 1 : 0)) / QUESTIONS.length) * 100);
    document.getElementById("progress-bar").style.width = pct + "%";
    document.getElementById("progress-text").textContent = `${index + 1} / ${QUESTIONS.length}`;

    const likert = document.getElementById("likert");
    likert.innerHTML = "";
    LIKERT.forEach((opt) => {
      const id = `opt-${q.id}-${opt.v}`;
      const label = document.createElement("label");
      label.innerHTML = `<input type="radio" name="q" value="${opt.v}" id="${id}" ${answers[index] === opt.v ? "checked" : ""} /><span>${opt.label}</span>`;
      likert.appendChild(label);
    });

    document.getElementById("btn-prev").disabled = index === 0;
    const filled = answers[index] >= 1;
    const nextBtn = document.getElementById("btn-next");
    nextBtn.disabled = !filled;
    nextBtn.textContent = index === QUESTIONS.length - 1 ? "查看结果" : "下一题";

    likert.querySelectorAll('input[name="q"]').forEach((inp) => {
      inp.addEventListener("change", () => {
        answers[index] = Number(inp.value);
        saveState();
        nextBtn.disabled = false;
        document.getElementById("progress-bar").style.width =
          Math.round(((index + 1) / QUESTIONS.length) * 100) + "%";
      });
    });
  }

  function saveLastResultSnapshot() {
    try {
      localStorage.setItem(RESULT_KEY, JSON.stringify({ answers: answers.slice() }));
    } catch (_) {}
  }

  function loadLastResultAnswers() {
    try {
      const raw = localStorage.getItem(RESULT_KEY);
      if (!raw) return null;
      const o = JSON.parse(raw);
      if (o.answers && o.answers.length === QUESTIONS.length && o.answers.every((a) => a >= 1 && a <= 5))
        return o.answers;
    } catch (_) {}
    return null;
  }

  function getAnswersForSummary() {
    if (answers.length === QUESTIONS.length && answers.every((a) => a >= 1 && a <= 5)) return answers;
    const snap = loadLastResultAnswers();
    return snap || answers;
  }

  function renderResult() {
    const scores = computeScores(answers);
    const arch = pickArchetype(scores);

    document.getElementById("archetype-title").textContent = arch.title;
    document.getElementById("archetype-sub").textContent = arch.sub;
    document.getElementById("match-pct").textContent = clamp(arch.match, 52, 97) + "%";
    document.getElementById("insight-body").innerHTML = formatInsightHTML(arch.deepInsight);

    document.getElementById("share-date").textContent = formatShareDate();
    document.getElementById("share-archetype").textContent = arch.title;
    document.getElementById("share-sub").textContent = arch.sub;
    document.getElementById("share-hook").textContent = arch.hook;
    document.getElementById("share-match").textContent = clamp(arch.match, 52, 97) + "%";

    const shareScores = document.getElementById("share-scores");
    shareScores.innerHTML = "";
    ["cognition", "practice", "domain", "habit"].forEach((k) => {
      const div = document.createElement("div");
      div.className = "share-score-item";
      div.innerHTML = `<span class="share-score-item__v">${scores[k]}</span><span class="share-score-item__k">${DIMENSIONS[k].short}</span>`;
      shareScores.appendChild(div);
    });

    const tagsEl = document.getElementById("share-tags");
    tagsEl.innerHTML = "";
    arch.tags.forEach((t) => {
      const s = document.createElement("span");
      s.className = "tag-chip";
      s.textContent = t;
      tagsEl.appendChild(s);
    });

    const weak = weakestDims(scores);
    const weakLabels = weak.map((k) => DIMENSIONS[k].label).join("、");
    const strong = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
    const strongLabel = DIMENSIONS[strong[0]].label;
    const strongScore = strong[1];
    document.getElementById("remark").innerHTML = `
      <div class="remark-stack">
        <div class="remark-block remark-block--up">
          <span class="remark-block__tag">相对优势</span>
          <p class="remark-block__text">当前最突出的是「${strongLabel}」<strong>${strongScore}</strong> 分。这是你最容易做出「像样的交付」、也最容易被他人感知到的长板。</p>
        </div>
        <div class="remark-block remark-block--focus">
          <span class="remark-block__tag">投入焦点</span>
          <p class="remark-block__text">相对更需要刻意练习的是「${weakLabels}」。这不代表「弱」，而表示下一阶段<strong>性价比最高</strong>的学习可以朝这里倾斜：先补短板，再把长板总结成可教别人的方法。</p>
        </div>
      </div>`;

    const tipsEl = document.getElementById("tips");
    tipsEl.innerHTML = "";
    weak.forEach((k) => {
      const li = document.createElement("li");
      li.className = "tip-item";
      li.innerHTML = `<span class="tip-item__dim">${DIMENSIONS[k].label}</span><p class="tip-item__text">${RECOMMEND[k][0]}</p>`;
      tipsEl.appendChild(li);
    });

    const narratives = document.getElementById("dim-narratives");
    narratives.innerHTML = "";
    ["cognition", "practice", "domain", "habit"].forEach((k) => {
      const li = document.createElement("li");
      li.className = "narrative-item";
      li.innerHTML = `<div class="narrative-item__head"><span class="narrative-item__name">${DIMENSIONS[k].label}</span><span class="narrative-item__score">${scores[k]}</span></div><p class="narrative-item__body">${narrativeBodyOnly(k, scores[k])}</p>`;
      narratives.appendChild(li);
    });

    const actionsEl = document.getElementById("actions");
    actionsEl.innerHTML = "";
    buildActions(weak).forEach((line) => {
      const li = document.createElement("li");
      li.textContent = line;
      actionsEl.appendChild(li);
    });

    const dimList = document.getElementById("dim-list");
    dimList.innerHTML = "";
    ["cognition", "practice", "domain", "habit"].forEach((k) => {
      const li = document.createElement("li");
      li.innerHTML = `<span>${DIMENSIONS[k].label}</span><span>${scores[k]}</span>`;
      dimList.appendChild(li);
    });

    document.getElementById("radar").innerHTML = radarPath(scores);
    renderBars(scores);

    saveLastResultSnapshot();
    clearState();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function copySummary() {
    const ans = getAnswersForSummary();
    if (!ans.every((a) => a >= 1 && a <= 5)) {
      alert("暂无完整结果可复制，请先完成一次扫描。");
      return;
    }
    const scores = computeScores(ans);
    const arch = pickArchetype(scores);
    const lines = [
      `【AIRADAR】AI 协作力扫描`,
      `日期：${formatShareDate()}`,
      `原型：${arch.title}`,
      `匹配度约 ${clamp(arch.match, 52, 97)}%`,
      `一句话：${arch.hook}`,
      `标签：${arch.tags.join(" · ")}`,
      `四轴：认知 ${scores.cognition} · 实践 ${scores.practice} · 专业 ${scores.domain} · 习惯 ${scores.habit}`,
      "",
      "本摘要由网页生成，仅供自我反思与教学使用。",
    ];
    navigator.clipboard.writeText(lines.join("\n")).then(
      () => alert("已复制到剪贴板"),
      () => alert("复制失败，请手动选择文字复制")
    );
  }

  document.getElementById("btn-start").addEventListener("click", () => {
    answers = QUESTIONS.map(() => 0);
    index = 0;
    saveState();
    show("quiz");
    renderQuestion();
  });

  document.getElementById("btn-resume").addEventListener("click", () => {
    show("quiz");
    renderQuestion();
  });

  document.getElementById("btn-back-home").addEventListener("click", () => {
    saveState();
    show("landing");
    refreshResume();
  });

  document.getElementById("btn-prev").addEventListener("click", () => {
    if (index > 0) {
      index -= 1;
      saveState();
      renderQuestion();
    }
  });

  document.getElementById("btn-next").addEventListener("click", () => {
    if (!answers[index]) return;
    if (index < QUESTIONS.length - 1) {
      index += 1;
      saveState();
      renderQuestion();
    } else {
      const incomplete = answers.some((a) => a < 1);
      if (incomplete) {
        alert("还有题目未作答，请补全后再查看结果。");
        return;
      }
      show("result");
      renderResult();
    }
  });

  document.getElementById("btn-retry").addEventListener("click", () => {
    answers = QUESTIONS.map(() => 0);
    index = 0;
    clearState();
    try {
      localStorage.removeItem(RESULT_KEY);
    } catch (_) {}
    show("landing");
    refreshResume();
  });

  document.getElementById("btn-copy").addEventListener("click", copySummary);

  function refreshResume() {
    const s = loadState();
    const btn = document.getElementById("btn-resume");
    const lastBtn = document.getElementById("btn-last-result");
    const hasLast = !!loadLastResultAnswers();

    if (s && s.answers.some((a) => a >= 1)) {
      answers = s.answers;
      index = clamp(s.index || 0, 0, QUESTIONS.length - 1);
      btn.hidden = false;
    } else {
      btn.hidden = true;
    }

    lastBtn.hidden = !hasLast;
  }

  document.getElementById("btn-last-result").addEventListener("click", () => {
    const snap = loadLastResultAnswers();
    if (!snap) return;
    answers = snap;
    show("result");
    renderResult();
  });

  refreshResume();
})();
