import { describe, expect, it } from "vitest";
import {
  buildPracticeResearchTask,
  createPracticeRound,
  loadPracticeRounds,
  isPracticeVideoUrl,
  isReadyPracticeExercise,
  practiceRoundReadinessError,
  parsePracticeStore,
  practiceStorageKey,
  safePracticeUrl,
  savePracticeRounds,
  serializePracticeRounds,
  type PracticeExercise,
} from "./videoPractice";

const exercise: PracticeExercise = {
  id: "motivated-light", number: 1, title: "让光源参与叙事", trackId: "cinematography", level: "基础",
  summary: "用光源变化交代人物决定。", goal: "让光线变化与人物决定发生在同一个动作里。",
  principles: ["可见光源支撑方向"], prerequisites: [],
  experiment: { variable: "光源方向", baseline: "正面", variant: "侧面", fixed: "角色、场景与动作", inspect: "面部层次", stop: "已有足够区别" },
  film: { title: "最后一盏灯", premise: "关灯之前的决定", duration: "60–120 秒", scope: "一个场景", beats: ["犹豫", "决定"] },
  research: { queries: ["窗光 人物决定 短片"], lookFor: ["人物进入光线的动作"], avoid: ["只学滤镜"] },
  references: [{ id: "light-ref", title: "布光案例", author: "示例作者", platform: "抖音", url: "https://www.douyin.com/video/7595814311688146176", kind: "教程", durationLabel: "待核时长", focus: "侧光", locate: "先查看对应光位示例", evidence: "仅详情文字已核对，尚未播放", verifiedAt: "2026-09-24", status: "verified" }],
  acceptance: ["光线没有凭空跳变"], pitfalls: ["同时改变太多条件"], sources: [],
  publishing: { workTitle: "最后一盏灯", tutorialTitle: "让窗光说话", outline: ["展示对照"] }, cost: "低", recommended: true,
};

function memoryStorage() {
  const entries = new Map<string, string>();
  return {
    entries,
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => { entries.set(key, value); },
  };
}

describe("concrete video reference admission", () => {
  it("requires a verified specific video with useful provenance before starting a round", () => {
    expect(isReadyPracticeExercise(exercise)).toBe(true);
    expect(isReadyPracticeExercise({ ...exercise, references: [] })).toBe(false);
    expect(() => createPracticeRound({ ...exercise, references: [] }, "no-reference")).toThrow("具体平台视频");
    for (const reference of [
      { ...exercise.references[0], status: "pending" as const },
      { ...exercise.references[0], evidence: " " },
      { ...exercise.references[0], author: "" },
      { ...exercise.references[0], focus: "" },
      { ...exercise.references[0], title: "" },
      { ...exercise.references[0], verifiedAt: "" },
      { ...exercise.references[0], url: "https://www.douyin.com/search/AI" },
    ]) expect(isReadyPracticeExercise({ ...exercise, references: [reference] })).toBe(false);
  });

  it.each([
    "https://douyin.com.evil.example/video/7672693169921723684",
    "https://evil.example/douyin.com/video/7672693169921723684",
    "https://www.douyin.com@evil.example/video/7672693169921723684",
    "https://www.douyin.com:8443/video/7672693169921723684",
    "https://www.douyin.com/search/AI?video=7672693169921723684",
    "https://www.xiaohongshu.com/explore/not-a-real-id",
    "https://xiaohongshu.com.evil.example/explore/64ab0123456789abcdef0123",
    "javascript:https://www.douyin.com/video/7672693169921723684",
  ])("does not let a search URL or disguised domain qualify: %s", (url) => {
    expect(isPracticeVideoUrl(url)).toBe(false);
  });

  it("recognizes exact platform detail routes and keeps the declared platform honest", () => {
    expect(isPracticeVideoUrl("https://www.douyin.com/video/7672693169921723684", "抖音")).toBe(true);
    expect(isPracticeVideoUrl("https://jingxuan.douyin.com/m/video/7672693169921723684", "抖音")).toBe(true);
    expect(isPracticeVideoUrl("https://www.xiaohongshu.com/explore/64ab0123456789abcdef0123", "小红书")).toBe(true);
    expect(isPracticeVideoUrl("https://www.xiaohongshu.com/discovery/item/64ab0123456789abcdef0123?source=share", "小红书")).toBe(true);
    expect(isPracticeVideoUrl(exercise.references[0].url, "小红书")).toBe(false);
  });

  it("allows an undecided draft but blocks preparation until watching, selection, target and format are explicit", () => {
    const storage = memoryStorage();
    const round = createPracticeRound(exercise, "round-1");
    const draftSave = savePracticeRounds(storage, exercise, [round], null);
    expect(draftSave.ok).toBe(true);
    expect(round.references[0].evidence).toBe("未查看");
    expect(round.references[0].selected).toBe(false);
    round.stage = "准备试片";
    expect(practiceRoundReadinessError(exercise, round)).toContain("实际查看");
    round.references[0].selected = true;
    round.references[0].evidence = "已查看";
    expect(practiceRoundReadinessError(exercise, round)).toContain("这次要做成什么");
    round.filmDescription = " ";
    expect(practiceRoundReadinessError(exercise, round)).toContain("成片目标");
    round.filmDescription = "生成一段 90 秒的原创重逢片段，只练原片的光线变化。";
    expect(practiceRoundReadinessError(exercise, round)).toContain("画幅");
    round.aspectRatio = "9:16";
    expect(practiceRoundReadinessError(exercise, round)).toBeNull();
    expect(savePracticeRounds(storage, exercise, [round], draftSave.ok ? draftSave.raw : null).ok).toBe(true);
    round.references[0].learn = "";
    expect(practiceRoundReadinessError(exercise, round)).toContain("只学什么");
    round.references[0].learn = "侧光";
    round.references[0].url = "https://example.com/video";
    expect(practiceRoundReadinessError(exercise, round)).toContain("具体平台视频");
  });

  it("does not save a production stage that omits its target, while preserving the prior draft", () => {
    const storage = memoryStorage();
    const round = createPracticeRound(exercise, "round-1");
    const saved = savePracticeRounds(storage, exercise, [round], null);
    round.stage = "制作中";
    round.references[0].selected = true;
    round.references[0].evidence = "已查看";
    round.aspectRatio = "16:9";
    const result = savePracticeRounds(storage, exercise, [round], saved.ok ? saved.raw : null);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toContain("成片目标");
    expect(storage.getItem(practiceStorageKey(exercise.id))).toBe(saved.ok ? saved.raw : null);
  });
});

