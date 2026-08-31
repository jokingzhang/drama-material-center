export type StoryObjectStatus = "MISSING" | "IN_PROGRESS" | "READY" | "BLOCKED" | "NOT_DUE";

export type StoryAssetKind = "story" | "image" | "video" | "audio" | "other";

export interface StoryAssetLink {
  assetId: string;
  materialType: string;
  path: string;
  name: string;
  kind: StoryAssetKind;
  url?: string;
  status: string;
  legacyPath: boolean;
  bindingState?: "STALE_BINDING" | "CONFLICT";
  verification?: {
    kind?: string;
    verifiedAt?: string;
  };
}

export interface StoryRequirementResult {
  id: string;
  label: string;
  role: string;
  status: StoryObjectStatus;
  reason: string;
  reasonCode?: "STALE_BINDING" | "INVALID_PATH" | "MISSING_FILE" | "HASH_MISMATCH" | "SUBJECT_CONFLICT" | "STATUS_CONFLICT";
  asset?: StoryAssetLink;
  suggestedAsset?: StoryAssetLink;
}

export interface StoryCompletion {
  status: StoryObjectStatus;
  ready: number;
  required: number;
  missing: number;
  inProgress: number;
  blocked: number;
}

export interface CharacterLookReadModel {
  id: string;
  name: string;
  kind: "primary" | "alternate" | "story-required";
  applicableEpisodeIds: string[];
  assets: StoryAssetLink[];
  preferredAsset?: StoryAssetLink;
  status: StoryObjectStatus;
}

export interface CharacterReadModel {
  id: string;
  name: string;
  kind: "human" | "creature" | "other";
  storyRole: string;
  oneLineSetting: string;
  personality: string[];
  biography: string;
  defaultLookId?: string;
  cardImage?: StoryAssetLink;
  cardImageStatus: StoryObjectStatus;
  cardImageReason: string;
  looks: CharacterLookReadModel[];
  episodeIds: string[];
  sceneCount: number;
  relatedFiles: StoryAssetLink[];
  requirements: StoryRequirementResult[];
  completion: StoryCompletion;
}

export interface EpisodeSummaryReadModel {
  id: string;
  title: string;
  summary: string;
  summaryStatus: string;
  sceneCount: number;
  characterIds: string[];
  locationIds: string[];
  requirements: StoryRequirementResult[];
  completion: StoryCompletion;
}

export interface SceneCastReadModel {
  characterId: string;
  characterName: string;
  lookId?: string;
  lookName?: string;
  speaks: boolean;
}

export interface ScenePropReadModel {
  id: string;
  status: StoryObjectStatus;
  asset?: StoryAssetLink;
}

export interface SceneReadModel {
  id: string;
  heading: string;
  summary?: string;
  locationId?: string;
  locationName?: string;
  scriptExcerpt?: string;
  cast: SceneCastReadModel[];
  propIds: string[];
  props: ScenePropReadModel[];
  requirements: StoryRequirementResult[];
  completion: StoryCompletion;
  derivedAssets: StoryAssetLink[];
  relatedFiles: StoryAssetLink[];
}

export interface EpisodeDetailReadModel extends EpisodeSummaryReadModel {
  script?: StoryAssetLink;
  relatedFiles: StoryAssetLink[];
  scenes: SceneReadModel[];
}

export interface ProjectStoryReadModel {
  project: {
    id: string;
    name: string;
    description?: string;
  };
  story: {
    title: string;
    genre: string[];
    totalEpisodes: number;
    productionScope?: string;
    logline: string;
    synopsis: string;
    coreConflict?: string;
    relationshipArc?: string;
    worldRules?: string[];
    summaryStatus: string;
    source?: StoryAssetLink;
  };
  currentMilestone: {
    id: string;
    name?: string;
    episodeIds: string[];
  };
  characters: CharacterReadModel[];
  episodes: EpisodeSummaryReadModel[];
  episode?: EpisodeDetailReadModel;
  relatedFiles: StoryAssetLink[];
  unregisteredAssets: StoryAssetLink[];
}
