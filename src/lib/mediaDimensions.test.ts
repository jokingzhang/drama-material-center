import { describe, expect, it } from "vitest";
import { formatAspectRatio } from "./mediaDimensions";

describe("formatAspectRatio", () => {
  it("recognizes common production aspect ratios from real pixel dimensions", () => {
    expect(formatAspectRatio(1080, 1920)).toBe("9:16");
    expect(formatAspectRatio(1920, 1080)).toBe("16:9");
    expect(formatAspectRatio(1024, 1024)).toBe("1:1");
    expect(formatAspectRatio(2048, 878)).toBe("21:9");
  });

  it("keeps uncommon ratios honest instead of forcing a standard label", () => {
    expect(formatAspectRatio(1000, 700)).toBe("1.43:1");
    expect(formatAspectRatio(0, 700)).toBeUndefined();
  });
});
