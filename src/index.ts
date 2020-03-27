const _pad = (
  original: string | undefined,
  length: number,
  pad: string,
  modifier: (original: string, pad: string) => string
) =>
  typeof original === "string"
    ? original.length < length
      ? modifier(original, pad.repeat(length - original.length))
      : original
    : undefined;

const _mod = (value: number, divisor: number) =>
  ((value % divisor) + divisor) % divisor;

export type CounterFormatter = (index: number) => string;

interface CounterStyle {
  (index: number): string;

  fallback(fallback: CounterFormatter): CounterStyle;
  range(min: number, max: number, fallback?: CounterStyle): CounterStyle;

  negative(prefix: string, suffix?: string): CounterStyle;

  padLeft(length: number, pad: string): CounterStyle;
  padRight(length: number, pad: string): CounterStyle;
}

interface CounterStyleImpl extends CounterStyle {
  _render: (index: number, decoratorLength: number) => string | undefined;
  _fallback: CounterFormatter;
}

const _prototype = Object.freeze({
  fallback(fallback: CounterStyle) {
    return CounterStyle.raw(this._render, fallback);
  },

  range(min: number, max: number, fallback?: (index: number) => string) {
    return CounterStyle.raw(
      (index, decoratorLength) =>
        index >= min && index <= max
          ? this._render(index, decoratorLength)
          : undefined,
      fallback || this._fallback
    );
  },

  negative(prefix: string, suffix: string = "") {
    return CounterStyle.raw((index, decoratorLength) => {
      if (index < 0) {
        const result = this._render(
          -index,
          decoratorLength + prefix.length + suffix.length
        );
        return typeof result === "string"
          ? prefix + result + suffix
          : undefined;
      } else {
        return this._render(index, decoratorLength);
      }
    }, this._fallback);
  },

  padLeft(length: number, pad: string) {
    return CounterStyle.raw(
      (index, decoratorLength) =>
        _pad(
          this._render(index, 0),
          length - decoratorLength,
          pad,
          (original, padding) => padding + original
        ),
      this._fallback
    );
  },
  padRight(length: number, pad: string) {
    return CounterStyle.raw(
      (index, decoratorLength) =>
        _pad(
          this._render(index, 0),
          length - decoratorLength,
          pad,
          (original, padding) => original + padding
        ),
      this._fallback
    );
  }
} as CounterStyleImpl);

const CounterStyle = Object.freeze({
  raw: (
    func: (index: number, decoratorLength: number) => string | undefined,
    fallback: CounterFormatter = index => index.toString()
  ): CounterStyle => {
    const impl = ((index: number) => {
      const result = impl._render(index, 0);
      if (typeof result === "undefined") {
        return impl._fallback(index);
      } else {
        return result;
      }
    }) as CounterStyleImpl;
    return Object.freeze(
      Object.assign(impl, _prototype, { _render: func, _fallback: fallback })
    );
  },

  cyclic: (...symbols: string[]) => {
    if (symbols.length === 1) {
      return CounterStyle.raw(_index => symbols[0]);
    } else {
      return CounterStyle.raw(
        index => symbols[_mod(index - 1, symbols.length)]
      );
    }
  },

  fixed: (...symbols: string[]) =>
    CounterStyle.raw(index => symbols[index - 1]).range(1, symbols.length),

  symbolic: (...symbols: string[]) =>
    CounterStyle.raw(index =>
      symbols[_mod(index - 1, symbols.length)].repeat(
        Math.ceil(index / symbols.length)
      )
    ).range(1, Infinity),

  alphabetic: (...symbols: string[]) =>
    CounterStyle.raw(index => {
      let result = "";
      while (index > 0) {
        index--;
        result = symbols[_mod(index, symbols.length)] + result;
        index = Math.floor(index / symbols.length);
      }
      return result;
    }).range(1, Infinity),

  numeric: (...symbols: string[]) =>
    CounterStyle.raw(index => {
      if (index === 0) {
        return symbols[0];
      } else {
        let result = "";
        while (index > 0) {
          result = symbols[_mod(index, symbols.length)] + result;
          index = Math.floor(index / symbols.length);
        }
        return result;
      }
    }).range(0, Infinity),

  additive: (symbols: { [value: number]: string }) => {
    const values = Object.keys(symbols)
      .map(value => parseInt(value, 10))
      .filter(value => value > 0);
    values.sort((a, b) => b - a);
    const symbolList = values.map(value => ({ value, symbol: symbols[value] }));
    const style = CounterStyle.raw(index => {
      if (index === 0) {
        return symbols[0];
      } else {
        let result = "";
        for (const { value, symbol } of symbolList) {
          if (index >= value) {
            const repeat = Math.floor(index / value);
            result += symbol.repeat(repeat);
            index -= repeat * value;
          }
        }
        return index === 0 ? result : undefined;
      }
    });
    if (0 in symbols) {
      return style.range(0, Infinity);
    } else {
      return style.range(1, Infinity);
    }
  }
});
export default CounterStyle;

