import type { AbstractIntlMessages } from "next-intl";

export function pickMessages(
  messages: AbstractIntlMessages,
  namespaces: readonly string[],
): AbstractIntlMessages {
  return Object.fromEntries(
    namespaces.map((namespace) => {
      const value = messages[namespace];
      if (value === undefined) {
        throw new Error(`Missing i18n namespace: ${namespace}`);
      }
      return [namespace, value];
    }),
  );
}
