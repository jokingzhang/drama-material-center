export type StoryObjectStatus = "MISSING" | "IN_PROGRESS" | "READY" | "BLOCKED" | "NOT_DUE";

export type StoryAssetKind = "story" | "image" | "video" | "audio" | "other";

export interface StoryAssetLink {
  assetId: string;
  materialType: string;
  path: string;
  name: string;
  kind: StoryAssetKind;
  url?: string;
  updatedAt?: string;
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

export type EpisodeProductionStage =
  | "NOT_STARTED"
  | "SCRIPT_READY"
  | "STORYBOARD_DRAFT"
  | "PREPRODUCTION"
  | "SHOT_PRODUCTION"
  | "FINAL_REVIEW"
  | "COMPLETED";

export interface EpisodeCompletionEvidence {
  kind: "human-playback" | "user-confirmation";
  verifiedAt?: string;
  note?: string;
}

export interface EpisodeProductionReadModel {
  id: string;
  title: string;
  stage: EpisodeProductionStage;
  current: boolean;
  completionEvidence?: EpisodeCompletionEvidence;
}

export interface StoryProductionOverview {
  completedEpisodes: number;
  totalEpisodes: number;
  percentage: number;
  pipeline: {
    scriptReady: number;
    storyboardReady: number;
    shotProduced: number;
    finalAccepted: number;
  };
  stageCounts: Record<EpisodeProductionStage, number>;
  episodes: EpisodeProductionReadModel[];
}

export interface ProductionSchedulePhase {
  id: string;
  startDate: string;
  endDate: string;
  title: string;
  items: string[];
}

export interface ProductionScheduleReadModel {
  title: string;
  timezone: string;
  phases: ProductionSchedulePhase[];
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
  voiceAssets: StoryAssetLink[];
  preferredVoice?: StoryAssetLink;
  episodeIds: string[];
  sceneCount: number;
  relatedFiles: StoryAssetLink[];
  requirements: StoryRequirementResult[];
  completion: StoryCompletion;
}

export interface LocationReadModel {
  id: string;
  name: string;
  oneLineSetting?: string;
  description?: string;
  cardImage?: StoryAssetLink;
  cardImageStatus: StoryObjectStatus;
  cardImageReason: string;
  images: StoryAssetLink[];
  ambientAudio: StoryAssetLink[];
  preferredAmbientAudio?: StoryAssetLink;
  relatedFiles: StoryAssetLink[];
  episodeIds: string[];
  sceneCount: number;
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
  assets: StoryAssetLink[];
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
  assets: StoryAssetLink[];
  derivedAssets: StoryAssetLink[];
  relatedFiles: StoryAssetLink[];
}

export interface EpisodeDetailReadModel extends EpisodeSummaryReadModel {
  script?: StoryAssetLink;
  relatedFiles: StoryAssetLink[];
  assets: StoryAssetLink[];
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
    aspectRatio?: string;
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
  productionSchedule?: ProductionScheduleReadModel;
  currentMilestoneCompletion: StoryCompletion;
  production: StoryProductionOverview;
  characters: CharacterReadModel[];
  locations: LocationReadModel[];
  episodes: EpisodeSummaryReadModel[];
  episode?: EpisodeDetailReadModel;
  relatedFiles: StoryAssetLink[];
  unregisteredAssets: StoryAssetLink[];
  assets: StoryAssetLink[];
}
