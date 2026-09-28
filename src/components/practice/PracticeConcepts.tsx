import { ExternalLink, BookOpenText } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { safePracticeUrl, type PracticeConcept } from '../../lib/videoPractice';

function ReadingLink({ url, children, className }: { url: string; children: ReactNode; className?: string }) {
  if (url.startsWith('/knowledge/areas/')) return <Link className={className} to={url}>{children}<BookOpenText size={14} aria-hidden="true" /></Link>;
  const safe = safePracticeUrl(url);
  return safe ? <a className={className} href={safe} target="_blank" rel="noreferrer">{children}<ExternalLink size={14} aria-hidden="true" /></a> : <span>{children}</span>;
}

function ConceptIllustration({ illustration }: { illustration: NonNullable<PracticeConcept['illustration']> }) {
  const [failed, setFailed] = useState(false);
  return <figure className="practice-concept-figure">
    {failed ? <div className="practice-image-fallback"><p>示例图暂未载入</p><ReadingLink url={illustration.sourceUrl}>去来源页看图</ReadingLink></div> : <a href={safePracticeUrl(illustration.src) ?? undefined} target="_blank" rel="noreferrer" className="practice-concept-image-link" aria-label={`查看原图：${illustration.work}`}>
      <img src={illustration.src} alt={illustration.alt} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
      <span>查看原图 <ExternalLink size={12} /></span>
    </a>}
    <figcaption><strong>{illustration.work}</strong><ReadingLink url={illustration.sourceUrl}>{illustration.credit}</ReadingLink></figcaption>
    <p className="practice-image-observation"><b>看这张图：</b>{illustration.lookFor}</p>
  </figure>;
}

export function PracticeConcepts({ concepts }: { concepts: PracticeConcept[] }) {
  const illustrated = concepts.some((concept) => concept.illustration);
  return <div className="practice-concepts">
    <p className="practice-concept-guide">点击概念名或下方讲解链接可继续学习。{illustrated ? '这些作品图例帮助辨认视觉选择，不是《我的妹妹不可爱》的截图；点击图片可看原图。' : '每条都标明资料语言和建议阅读位置。'}</p>
    <div className={illustrated ? 'practice-concept-gallery' : 'practice-concept-list'}>
      {concepts.map((concept) => <article className="practice-concept" key={concept.name}>
        <h3>{concept.readings[0] ? <ReadingLink url={concept.readings[0].url}>{concept.name}</ReadingLink> : concept.name}</h3>
        {concept.illustration && <ConceptIllustration illustration={concept.illustration} />}
        <div className="practice-concept-explanation"><p><b>是什么意思：</b>{concept.explanation}</p><p><b>怎样辨认：</b>{concept.visibleMechanism}</p></div>
        <ul className="practice-concept-readings" aria-label={`${concept.name}的学习链接`}>{concept.readings.map((reading) => <li key={`${reading.url}-${reading.title}`}>
          <ReadingLink url={reading.url}>{reading.title}</ReadingLink>
          <small>{reading.publisher} · {reading.language}</small><p>{reading.locate}</p>
        </li>)}</ul>
      </article>)}
    </div>
    {illustrated && <p className="practice-form-hint">图例保留原作构图，版权归原权利方；图片从来源站点加载。不同作品用来辨认选择，并非同一场景的严格风格实验。静帧不能说明动作、剪辑和声音，需结合来源中的动态片段。</p>}
  </div>;
}