export const sty = (
  strings: TemplateStringsArray,
  ...counters: CounterFormatter[]
): CounterFormatter => index => {
  let result = strings[0];
  counters.forEach((counter, i) => {
    result += counter(index) + strings[i + 1];
  });
  return result;
};

const _cjkItem = (counter: CounterFormatter) =>
  sty`${counter}\u3001`; /* "、" */

// Predefined counter styles, based on
//   https://drafts.csswg.org/css-counter-styles-3/#predefined-counters

// Default implementation is faster than invoking CounterStyle.numeric
export const decimal = CounterStyle.raw(index => index.toString());
export const decimalLeadingZero = decimal.padLeft(2, "0").negative("-");

export const arabicIndic = CounterStyle.numeric(
  /* ٠ ١ ٢ ٣ ٤ ٥ ٦ ٧ ٨ ٩ */
  "\u0660",
  "\u0661",
  "\u0662",
  "\u0663",
  "\u0664",
  "\u0665",
  "\u0666",
  "\u0667",
  "\u0668",
  "\u0669"
);

export const armenian = CounterStyle.additive({
  /* 9000 Ք, 8000 Փ, 7000 Ւ, 6000 Ց, 5000 Ր, 4000 Տ, 3000 Վ, 2000 Ս, 1000 Ռ,
     900 Ջ, 800 Պ, 700 Չ, 600 Ո, 500 Շ, 400 Ն, 300 Յ, 200 Մ, 100 Ճ,
     90 Ղ, 80 Ձ, 70 Հ, 60 Կ, 50 Ծ, 40 Խ, 30 Լ, 20 Ի, 10 Ժ,
     9 Թ, 8 Ը, 7 Է, 6 Զ, 5 Ե, 4 Դ, 3 Գ, 2 Բ, 1 Ա */
  9000: "\u0554",
  8000: "\u0553",
  7000: "\u0552",
  6000: "\u0551",
  5000: "\u0550",
  4000: "\u054F",
  3000: "\u054E",
  2000: "\u054D",
  1000: "\u054C",
  900: "\u054B",
  800: "\u054A",
  700: "\u0549",
  600: "\u0548",
  500: "\u0547",
  400: "\u0546",
  300: "\u0545",
  200: "\u0544",
  100: "\u0543",
  90: "\u0542",
  80: "\u0541",
  70: "\u0540",
  60: "\u053F",
  50: "\u053E",
  40: "\u053D",
  30: "\u053C",
  20: "\u053B",
  10: "\u053A",
  9: "\u0539",
  8: "\u0538",
  7: "\u0537",
  6: "\u0536",
  5: "\u0535",
  4: "\u0534",
  3: "\u0533",
  2: "\u0532",
  1: "\u0531"
}).range(1, 9999);

export const upperArmenian = armenian;

export const lowerArmenian = CounterStyle.additive({
  /* 9000 ք, 8000 փ, 7000 ւ, 6000 ց, 5000 ր, 4000 տ, 3000 վ, 2000 ս,
     1000 ռ, 900 ջ, 800 պ, 700 չ, 600 ո, 500 շ, 400 ն, 300 յ, 200 մ,
     100 ճ, 90 ղ, 80 ձ, 70 հ, 60 կ, 50 ծ, 40 խ, 30 լ, 20 ի,
     10 ժ, 9 թ, 8 ը, 7 է, 6 զ, 5 ե, 4 դ, 3 գ, 2 բ, 1 ա */
  9000: "\u0584",
  8000: "\u0583",
  7000: "\u0582",
  6000: "\u0581",
  5000: "\u0580",
  4000: "\u057F",
  3000: "\u057E",
  2000: "\u057D",
  1000: "\u057C",
  900: "\u057B",
  800: "\u057A",
  700: "\u0579",
  600: "\u0578",
  500: "\u0577",
  400: "\u0576",
  300: "\u0575",
  200: "\u0574",
  100: "\u0573",
  90: "\u0572",
  80: "\u0571",
  70: "\u0570",
  60: "\u056F",
  50: "\u056E",
  40: "\u056D",
  30: "\u056C",
  20: "\u056B",
  10: "\u056A",
  9: "\u0569",
  8: "\u0568",
  7: "\u0567",
  6: "\u0566",
  5: "\u0565",
  4: "\u0564",
  3: "\u0563",
  2: "\u0562",
  1: "\u0561"
}).range(1, 9999);

export const bengali = CounterStyle.numeric(
  /* ০ ১ ২ ৩ ৪ ৫ ৬ ৭ ৮ ৯ */
  "\u09E6",
  "\u09E7",
  "\u09E8",
  "\u09E9",
  "\u09EA",
  "\u09EB",
  "\u09EC",
  "\u09ED",
  "\u09EE",
  "\u09EF"
);

export const cambodian = CounterStyle.numeric(
  /* ០ ១ ២ ៣ ៤ ៥ ៦ ៧ ៨ ៩ */
  "\u17E0",
  "\u17E1",
  "\u17E2",
  "\u17E3",
  "\u17E4",
  "\u17E5",
  "\u17E6",
  "\u17E7",
  "\u17E8",
  "\u17E9"
);

