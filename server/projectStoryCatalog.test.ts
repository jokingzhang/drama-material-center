import { afterEach, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createProjectStoryCatalog } from "./projectStoryCatalog";

const temporaryRoots: string[] = [];

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

async function seedStoryProject() {
  const root = await mkdtemp(join(tmpdir(), "project-story-catalog-"));
  temporaryRoots.push(root);
  const projectRoot = join(root, "story-demo");
  await mkdir(join(projectRoot, "production"), { recursive: true });
  await mkdir(join(projectRoot, "library", "图片", "人物", "旧目录"), { recursive: true });
  await writeFile(join(projectRoot, "project.json"), JSON.stringify({
    schemaVersion: 1,
    name: "索引样板剧",
    description: "只读 fixture",
  }));
  await writeFile(join(projectRoot, "library", "图片", "人物", "旧目录", "CHAR-001-v01.png"), "fixture");
  await writeFile(join(projectRoot, "production", "story-index.v1.json"), JSON.stringify({
    schemaVersion: 1,
    story: {
      title: "先婚后爱试验场",
      genre: ["现代", "甜宠"],
      totalEpisodes: 2,
      logline: "一纸合约把两个对手绑在一起。",
      synopsis: "他们从互相拆台走到共同守约。",
      summaryStatus: "ACCEPTED",
    },
    currentMilestone: { id: "EP01_PREPRODUCTION", episodeIds: ["EP01"] },
    requirements: [],
    characters: [
      {
        id: "CHAR-001",
        name: "江砚秋",
        kind: "human",
        storyRole: "lead",
        oneLineSetting: "不肯把命运交给合同的策划师",
        personality: ["果断"],
        biography: "在婚礼现场夺回主动权。",
        defaultLookId: "LOOK-001",
        cardImageAssetId: "ASSET-CHAR-001",
        looks: [{ id: "LOOK-001", name: "婚礼策划师", kind: "primary" }],
      },
    ],
    episodes: [
      { id: "EP01", title: "红毯成空", summary: "新娘逃婚。", scenes: [] },
      { id: "EP02", title: "合约落笔", summary: "双方谈判。", scenes: [] },
    ],
  }));
  await writeFile(join(projectRoot, "production", "asset-bindings.v1.json"), JSON.stringify({
    schemaVersion: 1,
    assets: [
      {
        assetId: "ASSET-CHAR-001",
        materialType: "image.character",
        path: "图片/人物/旧目录/CHAR-001-v01.png",
        role: "character-standard",
        subject: { characterId: "CHAR-001", lookId: "LOOK-001" },
        status: "ACCEPTED",
        sha256: sha256("fixture"),
        legacyPath: true,
        verification: { kind: "human-image-review", verifiedAt: "2026-08-31" },
      },
    ],
  }));
  return root;
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("project story catalog", () => {
  it("reads story, character and episode order through one public interface", async () => {
    const root = await seedStoryProject();
    const assetIndexPath = join(root, "story-demo", "production", "asset-bindings.v1.json");
    const assetIndex = JSON.parse(await readFile(assetIndexPath, "utf8"));
    assetIndex.assets.unshift({
      assetId: "ASSET-CHAR-001-DRAFT",
      materialType: "image.character",
      path: "图片/人物/旧目录/CHAR-001-v01.png",
      role: "character-standard",
      subject: { characterId: "CHAR-001", lookId: "LOOK-001" },
      status: "DRAFT",
    });
    await writeFile(assetIndexPath, JSON.stringify(assetIndex));

    const story = await createProjectStoryCatalog(root).readProjectStory("story-demo");

    expect(story.project).toEqual({
      id: "story-demo",
      name: "索引样板剧",
      description: "只读 fixture",
    });
    expect(story.story).toEqual(expect.objectContaining({
      title: "先婚后爱试验场",
      synopsis: "他们从互相拆台走到共同守约。",
    }));
    expect(story.characters.map((character) => character.name)).toEqual(["江砚秋"]);
    expect(story.characters[0]?.cardImage).toEqual(expect.objectContaining({
      assetId: "ASSET-CHAR-001",
      legacyPath: true,
      status: "ACCEPTED",
    }));
    expect(story.characters[0]?.cardImageStatus).toBe("READY");
    expect(story.characters[0]?.looks[0]?.status).toBe("READY");
    expect(story.characters[0]?.looks[0]?.preferredAsset?.assetId).toBe("ASSET-CHAR-001");
    expect(story.episodes.map((episode) => episode.id)).toEqual(["EP01", "EP02"]);
  });

  it("evaluates every candidate deterministically and blocks broken explicit bindings", async () => {
    const root = await seedStoryProject();
    const projectRoot = join(root, "story-demo");
    await writeFile(join(projectRoot, "production", "story-index.v1.json"), JSON.stringify({
      schemaVersion: 1,
      story: { title: "候选选择", genre: ["现代"], totalEpisodes: 1, logline: "不能依赖 JSON 顺序。", synopsis: "完整评估候选。", summaryStatus: "ACCEPTED" },
      currentMilestone: { id: "EP01", episodeIds: ["EP01"] },
      requirements: [
        { id: "REQ-BEST", role: "character-standard", subject: { characterId: "CHAR-001", lookId: "LOOK-001" }, required: true },
        { id: "REQ-DANGLING", role: "voice-anchor", subject: { characterId: "CHAR-001" }, required: true, bindingAssetIds: ["ASSET-NOT-FOUND"] },
        { id: "REQ-PARTIAL", role: "character-standard", subject: { characterId: "CHAR-001", lookId: "LOOK-001" }, required: true, bindingAssetIds: ["ASSET-READY", "ASSET-NOT-FOUND"] },
        { id: "REQ-WRONG-ROLE", role: "character-standard", subject: { characterId: "CHAR-001", lookId: "LOOK-001" }, required: true, bindingAssetIds: ["ASSET-WRONG-ROLE"] },
      ],
      characters: [],
      episodes: [{ id: "EP01", title: "第一集", summary: "候选测试。", scenes: [{ id: "EP01-S01", heading: "内·大厅·日", cast: [], requirementIds: ["REQ-BEST", "REQ-DANGLING", "REQ-PARTIAL", "REQ-WRONG-ROLE"] }] }],
    }));
    await writeFile(join(projectRoot, "production", "asset-bindings.v1.json"), JSON.stringify({
      schemaVersion: 1,
      assets: [
        { assetId: "ASSET-DRAFT", materialType: "image.character", path: "图片/人物/旧目录/CHAR-001-v01.png", role: "character-standard", subject: { characterId: "CHAR-001", lookId: "LOOK-001" }, status: "DRAFT" },
        { assetId: "ASSET-READY", materialType: "image.character", path: "图片/人物/旧目录/CHAR-001-v01.png", role: "character-standard", subject: { characterId: "CHAR-001", lookId: "LOOK-001" }, status: "ACCEPTED" },
        { assetId: "ASSET-WRONG-ROLE", materialType: "audio.voice", path: "图片/人物/旧目录/CHAR-001-v01.png", role: "voice-anchor", subject: { characterId: "CHAR-001", lookId: "LOOK-001" }, status: "ACCEPTED" },
      ],
    }));

    const story = await createProjectStoryCatalog(root).readProjectStory("story-demo", { episodeId: "EP01" });

    expect(story.episode?.scenes[0]?.requirements.map(({ id, status, reasonCode, asset }) => ({ id, status, reasonCode, assetId: asset?.assetId }))).toEqual([
      { id: "REQ-BEST", status: "READY", reasonCode: undefined, assetId: "ASSET-READY" },
      { id: "REQ-DANGLING", status: "BLOCKED", reasonCode: "MISSING_FILE", assetId: undefined },
      { id: "REQ-PARTIAL", status: "BLOCKED", reasonCode: "MISSING_FILE", assetId: undefined },
      { id: "REQ-WRONG-ROLE", status: "BLOCKED", reasonCode: "SUBJECT_CONFLICT", assetId: "ASSET-WRONG-ROLE" },
    ]);
  });

  it("does not expose another character's image as the selected card", async () => {
    const root = await seedStoryProject();
    const projectRoot = join(root, "story-demo");
    const storyIndex = JSON.parse(await readFile(join(projectRoot, "production", "story-index.v1.json"), "utf8"));
    storyIndex.characters[0].cardImageAssetId = "ASSET-OTHER-CHARACTER";
    await writeFile(join(projectRoot, "production", "story-index.v1.json"), JSON.stringify(storyIndex));
    await writeFile(join(projectRoot, "production", "asset-bindings.v1.json"), JSON.stringify({
      schemaVersion: 1,
      assets: [
        { assetId: "ASSET-OTHER-CHARACTER", materialType: "image.character", path: "图片/人物/旧目录/CHAR-001-v01.png", role: "character-standard", subject: { characterId: "CHAR-002", lookId: "LOOK-001" }, status: "ACCEPTED" },
      ],
    }));

    const story = await createProjectStoryCatalog(root).readProjectStory("story-demo");

    expect(story.characters[0]?.cardImage).toBeUndefined();
    expect(story.characters[0]?.cardImageStatus).toBe("BLOCKED");
    expect(story.characters[0]?.cardImageReason).toContain("角色");
  });

  it("uses the accepted default look when no explicit character card is configured", async () => {
    const root = await seedStoryProject();
    const storyIndexPath = join(root, "story-demo", "production", "story-index.v1.json");
    const storyIndex = JSON.parse(await readFile(storyIndexPath, "utf8"));
    delete storyIndex.characters[0].cardImageAssetId;
    await writeFile(storyIndexPath, JSON.stringify(storyIndex));

    const story = await createProjectStoryCatalog(root).readProjectStory("story-demo");

    expect(story.characters[0]?.cardImage).toEqual(expect.objectContaining({ assetId: "ASSET-CHAR-001" }));
    expect(story.characters[0]?.cardImageStatus).toBe("READY");
    expect(story.characters[0]?.cardImageReason).toContain("默认主造型");
  });

  it("derives requirement states without silently replacing a stale binding", async () => {
    const root = await seedStoryProject();
    const projectRoot = join(root, "story-demo");
    await Promise.all([
      mkdir(join(projectRoot, "library", "图片", "场景"), { recursive: true }),
      mkdir(join(projectRoot, "library", "图片", "道具"), { recursive: true }),
    ]);
    await Promise.all([
      writeFile(join(projectRoot, "library", "图片", "场景", "LOC-001-v01.png"), "fixture"),
      writeFile(join(projectRoot, "library", "图片", "道具", "PROP-OLD-v01.png"), "fixture"),
      writeFile(join(projectRoot, "library", "图片", "道具", "PROP-NEW-v02.png"), "fixture"),
    ]);
    await writeFile(join(projectRoot, "production", "story-index.v1.json"), JSON.stringify({
      schemaVersion: 1,
      story: {
        title: "先婚后爱试验场",
        genre: ["现代", "甜宠"],
        totalEpisodes: 1,
        logline: "一纸合约把两个对手绑在一起。",
        synopsis: "他们从互相拆台走到共同守约。",
        summaryStatus: "ACCEPTED",
      },
      currentMilestone: { id: "EP01_PREPRODUCTION", episodeIds: ["EP01"] },
      requirements: [
        { id: "REQ-LOOK", label: "江砚秋主造型", milestoneId: "EP01_PREPRODUCTION", role: "character-standard", subject: { sceneId: "EP01-S01", characterId: "CHAR-001", lookId: "LOOK-001" }, required: true, bindingAssetIds: ["ASSET-CHAR-001"] },
        { id: "REQ-SCENE", label: "化妆间场景母版", milestoneId: "EP01_PREPRODUCTION", role: "scene-master", subject: { sceneId: "EP01-S01", locationId: "LOC-001" }, required: true, bindingAssetIds: ["ASSET-SCENE-DRAFT"] },
        { id: "REQ-VOICE", milestoneId: "EP01_PREPRODUCTION", role: "voice-anchor", subject: { sceneId: "EP01-S01", characterId: "CHAR-001" }, required: true },
        { id: "REQ-PROP", label: "旧画夹", milestoneId: "EP01_PREPRODUCTION", role: "prop-standard", subject: { sceneId: "EP01-S01", propId: "PROP-001" }, required: true, bindingAssetIds: ["ASSET-PROP-OLD"] },
      ],
      characters: [
        {
          id: "CHAR-001",
          name: "江砚秋",
          kind: "human",
          storyRole: "lead",
          oneLineSetting: "婚礼策划师",
          personality: ["果断"],
          biography: "在婚礼现场夺回主动权。",
          defaultLookId: "LOOK-001",
          cardImageAssetId: "ASSET-CHAR-001",
          looks: [{ id: "LOOK-001", name: "婚礼策划师", kind: "primary" }],
        },
      ],
      episodes: [
        {
          id: "EP01",
          title: "红毯成空",
          summary: "新娘逃婚。",
          scenes: [
            {
              id: "EP01-S01",
              heading: "内·化妆间·日",
              locationId: "LOC-001",
              locationName: "新娘化妆间",
              cast: [{ characterId: "CHAR-001", lookId: "LOOK-001", speaks: true }],
              propIds: ["PROP-001"],
              requirementIds: ["REQ-LOOK", "REQ-SCENE", "REQ-VOICE", "REQ-PROP"],
            },
          ],
        },
      ],
    }));
    await writeFile(join(projectRoot, "production", "asset-bindings.v1.json"), JSON.stringify({
      schemaVersion: 1,
      assets: [
        { assetId: "ASSET-CHAR-001", materialType: "image.character", path: "图片/人物/旧目录/CHAR-001-v01.png", role: "character-standard", subject: { characterId: "CHAR-001", lookId: "LOOK-001" }, status: "ACCEPTED", legacyPath: true },
        { assetId: "ASSET-SCENE-DRAFT", materialType: "image.scene", path: "图片/场景/LOC-001-v01.png", role: "scene-master", subject: { locationId: "LOC-001" }, status: "DRAFT" },
        { assetId: "ASSET-PROP-OLD", materialType: "image.prop", path: "图片/道具/PROP-OLD-v01.png", role: "prop-standard", subject: { propId: "PROP-001" }, status: "DRAFT", bindingState: "STALE_BINDING" },
        { assetId: "ASSET-PROP-NEW", materialType: "image.prop", path: "图片/道具/PROP-NEW-v02.png", role: "prop-standard", subject: { propId: "PROP-001" }, status: "ACCEPTED" },
      ],
    }));

    const story = await createProjectStoryCatalog(root).readProjectStory("story-demo", { episodeId: "EP01" });
    const scene = story.episode?.scenes[0];

    expect(scene?.requirements.map(({ id, status, reasonCode }) => ({ id, status, reasonCode }))).toEqual([
      { id: "REQ-LOOK", status: "READY", reasonCode: undefined },
      { id: "REQ-SCENE", status: "IN_PROGRESS", reasonCode: undefined },
      { id: "REQ-VOICE", status: "MISSING", reasonCode: undefined },
      { id: "REQ-PROP", status: "BLOCKED", reasonCode: "STALE_BINDING" },
    ]);
    expect(scene?.requirements[2]?.label).toBe("江砚秋对白声音");
    expect(scene?.requirements[3]).toEqual(expect.objectContaining({
      asset: expect.objectContaining({ assetId: "ASSET-PROP-OLD" }),
      suggestedAsset: expect.objectContaining({ assetId: "ASSET-PROP-NEW" }),
    }));
    expect(scene?.props[0]).toEqual(expect.objectContaining({
      id: "PROP-001",
      status: "READY",
      asset: expect.objectContaining({ assetId: "ASSET-PROP-NEW" }),
    }));
    expect(scene?.completion).toEqual({
      status: "BLOCKED",
      ready: 1,
      required: 4,
      missing: 1,
      inProgress: 1,
      blocked: 1,
    });
  });

  it("blocks wrong-look and unsafe bindings without returning an absolute path", async () => {
    const root = await seedStoryProject();
    const projectRoot = join(root, "story-demo");
    const outsideFile = join(root, "outside-scene.png");
    await writeFile(outsideFile, "outside");
    await writeFile(join(projectRoot, "production", "story-index.v1.json"), JSON.stringify({
      schemaVersion: 1,
      story: {
        title: "安全索引",
        genre: ["现代"],
        totalEpisodes: 1,
        logline: "安全边界测试。",
        synopsis: "绑定必须留在当前项目素材库。",
        summaryStatus: "ACCEPTED",
        source: { path: outsideFile },
      },
      currentMilestone: { id: "EP01", episodeIds: ["EP01"], debugPath: outsideFile },
      requirements: [
        { id: "REQ-WRONG-LOOK", label: "本场主造型", milestoneId: "EP01", role: "character-standard", subject: { sceneId: "EP01-S01", characterId: "CHAR-001", lookId: "LOOK-001" }, required: true, bindingAssetIds: ["ASSET-WRONG-LOOK"] },
        { id: "REQ-OUTSIDE", label: "本场场景", milestoneId: "EP01", role: "scene-master", subject: { sceneId: "EP01-S01", locationId: "LOC-001" }, required: true, bindingAssetIds: ["ASSET-OUTSIDE"] },
      ],
      characters: [
        { id: "CHAR-001", name: "江砚秋", kind: "human", storyRole: "lead", oneLineSetting: "策划师", personality: [], biography: "", defaultLookId: "LOOK-001", looks: [{ id: "LOOK-001", name: "策划师", kind: "primary", debugPath: outsideFile }, { id: "LOOK-002", name: "晚宴", kind: "alternate" }] },
      ],
      episodes: [
        { id: "EP01", title: "安全测试", summary: "测试错误绑定。", scenes: [{ id: "EP01-S01", heading: "内·化妆间·日", locationId: "LOC-001", cast: [{ characterId: "CHAR-001", lookId: "LOOK-001" }], requirementIds: ["REQ-WRONG-LOOK", "REQ-OUTSIDE"] }] },
      ],
    }));
    await writeFile(join(projectRoot, "production", "asset-bindings.v1.json"), JSON.stringify({
      schemaVersion: 1,
      assets: [
        { assetId: "ASSET-WRONG-LOOK", materialType: "image.character", path: "图片/人物/旧目录/CHAR-001-v01.png", role: "character-standard", subject: { characterId: "CHAR-001", lookId: "LOOK-002" }, status: "ACCEPTED", verification: { kind: "human-review", debugPath: outsideFile } },
        { assetId: "ASSET-OUTSIDE", materialType: "image.scene", path: outsideFile, role: "scene-master", subject: { locationId: "LOC-001" }, status: "ACCEPTED" },
      ],
    }));

    const story = await createProjectStoryCatalog(root).readProjectStory("story-demo", { episodeId: "EP01" });
    const requirements = story.episode?.scenes[0]?.requirements;

    expect(requirements?.map(({ id, status, reasonCode }) => ({ id, status, reasonCode }))).toEqual([
      { id: "REQ-WRONG-LOOK", status: "BLOCKED", reasonCode: "SUBJECT_CONFLICT" },
      { id: "REQ-OUTSIDE", status: "BLOCKED", reasonCode: "INVALID_PATH" },
    ]);
    expect(JSON.stringify(story)).not.toContain(root);
    expect(requirements?.[1]?.asset?.path).toBe("[已拒绝的不安全路径]");
  });

  it("keeps unregistered files and derived assets outside base completion", async () => {
    const root = await seedStoryProject();
    const projectRoot = join(root, "story-demo");
    const derivedRoot = join(projectRoot, "library", "图片", "剧情");
    const unregisteredRoot = join(projectRoot, "library", "图片", "待归档");
    await Promise.all([
      mkdir(join(derivedRoot, "EP01", "EP01-S01"), { recursive: true }),
      mkdir(join(derivedRoot, "EP02", "EP02-S01"), { recursive: true }),
      mkdir(unregisteredRoot, { recursive: true }),
    ]);
    await Promise.all([
      writeFile(join(derivedRoot, "EP01", "EP01-S01", "EP01-S01-U01-KF-v01.png"), "fixture"),
      writeFile(join(derivedRoot, "EP01", "EP01-S01", "EP01-S01-U01-ACTIONBOARD-v01.png"), "fixture"),
      writeFile(join(derivedRoot, "EP02", "EP02-S01", "EP02-S01-U01-KF-v01.png"), "fixture"),
      ...Array.from({ length: 100 }, (_, index) => writeFile(join(unregisteredRoot, `UNREGISTERED-${String(index + 1).padStart(3, "0")}.png`), "fixture")),
    ]);
    await writeFile(join(projectRoot, "production", "story-index.v1.json"), JSON.stringify({
      schemaVersion: 1,
      story: {
        title: "衍生素材测试",
        genre: ["现代"],
        totalEpisodes: 2,
        logline: "文件数量不改变故事结构。",
        synopsis: "关键帧默认不进入基础齐套分母。",
        summaryStatus: "ACCEPTED",
      },
      currentMilestone: { id: "EP01", episodeIds: ["EP01"] },
      requirements: [
        { id: "REQ-LOOK", label: "江砚秋主造型", milestoneId: "EP01", role: "character-standard", subject: { sceneId: "EP01-S01", characterId: "CHAR-001", lookId: "LOOK-001" }, required: true, bindingAssetIds: ["ASSET-CHAR-001"] },
      ],
      characters: [
        { id: "CHAR-001", name: "江砚秋", kind: "human", storyRole: "lead", oneLineSetting: "策划师", personality: [], biography: "", defaultLookId: "LOOK-001", cardImageAssetId: "ASSET-CHAR-001", looks: [{ id: "LOOK-001", name: "策划师", kind: "primary" }] },
      ],
      episodes: [
        { id: "EP01", title: "红毯成空", summary: "第一集。", scenes: [{ id: "EP01-S01", heading: "内·化妆间·日", cast: [{ characterId: "CHAR-001", lookId: "LOOK-001" }], requirementIds: ["REQ-LOOK"] }] },
        { id: "EP02", title: "合约落笔", summary: "第二集。", scenes: [{ id: "EP02-S01", heading: "内·会议室·夜", cast: [] }] },
      ],
    }));
    await writeFile(join(projectRoot, "production", "asset-bindings.v1.json"), JSON.stringify({
      schemaVersion: 1,
      assets: [
        { assetId: "ASSET-CHAR-001", materialType: "image.character", path: "图片/人物/旧目录/CHAR-001-v01.png", role: "character-standard", subject: { characterId: "CHAR-001", lookId: "LOOK-001" }, status: "ACCEPTED", legacyPath: true },
        { assetId: "ASSET-KF-EP01", materialType: "image.derived", path: "图片/剧情/EP01/EP01-S01/EP01-S01-U01-KF-v01.png", role: "keyframe", subject: { episodeId: "EP01", sceneId: "EP01-S01", shotId: "U01" }, status: "DRAFT" },
        { assetId: "ASSET-BOARD-EP01", materialType: "image.derived", path: "图片/剧情/EP01/EP01-S01/EP01-S01-U01-ACTIONBOARD-v01.png", role: "action-board", subject: { episodeId: "EP01", sceneId: "EP01-S01", shotId: "U01" }, status: "INTERNAL" },
        { assetId: "ASSET-KF-EP02", materialType: "image.derived", path: "图片/剧情/EP02/EP02-S01/EP02-S01-U01-KF-v01.png", role: "keyframe", subject: { episodeId: "EP02", sceneId: "EP02-S01", shotId: "U01" }, status: "DRAFT" },
      ],
    }));

    const story = await createProjectStoryCatalog(root).readProjectStory("story-demo", { episodeId: "EP01" });
    const scene = story.episode?.scenes[0];

    expect(story.episodes.map(({ id }) => id)).toEqual(["EP01", "EP02"]);
    expect(story.episode?.id).toBe("EP01");
    expect(scene?.derivedAssets.map(({ assetId }) => assetId)).toEqual(["ASSET-KF-EP01", "ASSET-BOARD-EP01"]);
    expect(scene?.completion).toEqual({ status: "READY", ready: 1, required: 1, missing: 0, inProgress: 0, blocked: 0 });
    expect(story.unregisteredAssets).toHaveLength(100);
    expect(story.unregisteredAssets[0]).toEqual(expect.objectContaining({ status: "UNREGISTERED" }));
  });

  it("binds story source and related documents without treating them as unregistered files", async () => {
    const root = await seedStoryProject();
    const projectRoot = join(root, "story-demo");
    await Promise.all([
      mkdir(join(projectRoot, "library", "剧情", "统一"), { recursive: true }),
      mkdir(join(projectRoot, "library", "剧情", "统一", "素材计划"), { recursive: true }),
      mkdir(join(projectRoot, "library", "剧情", "角色", "CHAR-001"), { recursive: true }),
      mkdir(join(projectRoot, "library", "剧情", "分集", "EP01", "剧本"), { recursive: true }),
      mkdir(join(projectRoot, "library", "剧情", "分集", "EP01", "素材计划"), { recursive: true }),
      mkdir(join(projectRoot, "library", "剧情", "分集", "EP01", "分镜"), { recursive: true }),
    ]);
    await Promise.all([
      writeFile(join(projectRoot, "library", "剧情", "统一", "STORY-SCRIPT-v01.md"), "# 全剧剧本"),
      writeFile(join(projectRoot, "library", "剧情", "统一", "素材计划", "PROJECT-ASSET-PLAN-v01.md"), "# 全剧素材计划"),
      writeFile(join(projectRoot, "library", "剧情", "角色", "CHAR-001", "CHAR-001-SETTING-v01.md"), "# 角色设定"),
      writeFile(join(projectRoot, "library", "剧情", "分集", "EP01", "剧本", "EP01-SCRIPT-v01.md"), "# EP01"),
      writeFile(join(projectRoot, "library", "剧情", "分集", "EP01", "素材计划", "EP01-ASSET-PLAN-v01.md"), "# EP01 素材计划"),
      writeFile(join(projectRoot, "library", "剧情", "分集", "EP01", "分镜", "EP01-S01-SHOT-PLAN-v01.md"), "# 分镜"),
    ]);
    await writeFile(join(projectRoot, "production", "story-index.v1.json"), JSON.stringify({
      schemaVersion: 1,
      sourceBindings: [
        { materialType: "story.source", kind: "shooting-script", path: "剧情/统一/STORY-SCRIPT-v01.md", decisionStatus: "ACCEPTED", legacyPath: true },
      ],
      documentBindings: [
        { materialType: "plan.asset-project", path: "剧情/统一/素材计划/PROJECT-ASSET-PLAN-v01.md", decisionStatus: "ACCEPTED" },
        { materialType: "story.character-setting", path: "剧情/角色/CHAR-001/CHAR-001-SETTING-v01.md", subject: { characterId: "CHAR-001" }, decisionStatus: "ACCEPTED" },
        { materialType: "story.episode-script", path: "剧情/分集/EP01/剧本/EP01-SCRIPT-v01.md", subject: { episodeId: "EP01" }, decisionStatus: "ACCEPTED" },
        { materialType: "plan.asset-episode", path: "剧情/分集/EP01/素材计划/EP01-ASSET-PLAN-v01.md", subject: { episodeId: "EP01" }, decisionStatus: "DRAFT" },
        { materialType: "plan.shot", path: "剧情/分集/EP01/分镜/EP01-S01-SHOT-PLAN-v01.md", subject: { episodeId: "EP01", sceneId: "EP01-S01" }, decisionStatus: "DRAFT" },
      ],
      story: { title: "文档绑定", genre: ["现代"], totalEpisodes: 1, logline: "打开精确事实源。", synopsis: "文档通过业务 ID 关联。", summaryStatus: "ACCEPTED" },
      currentMilestone: { id: "EP01", episodeIds: ["EP01"] },
      requirements: [],
      characters: [{ id: "CHAR-001", name: "江砚秋", kind: "human", storyRole: "女主角", oneLineSetting: "策划师", personality: ["果断"], biography: "角色设定。", looks: [] }],
      episodes: [{ id: "EP01", title: "第一集", summary: "文档绑定。", scenes: [{ id: "EP01-S01", heading: "内·大厅·日", cast: [], requirementIds: [] }] }],
    }));
    await writeFile(join(projectRoot, "production", "asset-bindings.v1.json"), JSON.stringify({
      schemaVersion: 1,
      assets: [
        { assetId: "ASSET-CHAR-001", materialType: "image.character", path: "图片/人物/旧目录/CHAR-001-v01.png", role: "character-standard", subject: { characterId: "CHAR-001", lookId: "LOOK-001" }, status: "ACCEPTED", legacyPath: true },
      ],
    }));

    const story = await createProjectStoryCatalog(root).readProjectStory("story-demo", { episodeId: "EP01" });

    expect(story.story.source).toEqual(expect.objectContaining({ path: "剧情/统一/STORY-SCRIPT-v01.md", status: "ACCEPTED", legacyPath: true }));
    expect(story.relatedFiles.map(({ path }) => path)).toEqual(["剧情/统一/素材计划/PROJECT-ASSET-PLAN-v01.md"]);
    expect(story.characters[0]?.relatedFiles.map(({ path }) => path)).toEqual(["剧情/角色/CHAR-001/CHAR-001-SETTING-v01.md"]);
    expect(story.episode?.script).toEqual(expect.objectContaining({ path: "剧情/分集/EP01/剧本/EP01-SCRIPT-v01.md" }));
    expect(story.episode?.relatedFiles.map(({ path }) => path)).toEqual(["剧情/分集/EP01/素材计划/EP01-ASSET-PLAN-v01.md"]);
    expect(story.episode?.scenes[0]?.relatedFiles.map(({ path }) => path)).toEqual([
      "剧情/分集/EP01/分镜/EP01-S01-SHOT-PLAN-v01.md",
    ]);
    expect(story.unregisteredAssets).toEqual([]);
  });

  it("rejects a production index symlink that escapes the project", async () => {
    const root = await seedStoryProject();
    const indexPath = join(root, "story-demo", "production", "story-index.v1.json");
    const outsideIndex = join(root, "outside-story-index.json");
    await writeFile(outsideIndex, JSON.stringify({
      schemaVersion: 1,
      story: { title: "不应读取", genre: [], totalEpisodes: 0, logline: "", synopsis: "", summaryStatus: "DRAFT_SUMMARY" },
      characters: [],
      episodes: [],
    }));
    await rm(indexPath);
    await symlink(outsideIndex, indexPath);

    await expect(createProjectStoryCatalog(root).readProjectStory("story-demo")).rejects.toMatchObject({
      code: "invalid_path",
    });
  });

  it("never treats a directory or symbolic link as a ready material file", async () => {
    const root = await seedStoryProject();
    const projectRoot = join(root, "story-demo");
    const libraryRoot = join(projectRoot, "library");
    await mkdir(join(libraryRoot, "图片", ".隐藏"), { recursive: true });
    await writeFile(join(libraryRoot, "图片", ".隐藏", "SECRET.png"), "fixture");
    await symlink(
      join(libraryRoot, "图片", "人物", "旧目录", "CHAR-001-v01.png"),
      join(libraryRoot, "图片", "人物", "旧目录", "CHAR-001-LINK.png"),
    );
    await writeFile(join(projectRoot, "production", "story-index.v1.json"), JSON.stringify({
      schemaVersion: 1,
      story: { title: "严格文件绑定", genre: ["现代"], totalEpisodes: 1, logline: "目录和链接不能冒充素材。", synopsis: "只接受普通文件。", summaryStatus: "ACCEPTED" },
      currentMilestone: { id: "EP01", episodeIds: ["EP01"] },
      requirements: [
        { id: "REQ-DIRECTORY", role: "scene-master", subject: { sceneId: "EP01-S01", locationId: "LOC-001" }, bindingAssetIds: ["ASSET-DIRECTORY"] },
        { id: "REQ-SYMLINK", role: "prop-standard", subject: { sceneId: "EP01-S01", propId: "PROP-001" }, bindingAssetIds: ["ASSET-SYMLINK"] },
        { id: "REQ-ABSOLUTE", role: "prop-standard", subject: { sceneId: "EP01-S01", propId: "PROP-ABSOLUTE" }, bindingAssetIds: ["ASSET-ABSOLUTE"] },
        { id: "REQ-DOTDOT", role: "prop-standard", subject: { sceneId: "EP01-S01", propId: "PROP-DOTDOT" }, bindingAssetIds: ["ASSET-DOTDOT"] },
        { id: "REQ-HIDDEN", role: "prop-standard", subject: { sceneId: "EP01-S01", propId: "PROP-HIDDEN" }, bindingAssetIds: ["ASSET-HIDDEN"] },
        { id: "REQ-EMPTY-SEGMENT", role: "prop-standard", subject: { sceneId: "EP01-S01", propId: "PROP-EMPTY-SEGMENT" }, bindingAssetIds: ["ASSET-EMPTY-SEGMENT"] },
      ],
      characters: [],
      episodes: [{ id: "EP01", title: "第一集", summary: "严格绑定。", scenes: [{ id: "EP01-S01", heading: "内·大厅·日", requirementIds: ["REQ-DIRECTORY", "REQ-SYMLINK", "REQ-ABSOLUTE", "REQ-DOTDOT", "REQ-HIDDEN", "REQ-EMPTY-SEGMENT"] }] }],
    }));
    await writeFile(join(projectRoot, "production", "asset-bindings.v1.json"), JSON.stringify({
      schemaVersion: 1,
      assets: [
        { assetId: "ASSET-DIRECTORY", materialType: "image.scene", path: "图片/人物/旧目录", role: "scene-master", subject: { locationId: "LOC-001" }, status: "ACCEPTED" },
        { assetId: "ASSET-SYMLINK", materialType: "image.prop", path: "图片/人物/旧目录/CHAR-001-LINK.png", role: "prop-standard", subject: { propId: "PROP-001" }, status: "ACCEPTED" },
        { assetId: "ASSET-ABSOLUTE", materialType: "image.prop", path: join(libraryRoot, "图片", "人物", "旧目录", "CHAR-001-v01.png"), role: "prop-standard", subject: { propId: "PROP-ABSOLUTE" }, status: "ACCEPTED" },
        { assetId: "ASSET-DOTDOT", materialType: "image.prop", path: "图片/人物/旧目录/../旧目录/CHAR-001-v01.png", role: "prop-standard", subject: { propId: "PROP-DOTDOT" }, status: "ACCEPTED" },
        { assetId: "ASSET-HIDDEN", materialType: "image.prop", path: "图片/.隐藏/SECRET.png", role: "prop-standard", subject: { propId: "PROP-HIDDEN" }, status: "ACCEPTED" },
        { assetId: "ASSET-EMPTY-SEGMENT", materialType: "image.prop", path: "图片//人物/旧目录/CHAR-001-v01.png", role: "prop-standard", subject: { propId: "PROP-EMPTY-SEGMENT" }, status: "ACCEPTED" },
      ],
    }));

    const story = await createProjectStoryCatalog(root).readProjectStory("story-demo", { episodeId: "EP01" });

    expect(story.episode?.scenes[0]?.requirements.map(({ status, reasonCode, asset }) => ({ status, reasonCode, hasUrl: Boolean(asset?.url) }))).toEqual([
      { status: "BLOCKED", reasonCode: "INVALID_PATH", hasUrl: false },
      { status: "BLOCKED", reasonCode: "INVALID_PATH", hasUrl: false },
      { status: "BLOCKED", reasonCode: "INVALID_PATH", hasUrl: false },
      { status: "BLOCKED", reasonCode: "INVALID_PATH", hasUrl: false },
      { status: "BLOCKED", reasonCode: "INVALID_PATH", hasUrl: false },
      { status: "BLOCKED", reasonCode: "INVALID_PATH", hasUrl: false },
    ]);
  });

  it("blocks an accepted binding when the registered SHA-256 no longer matches", async () => {
    const root = await seedStoryProject();
    const assetIndexPath = join(root, "story-demo", "production", "asset-bindings.v1.json");
    const assetIndex = JSON.parse(await readFile(assetIndexPath, "utf8"));
    assetIndex.assets[0].sha256 = sha256("replaced bytes");
    await writeFile(assetIndexPath, JSON.stringify(assetIndex));

    const story = await createProjectStoryCatalog(root).readProjectStory("story-demo");

    expect(story.characters[0]?.cardImageStatus).toBe("BLOCKED");
    expect(story.characters[0]?.cardImageReason).toContain("SHA-256");
    expect(story.characters[0]?.cardImage).toBeUndefined();
  });

  it("exposes a changed story source as blocked instead of accepted", async () => {
    const root = await seedStoryProject();
    const projectRoot = join(root, "story-demo");
    await mkdir(join(projectRoot, "library", "剧情", "统一"), { recursive: true });
    await writeFile(join(projectRoot, "library", "剧情", "统一", "STORY-SCRIPT-v01.md"), "# 当前剧本\n");
    const storyIndexPath = join(projectRoot, "production", "story-index.v1.json");
    const storyIndex = JSON.parse(await readFile(storyIndexPath, "utf8"));
    storyIndex.sourceBindings = [{
      materialType: "story.source",
      kind: "shooting-script",
      path: "剧情/统一/STORY-SCRIPT-v01.md",
      sha256: sha256("# 旧剧本\n"),
      decisionStatus: "ACCEPTED",
    }];
    await writeFile(storyIndexPath, JSON.stringify(storyIndex));

    const story = await createProjectStoryCatalog(root).readProjectStory("story-demo");

    expect(story.story.source).toEqual(expect.objectContaining({
      status: "BLOCKED",
      bindingState: "CONFLICT",
      path: "剧情/统一/STORY-SCRIPT-v01.md",
    }));
  });

  it("does not match a custom shot role across episodes or scenes", async () => {
    const root = await seedStoryProject();
    const projectRoot = join(root, "story-demo");
    await writeFile(join(projectRoot, "production", "story-index.v1.json"), JSON.stringify({
      schemaVersion: 1,
      story: { title: "镜头主体隔离", genre: [], totalEpisodes: 1, logline: "镜头不能串场。", synopsis: "稳定主体必须完整匹配。", summaryStatus: "ACCEPTED" },
      currentMilestone: { id: "EP01", episodeIds: ["EP01"] },
      requirements: [{
        id: "REQ-SHOT",
        role: "shot-reference",
        subject: { episodeId: "EP01", sceneId: "EP01-S01", shotId: "U01" },
        required: true,
      }],
      characters: [],
      episodes: [{ id: "EP01", title: "第一集", summary: "镜头隔离。", scenes: [{ id: "EP01-S01", heading: "内·大厅·日", requirementIds: ["REQ-SHOT"] }] }],
    }));
    await writeFile(join(projectRoot, "production", "asset-bindings.v1.json"), JSON.stringify({
      schemaVersion: 1,
      assets: [{
        assetId: "ASSET-OTHER-SCENE",
        materialType: "image.derived",
        path: "图片/人物/旧目录/CHAR-001-v01.png",
        role: "shot-reference",
        subject: { episodeId: "EP02", sceneId: "EP02-S01", shotId: "U01" },
        status: "ACCEPTED",
      }],
    }));

    const story = await createProjectStoryCatalog(root).readProjectStory("story-demo", { episodeId: "EP01" });

    expect(story.episode?.scenes[0]?.requirements).toEqual([
      expect.objectContaining({ id: "REQ-SHOT", status: "MISSING" }),
    ]);
  });

  it("infers the scene completeness formula and excludes later episodes from the milestone", async () => {
    const root = await seedStoryProject();
    const projectRoot = join(root, "story-demo");
    await writeFile(join(projectRoot, "production", "story-index.v1.json"), JSON.stringify({
      schemaVersion: 1,
      story: { title: "齐套公式", genre: [], totalEpisodes: 2, logline: "缺口必须可见。", synopsis: "场次元数据直接形成基础需求。", summaryStatus: "ACCEPTED" },
      currentMilestone: { id: "EP01", episodeIds: ["EP01"] },
      requirements: [],
      characters: [{
        id: "CHAR-001",
        name: "江砚秋",
        kind: "human",
        storyRole: "lead",
        oneLineSetting: "策划师",
        personality: [],
        biography: "",
        defaultLookId: "LOOK-001",
        looks: [{ id: "LOOK-001", name: "策划师造型", kind: "primary" }],
      }],
      episodes: [
        {
          id: "EP01",
          title: "第一集",
          summary: "当前里程碑。",
          scenes: [{
            id: "EP01-S01",
            heading: "内·化妆间·日",
            locationId: "LOC-001",
            locationName: "化妆间",
            cast: [{ characterId: "CHAR-001", lookId: "LOOK-001", speaks: true }],
            propIds: ["PROP-001"],
          }],
        },
        {
          id: "EP02",
          title: "第二集",
          summary: "后续里程碑。",
          scenes: [{ id: "EP02-S01", heading: "内·办公室·日", locationId: "LOC-002", locationName: "办公室" }],
        },
      ],
    }));
    await writeFile(join(projectRoot, "production", "asset-bindings.v1.json"), JSON.stringify({ schemaVersion: 1, assets: [] }));

    const story = await createProjectStoryCatalog(root).readProjectStory("story-demo", { episodeId: "EP01" });
    const scene = story.episode?.scenes[0];

    expect(scene?.requirements.map(({ role, status }) => ({ role, status }))).toEqual([
      { role: "scene-master", status: "MISSING" },
      { role: "character-standard", status: "MISSING" },
      { role: "voice-anchor", status: "MISSING" },
      { role: "prop-standard", status: "MISSING" },
    ]);
    expect(scene?.completion).toEqual({ status: "MISSING", ready: 0, required: 4, missing: 4, inProgress: 0, blocked: 0 });
    expect(story.episodes.find(({ id }) => id === "EP01")?.completion).toEqual(scene?.completion);
    expect(story.episodes.find(({ id }) => id === "EP02")?.completion).toEqual({ status: "NOT_DUE", ready: 0, required: 0, missing: 0, inProgress: 0, blocked: 0 });
    expect(story.characters[0]?.requirements.map(({ role, status }) => ({ role, status }))).toEqual([
      { role: "character-standard", status: "MISSING" },
      { role: "voice-anchor", status: "MISSING" },
    ]);
    expect(story.characters[0]?.completion).toEqual({ status: "MISSING", ready: 0, required: 2, missing: 2, inProgress: 0, blocked: 0 });
  });

  it("prefers the current milestone requirement over an older matching record", async () => {
    const root = await seedStoryProject();
    const projectRoot = join(root, "story-demo");
    await writeFile(join(projectRoot, "production", "story-index.v1.json"), JSON.stringify({
      schemaVersion: 1,
      story: { title: "里程碑顺序", genre: [], totalEpisodes: 1, logline: "旧需求不能遮住当前需求。", synopsis: "同主体按当前里程碑匹配。", summaryStatus: "ACCEPTED" },
      currentMilestone: { id: "CURRENT", episodeIds: ["EP01"] },
      requirements: [
        { id: "REQ-OLD", milestoneId: "OLD", role: "character-standard", subject: { characterId: "CHAR-001", lookId: "LOOK-001" }, required: true },
        { id: "REQ-CURRENT", milestoneId: "CURRENT", role: "character-standard", subject: { characterId: "CHAR-001", lookId: "LOOK-001" }, required: true, bindingAssetIds: ["ASSET-CHAR-001"] },
      ],
      characters: [{ id: "CHAR-001", name: "江砚秋", kind: "human", storyRole: "lead", oneLineSetting: "策划师", personality: [], biography: "", looks: [{ id: "LOOK-001", name: "当前造型", kind: "primary" }] }],
      episodes: [{ id: "EP01", title: "第一集", summary: "当前场次。", scenes: [{ id: "EP01-S01", heading: "内·大厅·日", cast: [{ characterId: "CHAR-001", lookId: "LOOK-001" }] }] }],
    }));

    const story = await createProjectStoryCatalog(root).readProjectStory("story-demo", { episodeId: "EP01" });

    expect(story.episode?.scenes[0]?.requirements).toEqual([
      expect.objectContaining({ id: "REQ-CURRENT", status: "READY" }),
    ]);
  });

  it("rejects duplicate stable identifiers before assembling the read model", async () => {
    const root = await seedStoryProject();
    const assetIndexPath = join(root, "story-demo", "production", "asset-bindings.v1.json");
    const assetIndex = JSON.parse(await readFile(assetIndexPath, "utf8"));
    assetIndex.assets.push({ ...assetIndex.assets[0], status: "DRAFT" });
    await writeFile(assetIndexPath, JSON.stringify(assetIndex));

    await expect(createProjectStoryCatalog(root).readProjectStory("story-demo")).rejects.toMatchObject({
      code: "invalid_index",
    });
  });
});
