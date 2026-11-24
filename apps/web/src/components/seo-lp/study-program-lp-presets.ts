export type StudyProgramVariant = "yks" | "tyt" | "lgs";

export interface SampleDayRow {
  day: string;
  blocks: string;
}

export interface DemoOption {
  id: string;
  label: string;
}

export interface DemoConfig {
  fields: DemoOption[];
  hours: DemoOption[];
  focuses: DemoOption[];
  days: readonly [string, string, string, string, string, string, string];
}

const TR_DAYS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"] as const;
const EN_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export function getSampleWeekRows(
  variant: StudyProgramVariant,
  locale: string,
): SampleDayRow[] {
  const en = locale === "en";
  if (variant === "yks") {
    return en
      ? [
          { day: "Mon", blocks: "Maths 50 min · Reading 25 min · Physics 40 min" },
          { day: "Tue", blocks: "Geometry 40 min · History 25 min · Chemistry 40 min" },
          { day: "Wed", blocks: "Maths 50 min · Biology 40 min · Review 25 min" },
          { day: "Thu", blocks: "AYT Maths 50 min · Geography 25 min · Test review 30 min" },
          { day: "Fri", blocks: "Physics 40 min · Reading 25 min · Mistake notebook 30 min" },
          { day: "Sat", blocks: "Branch practice test / net log · break blocks" },
          { day: "Sun", blocks: "Light review 40 min · weekly check-in 20 min" },
        ]
      : [
          { day: "Pzt", blocks: "Matematik 50 dk · Paragraf 25 dk · Fizik 40 dk" },
          { day: "Sal", blocks: "Geometri 40 dk · Tarih 25 dk · Kimya 40 dk" },
          { day: "Çar", blocks: "Matematik 50 dk · Biyoloji 40 dk · Tekrar 25 dk" },
          { day: "Per", blocks: "AYT Mat 50 dk · Coğrafya 25 dk · Deneme analizi 30 dk" },
          { day: "Cum", blocks: "Fizik 40 dk · Paragraf 25 dk · Yanlış defteri 30 dk" },
          { day: "Cmt", blocks: "Branş deneme / net kaydı · mola blokları" },
          { day: "Paz", blocks: "Hafif tekrar 40 dk · haftayı gözden geçir 20 dk" },
        ];
  }
  if (variant === "tyt") {
    return en
      ? [
          { day: "Mon", blocks: "Reading 40 min · Maths 50 min · Social 30 min" },
          { day: "Tue", blocks: "Maths 50 min · Science 40 min · Reading 30 min" },
          { day: "Wed", blocks: "Geometry 40 min · History/Geo 30 min · Review 30 min" },
          { day: "Thu", blocks: "Reading 40 min · Maths 50 min · Mistake notebook 30 min" },
          { day: "Fri", blocks: "Science 40 min · Social 30 min · Short test / net 40 min" },
          { day: "Sat", blocks: "Weak subject 50 min · light reading 25 min" },
          { day: "Sun", blocks: "General review 40 min · mark the week" },
        ]
      : [
          { day: "Pzt", blocks: "Paragraf 40 dk · Mat 50 dk · Sosyal 30 dk" },
          { day: "Sal", blocks: "Mat 50 dk · Fen 40 dk · Paragraf 30 dk" },
          { day: "Çar", blocks: "Geometri 40 dk · Tarih/Coğ 30 dk · Tekrar 30 dk" },
          { day: "Per", blocks: "Paragraf 40 dk · Mat 50 dk · Yanlış defteri 30 dk" },
          { day: "Cum", blocks: "Fen 40 dk · Sosyal 30 dk · Kısa deneme / net 40 dk" },
          { day: "Cmt", blocks: "Zayıf ders 50 dk · hafif paragraf 25 dk" },
          { day: "Paz", blocks: "Genel tekrar 40 dk · haftayı işaretle" },
        ];
  }
  return en
    ? [
        { day: "Mon", blocks: "Maths 40 min · Turkish (reading) 30 min · Review 15 min" },
        { day: "Tue", blocks: "Science 40 min · Maths 30 min · Social 20 min" },
        { day: "Wed", blocks: "Turkish 35 min · Science 30 min · Mistake notebook 25 min" },
        { day: "Thu", blocks: "Maths 40 min · History / Religion 25 min · Reading 20 min" },
        { day: "Fri", blocks: "Science 30 min · Turkish 30 min · Short test / net 30 min" },
        { day: "Sat", blocks: "Weak subject 40 min · light reading 20 min · plenty of rest" },
        { day: "Sun", blocks: "General review 30 min · mark the week 15 min" },
      ]
    : [
        { day: "Pzt", blocks: "Matematik 40 dk · Türkçe (paragraf) 30 dk · Tekrar 15 dk" },
        { day: "Sal", blocks: "Fen 40 dk · Matematik 30 dk · Sosyal 20 dk" },
        { day: "Çar", blocks: "Türkçe 35 dk · Fen 30 dk · Yanlış defteri 25 dk" },
        { day: "Per", blocks: "Matematik 40 dk · İnkılap / din 25 dk · Paragraf 20 dk" },
        { day: "Cum", blocks: "Fen 30 dk · Türkçe 30 dk · Kısa deneme / net 30 dk" },
        { day: "Cmt", blocks: "Zayıf ders 40 dk · hafif paragraf 20 dk · mola bol" },
        { day: "Paz", blocks: "Genel tekrar 30 dk · haftayı işaretle 15 dk" },
      ];
}

