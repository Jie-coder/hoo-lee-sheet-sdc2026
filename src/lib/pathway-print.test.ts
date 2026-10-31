import { describe, expect, it } from "vitest";
import { pathwayStopLeg, pathwayTicketNumber, sdgGoalNumbers, shortCourseUrl } from "./pathway-print";

describe("pathwayTicketNumber", () => {
  it("is PATH- plus four digits and stable per role", () => {
    const first = pathwayTicketNumber("http://data.europa.eu/esco/occupation/abc");
    expect(first).toMatch(/^PATH-\d{4}$/);
    expect(pathwayTicketNumber("http://data.europa.eu/esco/occupation/abc")).toBe(first);
  });

  it("differs between roles", () => {
    expect(pathwayTicketNumber("role-a")).not.toBe(pathwayTicketNumber("role-b"));
  });
});

describe("shortCourseUrl", () => {
  it("drops scheme, www and a trailing slash", () => {
    expect(shortCourseUrl("https://www.coursera.org/learn/sql/")).toBe("coursera.org/learn/sql");
  });

  it("cuts long links with an ellipsis", () => {
    const short = shortCourseUrl(`https://example.com/${"a".repeat(80)}`, 20);
    expect(short).toHaveLength(20);
    expect(short.endsWith("…")).toBe(true);
  });
});

describe("pathwayStopLeg", () => {
  it("boards first, arrives last, skills up between", () => {
    expect(pathwayStopLeg(0, 4)).toBe("board");
    expect(pathwayStopLeg(1, 4)).toBe("skillUp");
    expect(pathwayStopLeg(3, 4)).toBe("arrive");
    expect(pathwayStopLeg(0, 1)).toBe("board");
  });
});

describe("sdgGoalNumbers", () => {
  it("maps targets to unique ascending goals", () => {
    expect(sdgGoalNumbers(["8.5", "4.4", "8.6", "10.2"])).toEqual([4, 8, 10]);
  });
});
