#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const CARD_STATUSES = new Set(['OBSERVED', 'REUSABLE', 'VALIDATED', 'RETIRED']);
const CARD_KINDS = new Set(['pattern', 'risk']);
const STANDARD_KINDS = new Set(['asset-standard', 'shot-type', 'workflow-standard']);
const POLICY_STATUSES = new Set(['DRAFT', 'ACTIVE', 'RETIRED']);
const EVIDENCE_STATUSES = new Set(['OBSERVED', 'REUSABLE', 'VALIDATED']);
const EVIDENCE_STATUS_RANK = new Map([['OBSERVED', 1], ['REUSABLE', 2], ['VALIDATED', 3]]);
const DOMAINS = new Set(['narrative', 'visual-material', 'cinematography', 'workflow']);
const KNOWLEDGE_AREAS = new Set(['script', 'image-asset', 'shot-prompt']);
const KNOWLEDGE_AREA_ROLES = new Set(['PRIMARY', 'CROSS_CUTTING']);
const STRENGTHS = new Set(['LOW', 'MEDIUM', 'HIGH']);
const CASE_ORIGINS = new Set(['external-work', 'own-production']);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const PRACTICE_ID_RE = /^PRACTICE-(\d{8})-[A-Z0-9]+(?:-[A-Z0-9]+)+$/;
const DECISION_ID_RE = /^(?:DEV|DIR)-[A-Z0-9]+(?:-[A-Z0-9]+)*-\d{3}$/;
const WANTS_JSON = process.argv.includes('--json');
const CASE_V1_REQUIRED_HEADINGS = ['案例定位', '证据状态', '四领域结论', '知识卡', '未确认', '原始拆解'];
const CASE_V2_REQUIRED_HEADINGS = ['案例定位', '证据状态', '五层结论', '知识增量', '未确认', '原始拆解'];
const CASE_V2_LAYER_HEADINGS = ['剧情', '画面与素材', '分镜、景别与运镜', '提示词转译', '工作流'];
const CASE_V2_DELTA_HEADINGS = ['新发现', '重复验证', '相互冲突'];
const CARD_REQUIRED_HEADINGS = [
  '问题', '银幕事实', '机制', '适用条件', '不适用条件',
  'AI 制作转译', '验收', '失败信号', '证据', '实践记录',
];
const STANDARD_REQUIRED_HEADINGS = [
  '适用范围', '输入', '决策规则', '输出合同', '验收', '停止条件', '证据与成熟度',
];

function usage(exitCode = 0) {
  const stream = exitCode === 0 ? process.stdout : process.stderr;
  stream.write('Usage:\n');
  stream.write('  director_kb.mjs validate --root <absolute-kb-root> [--json]\n');
  stream.write('  director_kb.mjs standards --root <absolute-kb-root> [--kind <kind>] [--domain <domain>] [--policy-status <status>] [--tag <tag>] [--query <text>] [--limit <n>] [--json]\n');
  stream.write('  director_kb.mjs search --root <absolute-kb-root> [--domain <domain>] [--status <status>] [--tag <tag>] [--query <text>] [--limit <n>] [--json]\n');
  process.exit(exitCode);
}

function parseArgs(argv) {
  if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) usage(0);
  const command = argv[0];
  const options = {};
  for (let index = 1; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) throw new Error(`Unexpected argument: ${token}`);
    const key = token.slice(2);
    if (key === 'json') {
      options.json = true;
      continue;
    }
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for --${key}`);
    options[key] = value;
    index += 1;
  }
  return { command, options };
}

function resolveRoot(rootValue) {
  if (!rootValue) throw new Error('--root is required; pass the exact knowledge-base root.');
  if (!path.isAbsolute(rootValue)) throw new Error('--root must be an absolute path.');
  const root = path.resolve(rootValue);
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    throw new Error(`Knowledge-base root does not exist: ${root}`);
  }
  return root;
}

function walkMarkdown(directory) {
  if (!fs.existsSync(directory)) return [];
  const results = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) results.push(...walkMarkdown(target));
    else if (entry.isFile() && entry.name.endsWith('.md')) results.push(target);
  }
  return results.sort();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripFencedCode(text) {
  let fence = null;
  const withoutFences = text.split('\n').map((line) => {
    const marker = line.match(/^\s{0,3}(```+|~~~+)/)?.[1];
    if (marker) {
      if (!fence) fence = marker[0];
      else if (marker[0] === fence) fence = null;
      return ' '.repeat(line.length);
    }
    return fence ? ' '.repeat(line.length) : line;
  }).join('\n');
  return withoutFences.replace(/<!--[\s\S]*?-->/g, (comment) => comment.replace(/[^\n]/g, ' '));
}

function hasHeading(text, heading) {
  return new RegExp(`^##\\s+${escapeRegExp(heading)}\\s*$`, 'm').test(stripFencedCode(text));
}

function hasSubheading(text, heading) {
  return new RegExp(`^###\\s+${escapeRegExp(heading)}\\s*$`, 'm').test(stripFencedCode(text));
}

function sectionBody(text, level, heading) {
  const clean = stripFencedCode(text);
  const marker = '#'.repeat(level);
  const start = new RegExp(`^${marker}\\s+${escapeRegExp(heading)}\\s*$`, 'm').exec(clean);
  if (!start) return null;
  const bodyStart = start.index + start[0].length;
  const next = new RegExp(`^#{1,${level}}\\s+`, 'm');
  const remainder = clean.slice(bodyStart);
  const end = next.exec(remainder)?.index ?? remainder.length;
  return remainder.slice(0, end);
}