export const khmer = cambodian;

export const cjkDecimal = CounterStyle.numeric(
  /* 〇 一 二 三 四 五 六 七 八 九 */
  "\u3007",
  "\u4E00",
  "\u4E8C",
  "\u4E09",
  "\u56DB",
  "\u4E94",
  "\u516D",
  "\u4E03",
  "\u516B",
  "\u4E5D"
);
export const cjkDecimalItem = _cjkItem(cjkDecimal);

export const devanagari = CounterStyle.numeric(
  /* ० १ २ ३ ४ ५ ६ ७ ८ ९ */
  "\u0966",
  "\u0967",
  "\u0968",
  "\u0969",
  "\u096A",
  "\u096B",
  "\u096C",
  "\u096D",
  "\u096E",
  "\u096F"
);

export const georgian = CounterStyle.additive({
  /* 10000 ჵ, 9000 ჰ, 8000 ჯ, 7000 ჴ, 6000 ხ, 5000 ჭ, 4000 წ, 3000 ძ,
     2000 ც, 1000 ჩ, 900 შ, 800 ყ, 700 ღ, 600 ქ, 500 ფ, 400 ჳ, 300 ტ,
     200 ს, 100 რ, 90 ჟ, 80 პ, 70 ო, 60 ჲ, 50 ნ, 40 მ, 30 ლ,
     20 კ, 10 ი, 9 თ, 8 ჱ, 7 ზ, 6 ვ, 5 ე, 4 დ, 3 გ, 2 ბ, 1 ა */
  10000: "\u10F5",
  9000: "\u10F0",
  8000: "\u10EF",
  7000: "\u10F4",
  6000: "\u10EE",
  5000: "\u10ED",
  4000: "\u10EC",
  3000: "\u10EB",
  2000: "\u10EA",
  1000: "\u10E9",
  900: "\u10E8",
  800: "\u10E7",
  700: "\u10E6",
  600: "\u10E5",
  500: "\u10E4",
  400: "\u10F3",
  300: "\u10E2",
  200: "\u10E1",
  100: "\u10E0",
  90: "\u10DF",
  80: "\u10DE",
  70: "\u10DD",
  60: "\u10F2",
  50: "\u10DC",
  40: "\u10DB",
  30: "\u10DA",
  20: "\u10D9",
  10: "\u10D8",
  9: "\u10D7",
  8: "\u10F1",
  7: "\u10D6",
  6: "\u10D5",
  5: "\u10D4",
  4: "\u10D3",
  3: "\u10D2",
  2: "\u10D1",
  1: "\u10D0"
}).range(1, 19999);

export const gujarati = CounterStyle.numeric(
  /* ૦ ૧ ૨ ૩ ૪ ૫ ૬ ૭ ૮ ૯ */
  "\u0AE6",
  "\u0AE7",
  "\u0AE8",
  "\u0AE9",
  "\u0AEA",
  "\u0AEB",
  "\u0AEC",
  "\u0AED",
  "\u0AEE",
  "\u0AEF"
);

export const gurmukhi = CounterStyle.numeric(
  /* ੦ ੧ ੨ ੩ ੪ ੫ ੬ ੭ ੮ ੯ */
  "\u0A66",
  "\u0A67",
  "\u0A68",
  "\u0A69",
  "\u0A6A",
  "\u0A6B",
  "\u0A6C",
  "\u0A6D",
  "\u0A6E",
  "\u0A6F"
);

export const hebrew = CounterStyle.additive({
  /* Hebrew numerals from draft.csswg.org are not included here for
     reference, because Visual Studio Code fails to display them in
     the correct word order. */
  /* This system manually specifies the values for 19-15 to force
     the correct display of 15 and 16, which are commonly rewritten
     to avoid a close resemblance to the Tetragrammaton. */
  10000: "\u05D9\u05F3",
  9000: "\u05D8\u05F3",
  8000: "\u05D7\u05F3",
  7000: "\u05D6\u05F3",
  6000: "\u05D5\u05F3",
  5000: "\u05D4\u05F3",
  4000: "\u05D3\u05F3",
  3000: "\u05D2\u05F3",
  2000: "\u05D1\u05F3",
  1000: "\u05D0\u05F3",
  900: "\u05E5",
  800: "\u05E3",
  700: "\u05DF",
  600: "\u05DD",
  500: "\u05DA",
  400: "\u05EA",
  300: "\u05E9",
  200: "\u05E8",
  100: "\u05E7",
  90: "\u05E6",
  80: "\u05E4",
  70: "\u05E2",
  60: "\u05E1",
  50: "\u05E0",
  40: "\u05DE",
  30: "\u05DC",
  20: "\u05DB",
  19: "\u05D9\u05D8",
  18: "\u05D9\u05D7",
  17: "\u05D9\u05D6",
  16: "\u05D8\u05D6",
  15: "\u05D8\u05D5",
  10: "\u05D9",
  9: "\u05D8",
  8: "\u05D7",
  7: "\u05D6",
  6: "\u05D5",
  5: "\u05D4",
  4: "\u05D3",
  3: "\u05D2",
  2: "\u05D1",
  1: "\u05D0"
}).range(1, 10999);

