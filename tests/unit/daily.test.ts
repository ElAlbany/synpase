import { describe, expect, it } from "vitest";
import { getDailyNoteTitle } from "@/lib/daily";

describe("getDailyNoteTitle", () => {
  it("formats as 'MMM d, yyyy'", () => {
    expect(getDailyNoteTitle(new Date(2025, 5, 21))).toBe("Jun 21, 2025");
  });

  it("does not zero-pad single-digit days", () => {
    expect(getDailyNoteTitle(new Date(2025, 0, 1))).toBe("Jan 1, 2025");
  });

  it("formats month ends correctly", () => {
    expect(getDailyNoteTitle(new Date(2025, 11, 31))).toBe("Dec 31, 2025");
    expect(getDailyNoteTitle(new Date(2024, 1, 29))).toBe("Feb 29, 2024");
  });
});
