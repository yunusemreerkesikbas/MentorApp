"use client";
import { useId, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslations } from "next-intl";
import type { MentorshipProgramTemplateDto } from "@mentor/types";
import { PANEL_LINK_BUTTON } from "@/components/mentorship/coach-ui";
import { PopoverMenu, PopoverMenuItem } from "@/components/popover-menu";
import { COACH_FAST } from "@/components/mentorship/coach-motion";
import type { AssignDraft } from "./planning-state";
import { PlanningSource } from "./planning-source";
import { SuggestLink } from "./template-bar";

/**
 * Where a week can start from, as three quiet links: earlier tasks (opened in place), a saved
 * template (a menu) or the assistant's draft. None of them sends anything; each only fills the
 * program, which the coach still reads before the send.
 *
 * Earlier tasks open and close by height. The spacing above them sits inside the part that
 * collapses, and a 4 px margin keeps focus rings clear of its clipping edge.
 */
export function PlanningSources({
  studentId,
  target,
  count,
  copied,
  onCopy,
  templates,
  canLoad,
  onLoad,
  onPendingChange,
}: {
  studentId: string;
  /** The week being planned: copied tasks land on the same weekdays of it. */
  target: string;
  count: number;
  copied: string[];
  onCopy: (drafts: AssignDraft[], keys: string[]) => void;
  templates: readonly MentorshipProgramTemplateDto[];
  /** False while busy or once the program is full. */
  canLoad: boolean;
  onLoad: (template: MentorshipProgramTemplateDto) => void;
  onPendingChange: (pending: boolean) => void;
}) {
  const t = useTranslations("mentorship");
  const previousId = useId();
  const [showPrevious, setShowPrevious] = useState(false);

  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap items-center gap-x-5">
        <button
          type="button"
          className={PANEL_LINK_BUTTON}
          aria-expanded={showPrevious}
          aria-controls={showPrevious ? previousId : undefined}
          onClick={() => setShowPrevious((value) => !value)}
        >
          {t("planning_source")}
        </button>
        <TemplateLoadMenu templates={templates} disabled={!canLoad} onLoad={onLoad} />
        <SuggestLink
          studentId={studentId}
          disabled={!canLoad}
          onLoad={onLoad}
          onPendingChange={onPendingChange}
        />
      </div>
      <AnimatePresence initial={false}>
        {showPrevious ? (
          <motion.div
            key="previous"
            id={previousId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={COACH_FAST}
            className="-mx-1 -mb-1 overflow-hidden px-1 pb-1"
          >
            <div className="pt-3">
              <PlanningSource studentId={studentId} target={target} count={count} copied={copied} onAdd={onCopy} />
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/** "Şablondan yükle" opens the saved programs as a menu; choosing one fills the program. */
function TemplateLoadMenu({
  templates,
  disabled,
  onLoad,
}: {
  templates: readonly MentorshipProgramTemplateDto[];
  disabled: boolean;
  onLoad: (template: MentorshipProgramTemplateDto) => void;
}) {
  const t = useTranslations("mentorship");
  return (
    <PopoverMenu
      align="left"
      // The link sits at the foot of the panel: the menu opens upward, clear of the send.
      side="top"
      menuClassName="w-64 py-1"
      trigger={({ open, setOpen, menuId }) => (
        <button
          type="button"
          className={PANEL_LINK_BUTTON}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={open ? menuId : undefined}
          disabled={disabled}
          onClick={() => setOpen(!open)}
        >
          {t("template_load")}
        </button>
      )}
    >
      {templates.length === 0 ? (
        <PopoverMenuItem disabled onClick={() => undefined}>
          {t("template_none")}
        </PopoverMenuItem>
      ) : (
        templates.map((template) => (
          <PopoverMenuItem key={template.id} onClick={() => onLoad(template)}>
            {t("template_option", { name: template.name, count: template.tasks.length })}
          </PopoverMenuItem>
        ))
      )}
    </PopoverMenu>
  );
}