export function getDemoConfig(variant: StudyProgramVariant, locale: string): DemoConfig {
  const en = locale === "en";
  const days = en ? EN_DAYS : TR_DAYS;
  if (variant === "yks") {
    return {
      days,
      fields: en
        ? [
            { id: "say", label: "Science (SAY)" },
            { id: "ea", label: "Equal Weight (EA)" },
            { id: "soz", label: "Verbal (SÖZ)" },
            { id: "dil", label: "Language (DİL)" },
          ]
        : [
            { id: "say", label: "Sayısal" },
            { id: "ea", label: "Eşit Ağırlık" },
            { id: "soz", label: "Sözel" },
            { id: "dil", label: "Dil" },
          ],
      hours: en
        ? [
            { id: "2", label: "2 hrs/day" },
            { id: "4", label: "4 hrs/day" },
            { id: "6", label: "6 hrs/day" },
          ]
        : [
            { id: "2", label: "Günde 2 saat" },
            { id: "4", label: "Günde 4 saat" },
            { id: "6", label: "Günde 6 saat" },
          ],
      focuses: en
        ? [
            { id: "balanced", label: "Balanced TYT / AYT" },
            { id: "tyt", label: "TYT heavy" },
            { id: "ayt", label: "AYT heavy" },
          ]
        : [
            { id: "balanced", label: "Dengeli TYT / AYT" },
            { id: "tyt", label: "TYT ağırlıklı" },
            { id: "ayt", label: "AYT ağırlıklı" },
          ],
    };
  }
  if (variant === "tyt") {
    return {
      days,
      fields: en
        ? [
            { id: "core", label: "All TYT subjects" },
            { id: "math", label: "Maths + Geometry boost" },
            { id: "verbal", label: "Reading + Social boost" },
          ]
        : [
            { id: "core", label: "Tüm TYT dersleri" },
            { id: "math", label: "Matematik + Geometri" },
            { id: "verbal", label: "Paragraf + Sosyal" },
          ],
      hours: en
        ? [
            { id: "2", label: "2 hrs/day" },
            { id: "3", label: "3 hrs/day" },
            { id: "4", label: "4 hrs/day" },
          ]
        : [
            { id: "2", label: "Günde 2 saat" },
            { id: "3", label: "Günde 3 saat" },
            { id: "4", label: "Günde 4 saat" },
          ],
      focuses: en
        ? [
            { id: "balanced", label: "Balanced review" },
            { id: "speed", label: "Speed + Problems" },
            { id: "mock", label: "Practice test rhythm" },
          ]
        : [
            { id: "balanced", label: "Dengeli tekrar" },
            { id: "speed", label: "Paragraf + Problem" },
            { id: "mock", label: "Deneme ve analiz" },
          ],
    };
  }
  return {
    days,
    fields: en
      ? [
          { id: "school", label: "School week" },
          { id: "holiday", label: "Break / Holiday" },
        ]
      : [
          { id: "school", label: "Okul haftası" },
          { id: "holiday", label: "Ara tatil / Hafta sonu" },
        ],
    hours: en
      ? [
          { id: "1", label: "1 hr/day" },
          { id: "2", label: "2 hrs/day" },
          { id: "3", label: "3 hrs/day" },
        ]
      : [
          { id: "1", label: "Günde 1 saat" },
          { id: "2", label: "Günde 2 saat" },
          { id: "3", label: "3 saat (yoğun)" },
        ],
    focuses: en
      ? [
          { id: "balanced", label: "Turkish + Maths balanced" },
          { id: "math", label: "Maths heavy" },
          { id: "science", label: "Science heavy" },
        ]
      : [
          { id: "balanced", label: "Türkçe ve Mat dengeli" },
          { id: "math", label: "Matematik ağırlıklı" },
          { id: "science", label: "Fen ağırlıklı" },
        ],
  };
}