export const kannada = CounterStyle.numeric(
  /* ೦ ೧ ೨ ೩ ೪ ೫ ೬ ೭ ೮ ೯ */
  "\u0CE6",
  "\u0CE7",
  "\u0CE8",
  "\u0CE9",
  "\u0CEA",
  "\u0CEB",
  "\u0CEC",
  "\u0CED",
  "\u0CEE",
  "\u0CEF"
);

export const lao = CounterStyle.numeric(
  /* ໐ ໑ ໒ ໓ ໔ ໕ ໖ ໗ ໘ ໙ */
  "\u0ED0",
  "\u0ED1",
  "\u0ED2",
  "\u0ED3",
  "\u0ED4",
  "\u0ED5",
  "\u0ED6",
  "\u0ED7",
  "\u0ED8",
  "\u0ED9"
);

export const malayalam = CounterStyle.numeric(
  /* ൦ ൧ ൨ ൩ ൪ ൫ ൬ ൭ ൮ ൯ */
  "\u0D66",
  "\u0D67",
  "\u0D68",
  "\u0D69",
  "\u0D6A",
  "\u0D6B",
  "\u0D6C",
  "\u0D6D",
  "\u0D6E",
  "\u0D6F"
);

export const mongolian = CounterStyle.numeric(
  /* ᠐ ᠑ ᠒ ᠓ ᠔ ᠕ ᠖ ᠗ ᠘ ᠙ */
  "\u1810",
  "\u1811",
  "\u1812",
  "\u1813",
  "\u1814",
  "\u1815",
  "\u1816",
  "\u1817",
  "\u1818",
  "\u1819"
);

export const myanmar = CounterStyle.numeric(
  /* ၀ ၁ ၂ ၃ ၄ ၅ ၆ ၇ ၈ ၉ */
  "\u1040",
  "\u1041",
  "\u1042",
  "\u1043",
  "\u1044",
  "\u1045",
  "\u1046",
  "\u1047",
  "\u1048",
  "\u1049"
);

export const oriya = CounterStyle.numeric(
  /* ୦ ୧ ୨ ୩ ୪ ୫ ୬ ୭ ୮ ୯ */
  "\u0B66",
  "\u0B67",
  "\u0B68",
  "\u0B69",
  "\u0B6A",
  "\u0B6B",
  "\u0B6C",
  "\u0B6D",
  "\u0B6E",
  "\u0B6F"
);

export const persian = CounterStyle.numeric(
  /* ۰ ۱ ۲ ۳ ۴ ۵ ۶ ۷ ۸ ۹ */
  "\u06F0",
  "\u06F1",
  "\u06F2",
  "\u06F3",
  "\u06F4",
  "\u06F5",
  "\u06F6",
  "\u06F7",
  "\u06F8",
  "\u06F9"
);

export const lowerRoman = CounterStyle.additive({
  1000: "m",
  900: "cm",
  500: "d",
  400: "cd",
  100: "c",
  90: "xc",
  50: "l",
  40: "xl",
  10: "x",
  9: "ix",
  5: "v",
  4: "iv",
  1: "i"
}).range(1, 3999);

export const upperRoman = CounterStyle.additive({
  1000: "M",
  900: "CM",
  500: "D",
  400: "CD",
  100: "C",
  90: "XC",
  50: "L",
  40: "XL",
  10: "X",
  9: "IX",
  5: "V",
  4: "IV",
  1: "I"
}).range(1, 3999);

export const tamil = CounterStyle.numeric(
  /* ௦ ௧ ௨ ௩ ௪ ௫ ௬ ௭ ௮ ௯ */
  "\u0BE6",
  "\u0BE7",
  "\u0BE8",
  "\u0BE9",
  "\u0BEA",
  "\u0BEB",
  "\u0BEC",
  "\u0BED",
  "\u0BEE",
  "\u0BEF"
);

export const telugu = CounterStyle.numeric(
  /* ౦ ౧ ౨ ౩ ౪ ౫ ౬ ౭ ౮ ౯ */
  "\u0C66",
  "\u0C67",
  "\u0C68",
  "\u0C69",
  "\u0C6A",
  "\u0C6B",
  "\u0C6C",
  "\u0C6D",
  "\u0C6E",
  "\u0C6F"
);

export const thai = CounterStyle.numeric(
  /* ๐ ๑ ๒ ๓ ๔ ๕ ๖ ๗ ๘ ๙ */
  "\u0E50",
  "\u0E51",
  "\u0E52",
  "\u0E53",
  "\u0E54",
  "\u0E55",
  "\u0E56",
  "\u0E57",
  "\u0E58",
  "\u0E59"
);

