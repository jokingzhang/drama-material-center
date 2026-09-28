export interface PracticeVideoReference {
  id: string;
  title: string;
  author: string;
  platform: "抖音" | "小红书";
  url: string;
  kind: "作品" | "教程";
  durationLabel: string;
  focus: string;
  locate: string;
  evidence: string;
  verifiedAt: string;
  status: "verified" | "pending";
}

export interface PracticeConcept {
  name: string;
  explanation: string;
  visibleMechanism: string;
  readings: { title: string; url: string; publisher: string; language: "中文" | "英文"; locate: string }[];
  illustration?: { src: string; alt: string; work: string; credit: string; sourceUrl: string; lookFor: string };
}

export interface PracticeExercise {
  id: string;
  number: number;
  title: string;
  trackId: string;
  level: "基础" | "进阶" | "综合";
  summary: string;
  goal: string;
  principles: string[];
  prerequisites: string[];
  experiment: { variable: string; baseline: string; variant: string; fixed: string; inspect: string; stop: string };
  film: { title: string; premise: string; duration: string; scope: string; beats: string[] };
  research: { queries: string[]; lookFor: string[]; avoid: string[] };
  references: PracticeVideoReference[];
  acceptance: string[];
  pitfalls: string[];
  sources: { area: "script" | "image-asset" | "shot-prompt"; path: string; why: string }[];
  publishing: { workTitle: string; tutorialTitle: string; outline: string[] };
  cost: "低" | "中" | "高";
  recommended: boolean;
  science?: {
    question: string;
    concepts: PracticeConcept[];
    filmChoice: string;
    evidence: string;
    generationTranslation: string[];
    boundary: string;
  };
  segment?: { start: number; end: number; label: string; observations: string[]; mechanism: string };
}

export const PRACTICE_STAGES = ["待找参考", "待定目标", "准备试片", "制作中", "待复盘", "完成"] as const;
export type PracticeStage = typeof PRACTICE_STAGES[number];
export type PracticeAspectRatio = "未定" | "9:16" | "16:9";

export interface PracticeReference {
  id: string;
  title: string;
  url: string;
  timeRange: string;
  learn: string;
  evidence: "未查看" | "已查看";
  selected: boolean;
}

export interface PracticeRound {
  id: string;
  exerciseId: string;
  createdAt: string;
  updatedAt: string;
  title: string;
  goal: string;
  durationSeconds: number;
  aspectRatio: PracticeAspectRatio;
  filmDescription: string;
  stage: PracticeStage;
  references: PracticeReference[];
  experimentNotes: string;
  reflection: string;
  finalUrl: string;
  tutorialUrl: string;
}

export interface PracticeStore {
  schemaVersion: 1;
  exerciseId: string;
  rounds: PracticeRound[];
}

type PracticeStorage = Pick<Storage, "getItem" | "setItem">;
export type PracticeLoadResult =
  | { ok: true; rounds: PracticeRound[]; raw: string | null }
  | { ok: false; error: string; raw: string | null };

export function practiceStorageKey(exerciseId: string) {
  return `material-center:video-practice:v1:${encodeURIComponent(exerciseId)}`;
}

