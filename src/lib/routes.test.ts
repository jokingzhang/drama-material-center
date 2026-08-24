import { describe, expect, it } from "vitest";
import { projectLibraryPath } from "./routes";

describe("project library routes", () => {
  it("encodes every directory segment into a refresh-safe project URL", () => {
    expect(projectLibraryPath("zero-boundary", "剧情/第一集")).toBe(
      "/projects/zero-boundary/library/%E5%89%A7%E6%83%85/%E7%AC%AC%E4%B8%80%E9%9B%86",
    );
  });
});