export const tibetan = CounterStyle.numeric(
  /* ༠ ༡ ༢ ༣ ༤ ༥ ༦ ༧ ༨ ༩ */
  "\u0F20",
  "\u0F21",
  "\u0F22",
  "\u0F23",
  "\u0F24",
  "\u0F25",
  "\u0F26",
  "\u0F27",
  "\u0F28",
  "\u0F29"
);

export const lowerAlpha = CounterStyle.alphabetic(
  "a",
  "b",
  "c",
  "d",
  "e",
  "f",
  "g",
  "h",
  "i",
  "j",
  "k",
  "l",
  "m",
  "n",
  "o",
  "p",
  "q",
  "r",
  "s",
  "t",
  "u",
  "v",
  "w",
  "x",
  "y",
  "z"
);
export const lowerLatin = lowerAlpha;

export const upperAlpha = CounterStyle.alphabetic(
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "I",
  "J",
  "K",
  "L",
  "M",
  "N",
  "O",
  "P",
  "Q",
  "R",
  "S",
  "T",
  "U",
  "V",
  "W",
  "X",
  "Y",
  "Z"
);
export const upperLatin = upperAlpha;

export const lowerGreek = CounterStyle.alphabetic(
  /* α β γ δ ε ζ η θ ι κ λ μ ν ξ ο π ρ σ τ υ φ χ ψ ω */
  "\u03B1",
  "\u03B2",
  "\u03B3",
  "\u03B4",
  "\u03B5",
  "\u03B6",
  "\u03B7",
  "\u03B8",
  "\u03B9",
  "\u03BA",
  "\u03BB",
  "\u03BC",
  "\u03BD",
  "\u03BE",
  "\u03BF",
  "\u03C0",
  "\u03C1",
  "\u03C3",
  "\u03C4",
  "\u03C5",
  "\u03C6",
  "\u03C7",
  "\u03C8",
  "\u03C9"
);

export const hiragana = CounterStyle.alphabetic(
  /* あ い う え お か き く け こ さ し す せ そ た ち つ て と
     な に ぬ ね の は ひ ふ へ ほ ま み む め も や ゆ よ
     ら り る れ ろ わ ゐ ゑ を ん */
  "\u3042",
  "\u3044",
  "\u3046",
  "\u3048",
  "\u304A",
  "\u304B",
  "\u304D",
  "\u304F",
  "\u3051",
  "\u3053",
  "\u3055",
  "\u3057",
  "\u3059",
  "\u305B",
  "\u305D",
  "\u305F",
  "\u3061",
  "\u3064",
  "\u3066",
  "\u3068",
  "\u306A",
  "\u306B",
  "\u306C",
  "\u306D",
  "\u306E",
  "\u306F",
  "\u3072",
  "\u3075",
  "\u3078",
  "\u307B",
  "\u307E",
  "\u307F",
  "\u3080",
  "\u3081",
  "\u3082",
  "\u3084",
  "\u3086",
  "\u3088",
  "\u3089",
  "\u308A",
  "\u308B",
  "\u308C",
  "\u308D",
  "\u308F",
  "\u3090",
  "\u3091",
  "\u3092",
  "\u3093"
);
export const hiraganaItem = _cjkItem(hiragana);

export const hiraganaIroha = CounterStyle.alphabetic(
  /* い ろ は に ほ へ と ち り ぬ る を わ か よ た れ そ
     つ ね な ら む う ゐ の お く や ま け ふ こ え て
     あ さ き ゆ め み し ゑ ひ も せ す */
  "\u3044",
  "\u308D",
  "\u306F",
  "\u306B",
  "\u307B",
  "\u3078",
  "\u3068",
  "\u3061",
  "\u308A",
  "\u306C",
  "\u308B",
  "\u3092",
  "\u308F",
  "\u304B",
  "\u3088",
  "\u305F",
  "\u308C",
  "\u305D",
  "\u3064",
  "\u306D",
  "\u306A",
  "\u3089",
  "\u3080",
  "\u3046",
  "\u3090",
  "\u306E",
  "\u304A",
  "\u304F",
  "\u3084",
  "\u307E",
  "\u3051",
  "\u3075",
  "\u3053",
  "\u3048",
  "\u3066",
  "\u3042",
  "\u3055",
  "\u304D",
  "\u3086",
  "\u3081",
  "\u307F",
  "\u3057",
  "\u3091",
  "\u3072",
  "\u3082",
  "\u305B",
  "\u3059"
);
export const hiraganaIrohaItem = _cjkItem(hiraganaIroha);

