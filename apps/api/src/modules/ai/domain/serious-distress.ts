const SERIOUS_DISTRESS_PHRASES = [
  "hiçbir şeyin anlamı yok",
  "yaşamak istemiyorum",
  "ölmek istiyorum",
  "kendime zarar",
  "kendimi öldür",
  "nothing matters",
  "do not want to live",
  "don't want to live",
  "want to die",
  "hurt myself",
  "kill myself",
  "self harm",
  "no reason to live",
] as const;

export function hasSeriousDistressSignal(note: string | null | undefined): boolean {
  if (!note) return false;

  const normalized = note.normalize("NFKC").toLocaleLowerCase("tr-TR");
  return SERIOUS_DISTRESS_PHRASES.some((phrase) => normalized.includes(phrase));
}