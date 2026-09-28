/// <reference types="node" />
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { practiceExercises, practiceTracks } from "../data/videoPracticeCurriculum";
import { isReadyPracticeExercise, safePracticeUrl } from "./videoPractice";

const areas = { script: "剧本", "image-asset": "图片素材", "shot-prompt": "分镜提示词" };
describe("source-film practice catalog", () => {
  it("keeps unique routes, valid categories and only the user's actual source film", () => {
    expect(new Set(practiceExercises.map((item) => item.id)).size).toBe(practiceExercises.length);
    for (const item of practiceExercises) {
      expect(practiceTracks.some((track) => track.id === item.trackId)).toBe(true);
      expect(isReadyPracticeExercise(item)).toBe(true);
      expect(item.references.length).toBeGreaterThan(0);
      for (const reference of item.references) expect(reference.url).toBe("https://www.douyin.com/video/7672693169921723684");
      for (const prerequisite of item.prerequisites) expect(practiceExercises.some((other) => other.id === prerequisite)).toBe(true);
    }
  });
  it("gives each exercise a playable source range, observations, literacy and a film-specific choice", () => {
    for (const item of practiceExercises) {
      expect(item.segment, item.id).toBeDefined();
      expect(item.segment!.start).toBeGreaterThanOrEqual(0);
      expect(item.segment!.end).toBeGreaterThan(item.segment!.start);
      expect(item.segment!.end).toBeLessThanOrEqual(402.57);
      expect(item.segment!.observations.length).toBeGreaterThan(1);
      expect(item.segment!.mechanism.trim()).not.toBe("");
      expect(item.science, item.id).toBeDefined();
      expect(item.science!.concepts.length).toBeGreaterThanOrEqual(3);
      expect(item.science!.filmChoice.trim()).not.toBe("");
      expect(item.science!.generationTranslation.length).toBeGreaterThan(0);
    }
  });
  it("connects studies to existing knowledge files, without dangling or escaping paths", () => {
    for (const item of practiceExercises) for (const source of item.sources) {
      expect(source.path.split("/")).not.toContain("..");
      expect(existsSync(resolve("director-knowledge-base", areas[source.area], source.path)), `${item.id}: ${source.path}`).toBe(true);
    }
  });
  it("links every literacy concept to readable sources and credits every style example", () => {
    for (const exercise of practiceExercises) for (const concept of exercise.science!.concepts) {
      expect(concept.readings.length, concept.name).toBeGreaterThan(0);
      for (const reading of concept.readings) {
        expect(reading.title.trim()).not.toBe("");
        expect(reading.locate.trim()).not.toBe("");
        if (reading.url.startsWith("/knowledge/areas/")) {
          const [, , , area, ...parts] = reading.url.split("/");
          expect(area in areas).toBe(true);
          const path = parts.map(decodeURIComponent).join("/");
          expect(path.split("/")).not.toContain("..");
          expect(existsSync(resolve("director-knowledge-base", areas[area as keyof typeof areas], path)), reading.url).toBe(true);
        } else expect(safePracticeUrl(reading.url), concept.name).not.toBeNull();
      }
      if (exercise.id === "sister-style") {
        expect(concept.illustration, concept.name).toBeDefined();
        const image = concept.illustration!;
        expect(safePracticeUrl(image.src)).not.toBeNull();
        expect(safePracticeUrl(image.sourceUrl)).not.toBeNull();
        for (const field of [image.alt, image.work, image.credit, image.lookFor]) expect(field.trim()).not.toBe("");
      }
    }
  });
});