export const katakana = CounterStyle.alphabetic(
  /* ア イ ウ エ オ カ キ ク ケ コ サ シ ス セ ソ タ チ ツ テ ト
     ナ ニ ヌ ネ ノ ハ ヒ フ ヘ ホ マ ミ ム メ モ ヤ ユ ヨ
     ラ リ ル レ ロ ワ ヰ ヱ ヲ ン */
  "\u30A2",
  "\u30A4",
  "\u30A6",
  "\u30A8",
  "\u30AA",
  "\u30AB",
  "\u30AD",
  "\u30AF",
  "\u30B1",
  "\u30B3",
  "\u30B5",
  "\u30B7",
  "\u30B9",
  "\u30BB",
  "\u30BD",
  "\u30BF",
  "\u30C1",
  "\u30C4",
  "\u30C6",
  "\u30C8",
  "\u30CA",
  "\u30CB",
  "\u30CC",
  "\u30CD",
  "\u30CE",
  "\u30CF",
  "\u30D2",
  "\u30D5",
  "\u30D8",
  "\u30DB",
  "\u30DE",
  "\u30DF",
  "\u30E0",
  "\u30E1",
  "\u30E2",
  "\u30E4",
  "\u30E6",
  "\u30E8",
  "\u30E9",
  "\u30EA",
  "\u30EB",
  "\u30EC",
  "\u30ED",
  "\u30EF",
  "\u30F0",
  "\u30F1",
  "\u30F2",
  "\u30F3"
);
export const katakanaItem = _cjkItem(katakana);

export const katakanaIroha = CounterStyle.alphabetic(
  /* イ ロ ハ ニ ホ ヘ ト チ リ ヌ ル ヲ ワ カ ヨ タ レ ソ
     ツ ネ ナ ラ ム ウ ヰ ノ オ ク ヤ マ ケ フ コ エ テ
     ア サ キ ユ メ ミ シ ヱ ヒ モ セ ス */
  "\u30A4",
  "\u30ED",
  "\u30CF",
  "\u30CB",
  "\u30DB",
  "\u30D8",
  "\u30C8",
  "\u30C1",
  "\u30EA",
  "\u30CC",
  "\u30EB",
  "\u30F2",
  "\u30EF",
  "\u30AB",
  "\u30E8",
  "\u30BF",
  "\u30EC",
  "\u30BD",
  "\u30C4",
  "\u30CD",
  "\u30CA",
  "\u30E9",
  "\u30E0",
  "\u30A6",
  "\u30F0",
  "\u30CE",
  "\u30AA",
  "\u30AF",
  "\u30E4",
  "\u30DE",
  "\u30B1",
  "\u30D5",
  "\u30B3",
  "\u30A8",
  "\u30C6",
  "\u30A2",
  "\u30B5",
  "\u30AD",
  "\u30E6",
  "\u30E1",
  "\u30DF",
  "\u30B7",
  "\u30F1",
  "\u30D2",
  "\u30E2",
  "\u30BB",
  "\u30B9"
);
export const katakanaIrohaItem = _cjkItem(katakanaIroha);

export const disc = CounterStyle.cyclic("\u2022"); /* • */
export const circle = CounterStyle.cyclic("\u25E6"); /* ◦ */
export const square = CounterStyle.cyclic("\u25FE"); /* ◾ */

export const cjkEarthlyBranch = CounterStyle.fixed(
  /* 子 丑 寅 卯 辰 巳 午 未 申 酉 戌 亥 */
  "\u5B50",
  "\u4E11",
  "\u5BC5",
  "\u536F",
  "\u8FB0",
  "\u5DF3",
  "\u5348",
  "\u672A",
  "\u7533",
  "\u9149",
  "\u620C",
  "\u4EA5"
);
export const cjkEarthlyBranchItem = _cjkItem(cjkEarthlyBranch);

export const cjkHeavenlyStem = CounterStyle.fixed(
  /* 甲 乙 丙 丁 戊 己 庚 辛 壬 癸 */
  "\u7532",
  "\u4E59",
  "\u4E19",
  "\u4E01",
  "\u620A",
  "\u5DF1",
  "\u5E9A",
  "\u8F9B",
  "\u58EC",
  "\u7678"
);
export const cjkHeavenlyStemItem = _cjkItem(cjkHeavenlyStem);

export const japaneseInformal = CounterStyle.additive({
  /* 9000 九千, 8000 八千, 7000 七千, 6000 六千, 5000 五千, 4000 四千,
     3000 三千, 2000 二千, 1000 千, 900 九百, 800 八百, 700 七百,
     600 六百, 500 五百, 400 四百, 300 三百, 200 二百, 100 百, 90 九十,
     80 八十, 70 七十, 60 六十, 50 五十, 40 四十, 30 三十, 20 二十, 10 十,
     9 九, 8 八, 7 七, 6 六, 5 五, 4 四, 3 三, 2 二, 1 一, 0 〇 */
  9000: "\u4E5D\u5343",
  8000: "\u516B\u5343",
  7000: "\u4E03\u5343",
  6000: "\u516D\u5343",
  5000: "\u4E94\u5343",
  4000: "\u56DB\u5343",
  3000: "\u4E09\u5343",
  2000: "\u4E8C\u5343",
  1000: "\u5343",
  900: "\u4E5D\u767E",
  800: "\u516B\u767E",
  700: "\u4E03\u767E",
  600: "\u516D\u767E",
  500: "\u4E94\u767E",
  400: "\u56DB\u767E",
  300: "\u4E09\u767E",
  200: "\u4E8C\u767E",
  100: "\u767E",
  90: "\u4E5D\u5341",
  80: "\u516B\u5341",
  70: "\u4E03\u5341",
  60: "\u516D\u5341",
  50: "\u4E94\u5341",
  40: "\u56DB\u5341",
  30: "\u4E09\u5341",
  20: "\u4E8C\u5341",
  10: "\u5341",
  9: "\u4E5D",
  8: "\u516B",
  7: "\u4E03",
  6: "\u516D",
  5: "\u4E94",
  4: "\u56DB",
  3: "\u4E09",
  2: "\u4E8C",
  1: "\u4E00",
  0: "\u3007"
})
  .negative("\u30DE\u30A4\u30CA\u30B9" /* マイナス */)
  .range(-9999, 9999)
  .fallback(cjkDecimal.negative("\u30DE\u30A4\u30CA\u30B9" /* マイナス */));
