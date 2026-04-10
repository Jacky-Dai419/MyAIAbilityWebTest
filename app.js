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

  /** @param {Record<string, number>} scores 0-100 */
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
        sub: "四轴均衡偏高——你像一支编好曲的乐队，知道何时让人声、何时让合成器上场。",
        match: Math.round(88 + (avg - 70) * 0.4),
      };
    }
    if (hi(c) && lo(p)) {
      return {
        title: "星图测绘员",
        sub: "脑子里的地图很清晰，但脚步还在试探——该把认知翻译成可重复的练习回合。",
        match: Math.round(72 + c * 0.15),
      };
    }
    if (hi(p) && lo(c)) {
      return {
        title: "手感型游牧民",
        sub: "你靠直觉打得很快，偶尔会被幻觉绊一下——值得补一层「模型如何犯错」的底层感。",
        match: Math.round(70 + p * 0.18),
      };
    }
    if (d >= c && d >= p && d >= h && d >= 62) {
      return {
        title: "垂直领域猎手",
        sub: "专业场景是你的主场；把领域资产产品化，你会强得不像「只会聊天」的那种用法。",
        match: Math.round(75 + d * 0.2),
      };
    }
    if (h >= c && h >= p && h >= d && h >= 62) {
      return {
        title: "流程建筑师",
        sub: "你擅长把协作固化成习惯与规范——下一步是把个人 SOP 变成团队可复制的版本。",
        match: Math.round(74 + h * 0.2),
      };
    }
    if (lo(c) && lo(p) && lo(d) && lo(h)) {
      return {
        title: "观测席常客",
        sub: "你还在围观阶段没关系——从一个小而具体的重复任务开始，连打七天卡就会换画风。",
        match: Math.round(55 + avg * 0.35),
      };
    }
    if (c + p > d + h + 15) {
      return {
        title: "双引擎试飞员",
        sub: "认知与实践走在前面，专业沉淀与习惯系统可以慢慢「收网」成资产。",
        match: Math.round(78 + (c + p) * 0.1),
      };
    }
    if (d + h > c + p + 15) {
      return {
        title: "阵地工兵",
        sub: "你已经把 AI 嵌进领域与流程；补一点底层直觉，决策会更快、更省试错成本。",
        match: Math.round(77 + (d + h) * 0.1),
      };
    }
    return {
      title: "混态进化体",
      sub: "没有单一标签能框住你——你在多轴之间摆动，正是继续精细调参的黄金期。",
      match: Math.round(70 + avg * 0.25),
    };
  }

  function clamp(n, a, b) {
    return Math.max(a, Math.min(b, n));
  }

  /** @param {number[]} answers 1-5 per question in order */
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
    /** @type {Record<string, number>} */
    const out = {};
    (Object.keys(sums)).forEach((k) => {
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
      "短课程：概率输出、上下文窗口、RAG 与智能体分工（各 1 篇精读 + 手绘一张概念图）。",
      "练习：同一问题分别用「零示例 / 少示例 / 给反例」三种提示对比输出差异。",
    ],
    practice: [
      "给自己定一个「每周 3 次、每次 20 分钟」的交付型小任务（邮件、小结、脚本均可）。",
      "建立「提示词迭代日志」：记录原提示、修改点、结果变化各一行。",
    ],
    domain: [
      "整理一份「领域专用术语表 + 3 个标杆样例」作为固定系统提示或附件。",
      "选一条专业工作流，画出人机分工泳道图，标出必须人工审核的节点。",
    ],
    habit: [
      "把最高频场景做成模板库（命名规范 + 标签），每周只新增 1 条精品。",
      "与同伴约定最小合规：哪些数据不进公网模型、成品如何署名与复核。",
    ],
  };

  function buildActions(weak) {
    const lines = [];
    weak.forEach((k) => {
      const pair = RECOMMEND[k];
      if (pair) lines.push(pair[0], pair[1]);
    });
    if (!lines.length) {
      lines.push("维持现状的同时，尝试教别人一遍——教学是最好的压力测试。");
    }
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
      grid.push(`<path d="${gd}" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>`);
    }

    const axis = angles
      .map((ang, i) => {
        const x2 = cx + rMax * Math.cos(ang);
        const y2 = cy + rMax * Math.sin(ang);
        const lx = cx + (rMax + 14) * Math.cos(ang);
        const ly = cy + (rMax + 14) * Math.sin(ang);
        const t = `<text x="${lx}" y="${ly}" fill="#8b92a8" font-size="9" text-anchor="middle" dominant-baseline="middle">${labels[i]}</text>`;
        return `<line x1="${cx}" y1="${cy}" x2="${x2}" y2="${y2}" stroke="rgba(255,255,255,0.12)" stroke-width="1"/>${t}`;
      })
      .join("");

    const fill = `<path d="${d}" fill="rgba(62,232,200,0.2)" stroke="#3ee8c8" stroke-width="1.5"/>`;
    return grid.join("") + axis + fill;
  }

  // --- UI ---
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
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ answers, index, savedAt: Date.now() })
    );
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

    const weak = weakestDims(scores);
    const weakLabels = weak.map((k) => DIMENSIONS[k].label).join("、");
    document.getElementById("remark").textContent =
      `相对短板集中在：${weakLabels}。下面建议按「先补短板、再放大优势」的顺序尝试即可。`;

    const tipsEl = document.getElementById("tips");
    tipsEl.innerHTML = "";
    weak.forEach((k) => {
      const li = document.createElement("li");
      li.textContent = `${DIMENSIONS[k].label}：${RECOMMEND[k][0]}`;
      tipsEl.appendChild(li);
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
    saveLastResultSnapshot();
    clearState();
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
      `原型：${arch.title}`,
      `匹配度约 ${clamp(arch.match, 52, 97)}%`,
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