function hasMeaningfulContent(body) {
  if (body === null) return false;
  const normalized = stripFencedCode(body)
    .replace(/^#{1,6}\s+.*$/gm, '')
    .replace(/^[-*+]\s*/gm, '')
    .replace(/[`*_~]/g, '')
    .trim();
  return normalized.length > 0
    && !/^(无|none|n\/a|tbd|todo|placeholder|占位|稍后补充|待补充|待定|待确认|未确认|尚未完成|待人工(?:播放|试听|观看|验收|确认))[。.!！?？\s]*$/i.test(normalized);
}

function hasDeclaredContent(body) {
  if (body === null) return false;
  return body.replace(/^#{1,6}\s+.*$/gm, '').trim().length > 0;
}

function extractIdBlocks(text, prefix) {
  const clean = stripFencedCode(text);
  const matches = [...clean.matchAll(new RegExp(`^###\\s+(${escapeRegExp(prefix)}[A-Z0-9-]+)\\b[^\\n]*$`, 'gm'))];
  return matches.map((match, index) => ({
    id: match[1],
    body: clean.slice(match.index + match[0].length, matches[index + 1]?.index ?? clean.length),
  }));
}

function hasBullet(body, label) {
  return new RegExp(`^-\\s+${escapeRegExp(label)}：`, 'm').test(body);
}

function bulletValue(body, label) {
  return body.match(new RegExp(`^-\\s+${escapeRegExp(label)}：\\s*(.*?)\\s*$`, 'm'))?.[1]?.trim() ?? null;
}

function unquote(value) {
  return value?.replace(/^`|`$/g, '').trim() ?? null;
}

function isPendingValue(value) {
  const normalized = unquote(value)?.toLocaleLowerCase();
  return !normalized
    || /^(unknown|not[_ -]?done|pending|n\/a|tbd|todo|待补充|待确认|未完成|无法判断)$/.test(normalized)
    || /(?:待|尚未|还未|未实际)(?:人工)?(?:播放|试听|观看|验收|确认)|待人工(?:播放|试听|观看|验收|确认)/i.test(normalized);
}

function isValidDate(value) {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function hasActualPlaybackOrListening(value) {
  if (isPendingValue(value)) return false;
  const normalized = unquote(value) ?? '';
  return /(?:实际|完整|逐段|逐镜)?(?:播放|试听|观看|收看)|playback|viewed|watched|listened/i.test(normalized);
}

function isHumanConfirmer(value) {
  const normalized = unquote(value);
  return !isPendingValue(normalized)
    && !/\b(?:agent|codex|ai|model|automation)\b|ai\s*director|模型|自动|智能体|人工智能/i.test(normalized ?? '');
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function requireString(meta, key, file, errors) {
  if (typeof meta[key] !== 'string' || meta[key].trim() === '') errors.push(`${file}: ${key} must be a non-empty string`);
}

function requireStringArray(meta, key, file, errors, allowEmpty = false) {
  const value = meta[key];
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0) || value.some((item) => typeof item !== 'string' || item.trim() === '')) {
    errors.push(`${file}: ${key} must be ${allowEmpty ? 'a' : 'a non-empty'} string array`);
  }
}

function validateKnowledgeClassification(meta, file, errors) {
  requireStringArray(meta, 'knowledgeAreas', file, errors);
  const areas = Array.isArray(meta.knowledgeAreas) ? meta.knowledgeAreas : [];
  for (const area of areas) {
    if (!KNOWLEDGE_AREAS.has(area)) errors.push(`${file}: unsupported knowledgeArea ${area}`);
  }
  if (new Set(areas).size !== areas.length) errors.push(`${file}: knowledgeAreas must not contain duplicates`);
  if (!KNOWLEDGE_AREA_ROLES.has(meta.knowledgeAreaRole)) {
    errors.push(`${file}: knowledgeAreaRole must be PRIMARY or CROSS_CUTTING`);
  } else if (meta.knowledgeAreaRole === 'PRIMARY' && areas.length !== 1) {
    errors.push(`${file}: PRIMARY knowledge entries must name exactly one knowledgeArea`);
  } else if (meta.knowledgeAreaRole === 'CROSS_CUTTING' && areas.length < 2) {
    errors.push(`${file}: CROSS_CUTTING knowledge entries must name at least two knowledgeAreas`);
  }
}

function validateUsageContract(meta, file, errors) {
  const contract = meta.usageContract;
  if (!isPlainObject(contract)) {
    errors.push(`${file}: usageContract must be an object`);
    return;
  }
  for (const key of ['triggers', 'exclusions', 'requiredInputs', 'outputTargets', 'stopConditions']) {
    const values = contract[key];
    if (!Array.isArray(values) || values.length === 0 || values.some((item) => typeof item !== 'string' || item.trim() === '')) {
      errors.push(`${file}: usageContract.${key} must be a non-empty string array`);
    }
  }
  if (!isPlainObject(contract.acceptance)) {
    errors.push(`${file}: usageContract.acceptance must be an object`);
    return;
  }
  for (const key of ['machineChecks', 'actualViewing', 'actualListening', 'humanAcceptance']) {
    const values = contract.acceptance[key];
    if (!Array.isArray(values) || values.length === 0 || values.some((item) => typeof item !== 'string' || item.trim() === '')) {
      errors.push(`${file}: usageContract.acceptance.${key} must be a non-empty string array`);
    }
  }
}

function validateCaseRecord(record, errors) {
  const { meta, text, file } = record;
  if (![1, 2].includes(meta.schemaVersion)) errors.push(`${file}: schemaVersion must be 1 or 2`);
  requireString(meta, 'id', file, errors);
  if (meta.kind !== 'case') errors.push(`${file}: kind must be case`);
  if (meta.schemaVersion === 2 && !CASE_ORIGINS.has(meta.origin)) errors.push(`${file}: schemaVersion 2 requires origin external-work or own-production`);
  requireString(meta, 'title', file, errors);
  requireString(meta, 'path', file, errors);
  if (!isValidDate(meta.studiedAt)) errors.push(`${file}: studiedAt must be a real date using YYYY-MM-DD`);
  requireString(meta, 'sourceDocument', file, errors);
  requireString(meta, 'evidenceDocument', file, errors);
  requireStringArray(meta, 'domains', file, errors);
  requireStringArray(meta, 'derivedCardIds', file, errors, true);
  validateKnowledgeClassification(meta, file, errors);
  for (const domain of Array.isArray(meta.domains) ? meta.domains : []) if (!DOMAINS.has(domain)) errors.push(`${file}: unsupported domain ${domain}`);
  const requiredHeadings = meta.schemaVersion === 2 ? CASE_V2_REQUIRED_HEADINGS : CASE_V1_REQUIRED_HEADINGS;
  for (const heading of requiredHeadings) if (!hasHeading(text, heading)) errors.push(`${file}: missing heading ## ${heading}`);
  if (meta.schemaVersion === 2) {
    const layers = sectionBody(text, 2, '五层结论');
    const delta = sectionBody(text, 2, '知识增量');
    for (const heading of CASE_V2_LAYER_HEADINGS) {
      if (!hasSubheading(layers ?? '', heading)) errors.push(`${file}: ## 五层结论 missing heading ### ${heading}`);
      else if (!hasMeaningfulContent(sectionBody(layers ?? '', 3, heading))) errors.push(`${file}: ### ${heading} must not be empty`);
    }
    for (const heading of CASE_V2_DELTA_HEADINGS) {
      if (!hasSubheading(delta ?? '', heading)) errors.push(`${file}: ## 知识增量 missing heading ### ${heading}`);
      else if (!hasDeclaredContent(sectionBody(delta ?? '', 3, heading))) errors.push(`${file}: ### ${heading} must state evidence-backed entries or 无`);
    }
  }
}

function validateCardRecord(record, validationText, errors) {
  const { meta, text, file } = record;
  const cardMetaId = typeof meta.id === 'string' ? meta.id : '';
  const sourceCaseIds = Array.isArray(meta.sourceCaseIds) ? meta.sourceCaseIds : [];
  if (meta.schemaVersion !== 2) errors.push(`${file}: schemaVersion must be 2`);
  requireString(meta, 'id', file, errors);
  if (!/^DRAMA-(PAT|RISK)-\d{3}$/.test(meta.id ?? '')) errors.push(`${file}: id must match DRAMA-PAT-### or DRAMA-RISK-###`);
  if (!CARD_KINDS.has(meta.kind)) errors.push(`${file}: unsupported kind ${meta.kind}`);
  requireString(meta, 'title', file, errors);
  requireString(meta, 'path', file, errors);
  if (!DOMAINS.has(meta.domain)) errors.push(`${file}: unsupported domain ${meta.domain}`);
  if (!CARD_STATUSES.has(meta.status)) errors.push(`${file}: unsupported status ${meta.status}`);
  requireStringArray(meta, 'tags', file, errors);
  requireStringArray(meta, 'sourceCaseIds', file, errors);
  requireStringArray(meta, 'evidenceRefs', file, errors);
  validateKnowledgeClassification(meta, file, errors);
  validateUsageContract(meta, file, errors);
  if (!STRENGTHS.has(meta.evidenceStrength)) errors.push(`${file}: unsupported evidenceStrength ${meta.evidenceStrength}`);
  for (const key of ['sourceCount', 'ownProductionUses', 'ownAcceptedUses']) {
    if (!Number.isInteger(meta[key]) || meta[key] < 0) errors.push(`${file}: ${key} must be a non-negative integer`);
  }
  if ((meta.sourceCount ?? -1) !== new Set(sourceCaseIds).size) errors.push(`${file}: sourceCount must equal unique sourceCaseIds count`);
  if (!isValidDate(meta.createdAt)) errors.push(`${file}: createdAt must be a real date using YYYY-MM-DD`);
  if (!isValidDate(meta.updatedAt)) errors.push(`${file}: updatedAt must be a real date using YYYY-MM-DD`);
  if (meta.status === 'REUSABLE' && meta.sourceCount < 2 && meta.ownAcceptedUses < 1) {
    errors.push(`${file}: REUSABLE requires two source cases or one accepted own-production use`);
  }
  if (meta.status === 'VALIDATED' && meta.ownAcceptedUses < 2) {
    errors.push(`${file}: VALIDATED requires at least two accepted own-production uses`);
  }
  for (const heading of CARD_REQUIRED_HEADINGS) {
    if (!hasHeading(text, heading)) errors.push(`${file}: missing heading ## ${heading}`);
    else if (!hasMeaningfulContent(sectionBody(text, 2, heading))) errors.push(`${file}: ## ${heading} must not be empty or placeholder-only`);
  }

  const practiceBlocks = extractIdBlocks(sectionBody(text, 2, '实践记录') ?? '', 'PRACTICE-');
  const practiceIds = practiceBlocks.map(({ id }) => id);
  for (const id of practiceIds) {
    if (!PRACTICE_ID_RE.test(id)) errors.push(`${file}: practice ID ${id} must match PRACTICE-YYYYMMDD-PROJECT-SHOT`);
  }
  for (const id of new Set(practiceIds)) {
    if (practiceIds.filter((value) => value === id).length > 1) errors.push(`${file}: duplicate practice ID ${id}`);
  }
  if (practiceBlocks.length !== (meta.ownProductionUses ?? 0)) {
    errors.push(`${file}: ownProductionUses must equal structured PRACTICE record count`);
  }
  const acceptedBlocks = practiceBlocks.filter(({ body }) => /^\-\s+计入人工接受：\s*`?YES`?\s*$/m.test(body));
  if (acceptedBlocks.length !== (meta.ownAcceptedUses ?? 0)) {
    errors.push(`${file}: ownAcceptedUses must equal PRACTICE records marked YES`);
  }
  const requiredPracticeFields = [
    '日期', '项目 / 集数 / 镜头', '决策 ID', '知识卡 ID 与版本', '预期观众效果',
    '实际执行与结果', '实际播放 / 试听证据', '人工结论', '确认人', '计入人工接受',
    '成本与副作用', '状态决定', '证据路径',
  ];
  const validationPracticeBlocks = extractIdBlocks(validationText, 'PRACTICE-');
  const usedTargets = new Set();
  for (const block of practiceBlocks) {
    for (const label of requiredPracticeFields) {
      const value = bulletValue(block.body, label);
      if (value === null) errors.push(`${file}: ${block.id} missing field ${label}`);
      else if (value.trim() === '') errors.push(`${file}: ${block.id} field ${label} must not be empty`);
    }
    const date = unquote(bulletValue(block.body, '日期'));
    if (!isValidDate(date)) errors.push(`${file}: ${block.id} 日期 must be a real date using YYYY-MM-DD`);
    const compactDate = PRACTICE_ID_RE.exec(block.id)?.[1];
    if (compactDate && date?.replaceAll('-', '') !== compactDate) errors.push(`${file}: ${block.id} date segment must match 日期`);
    const decisionId = unquote(bulletValue(block.body, '决策 ID'));
    if (!DECISION_ID_RE.test(decisionId ?? '')) {
      errors.push(`${file}: ${block.id} must bind an exact DEV-<scope>-### or DIR-<scope>-### decision ID`);
    }
    const cardId = unquote(bulletValue(block.body, '知识卡 ID 与版本'));
    if (!new RegExp(`^${escapeRegExp(cardMetaId)}(?:\\s+|@)v\\d+$`, 'i').test(cardId ?? '')) {
      errors.push(`${file}: ${block.id} 知识卡 ID 与版本 must exactly name ${meta.id} and a v<number> version`);
    }
    const accepted = unquote(bulletValue(block.body, '计入人工接受'));
    if (!['YES', 'NO'].includes(accepted ?? '')) errors.push(`${file}: ${block.id} 计入人工接受 must be YES or NO`);
    if (accepted === 'YES') {
      if (isPendingValue(bulletValue(block.body, '人工结论'))) errors.push(`${file}: ${block.id} accepted practice requires a human conclusion`);
      if (!hasActualPlaybackOrListening(bulletValue(block.body, '实际播放 / 试听证据'))) errors.push(`${file}: ${block.id} accepted practice requires explicit actual playback or listening evidence`);
      const confirmer = bulletValue(block.body, '确认人');
      if (!isHumanConfirmer(confirmer)) {
        errors.push(`${file}: ${block.id} accepted practice requires an identified human confirmer`);
      }
    }
    const target = unquote(bulletValue(block.body, '项目 / 集数 / 镜头'));
    if (target && usedTargets.has(target)) errors.push(`${file}: duplicate own-production target ${target}`);
    if (target) usedTargets.add(target);

    const matchingValidation = validationPracticeBlocks.filter(({ id }) => id === block.id);
    if (matchingValidation.length !== 1) {
      errors.push(`${file}: ${block.id} must appear exactly once in 验证/验证记录.md`);
      continue;
    }
    for (const label of requiredPracticeFields) {
      const cardValue = bulletValue(block.body, label);
      const validationValue = bulletValue(matchingValidation[0].body, label);
      if (cardValue !== validationValue) errors.push(`${file}: ${block.id} field ${label} differs from 验证/验证记录.md`);
    }
  }
}

function validateStandardRecord(record, errors) {
  const { meta, text, file } = record;
  if (meta.schemaVersion !== 2) errors.push(`${file}: schemaVersion must be 2`);
  requireString(meta, 'id', file, errors);
  if (!/^DRAMA-STD-(ASSET|SHOT|WORKFLOW)-\d{3}$/.test(meta.id ?? '')) {
    errors.push(`${file}: id must match DRAMA-STD-ASSET-###, DRAMA-STD-SHOT-###, or DRAMA-STD-WORKFLOW-###`);
  }
  if (!STANDARD_KINDS.has(meta.kind)) errors.push(`${file}: unsupported standard kind ${meta.kind}`);
  requireString(meta, 'title', file, errors);
  requireString(meta, 'path', file, errors);
  if (!DOMAINS.has(meta.domain)) errors.push(`${file}: unsupported domain ${meta.domain}`);
  if (!POLICY_STATUSES.has(meta.policyStatus)) errors.push(`${file}: unsupported policyStatus ${meta.policyStatus}`);
  if (!EVIDENCE_STATUSES.has(meta.evidenceStatus)) errors.push(`${file}: unsupported evidenceStatus ${meta.evidenceStatus}`);
  if (typeof meta.version !== 'string' || !/^\d+\.\d+\.\d+$/.test(meta.version)) {
    errors.push(`${file}: version must use semantic version form x.y.z`);
  }
  requireStringArray(meta, 'tags', file, errors);
  requireStringArray(meta, 'triggerFeatures', file, errors);
  requireStringArray(meta, 'exclusionFeatures', file, errors, true);
  requireStringArray(meta, 'sourceCardIds', file, errors);
  validateKnowledgeClassification(meta, file, errors);
  validateUsageContract(meta, file, errors);
  if (meta.evidenceOverrides !== undefined) {
    if (!Array.isArray(meta.evidenceOverrides)) {
      errors.push(`${file}: evidenceOverrides must be an array when present`);
    } else {
      const seenFeatures = new Set();
      for (const [index, override] of meta.evidenceOverrides.entries()) {
        const label = `${file}: evidenceOverrides[${index}]`;
        if (!isPlainObject(override)) {
          errors.push(`${label} must be an object`);
          continue;
        }
        requireString(override, 'feature', label, errors);
        if (typeof override.feature === 'string') {
          if (seenFeatures.has(override.feature)) errors.push(`${label}: duplicate feature ${override.feature}`);
          seenFeatures.add(override.feature);
          const cleanStandard = stripFencedCode(text);
          const featurePattern = meta.kind === 'shot-type'
            ? new RegExp('^\\|\\s*`' + escapeRegExp(override.feature) + '`\\s*\\|', 'm')
            : new RegExp('`' + escapeRegExp(override.feature) + '`');
          if (!featurePattern.test(cleanStandard)) {
            errors.push(`${label}: feature ${override.feature} is not declared in the standard body`);
          }
        }
        if (!EVIDENCE_STATUSES.has(override.evidenceStatus)) {
          errors.push(`${label}: unsupported evidenceStatus ${override.evidenceStatus}`);
        }
        requireString(override, 'reason', label, errors);
        if (typeof override.representativeTestRequired !== 'boolean') {
          errors.push(`${label}: representativeTestRequired must be boolean`);
        }
        requireStringArray(override, 'sourceCardIds', label, errors);
      }
    }
  }
  if (!isValidDate(meta.createdAt)) errors.push(`${file}: createdAt must be a real date using YYYY-MM-DD`);
  if (!isValidDate(meta.updatedAt)) errors.push(`${file}: updatedAt must be a real date using YYYY-MM-DD`);
  for (const heading of STANDARD_REQUIRED_HEADINGS) {
    if (!hasHeading(text, heading)) errors.push(`${file}: missing heading ## ${heading}`);
    else if (!hasMeaningfulContent(sectionBody(text, 2, heading))) errors.push(`${file}: ## ${heading} must not be empty or placeholder-only`);
  }
}

function validateEvidenceDocument(caseRecord, evidenceText, displayFile, errors) {
  const blocks = extractIdBlocks(evidenceText, 'EV-');
  const ids = blocks.map(({ id }) => id);
  for (const id of new Set(ids)) {
    if (ids.filter((value) => value === id).length > 1) errors.push(`${displayFile}: duplicate evidence ID ${id}`);
  }
  if (blocks.length === 0) errors.push(`${displayFile}: evidence ledger has no EV-* entries`);
  const isV2 = caseRecord.meta.schemaVersion === 2;
  const requiredEvidenceFields = ['类型', '来源', '检查', '观察', '可信度', ...(isV2 ? ['读取日期'] : [])];
  const legacyReadDate = stripFencedCode(evidenceText).match(/读取日期均为\s*`?(\d{4}-\d{2}-\d{2})`?/)?.[1];
  for (const block of blocks) {
    for (const label of requiredEvidenceFields) {
      const value = bulletValue(block.body, label);
      if (value === null) errors.push(`${displayFile}: ${block.id} missing field ${label}`);
      else if (value.trim() === '') errors.push(`${displayFile}: ${block.id} field ${label} must not be empty`);
    }
    if (hasBullet(block.body, '类型') && !/^-\s+类型：\s*`?(DIRECT_FACT|ANALYTICAL_INFERENCE|UNKNOWN)`?\s*$/m.test(block.body)) {
      errors.push(`${displayFile}: ${block.id} has unsupported evidence type`);
    }
    const readDate = block.body.match(/^-\s+读取日期：\s*`?(\d{4}-\d{2}-\d{2})`?\s*$/m)?.[1];
    if (isV2 && !isValidDate(readDate)) {
      errors.push(`${displayFile}: ${block.id} 读取日期 must be a real date using YYYY-MM-DD`);
    }
  }
  if (!isV2 && !isValidDate(legacyReadDate)) {
    errors.push(`${displayFile}: schemaVersion 1 evidence ledger requires a real global 读取日期均为 YYYY-MM-DD declaration`);
  }
  return new Set(ids);
}

function relative(root, file) {
  return path.relative(root, file).split(path.sep).join('/');
}

function resolveIndexedPath(root, relativePath, label, errors, allowedRoot = root) {
  if (typeof relativePath !== 'string' || relativePath.trim() === '') {
    errors.push(`${label}: indexed path must be a non-empty relative string`);
    return null;
  }
  const resolved = path.resolve(root, relativePath);
  const boundary = path.relative(allowedRoot, resolved);
  if (boundary.startsWith('..') || path.isAbsolute(boundary)) {
    errors.push(`${label}: indexed path escapes the knowledge-base root (${relativePath})`);
    return null;
  }
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    errors.push(`${label}: indexed Markdown file not found (${relativePath})`);
    return null;
  }
  const realRoot = fs.realpathSync(allowedRoot);
  const realResolved = fs.realpathSync(resolved);
  const realBoundary = path.relative(realRoot, realResolved);
  if (realBoundary.startsWith('..') || path.isAbsolute(realBoundary)) {
    errors.push(`${label}: indexed path escapes the knowledge-base root through a symlink (${relativePath})`);
    return null;
  }
  return resolved;
}

function readKnowledgeBase(root) {
  const errors = [];
  const cases = [];
  const cards = [];
  const standards = [];
  const rawIndexPath = path.join(root, '.ai-director', 'index.json');
  if (!fs.existsSync(rawIndexPath)) {
    errors.push('.ai-director/index.json: metadata index not found');
    return { errors, cases, cards, standards, counts: { cases: 0, cards: 0, standards: 0, byStatus: {}, byDomain: {}, byPolicyStatus: {} } };
  }
  const indexPath = resolveIndexedPath(root, '.ai-director/index.json', '.ai-director/index.json', errors);
  if (!indexPath) return { errors, cases, cards, standards, counts: { cases: 0, cards: 0, standards: 0, byStatus: {}, byDomain: {}, byPolicyStatus: {} } };

  let index;
  try {
    index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  } catch (error) {
    errors.push(`.ai-director/index.json: invalid JSON (${error.message})`);
    return { errors, cases, cards, standards, counts: { cases: 0, cards: 0, standards: 0, byStatus: {}, byDomain: {}, byPolicyStatus: {} } };
  }
  if (!isPlainObject(index)) {
    errors.push('.ai-director/index.json: root must be an object');
    return { errors, cases, cards, standards, counts: { cases: 0, cards: 0, standards: 0, byStatus: {}, byDomain: {}, byPolicyStatus: {} } };
  }
  if (index.schemaVersion !== 2) errors.push('.ai-director/index.json: schemaVersion must be 2');
  if (!Array.isArray(index.cases)) errors.push('.ai-director/index.json: cases must be an array');
  if (!Array.isArray(index.cards)) errors.push('.ai-director/index.json: cards must be an array');
  if (index.standards !== undefined && !Array.isArray(index.standards)) errors.push('.ai-director/index.json: standards must be an array when present');

  const caseMetas = Array.isArray(index.cases) ? index.cases : [];
  const cardMetas = Array.isArray(index.cards) ? index.cards : [];
  const standardMetas = Array.isArray(index.standards) ? index.standards : [];
  for (const [indexNumber, meta] of caseMetas.entries()) {
    if (!isPlainObject(meta)) {
      errors.push(`.ai-director/index.json: cases[${indexNumber}] must be an object`);
      continue;
    }
    const label = meta.path || meta.id || '.ai-director/index.json case';
    const file = resolveIndexedPath(root, meta.path, label, errors);
    if (file) cases.push({ meta, text: fs.readFileSync(file, 'utf8'), file });
  }

  for (const [indexNumber, meta] of cardMetas.entries()) {
    if (!isPlainObject(meta)) {
      errors.push(`.ai-director/index.json: cards[${indexNumber}] must be an object`);
      continue;
    }
    const label = meta.path || meta.id || '.ai-director/index.json card';
    const file = resolveIndexedPath(root, meta.path, label, errors);
    if (file) cards.push({ meta, text: fs.readFileSync(file, 'utf8'), file });
  }

  for (const [indexNumber, meta] of standardMetas.entries()) {
    if (!isPlainObject(meta)) {
      errors.push(`.ai-director/index.json: standards[${indexNumber}] must be an object`);
      continue;
    }
    const label = meta.path || meta.id || '.ai-director/index.json standard';
    const file = resolveIndexedPath(root, meta.path, label, errors);
    if (file) standards.push({ meta, text: fs.readFileSync(file, 'utf8'), file });
  }

  const indexedCasePaths = new Set(cases.map((record) => relative(root, record.file)));
  const indexedCardPaths = new Set(cards.map((record) => relative(root, record.file)));
  const indexedStandardPaths = new Set(standards.map((record) => relative(root, record.file)));
  for (const [kind, records] of [['case', cases], ['card', cards], ['standard', standards]]) {
    const seen = new Map();
    for (const record of records) {
      const recordPath = relative(root, record.file);
      if (seen.has(recordPath)) errors.push(`Duplicate ${kind} path ${recordPath}: ${seen.get(recordPath)} and ${record.meta.id ?? 'missing-id'}`);
      else seen.set(recordPath, record.meta.id ?? 'missing-id');
    }
  }
  for (const file of walkMarkdown(path.join(root, '案例')).filter((value) => path.basename(value) === '案例档案.md')) {
    if (!indexedCasePaths.has(relative(root, file))) errors.push(`${relative(root, file)}: case dossier is not registered in .ai-director/index.json`);
  }
  for (const file of walkMarkdown(path.join(root, '知识卡'))) {
    if (!indexedCardPaths.has(relative(root, file))) errors.push(`${relative(root, file)}: knowledge card is not registered in .ai-director/index.json`);
  }
  for (const file of walkMarkdown(path.join(root, '标准'))) {
    if (!indexedStandardPaths.has(relative(root, file))) errors.push(`${relative(root, file)}: standard is not registered in .ai-director/index.json`);
  }

  const rawValidationPath = path.join(root, '验证', '验证记录.md');
  const validationPath = fs.existsSync(rawValidationPath)
    ? resolveIndexedPath(root, '验证/验证记录.md', '验证/验证记录.md', errors)
    : null;
  const validationText = validationPath ? fs.readFileSync(validationPath, 'utf8') : '';
  for (const record of cases) validateCaseRecord({ ...record, file: relative(root, record.file) }, errors);
  for (const record of cards) validateCardRecord({ ...record, file: relative(root, record.file) }, validationText, errors);
  for (const record of standards) validateStandardRecord({ ...record, file: relative(root, record.file) }, errors);

  const allIds = new Map();
  for (const record of [...cases, ...cards, ...standards]) {
    const id = record.meta.id;
    if (!id) continue;
    if (allIds.has(id)) errors.push(`Duplicate ID ${id}: ${allIds.get(id)} and ${relative(root, record.file)}`);
    else allIds.set(id, relative(root, record.file));
  }

  const practiceOwners = new Map();
  for (const record of cards) {
    for (const { id } of extractIdBlocks(sectionBody(record.text, 2, '实践记录') ?? '', 'PRACTICE-')) {
      const owner = relative(root, record.file);
      if (practiceOwners.has(id)) errors.push(`Duplicate practice ID ${id}: ${practiceOwners.get(id)} and ${owner}`);
      else practiceOwners.set(id, owner);
    }
  }
  const validationPracticeIds = extractIdBlocks(validationText, 'PRACTICE-').map(({ id }) => id);
  for (const id of validationPracticeIds) {
    if (!PRACTICE_ID_RE.test(id)) errors.push(`验证/验证记录.md: practice ID ${id} must match PRACTICE-YYYYMMDD-PROJECT-SHOT`);
    if (!practiceOwners.has(id)) errors.push(`验证/验证记录.md: orphan practice ID ${id} is not present in any card`);
  }
  for (const id of new Set(validationPracticeIds)) {
    if (validationPracticeIds.filter((value) => value === id).length > 1) errors.push(`验证/验证记录.md: duplicate practice ID ${id}`);
  }

  const caseById = new Map(cases.map((record) => [record.meta.id, record]));
  const cardById = new Map(cards.map((record) => [record.meta.id, record]));
  const evidenceByCase = new Map();

  for (const record of cases) {
    const displayFile = relative(root, record.file);
    resolveIndexedPath(root, record.meta.sourceDocument, `${displayFile}: sourceDocument`, errors, path.dirname(root));
    const evidencePath = resolveIndexedPath(root, record.meta.evidenceDocument, `${displayFile}: evidenceDocument`, errors);
    if (!evidencePath) {
      evidenceByCase.set(record.meta.id, new Set());
    } else {
      const evidenceText = fs.readFileSync(evidencePath, 'utf8');
      evidenceByCase.set(record.meta.id, validateEvidenceDocument(record, evidenceText, relative(root, evidencePath), errors));
    }
    for (const cardId of Array.isArray(record.meta.derivedCardIds) ? record.meta.derivedCardIds : []) {
      if (!cardById.has(cardId)) errors.push(`${displayFile}: derivedCardIds references missing card ${cardId}`);
      else if (!(Array.isArray(cardById.get(cardId).meta.sourceCaseIds) ? cardById.get(cardId).meta.sourceCaseIds : []).includes(record.meta.id)) {
        errors.push(`${displayFile}: derived card ${cardId} does not reference source case ${record.meta.id}`);
      }
    }
  }

  const evidenceOwners = new Map();
  for (const [caseId, evidenceIds] of evidenceByCase) {
    for (const evidenceId of evidenceIds) {
      if (evidenceOwners.has(evidenceId)) errors.push(`Duplicate evidence ID ${evidenceId}: ${evidenceOwners.get(evidenceId)} and ${caseId}`);
      else evidenceOwners.set(evidenceId, caseId);
    }
  }

  for (const record of cards) {
    const displayFile = relative(root, record.file);
    const availableEvidence = new Set();
    for (const caseId of Array.isArray(record.meta.sourceCaseIds) ? record.meta.sourceCaseIds : []) {
      if (!caseById.has(caseId)) errors.push(`${displayFile}: sourceCaseIds references missing case ${caseId}`);
      for (const evidenceId of evidenceByCase.get(caseId) ?? []) availableEvidence.add(evidenceId);
      if (caseById.has(caseId) && !(Array.isArray(caseById.get(caseId).meta.derivedCardIds) ? caseById.get(caseId).meta.derivedCardIds : []).includes(record.meta.id)) {
        errors.push(`${displayFile}: source case ${caseId} does not list ${record.meta.id} in derivedCardIds`);
      }
    }
    for (const evidenceId of Array.isArray(record.meta.evidenceRefs) ? record.meta.evidenceRefs : []) {
      if (!availableEvidence.has(evidenceId)) errors.push(`${displayFile}: evidenceRefs references missing evidence ${evidenceId}`);
    }
  }

  for (const record of standards) {
    const displayFile = relative(root, record.file);
    const sourceCards = [];
    for (const cardId of Array.isArray(record.meta.sourceCardIds) ? record.meta.sourceCardIds : []) {
      const card = cardById.get(cardId);
      if (!card) errors.push(`${displayFile}: sourceCardIds references missing card ${cardId}`);
      else sourceCards.push(card);
    }
    const strongestSourceRank = Math.max(0, ...sourceCards.map((card) => EVIDENCE_STATUS_RANK.get(card.meta.status) ?? 0));
    const declaredRank = EVIDENCE_STATUS_RANK.get(record.meta.evidenceStatus) ?? Number.POSITIVE_INFINITY;
    if (declaredRank > strongestSourceRank) {
      errors.push(`${displayFile}: evidenceStatus ${record.meta.evidenceStatus} exceeds supporting card maturity`);
    }
    for (const override of Array.isArray(record.meta.evidenceOverrides) ? record.meta.evidenceOverrides : []) {
      const overrideCards = [];
      for (const cardId of Array.isArray(override.sourceCardIds) ? override.sourceCardIds : []) {
        const card = cardById.get(cardId);
        if (!card) errors.push(`${displayFile}: evidenceOverrides ${override.feature} references missing card ${cardId}`);
        else overrideCards.push(card);
        if (!(Array.isArray(record.meta.sourceCardIds) ? record.meta.sourceCardIds : []).includes(cardId)) {
          errors.push(`${displayFile}: evidenceOverrides ${override.feature} card ${cardId} must also appear in sourceCardIds`);
        }
      }
      const strongestOverrideRank = Math.max(0, ...overrideCards.map((card) => EVIDENCE_STATUS_RANK.get(card.meta.status) ?? 0));
      const overrideRank = EVIDENCE_STATUS_RANK.get(override.evidenceStatus) ?? Number.POSITIVE_INFINITY;
      if (overrideRank > strongestOverrideRank) {
        errors.push(`${displayFile}: evidenceOverrides ${override.feature} maturity ${override.evidenceStatus} exceeds supporting card maturity`);
      }
    }
  }

  const counts = {
    cases: cases.length,
    cards: cards.length,
    standards: standards.length,
    byStatus: Object.fromEntries([...CARD_STATUSES].map((status) => [status, cards.filter((record) => record.meta.status === status).length])),
    byDomain: Object.fromEntries([...DOMAINS].map((domain) => [domain, cards.filter((record) => record.meta.domain === domain).length])),
    byPolicyStatus: Object.fromEntries([...POLICY_STATUSES].map((status) => [status, standards.filter((record) => record.meta.policyStatus === status).length])),
  };
  return { errors, cases, cards, standards, counts };
}

function scoreCard(record, query) {
  if (!query) return 1;
  const tokens = query.toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const id = record.meta.id.toLocaleLowerCase();
  const title = record.meta.title.toLocaleLowerCase();
  const tags = (record.meta.tags ?? []).join(' ').toLocaleLowerCase();
  const body = record.text.toLocaleLowerCase();
  let score = 0;
  for (const token of tokens) {
    if (id.includes(token)) score += 8;
    if (title.includes(token)) score += 6;
    if (tags.includes(token)) score += 4;
    if (body.includes(token)) score += 1;
  }
  return score;
}

function searchCards(root, options, knowledge) {
  const limit = options.limit === undefined ? 10 : Number.parseInt(options.limit, 10);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error('--limit must be an integer from 1 to 100.');
  if (options.domain && !DOMAINS.has(options.domain)) throw new Error(`Unsupported --domain: ${options.domain}`);
  if (options.status && !CARD_STATUSES.has(options.status)) throw new Error(`Unsupported --status: ${options.status}`);
  const tag = options.tag?.toLocaleLowerCase();
  return knowledge.cards
    .filter((record) => !options.domain || record.meta.domain === options.domain)
    .filter((record) => !options.status || record.meta.status === options.status)
    .filter((record) => !tag || (record.meta.tags ?? []).some((value) => value.toLocaleLowerCase() === tag))
    .map((record) => ({ record, score: scoreCard(record, options.query) }))
    .filter(({ score }) => !options.query || score > 0)
    .sort((left, right) => right.score - left.score || left.record.meta.id.localeCompare(right.record.meta.id))
    .slice(0, limit)
    .map(({ record, score }) => ({
      id: record.meta.id,
      status: record.meta.status,
      domain: record.meta.domain,
      knowledgeAreas: record.meta.knowledgeAreas,
      knowledgeAreaRole: record.meta.knowledgeAreaRole,
      title: record.meta.title,
      evidenceStrength: record.meta.evidenceStrength,
      sourceCaseIds: record.meta.sourceCaseIds,
      tags: record.meta.tags,
      usageContract: record.meta.usageContract,
      score,
      path: relative(root, record.file),
    }));
}

function printSearch(results) {
  if (results.length === 0) {
    process.stdout.write('No matching knowledge cards.\n');
    return;
  }
  for (const result of results) {
    process.stdout.write(`${result.id} [${result.status}] ${result.domain} | ${result.title}\n`);
    process.stdout.write(`  evidence=${result.evidenceStrength} score=${result.score} tags=${result.tags.join(',')}\n`);
    process.stdout.write(`  source=${result.sourceCaseIds.join(',')} path=${result.path}\n`);
  }
}

function listStandards(root, options, knowledge) {
  const limit = options.limit === undefined ? 100 : Number.parseInt(options.limit, 10);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error('--limit must be an integer from 1 to 100.');
  if (options.kind && !STANDARD_KINDS.has(options.kind)) throw new Error(`Unsupported --kind: ${options.kind}`);
  if (options.domain && !DOMAINS.has(options.domain)) throw new Error(`Unsupported --domain: ${options.domain}`);
  if (options['policy-status'] && !POLICY_STATUSES.has(options['policy-status'])) {
    throw new Error(`Unsupported --policy-status: ${options['policy-status']}`);
  }
  const tag = options.tag?.toLocaleLowerCase();
  const query = options.query?.toLocaleLowerCase();
  return knowledge.standards
    .filter((record) => !options.kind || record.meta.kind === options.kind)
    .filter((record) => !options.domain || record.meta.domain === options.domain)
    .filter((record) => !options['policy-status'] || record.meta.policyStatus === options['policy-status'])
    .filter((record) => !tag || (record.meta.tags ?? []).some((value) => value.toLocaleLowerCase() === tag))
    .filter((record) => !query || [
      record.meta.id, record.meta.title, ...(record.meta.tags ?? []),
      ...(record.meta.triggerFeatures ?? []), record.text,
    ].join(' ').toLocaleLowerCase().includes(query))
    .sort((left, right) => left.meta.id.localeCompare(right.meta.id))
    .slice(0, limit)
    .map((record) => ({
      id: record.meta.id,
      kind: record.meta.kind,
      domain: record.meta.domain,
      title: record.meta.title,
      version: record.meta.version,
      policyStatus: record.meta.policyStatus,
      evidenceStatus: record.meta.evidenceStatus,
      knowledgeAreas: record.meta.knowledgeAreas,
      knowledgeAreaRole: record.meta.knowledgeAreaRole,
      tags: record.meta.tags,
      triggerFeatures: record.meta.triggerFeatures,
      exclusionFeatures: record.meta.exclusionFeatures,
      sourceCardIds: record.meta.sourceCardIds,
      evidenceOverrides: record.meta.evidenceOverrides ?? [],
      usageContract: record.meta.usageContract,
      path: relative(root, record.file),
    }));
}

function printStandards(results) {
  if (results.length === 0) {
    process.stdout.write('No matching project standards.\n');
    return;
  }
  for (const result of results) {
    process.stdout.write(`${result.id} [${result.policyStatus}/${result.evidenceStatus}] ${result.kind} | ${result.title}\n`);
    process.stdout.write(`  version=${result.version} tags=${result.tags.join(',')} path=${result.path}\n`);
    for (const override of result.evidenceOverrides) {
      process.stdout.write(`  feature=${override.feature} evidence=${override.evidenceStatus} representativeTest=${override.representativeTestRequired}\n`);
    }
  }
}

try {
  const { command, options } = parseArgs(process.argv.slice(2));
  const root = resolveRoot(options.root);
  const knowledge = readKnowledgeBase(root);
  if (knowledge.errors.length > 0) {
    if (options.json) process.stdout.write(`${JSON.stringify({ ok: false, root, errors: knowledge.errors }, null, 2)}\n`);
    else {
      process.stderr.write(`Knowledge base is invalid (${knowledge.errors.length} error(s)):\n`);
      for (const error of knowledge.errors) process.stderr.write(`- ${error}\n`);
    }
    process.exit(1);
  }

  if (command === 'validate') {
    const result = { ok: true, root, ...knowledge.counts };
    if (options.json) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    else process.stdout.write(`VALID ${root}\ncases=${result.cases} cards=${result.cards}\nstatus=${JSON.stringify(result.byStatus)}\ndomain=${JSON.stringify(result.byDomain)}\n`);
  } else if (command === 'standards') {
    const results = listStandards(root, options, knowledge);
    if (options.json) process.stdout.write(`${JSON.stringify({ ok: true, root, count: results.length, results }, null, 2)}\n`);
    else printStandards(results);
  } else if (command === 'search') {
    const results = searchCards(root, options, knowledge);
    if (options.json) process.stdout.write(`${JSON.stringify({ ok: true, root, count: results.length, results }, null, 2)}\n`);
    else printSearch(results);
  } else {
    throw new Error(`Unknown command: ${command}`);
  }
} catch (error) {
  if (WANTS_JSON) process.stdout.write(`${JSON.stringify({ ok: false, error: error.message }, null, 2)}\n`);
  else process.stderr.write(`ERROR: ${error.message}\n`);
  process.exit(2);
}