export const japaneseInformalItem = _cjkItem(japaneseInformal);

export const japaneseFormal = CounterStyle.additive({
  /* 9000 九阡, 8000 八阡, 7000 七阡, 6000 六阡, 5000 伍阡, 4000 四阡,
     3000 参阡, 2000 弐阡, 1000 壱阡, 900 九百, 800 八百, 700 七百,
     600 六百, 500 伍百, 400 四百, 300 参百, 200 弐百, 100 壱百, 90 九拾,
     80 八拾, 70 七拾, 60 六拾, 50 伍拾, 40 四拾, 30 参拾, 20 弐拾, 10 壱拾,
     9 九, 8 八, 7 七, 6 六, 5 伍, 4 四, 3 参, 2 弐, 1 壱, 0 零 */
  9000: "\u4E5D\u9621",
  8000: "\u516B\u9621",
  7000: "\u4E03\u9621",
  6000: "\u516D\u9621",
  5000: "\u4F0D\u9621",
  4000: "\u56DB\u9621",
  3000: "\u53C2\u9621",
  2000: "\u5F10\u9621",
  1000: "\u58F1\u9621",
  900: "\u4E5D\u767E",
  800: "\u516B\u767E",
  700: "\u4E03\u767E",
  600: "\u516D\u767E",
  500: "\u4F0D\u767E",
  400: "\u56DB\u767E",
  300: "\u53C2\u767E",
  200: "\u5F10\u767E",
  100: "\u58F1\u767E",
  90: "\u4E5D\u62FE",
  80: "\u516B\u62FE",
  70: "\u4E03\u62FE",
  60: "\u516D\u62FE",
  50: "\u4F0D\u62FE",
  40: "\u56DB\u62FE",
  30: "\u53C2\u62FE",
  20: "\u5F10\u62FE",
  10: "\u58F1\u62FE",
  9: "\u4E5D",
  8: "\u516B",
  7: "\u4E03",
  6: "\u516D",
  5: "\u4F0D",
  4: "\u56DB",
  3: "\u53C2",
  2: "\u5F10",
  1: "\u58F1",
  0: "\u96F6"
})
  .negative("\u30DE\u30A4\u30CA\u30B9" /* マイナス */)
  .range(-9999, 9999)
  .fallback(cjkDecimal.negative("\u30DE\u30A4\u30CA\u30B9" /* マイナス */));
export const japaneseFormalItem = _cjkItem(japaneseFormal);

export const koreanHangulFormal = CounterStyle.additive({
  /* 9000 구천, 8000 팔천, 7000 칠천, 6000 육천, 5000 오천, 4000 사천,
     3000 삼천, 2000 이천, 1000 일천, 900 구백, 800 팔백, 700 칠백,
     600 육백, 500 오백, 400 사백, 300 삼백, 200 이백, 100 일백, 90 구십,
     80 팔십, 70 칠십, 60 육십, 50 오십, 40 사십, 30 삼십, 20 이십, 10 일십,
     9 구, 8 팔, 7 칠, 6 육, 5 오, 4 사, 3 삼, 2 이, 1 일, 0 영 */
  9000: "\u4E5D\u5343",
  8000: "\u516B\u5343",
  7000: "\u4E03\u5343",
  6000: "\u516D\u5343",
  5000: "\u4E94\u5343",
  4000: "\u56DB\u5343",
  3000: "\u4E09\u5343",
  2000: "\u4E8C\u5343",
  1000: "\u5343",
  900: "\u4E5D\u767E",
  800: "\u516B\u767E",
  700: "\u4E03\u767E",
  600: "\u516D\u767E",
  500: "\u4E94\u767E",
  400: "\u56DB\u767E",
  300: "\u4E09\u767E",
  200: "\u4E8C\u767E",
  100: "\u767E",
  90: "\u4E5D\u5341",
  80: "\u516B\u5341",
  70: "\u4E03\u5341",
  60: "\u516D\u5341",
  50: "\u4E94\u5341",
  40: "\u56DB\u5341",
  30: "\u4E09\u5341",
  20: "\u4E8C\u5341",
  10: "\u5341",
  9: "\u4E5D",
  8: "\u516B",
  7: "\u4E03",
  6: "\u516D",
  5: "\u4E94",
  4: "\u56DB",
  3: "\u4E09",
  2: "\u4E8C",
  1: "\u4E00",
  0: "\u96F6"
})
  .negative("\uB9C8\uC774\uB108\uC2A4 " /* 마이너스 (space) */)
  .range(-9999, 9999);
