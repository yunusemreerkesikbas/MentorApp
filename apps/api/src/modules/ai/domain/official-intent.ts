export type OfficialIntent =
  | "EXAM_DATE"
  | "APPLICATION"
  | "RESULT_PLACEMENT"
  | "PROCESS";

function normalize(value: string): string {
  return value
    .toLocaleLowerCase("tr")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u0131/g, "i")
    .replace(
      /[\u015f\u00e7\u011f\u00f6\u00fc]/g,
      (char) =>
        ({
          "\u015f": "s",
          "\u00e7": "c",
          "\u011f": "g",
          "\u00f6": "o",
          "\u00fc": "u",
        })[char] ?? char,
    );
}

/** Conservative official-info router; personal mock-exam analysis always stays in coaching. */
export function classifyOfficialIntent(message: string): OfficialIntent | null {
  const text = normalize(message);
  if (
    /(deneme|mock).*(sonuc|net|yorum|analiz)|(sonuc|net).*(deneme|mock)/.test(
      text,
    )
  ) {
    return null;
  }
  if (
    /(sinav tarihi|sinavi? ne zaman|sinava kac gun|exam date|kac gun kaldi)/.test(
      text,
    )
  ) {
    return "EXAM_DATE";
  }
  if (/(basvuru|application|kayit tarihi|son basvuru|deadline)/.test(text))
    return "APPLICATION";
  if (
    /(yerlestirme|tercihler?|tercih sonucu|sinav sonucu|sonuclar ne zaman|sonuc aciklama|results?|placement)/.test(
      text,
    )
  )
    return "RESULT_PLACEMENT";
  if (
    /(sinav sureci|resmi surec|hangi belge|basvuru sarti|sinav (?:ucreti|kurali)|procedure|exam process)/.test(
      text,
    )
  )
    return "PROCESS";
  return null;
}
