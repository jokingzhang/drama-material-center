import { useId, useLayoutEffect, useState } from "react";
import { Copy, Download, ExternalLink, Plus, Save, Trash2 } from "lucide-react";
import {
  PRACTICE_STAGES,
  buildPracticeResearchTask,
  createPracticeRound,
  isReadyPracticeExercise,
  loadPracticeRounds,
  safePracticeUrl,
  savePracticeRounds,
  serializePracticeRounds,
  type PracticeExercise,
  type PracticeLoadResult,
  type PracticeReference,
  type PracticeRound,
} from "../../lib/videoPractice";

interface PracticeDraftSession {
  initial: PracticeLoadResult;
  rounds: PracticeRound[];
  raw: string | null;
  selectedId: string;
  dirty: boolean;
}

// SPA navigation may unmount this form. Keep unsaved work in memory only;
// explicit Save remains the only operation that writes browser storage.
const draftSessions = new Map<string, PracticeDraftSession>();
let unloadListenerActive = false;
function warnBeforeDiscardingDrafts(event: BeforeUnloadEvent) {
  if (!draftSessions.size) return;
  event.preventDefault();
  event.returnValue = "";
}

function retainDraftSession(exerciseId: string, session: PracticeDraftSession) {
  if (session.dirty) draftSessions.set(exerciseId, session);
  else draftSessions.delete(exerciseId);
  if (draftSessions.size && !unloadListenerActive) {
    window.addEventListener("beforeunload", warnBeforeDiscardingDrafts);
    unloadListenerActive = true;
  } else if (!draftSessions.size && unloadListenerActive) {
    window.removeEventListener("beforeunload", warnBeforeDiscardingDrafts);
    unloadListenerActive = false;
  }
}

function load(exerciseId: string): PracticeLoadResult {
  try {
    return loadPracticeRounds(window.localStorage, exerciseId);
  } catch {
    return { ok: false, raw: null, error: "浏览器存储不可用，无法载入本轮记录。请检查存储权限后刷新。" };
  }
}

