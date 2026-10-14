"use client";

import { useTranslations } from "next-intl";
import type { AnswerView, ThreadView } from "@mentor/types";
import { PANEL_CARD, PANEL_CARD_TITLE } from "@/components/panel/panel-styles";
import { AuthorAvatar } from "../../../_components/author-avatar";
import { AuthorLink } from "../../../_components/author-link";
import { HubWaitingQuestions } from "../../../_components/hub-waiting-questions";

type Person = { id: string; name: string; username: string | null; avatarUrl: string | null; role: string };

/** The question page's rail: who is in this question (asker, solver, answerers) and other waiting questions. */
export function QuestionRail({ question, answers }: { question: ThreadView; answers: AnswerView[] }) {
  const t = useTranslations("community");
  const people = new Map<string, Person>([
    [
      question.authorId,
      {
        id: question.authorId,
        name: question.authorName,
        username: question.authorUsername,
        avatarUrl: question.authorAvatarUrl,
        role: t("question_role_asker"),
      },
    ],
  ]);
  // The API lists the accepted answer first, so its author keeps the "solver" role.
  for (const answer of answers) {
    if (people.has(answer.authorId)) continue;
    people.set(answer.authorId, {
      id: answer.authorId,
      name: answer.authorName,
      username: answer.authorUsername,
      avatarUrl: answer.authorAvatarUrl,
      role: answer.isAccepted ? t("question_role_solver") : t("question_role_answerer"),
    });
  }

  return (
    <aside className="flex min-w-0 flex-col gap-5" aria-label={t("detail_context_title")}>
      <section className={`${PANEL_CARD} flex flex-col gap-2`} aria-labelledby="question-people-title">
        <h2 id="question-people-title" className={PANEL_CARD_TITLE}>
          {t("question_people_title")}
        </h2>
        <ul className="flex flex-col">
          {[...people.values()].slice(0, 8).map((person) => (
            <li key={person.id} className="flex min-h-11 items-center gap-3 py-1.5">
              <AuthorAvatar name={person.name} src={person.avatarUrl} size={32} />
              <span className="flex min-w-0 flex-col">
                <AuthorLink username={person.username} className="min-w-0 truncate hover:underline">
                  <span className="text-body-sm font-extrabold text-[var(--color-main)]">
                    {person.name || t("unknown_author")}
                  </span>
                </AuthorLink>
                <span className="text-caption font-semibold text-[var(--color-secondary)]">{person.role}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>
      <HubWaitingQuestions exclude={question.id} />
    </aside>
  );
}