describe("practice browser storage", () => {
  it("keeps multiple rounds separate from another exercise, with history intact", () => {
    const storage = memoryStorage();
    const first = createPracticeRound(exercise, "round-1", "2026-09-24T01:00:00Z");
    first.title = "第一版";
    first.stage = "待定目标";
    const second = createPracticeRound(exercise, "round-2", "2026-09-25T01:00:00Z");
    second.goal = "只改方向";
    const otherExercise = { ...exercise, id: "reaction" };
    const other = createPracticeRound(otherExercise, "round-1", "2026-09-25T01:00:00Z");
    expect(savePracticeRounds(storage, exercise, [first, second], null).ok).toBe(true);
    expect(savePracticeRounds(storage, otherExercise, [other], null).ok).toBe(true);
    const loaded = loadPracticeRounds(storage, exercise.id);
    const otherLoaded = loadPracticeRounds(storage, otherExercise.id);
    expect(loaded.ok && loaded.rounds.map((round) => [round.id, round.title, round.stage])).toEqual([
      ["round-1", "第一版", "待定目标"], ["round-2", "", "待定目标"],
    ]);
    expect(otherLoaded.ok && otherLoaded.rounds).toEqual([other]);
    expect(loaded.ok && loaded.rounds[1].goal).toBe("只改方向");
  });

  it.each([
    "{broken",
    "null",
    JSON.stringify({ schemaVersion: 2, exerciseId: exercise.id, rounds: [] }),
    JSON.stringify({ schemaVersion: 1, exerciseId: "another-exercise", rounds: [] }),
    JSON.stringify({ schemaVersion: 1, exerciseId: exercise.id, rounds: [null] }),
  ])("preserves an unreadable stored payload without silently replacing it: %s", (raw) => {
    const storage = memoryStorage();
    storage.setItem(practiceStorageKey(exercise.id), raw);
    const loaded = loadPracticeRounds(storage, exercise.id);
    expect(loaded.ok).toBe(false);
    expect(loaded.raw).toBe(raw);
    expect(savePracticeRounds(storage, exercise, [createPracticeRound(exercise, "new")], raw).ok).toBe(false);
    expect(storage.getItem(practiceStorageKey(exercise.id))).toBe(raw);
  });

  it("rejects corrupted saved fields and unsafe saved reference URLs", () => {
    const round = createPracticeRound(exercise, "round-1");
    for (const changed of [
      { ...round, durationSeconds: 121 },
      { ...round, durationSeconds: 90.5 },
      { ...round, stage: "已自动验收" },
      { ...round, aspectRatio: "1:1" },
      { ...round, createdAt: "not a date" },
      { ...round, finalUrl: "javascript:alert(1)" },
      { ...round, references: [{ id: "r", title: "样本", url: "data:text/html,test", timeRange: "", learn: "", evidence: "已查看", selected: true }] },
    ]) {
      expect(parsePracticeStore(JSON.stringify({ schemaVersion: 1, exerciseId: exercise.id, rounds: [changed] }), exercise.id).ok).toBe(false);
    }
  });

  it("refuses to overwrite a newer value saved by another tab", () => {
    const storage = memoryStorage();
    const first = createPracticeRound(exercise, "round-1");
    const oldRaw = serializePracticeRounds(exercise.id, [first]);
    const newRaw = serializePracticeRounds(exercise.id, [{ ...first, reflection: "另一个标签页的复盘" }]);
    storage.setItem(practiceStorageKey(exercise.id), newRaw);
    const result = savePracticeRounds(storage, exercise, [{ ...first, title: "当前标签页的标题" }], oldRaw);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toContain("另一页面");
    expect(storage.getItem(practiceStorageKey(exercise.id))).toBe(newRaw);
  });

  it("reports quota and read failures rather than claiming data was saved", () => {
    const result = savePracticeRounds({ getItem: () => null, setItem: () => { throw new Error("QuotaExceededError"); } }, exercise, [createPracticeRound(exercise, "round-1")], null);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toContain("保存失败");
    expect(!result.ok && result.error).toContain("导出 JSON");
    const readResult = loadPracticeRounds({ getItem: () => { throw new Error("SecurityError"); } }, exercise.id);
    expect(readResult.ok).toBe(false);
    expect(!readResult.ok && readResult.error).toContain("无法读取");
  });
});

