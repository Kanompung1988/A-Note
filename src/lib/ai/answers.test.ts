import { describe, expect, it } from "vitest";
import { normalizeAnswer, numbersIn, sameAnswer } from "./answers";

describe("normalizeAnswer", () => {
  it("drops variable prefixes, separators and spaces", () => {
    expect(normalizeAnswer(" x = 5 ")).toBe("5");
    expect(normalizeAnswer("1,250 baht.")).toBe("1250baht");
    expect(normalizeAnswer("x = −3")).toBe("-3");
  });
});

describe("numbersIn", () => {
  it("reads integers, decimals and fractions", () => {
    expect(numbersIn("x = 12")).toEqual(["12"]);
    expect(numbersIn("2.50 m")).toEqual(["2.5"]);
    expect(numbersIn("3/4")).toEqual(["0.75"]);
  });
});

describe("sameAnswer", () => {
  it("matches equivalent short answers", () => {
    expect(sameAnswer("x = 5", "5")).toBe(true);
    expect(sameAnswer("550 baht", "550")).toBe(true);
    expect(sameAnswer("0.75", "3/4")).toBe(true);
    expect(sameAnswer("x = 7", "x=7.")).toBe(true);
  });

  it("rejects different numbers", () => {
    expect(sameAnswer("x = 5", "x = 6")).toBe(false);
    expect(sameAnswer("550 baht", "700 baht")).toBe(false);
  });

  it("leaves worded answers to the judge", () => {
    expect(sameAnswer("The bulb goes out because the circuit is open", "It turns off: the loop is broken")).toBeNull();
    expect(sameAnswer("", "5")).toBeNull();
  });
});
