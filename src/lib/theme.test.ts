import { describe, expect, it } from "vitest";
import { nextTheme } from "./theme";

describe("nextTheme", () => {
  it("switches between the two supported themes", () => {
    expect(nextTheme("light")).toBe("dark");
    expect(nextTheme("dark")).toBe("light");
  });
});