/** Only absolute web URLs may become links, including data read from local storage. */
export function safePracticeUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!/^https?:\/\//i.test(trimmed) || /[\u0000-\u0020\u007f]/.test(trimmed)) return null;
  try {
    const url = new URL(trimmed);
    if (!url.hostname || url.username || url.password) return null;
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

/** A search page, short link, or lookalike hostname is not a concrete reference video. */
export function isPracticeVideoUrl(value: string, platform?: PracticeVideoReference["platform"]): boolean {
  const safeUrl = safePracticeUrl(value);
  if (!safeUrl) return false;
  const url = new URL(safeUrl);
  if (url.port) return false;
  const douyin = ((url.hostname === "www.douyin.com" || url.hostname === "douyin.com") && /^\/video\/\d+\/?$/.test(url.pathname))
    || (url.hostname === "jingxuan.douyin.com" && /^\/m\/video\/\d+\/?$/.test(url.pathname));
  const xiaohongshu = (url.hostname === "www.xiaohongshu.com" || url.hostname === "xiaohongshu.com")
    && /^\/(?:explore|discovery\/item)\/[a-f\d]{24}\/?$/i.test(url.pathname);
  return platform === "抖音" ? douyin : platform === "小红书" ? xiaohongshu : douyin || xiaohongshu;
}

export function isReadyPracticeExercise(exercise: PracticeExercise): boolean {
  return Array.isArray(exercise.references) && exercise.references.some((reference) =>
    reference.status === "verified" && isPracticeVideoUrl(reference.url, reference.platform)
    && [reference.title, reference.author, reference.focus, reference.evidence, reference.verifiedAt]
      .every((value) => typeof value === "string" && value.trim() !== ""));
}

export function practiceRoundReadinessError(exercise: PracticeExercise, round: PracticeRound): string | null {
  if (round.stage === "待找参考" || round.stage === "待定目标") return null;
  if (!isReadyPracticeExercise(exercise)) return "本练习还缺少已核对的具体抖音或小红书参考，暂不能进入试片或制作阶段。可先保存为待定目标草稿。";
  if (!round.references.some((reference) => reference.selected && reference.evidence === "已查看"
    && isPracticeVideoUrl(reference.url) && reference.learn.trim() !== "" && reference.timeRange.trim() !== "")) {
    return "进入试片或制作前，请至少选用 1 个具体平台视频，实际查看后标记“已查看”，并填写片段时间和“只学什么”。也可以先改回“待定目标”保存草稿。";
  }
  if (!round.filmDescription.trim()) return "请先填写“这次要做成什么”，明确本轮成片目标；尚未定下时可改回“待定目标”保存草稿。";
  if (round.aspectRatio === "未定") return "请先选择本轮画幅意向；尚未决定时可改回“待定目标”保存草稿。项目生产仍须遵守正式画幅锁。";
  return null;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasStrings(value: Record<string, unknown>, keys: string[]) {
  return keys.every((key) => typeof value[key] === "string");
}

function optionalUrl(value: unknown) {
  return typeof value === "string" && (value.trim() === "" || safePracticeUrl(value) !== null);
}

function isReference(value: unknown): value is PracticeReference {
  return isObject(value)
    && hasStrings(value, ["id", "title", "url", "timeRange", "learn"])
    && value.id !== ""
    && optionalUrl(value.url)
    && (value.evidence === "未查看" || value.evidence === "已查看")
    && typeof value.selected === "boolean";
}

function isRound(value: unknown, exerciseId: string): value is PracticeRound {
  if (!isObject(value) || !hasStrings(value, [
    "id", "exerciseId", "createdAt", "updatedAt", "title", "goal", "filmDescription",
    "stage", "experimentNotes", "reflection", "finalUrl", "tutorialUrl",
  ])) return false;
  return value.id !== ""
    && value.exerciseId === exerciseId
    && Number.isFinite(Date.parse(value.createdAt as string))
    && Number.isFinite(Date.parse(value.updatedAt as string))
    && Number.isInteger(value.durationSeconds)
    && Number(value.durationSeconds) >= 60 && Number(value.durationSeconds) <= 120
    && ["未定", "9:16", "16:9"].includes(value.aspectRatio as string)
    && PRACTICE_STAGES.includes(value.stage as PracticeStage)
    && Array.isArray(value.references) && value.references.every(isReference)
    && new Set(value.references.map((reference) => reference.id)).size === value.references.length
    && optionalUrl(value.finalUrl) && optionalUrl(value.tutorialUrl);
}

function validRounds(value: unknown, exerciseId: string): value is PracticeRound[] {
  return Array.isArray(value) && value.every((round) => isRound(round, exerciseId))
    && new Set(value.map((round) => round.id)).size === value.length;
}

export function parsePracticeStore(raw: string | null, exerciseId: string): PracticeLoadResult {
  if (raw === null) return { ok: true, rounds: [], raw };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (isObject(parsed) && parsed.schemaVersion === 1 && parsed.exerciseId === exerciseId
      && validRounds(parsed.rounds, exerciseId)) {
      return { ok: true, rounds: parsed.rounds, raw };
    }
  } catch { /* Preserve invalid content for recovery instead of resetting it. */ }
  return { ok: false, raw, error: "本练习的浏览器记录格式损坏或版本不兼容，已停止写入。请先导出原始记录备份，再检查浏览器存储。" };
}

export function loadPracticeRounds(storage: Pick<Storage, "getItem">, exerciseId: string): PracticeLoadResult {
  try {
    return parsePracticeStore(storage.getItem(practiceStorageKey(exerciseId)), exerciseId);
  } catch {
    return { ok: false, raw: null, error: "无法读取浏览器存储，记录未载入。请检查浏览器的存储权限后重试。" };
  }
}

export function serializePracticeRounds(exerciseId: string, rounds: PracticeRound[]) {
  return JSON.stringify({ schemaVersion: 1, exerciseId, rounds } satisfies PracticeStore, null, 2);
}

export function savePracticeRounds(
  storage: PracticeStorage,
  exercise: PracticeExercise,
  rounds: PracticeRound[],
  expectedRaw: string | null,
): { ok: true; raw: string } | { ok: false; error: string } {
  const exerciseId = exercise.id;
  if (!validRounds(rounds, exerciseId)) {
    return { ok: false, error: "保存失败：请将时长设为 60–120 秒的整数，链接填写完整的 http:// 或 https:// 地址，并检查本轮记录。" };
  }
  for (const [index, round] of rounds.entries()) {
    const readinessError = practiceRoundReadinessError(exercise, round);
    if (readinessError) return { ok: false, error: `第 ${index + 1} 轮尚未保存：${readinessError}` };
  }
  const existing = loadPracticeRounds(storage, exerciseId);
  if (!existing.ok) return { ok: false, error: existing.error };
  if (existing.raw !== expectedRaw) {
    return { ok: false, error: "保存失败：另一页面已经修改了本练习的记录。请先导出当前草稿备份，再刷新读取新记录，避免覆盖。" };
  }
  const raw = serializePracticeRounds(exerciseId, rounds);
  try {
    storage.setItem(practiceStorageKey(exerciseId), raw);
    return { ok: true, raw };
  } catch {
    return { ok: false, error: "保存失败：浏览器存储空间不足或写入被禁用。当前草稿仍在页面中，请立即导出 JSON 备份；刷新会丢失未保存内容。" };
  }
}

export function createPracticeRound(exercise: PracticeExercise, id: string, now = new Date().toISOString()): PracticeRound {
  if (!isReadyPracticeExercise(exercise)) throw new Error("本练习尚无已核对的具体平台视频，暂不能开始新一轮练习。");
  return {
    id, exerciseId: exercise.id, createdAt: now, updatedAt: now,
    title: "", goal: exercise.goal, durationSeconds: 90, aspectRatio: "未定",
    filmDescription: "", stage: "待定目标",
    references: exercise.references.filter((reference) => isPracticeVideoUrl(reference.url, reference.platform)).map((reference) => ({
      id: reference.id, title: reference.title, url: reference.url, timeRange: reference.locate,
      learn: reference.focus, evidence: "未查看", selected: false,
    })),
    experimentNotes: "", reflection: "", finalUrl: "", tutorialUrl: "",
  };
}

export function buildPracticeResearchTask(exercise: PracticeExercise, round: PracticeRound): string {
  const baseReferences = exercise.references.map((reference, index) => [
    `${index + 1}. ${reference.title} · ${reference.author} · ${reference.platform} · ${reference.kind}`,
    `   原视频：${isPracticeVideoUrl(reference.url, reference.platform) ? safePracticeUrl(reference.url) : "未取得有效的具体平台视频链接"}`,
    `   聚焦：${reference.focus}；定位：${reference.locate || "需看片定位"}`,
    `   核验状态：${reference.status === "verified" ? "已核对参考资料" : "待核对"}；核验时间：${reference.verifiedAt || "未记录"}`,
    `   核验边界：${reference.evidence || "未记录，不得当作已播放"}`,
  ].join("\n")).join("\n");
  const references = round.references.length
    ? round.references.map((reference, index) => `${index + 1}. ${reference.title || "未命名参考"}\n   链接：${safePracticeUrl(reference.url) ?? "未填写有效网页链接"}\n   时间段：${reference.timeRange || "未记录"}\n   只学：${reference.learn || "待分析"}\n   证据：${reference.evidence}；本轮标记：${reference.selected ? "选用候选（不等于成片目标已确认）" : "待比较"}`).join("\n")
    : "尚无参考候选。";
  return [
    `请协助我完成 AI 视频练习「${exercise.title}」的本轮研究（记录 ${round.id}）。`,
    `练习目标：${exercise.goal}`,
    `本轮阶段（用户手动记录）：${round.stage}。此状态不等于参考已核验、剧本已确认或视频已验收。`,
    "",
    "当前输入：",
    `作品名：${round.title || "待定"}`,
    `一句话目标：${round.goal || "待定"}`,
    `计划时长：${round.durationSeconds} 秒（最终控制在 60–120 秒）。`,
    `画幅：${round.aspectRatio}${round.aspectRatio === "未定" ? "（进入分镜与生产前须确认并锁定）" : "（本轮意向；已有项目以正式画幅锁为准）"}`,
    `成片描述：${round.filmDescription || "尚未确定，需要先研究参考并讨论"}`,
    `实验记录：${round.experimentNotes || "暂无"}`,
    `复盘：${round.reflection || "暂无"}`,
    `成片链接：${safePracticeUrl(round.finalUrl) ?? "未填写"}`,
    `教程链接：${safePracticeUrl(round.tutorialUrl) ?? "未填写"}`,
    "",
    "本练习已收录的具体对照视频（不是搜索结果页；资料核验不等于本轮已观看）：", baseReferences || "当前还没有合格参考，本练习暂不准入。",
    "",
    "已有参考候选：", references,
    "",
    `检索线索：${exercise.research.queries.join("；")}`,
    `重点观察：${exercise.research.lookFor.join("；")}`,
    `避免：${exercise.research.avoid.join("；")}`,
    `实验只变动：${exercise.experiment.variable}；固定：${exercise.experiment.fixed}`,
    `本轮验收关注：${exercise.acceptance.join("；")}`,
    "",
    "请先回到上面已收录的原视频并实际查看，确定这次具体对照哪个片段、只学什么，再讨论本次目标片。围绕已有原片推进，不以用户补齐更多参考作为启动前提，不从零搜索开始。给出来源链接、可复核时间段及不照搬的表达；无法查看时明确标注，不能以标题或搜索摘要冒充已观看。",
    "根据参考，推荐本次 60–120 秒 AI 视频成片候选，说明故事、镜头规模、重点实验、生成成本和可拆出的教程；当前页面上的候选、勾选与阶段记录都不是用户对最终方案的确认。",
    "先与我讨论并确认这次要做的成片，再按项目 SOP 推进。练习以 AI 生成视频为主，不安排真人拍摄作业。此次研究不自动创建新任务、不创建或运行视频节点、不消耗生成积分；任何后续生产须满足项目已有授权与门禁。",
  ].join("\n");
}