function uniqueId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function downloadText(filename: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "application/json;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

function WebLink({ value }: { value: string }) {
  const url = safePracticeUrl(value);
  return url ? <a href={url} target="_blank" rel="noreferrer">打开链接 <ExternalLink size={13} /></a> : null;
}

export function PracticeRounds({ exercise }: { exercise: PracticeExercise }) {
  return <PracticeRoundsSession key={exercise.id} exercise={exercise} />;
}

function PracticeRoundsSession({ exercise }: { exercise: PracticeExercise }) {
  const [session] = useState<PracticeDraftSession>(() => {
    const draft = draftSessions.get(exercise.id);
    if (draft) return draft;
    const initial = load(exercise.id);
    return {
      initial,
      rounds: initial.ok ? initial.rounds : [],
      raw: initial.raw,
      selectedId: initial.ok ? initial.rounds.at(-1)?.id ?? "" : "",
      dirty: false,
    };
  });
  const initial = session.initial;
  const [rounds, setRounds] = useState<PracticeRound[]>(session.rounds);
  const [raw, setRaw] = useState(session.raw);
  const [selectedId, setSelectedId] = useState(session.selectedId);
  const [dirty, setDirty] = useState(session.dirty);
  const [notice, setNotice] = useState<{ text: string; error: boolean }>({ text: session.dirty ? "已恢复尚未保存的草稿，仅在当前应用会话内保留。请保存或导出备份。" : "", error: false });
  const [copyFallback, setCopyFallback] = useState("");
  const headingId = useId();
  const round = rounds.find((item) => item.id === selectedId);
  const ready = isReadyPracticeExercise(exercise);

  useLayoutEffect(() => {
    retainDraftSession(exercise.id, { initial, rounds, raw, selectedId, dirty });
  }, [exercise.id, initial, rounds, raw, selectedId, dirty]);

  function updateRound(patch: Partial<PracticeRound>) {
    setRounds((current) => current.map((item) => item.id === selectedId
      ? { ...item, ...patch, updatedAt: new Date().toISOString() } : item));
    setDirty(true);
    setNotice({ text: "", error: false });
    setCopyFallback("");
  }

  function updateReference(id: string, patch: Partial<PracticeReference>) {
    if (!round) return;
    updateRound({ references: round.references.map((reference) => reference.id === id ? { ...reference, ...patch } : reference) });
  }

  function startRound() {
    if (!ready) {
      setNotice({ text: "本练习还没有已核对的具体抖音或小红书视频，暂不能开始。请先补齐对照参考。", error: true });
      return;
    }
    const next = createPracticeRound(exercise, uniqueId());
    setRounds((current) => [...current, next]);
    setSelectedId(next.id);
    setDirty(true);
    setCopyFallback("");
    setNotice({ text: "已创建本轮草稿并带入具体参考。请实际查看原视频，再讨论成片目标；填写后请保存。", error: false });
  }

  function save() {
    try {
      const result = savePracticeRounds(window.localStorage, exercise, rounds, raw);
      if (result.ok) {
        setRaw(result.raw);
        setDirty(false);
        setNotice({ text: `已保存本练习的 ${rounds.length} 轮记录，仅保存在当前浏览器。`, error: false });
      } else {
        setNotice({ text: result.error, error: true });
      }
    } catch {
      setNotice({ text: "保存失败：浏览器禁止访问存储。草稿暂留当前应用会话，请导出备份；刷新或关闭页面会丢失未保存内容。", error: true });
    }
  }

  function exportBackup(original = false) {
    try {
      const content = original ? initial.raw : serializePracticeRounds(exercise.id, rounds);
      if (content === null) return;
      downloadText(`ai-video-practice-${exercise.id}-${original ? "original-" : ""}${new Date().toISOString().replace(/[:.]/g, "-")}.json`, content);
      setNotice({ text: original ? "已发起原始记录下载，请保留这份备份后再处理存储问题。" : "已发起 JSON 备份下载，包含本练习所有轮次与当前草稿。请确认下载文件已保留。", error: false });
    } catch {
      setNotice({ text: "备份下载失败，请保留当前页面并检查浏览器下载权限。", error: true });
    }
  }

  async function copyResearchTask() {
    if (!round) return;
    const task = buildPracticeResearchTask(exercise, round);
    try {
      await navigator.clipboard.writeText(task);
      setCopyFallback("");
      setNotice({ text: "研究任务已复制。粘贴到当前会话，从已收录的原视频继续确定本轮目标；此操作没有发起生成。", error: false });
    } catch {
      setCopyFallback(task);
      setNotice({ text: "浏览器未允许复制，请从下方文本框全选并手动复制研究任务。", error: true });
    }
  }

  return (
    <section className="practice-rounds" aria-labelledby={headingId}>
      <header className="practice-rounds-heading">
        <div><h2 id={headingId}>把目标变成这一轮作品</h2><p>每次保留参考、实验与复盘，再决定下一轮只改什么。阶段由你手动更新。</p></div>
        <button className="primary-button" type="button" onClick={startRound} disabled={!initial.ok || !ready}><Plus size={16} />开始本轮练习</button>
      </header>
      <p className="practice-form-hint">未保存草稿会在当前应用内切换页面时保留，刷新或关闭前请先保存或备份。点击保存后记录仅写入当前浏览器，不写入项目素材库；清理浏览器会丢失已保存记录。</p>

      {!ready && <p className="practice-status-message is-error" role="status">此方向尚缺已核对的具体抖音或小红书视频，暂不开放新轮次和试片准备。搜索词或知识库文章不能替代对照视频。</p>}

      {!initial.ok && <div className="practice-status-message is-error" role="alert"><p>{initial.error}</p>{initial.raw !== null && <button className="secondary-button" type="button" onClick={() => exportBackup(true)}><Download size={15} />导出原始记录</button>}</div>}

      {initial.ok && !round && <div className="practice-round-empty"><strong>本项还没有练习记录</strong><p>{ready ? "创建一轮草稿会带入本项具体参考。先回到原视频确定要学的机制，再讨论并确认这次的 1–2 分钟短片。页面里的示例只是起点。" : "待具体对照视频补齐后，再围绕目标片开始练习。"}</p></div>}

      {initial.ok && round && <>
        <div className="practice-round-toolbar">
          <label className="practice-field">历史轮次<select value={selectedId} onChange={(event) => { setSelectedId(event.target.value); setCopyFallback(""); }}>
            {rounds.map((item, index) => <option key={item.id} value={item.id}>第 {index + 1} 轮 · {item.title || "未定作品名"} · {item.stage}</option>)}
          </select></label>
          <span className="practice-form-hint">{dirty ? "有未保存更改" : "记录已保存"}</span>
          <div className="practice-inline-actions">
            <button className="primary-button" type="button" onClick={save}><Save size={15} />保存记录</button>
            <button className="secondary-button" type="button" onClick={() => exportBackup()}><Download size={15} />导出备份</button>
          </div>
        </div>

        <div className="practice-round-form">
          <div className="practice-form-grid">
            <label className="practice-field">本轮作品名<input value={round.title} onChange={(event) => updateRound({ title: event.target.value })} placeholder="参考研究后再定，例如《最后一盏灯》" /></label>
            <label className="practice-field">当前阶段<select value={round.stage} onChange={(event) => updateRound({ stage: event.target.value as PracticeRound["stage"] })}>{PRACTICE_STAGES.map((stage) => <option key={stage}>{stage}</option>)}</select></label>
            <label className="practice-field practice-field-wide">一句话训练目标<textarea rows={2} value={round.goal} onChange={(event) => updateRound({ goal: event.target.value })} /></label>
            <label className="practice-field">目标时长（60–120 秒）<input type="number" min={60} max={120} step={1} value={round.durationSeconds || ""} onChange={(event) => updateRound({ durationSeconds: Number(event.target.value) })} /></label>
            <label className="practice-field">本轮画幅意向<select value={round.aspectRatio} onChange={(event) => updateRound({ aspectRatio: event.target.value as PracticeRound["aspectRatio"] })}><option>未定</option><option>9:16</option><option>16:9</option></select></label>
            <label className="practice-field practice-field-wide">这次要做成什么<textarea rows={4} value={round.filmDescription} onChange={(event) => updateRound({ filmDescription: event.target.value })} placeholder="先记候选：人物、事件、转折、视觉目标和结尾。讨论确认后，再记录最终方案与确认范围。" /></label>
          </div>
          <p className="practice-form-hint">这里记录计划与学习进度。“选用参考”或“完成”不代表项目剧本、台词、画幅锁或成片已通过正式验收。</p>

          <section className="practice-round-section">
            <header className="practice-reference-heading"><div><h3>参考候选</h3><p>把“喜欢”写成可复核的时间段与可学习的机制；只借鉴本轮目标需要的部分。</p></div><button className="secondary-button" type="button" onClick={() => updateRound({ references: [...round.references, { id: uniqueId(), title: "", url: "", timeRange: "", learn: "", evidence: "未查看", selected: false }] })}><Plus size={15} />添加参考</button></header>
            {!round.references.length && <p className="practice-form-hint">本轮还未记录参考。请先查看本项收录的具体视频，并记录本次要学习的片段。</p>}
            <div className="practice-reference-list">
              {round.references.map((reference, index) => <article className="practice-reference-card" key={reference.id}>
                <div className="practice-reference-heading"><strong>参考 {index + 1}</strong><button className="secondary-button" type="button" aria-label={`移除参考 ${index + 1}`} onClick={() => updateRound({ references: round.references.filter((item) => item.id !== reference.id) })}><Trash2 size={14} />移除</button></div>
                <div className="practice-form-grid">
                  <label className="practice-field">标题<input value={reference.title} onChange={(event) => updateReference(reference.id, { title: event.target.value })} /></label>
                  <label className="practice-field">目标时间段<input value={reference.timeRange} onChange={(event) => updateReference(reference.id, { timeRange: event.target.value })} placeholder="例如 00:18–00:26" /></label>
                  <label className="practice-field practice-field-wide">来源链接<input type="url" value={reference.url} onChange={(event) => updateReference(reference.id, { url: event.target.value })} placeholder="https://…" /></label>
                  <label className="practice-field practice-field-wide">只学什么<textarea rows={2} value={reference.learn} onChange={(event) => updateReference(reference.id, { learn: event.target.value })} placeholder="例如：让角色从阴影走进窗光，标记她的决定。" /></label>
                  <label className="practice-field">观看证据<select value={reference.evidence} onChange={(event) => updateReference(reference.id, { evidence: event.target.value as PracticeReference["evidence"] })}><option>未查看</option><option>已查看</option></select></label>
                  <label className="practice-checkbox"><input type="checkbox" checked={reference.selected} onChange={(event) => updateReference(reference.id, { selected: event.target.checked })} />选为本轮参考候选</label>
                </div>
                <WebLink value={reference.url} />
              </article>)}
            </div>
          </section>

          <section className="practice-round-section">
            <h3>实验与复盘</h3>
            <div className="practice-form-grid">
              <label className="practice-field practice-field-wide">实验记录<textarea rows={4} value={round.experimentNotes} onChange={(event) => updateRound({ experimentNotes: event.target.value })} placeholder="模型与输入版本 / 本次只改什么 / 固定什么 / A、B 结果 / 实际花费与失败原因" /></label>
              <label className="practice-field practice-field-wide">复盘与下一轮<textarea rows={4} value={round.reflection} onChange={(event) => updateRound({ reflection: event.target.value })} placeholder="目标达到了吗？证据在哪个时间点？哪个改动有效？下一轮只改什么？" /></label>
              <label className="practice-field">成片链接<input type="url" value={round.finalUrl} onChange={(event) => updateRound({ finalUrl: event.target.value })} placeholder="http:// 或 https://，可留空" /></label>
              <label className="practice-field">教程链接<input type="url" value={round.tutorialUrl} onChange={(event) => updateRound({ tutorialUrl: event.target.value })} placeholder="http:// 或 https://，可留空" /></label>
            </div>
            <div className="practice-inline-actions">{safePracticeUrl(round.finalUrl) && <span>成片：<WebLink value={round.finalUrl} /></span>}{safePracticeUrl(round.tutorialUrl) && <span>教程：<WebLink value={round.tutorialUrl} /></span>}</div>
          </section>
          <div className="practice-inline-actions">
            <button className="primary-button" type="button" onClick={save}><Save size={15} />保存记录</button>
            <button className="secondary-button" type="button" onClick={() => void copyResearchTask()}><Copy size={15} />复制本轮研究任务</button>
          </div>
          <p className="practice-form-hint">把任务粘贴到当前会话：先回到已收录的原视频实际查看，再讨论本次成片目标。准备试片前须选用至少 1 个已查看参考，填写成片描述并选择画幅。复制不会创建任务或运行视频生成。</p>
        </div>
      </>}

      {notice.text && <p className={`practice-status-message ${notice.error ? "is-error" : "is-success"}`} role={notice.error ? "alert" : "status"}>{notice.text}</p>}
      {copyFallback && <label className="practice-field practice-copy-fallback">手动复制研究任务<textarea rows={12} value={copyFallback} readOnly onFocus={(event) => event.currentTarget.select()} /></label>}
    </section>
  );
}