describe("safePracticeUrl", () => {
  it.each(["javascript:alert(1)", "data:text/html,test", "file:///Users/test/movie.mp4", "//example.com", "/video.mp4", "https://name:secret@example.com", "https://example.com\n/hidden", "ftp://example.com"]) ("does not expose an unsafe or non-web link: %s", (url) => {
    expect(safePracticeUrl(url)).toBeNull();
  });

  it("allows public references and loopback material links", () => {
    expect(safePracticeUrl(" https://example.com/watch?id=2#t=8 ")).toBe("https://example.com/watch?id=2#t=8");
    expect(safePracticeUrl("http://127.0.0.1:4373/projects/test")).toBe("http://127.0.0.1:4373/projects/test");
  });
});

describe("practice research handoff", () => {
  it("carries the actual draft and evidence state without presenting it as an approved plan", () => {
    const round = createPracticeRound(exercise, "round-3");
    round.title = "灯灭之前";
    round.stage = "待定目标";
    round.durationSeconds = 75;
    round.aspectRatio = "9:16";
    round.goal = "练侧光中的反应";
    round.filmDescription = "收到消息后决定留下";
    round.experimentNotes = "保持角色相同，只改方向";
    round.references = [{ id: "r1", title: "候选镜头", url: "https://example.com/reference", timeRange: "00:12–00:18", learn: "用影子表现迟疑", evidence: "未查看", selected: true }];
    const task = buildPracticeResearchTask(exercise, round);
    for (const text of ["灯灭之前", "待定目标", "75 秒", "9:16", "练侧光中的反应", "收到消息后决定留下", "保持角色相同，只改方向", "00:12–00:18", "证据：未查看", "选用候选（不等于成片目标已确认）", "先回到上面已收录的原视频并实际查看", "60–120 秒", "先与我讨论并确认", "不安排真人拍摄作业", "不创建或运行视频节点"]) {
      expect(task).toContain(text);
    }
    expect(task).not.toContain("已确认成片目标");
  });

  it("keeps an empty round undecided and never promotes the example film into its target", () => {
    const round = createPracticeRound(exercise, "round-1");
    const task = buildPracticeResearchTask(exercise, round);
    expect(round.filmDescription).toBe("");
    expect(task).toContain("作品名：待定");
    expect(task).toContain("画幅：未定");
    expect(task).toContain("布光案例");
    expect(task).toContain("核验边界：仅详情文字已核对，尚未播放");
    expect(round.references[0].evidence).toBe("未查看");
    expect(round.references[0].selected).toBe(false);
    expect(round.stage).toBe("待定目标");
    expect(task).not.toContain(exercise.film.title);
  });
});
