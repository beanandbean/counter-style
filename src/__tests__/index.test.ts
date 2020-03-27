import CounterStyle, { decimal, sty } from "../index";

test("Tagged template", () => {
  const a = (index: number) => `${index}`;
  const b = (index: number) => `${index + 1}`;
  expect(sty`${a}/${b}.`(5)).toBe("5/6.");
  expect(sty`${a}/${b}.`(-1)).toBe("-1/0.");
});

test("Custom cyclic counter", () => {
  const counter = CounterStyle.cyclic(">");
  expect(counter(1)).toBe(">");
  expect(counter(5)).toBe(">");
});

test("Custom fixed counter", () => {
  const counter = CounterStyle.fixed("x", "y", "z");
  expect(counter(1)).toBe("x");
  expect(counter(2)).toBe("y");
  expect(counter(3)).toBe("z");
  expect(counter(4)).toBe("4");
});

test("Custom symbolic counter", () => {
  const counter = CounterStyle.symbolic("*", "&");
  expect(counter(1)).toBe("*");
  expect(counter(2)).toBe("&");
  expect(counter(3)).toBe("**");
  expect(counter(4)).toBe("&&");
  expect(counter(5)).toBe("***");
});

test("Custom alphabetic counter", () => {
  const counter = CounterStyle.alphabetic("T", "F");
  expect(counter(1)).toBe("T");
  expect(counter(2)).toBe("F");
  expect(counter(3)).toBe("TT");
  expect(counter(4)).toBe("TF");
  expect(counter(5)).toBe("FT");
  expect(counter(6)).toBe("FF");
  expect(counter(7)).toBe("TTT");
});

test("Custom numeric counter", () => {
  const counter = CounterStyle.numeric("0", "1", "2");
  expect(counter(0)).toBe("0");
  expect(counter(1)).toBe("1");
  expect(counter(2)).toBe("2");
  expect(counter(3)).toBe("10");
  expect(counter(4)).toBe("11");
  expect(counter(5)).toBe("12");
  expect(counter(6)).toBe("20");
});

test("Custom additive counter", () => {
  const counter = CounterStyle.additive({
    1: "1",
    2: "2",
    3: "3",
    4: "4",
    5: "5",
    6: "6"
  });
  expect(counter(1)).toBe("1");
  expect(counter(2)).toBe("2");
  expect(counter(3)).toBe("3");
  expect(counter(11)).toBe("65");
  expect(counter(12)).toBe("66");
  expect(counter(13)).toBe("661");
});

test("Negative decorator", () => {
  const counter = decimal.negative("(", ")");
  expect(counter(-2)).toBe("(2)");
  expect(counter(-1)).toBe("(1)");
  expect(counter(0)).toBe("0");
  expect(counter(1)).toBe("1");
  expect(counter(2)).toBe("2");
});

test("Left padding decorator", () => {
  const counter = decimal.padLeft(3, "0").negative("-");
  expect(counter(1)).toBe("001");
  expect(counter(20)).toBe("020");
  expect(counter(300)).toBe("300");
  expect(counter(4000)).toBe("4000");
  expect(counter(-5)).toBe("-05");
});

test("Right padding decorator", () => {
  const counter = decimal.padRight(3, " ");
  expect(counter(1)).toBe("1  ");
  expect(counter(20)).toBe("20 ");
  expect(counter(300)).toBe("300");
  expect(counter(4000)).toBe("4000");
  expect(counter(-5)).toBe("-5 ");
});