export const koreanHangulFormalItem = sty`${koreanHangulFormal},`;

export const koreanHanjaInformal = CounterStyle.additive({
  /* 9000 九千, 8000 八千, 7000 七千, 6000 六千, 5000 五千, 4000 四千,
     3000 三千, 2000 二千, 1000 千, 900 九百, 800 八百, 700 七百,
     600 六百, 500 五百, 400 四百, 300 三百, 200 二百, 100 百, 90 九十,
     80 八十, 70 七十, 60 六十, 50 五十, 40 四十, 30 三十, 20 二十, 10 十,
     9 九, 8 八, 7 七, 6 六, 5 五, 4 四, 3 三, 2 二, 1 一, 0 零 */
  9000: "\u4E5D\u5343",
  8000: "\u516B\u5343",
  7000: "\u4E03\u5343",
  6000: "\u516D\u5343",
  5000: "\u4E94\u5343",
  4000: "\u56DB\u5343",
  3000: "\u4E09\u5343",
  2000: "\u4E8C\u5343",
  1000: "\u5343",
  900: "\u4E5D\u767E",
  800: "\u516B\u767E",
  700: "\u4E03\u767E",
  600: "\u516D\u767E",
  500: "\u4E94\u767E",
  400: "\u56DB\u767E",
  300: "\u4E09\u767E",
  200: "\u4E8C\u767E",
  100: "\u767E",
  90: "\u4E5D\u5341",
  80: "\u516B\u5341",
  70: "\u4E03\u5341",
  60: "\u516D\u5341",
  50: "\u4E94\u5341",
  40: "\u56DB\u5341",
  30: "\u4E09\u5341",
  20: "\u4E8C\u5341",
  10: "\u5341",
  9: "\u4E5D",
  8: "\u516B",
  7: "\u4E03",
  6: "\u516D",
  5: "\u4E94",
  4: "\u56DB",
  3: "\u4E09",
  2: "\u4E8C",
  1: "\u4E00",
  0: "\u96F6"
})
  .negative("\uB9C8\uC774\uB108\uC2A4 " /* 마이너스 (space) */)
  .range(-9999, 9999);
export const koreanHanjaInformalItem = sty`${koreanHanjaInformal},`;

export const koreanHanjaFormal = CounterStyle.additive({
  /* 9000 九仟, 8000 八仟, 7000 七仟, 6000 六仟, 5000 五仟, 4000 四仟,
     3000 參仟, 2000 貳仟, 1000 壹仟, 900 九百, 800 八百, 700 七百,
     600 六百, 500 五百, 400 四百, 300 參百, 200 貳百, 100 壹百, 90 九拾,
     80 八拾, 70 七拾, 60 六拾, 50 五拾, 40 四拾, 30 參拾, 20 貳拾, 10 壹拾,
     9 九, 8 八, 7 七, 6 六, 5 五, 4 四, 3 參, 2 貳, 1 壹, 0 零 */
  9000: "\u4E5D\u4EDF",
  8000: "\u516B\u4EDF",
  7000: "\u4E03\u4EDF",
  6000: "\u516D\u4EDF",
  5000: "\u4E94\u4EDF",
  4000: "\u56DB\u4EDF",
  3000: "\u53C3\u4EDF",
  2000: "\u8CB3\u4EDF",
  1000: "\u58F9\u4EDF",
  900: "\u4E5D\u767E",
  800: "\u516B\u767E",
  700: "\u4E03\u767E",
  600: "\u516D\u767E",
  500: "\u4E94\u767E",
  400: "\u56DB\u767E",
  300: "\u53C3\u767E",
  200: "\u8CB3\u767E",
  100: "\u58F9\u767E",
  90: "\u4E5D\u62FE",
  80: "\u516B\u62FE",
  70: "\u4E03\u62FE",
  60: "\u516D\u62FE",
  50: "\u4E94\u62FE",
  40: "\u56DB\u62FE",
  30: "\u53C3\u62FE",
  20: "\u8CB3\u62FE",
  10: "\u58F9\u62FE",
  9: "\u4E5D",
  8: "\u516B",
  7: "\u4E03",
  6: "\u516D",
  5: "\u4E94",
  4: "\u56DB",
  3: "\u53C3",
  2: "\u8CB3",
  1: "\u58F9",
  0: "\u96F6"
})
  .negative("\uB9C8\uC774\uB108\uC2A4 " /* 마이너스 (space) */)
  .range(-9999, 9999);
export const koreanHanjaFormalItem = sty`${koreanHanjaFormal},`;

// TODO: Implement Chinese numberings, which need special logic, as in
//   https://drafts.csswg.org/css-counter-styles-3/#limited-chinese

// TODO: Include further predefined counter styles in
//   https://www.w3.org/TR/predefined-counter-styles/