export function buildDemoWeekPreview(
  variant: StudyProgramVariant,
  fieldId: string,
  hourId: string,
  focusId: string,
  days: readonly string[],
): Array<{ day: string; tasks: [string, string] }> {
  const baseMin = hourId === "1" ? 25 : hourId === "2" ? 35 : hourId === "3" ? 45 : hourId === "4" ? 50 : 60;
  const subMin = Math.max(20, baseMin - 15);

  if (variant === "lgs") {
    const primary =
      focusId === "math"
        ? `Matematik ${baseMin} dk`
        : focusId === "science"
          ? `Fen Bilimleri ${baseMin} dk`
          : `Türkçe / Mat ${baseMin} dk`;
    const secondary = fieldId === "holiday" ? `Deneme + Defter ${subMin + 10} dk` : `Paragraf / Tekrar ${subMin} dk`;
    return days.map((day, idx) => ({
      day,
      tasks: [
        idx % 2 === 0 ? primary : `Fen / İnkılap ${baseMin - 5} dk`,
        idx === 5 ? `Deneme analizi ${subMin + 10} dk` : secondary,
      ],
    }));
  }

  if (variant === "tyt") {
    const first =
      fieldId === "math"
        ? `TYT Mat / Geo ${baseMin} dk`
        : fieldId === "verbal"
          ? `Paragraf + Sosyal ${baseMin} dk`
          : `TYT Matematik ${baseMin} dk`;
    const second =
      focusId === "speed"
        ? `Problem + Paragraf ${subMin} dk`
        : focusId === "mock"
          ? `Branş deneme / Defter ${subMin} dk`
          : `TYT Fen / Sosyal ${subMin} dk`;
    return days.map((day, idx) => ({
      day,
      tasks: [idx % 2 === 0 ? first : `Paragraf + Türkçe ${baseMin - 10} dk`, second],
    }));
  }

  const aytSubject =
    fieldId === "ea"
      ? "AYT Edebiyat / Mat"
      : fieldId === "soz"
        ? "AYT Edebiyat / Tarih"
        : fieldId === "dil"
          ? "YDT Kelime / Okuma"
          : "AYT Mat / Fen";
  const block1 =
    focusId === "tyt"
      ? `TYT Mat + Paragraf ${baseMin} dk`
      : focusId === "ayt"
        ? `${aytSubject} ${baseMin} dk`
        : `TYT / ${aytSubject} ${baseMin} dk`;
  const block2 =
    focusId === "ayt"
      ? `AYT Konu + Defter ${subMin} dk`
      : `TYT Tekrar + Analiz ${subMin} dk`;

  return days.map((day, idx) => ({
    day,
    tasks: [idx % 2 === 0 ? block1 : `${aytSubject} ${baseMin} dk`, block2],
  }));
}
