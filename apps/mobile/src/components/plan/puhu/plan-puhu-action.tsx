import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { ActivityIndicator, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { MagicWand2Icon } from "@solar-icons/react-native/linear/magic-wand-2";
import { COIN_SHEET_ERRORS, type PlanAdaptationKnownWeek } from "@mentor/core";
import type {
  ApplyPlanAdaptationResultDto,
  CoachPlanAdaptationBriefDto,
  CoachPlanAdaptationDto,
  PlanPreviewAccessDto,
} from "@mentor/types";
import type { CoachPlanAdaptationInput } from "@mentor/validation";
import { fetchPlanAdaptationBrief } from "../../../lib/coach-api.js";
import { fetchCoinPlanBrief, fetchPlanPreviewAccess, fetchSavedPlanPreview } from "../../../lib/plan-previews-api.js";
import {
  createDismissQueue,
  keepsCoinQuote,
  newCoinQuote,
  planOpenStep,
  wizardCoinQuote,
  type PlanCoinQuote,
  type PlanCoinSheetState,
} from "../../../lib/plan-puhu.js";
import { apiErrorCode, errorText } from "../../../lib/plan-view.js";
import { newRequestId } from "../../../lib/request-id.js";
import { useTranslations } from "../../../providers/i18n-provider.js";
import { useThemeTokens } from "../../../providers/theme-provider.js";
import { useToast } from "../../../providers/toast-provider.js";
import { AppText } from "../../ui/text.js";
import { PlanPuhuCoinSheet } from "./plan-puhu-coin-sheet.js";
import { PlanPuhuPreview } from "./plan-puhu-preview.js";
import { PlanPuhuStage } from "./plan-puhu-stage.js";
import { PlanPuhuWizard } from "./plan-puhu-wizard.js";
import { usePuhuGeneration } from "./use-puhu-generation.js";

export interface PlanPuhuActionHandle {
  open(input: CoachPlanAdaptationInput): void;
}

type SheetUpdate = PlanCoinSheetState | null | ((current: PlanCoinSheetState | null) => PlanCoinSheetState | null);

/**
 * "Puhu'yla planla" on the Plan tab (the web's `PlanCoachAdaptationAction`): the entry row, then
 * the Coin sheet, the wizard and the waiting scene (one full-screen host), and Puhu's draft.
 */
export const PlanPuhuAction = forwardRef<
  PlanPuhuActionHandle,
  {
    knownWeek: PlanAdaptationKnownWeek;
    onApplied: (result: ApplyPlanAdaptationResultDto) => Promise<void>;
    onPlanChanged: () => Promise<void>;
  }
>(function PlanPuhuAction({ knownWeek, onApplied, onPlanChanged }, ref) {
  const t = useTranslations("plan");
  const tCoin = useTranslations("planCoin");
  const tCommon = useTranslations("common");
  const { palette, radii } = useThemeTokens();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [dismiss] = useState(() => createDismissQueue(Platform.OS));
  const busyRef = useRef(false);
  /** The Coin request the wizard sent last; the same answers go again under its id. */
  const lastQuote = useRef<PlanCoinQuote | null>(null);
  const [busy, setBusy] = useState(false);
  const wizardLock = useRef(false);
  const backRef = useRef<(() => void) | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardError, setWizardError] = useState<string | null>(null);
  const [brief, setBrief] = useState<CoachPlanAdaptationBriefDto | null>(null);
  const [offer, setOffer] = useState<PlanPreviewAccessDto | null>(null);
  /** The price confirmed in the sheet: the wizard's last button says it and the request carries it. */
  const [paid, setPaid] = useState<number | null>(null);
  const sheetRef = useRef<PlanCoinSheetState | null>(null);
  const [sheet, setSheetState] = useState<PlanCoinSheetState | null>(null);
  const [draft, setDraft] = useState<{ preview: CoachPlanAdaptationDto; input: CoachPlanAdaptationInput } | null>(null);
  const [draftOpen, setDraftOpen] = useState(false);

  const unknownError = tCommon("error_body");
  const fail = (error: unknown) => toast.show(errorText(error, unknownError));

  // The ref answers "is the sheet up?" inside async steps, where state is a render behind.
  const setSheet = (next: SheetUpdate) => {
    sheetRef.current = typeof next === "function" ? next(sheetRef.current) : next;
    setSheetState(sheetRef.current);
  };
  const showSheet = (patch: Partial<PlanCoinSheetState> = {}) =>
    setSheet({ armed: false, error: null, pending: null, resume: null, ...patch });
  /** Closes the sheet when it is up; on iOS the next modal waits until it has gone. */
  const afterSheet = (run: () => void) => {
    if (!sheetRef.current) return run();
    setSheet(null);
    dismiss.queue(run);
  };
  const refreshOffer = async () => {
    const view = await fetchPlanPreviewAccess();
    setOffer(view);
    return view;
  };

  const closeWizard = () => {
    wizardLock.current = false;
    setWizardOpen(false);
  };
  // The host modal covers the app's toast, so an error said while the wizard is up goes in it.
  const report = (message: string) => {
    if (wizardLock.current) setWizardError(message);
    else toast.show(message);
  };
  const openPreview = (preview: CoachPlanAdaptationDto, input: CoachPlanAdaptationInput) => {
    setDraft({ preview, input });
    setDraftOpen(true);
  };

  const { stage, generate, finish, cancel } = usePuhuGeneration({
    busyRef,
    unknownError,
    onBusy: setBusy,
    onStart: () => setWizardError(null),
    onPremium: () => {
      closeWizard();
      toast.show(tCoin("phone_closed"));
    },
    onReady: (preview, input) => {
      lastQuote.current = null;
      closeWizard();
      dismiss.queue(() => openPreview(preview, input));
    },
    onError: (error, quote) => {
      if (!keepsCoinQuote(error)) lastQuote.current = null;
      const message = errorText(error, unknownError);
      const code = apiErrorCode(error);
      if (!(quote && code && COIN_SHEET_ERRORS.has(code))) return report(message);
      // A changed price or a used allowance goes back to the sheet. Over the wizard its answers
      // stay underneath; without it the scene is closing, so the sheet waits for it on iOS.
      const refreshed = refreshOffer();
      const run = () =>
        void refreshed.then(
          () =>
            showSheet({
              armed: true,
              error: message,
              pending: quote.resume ? null : { input: quote.input, progress: quote.progress },
            }),
          () => report(message),
        );
      if (wizardLock.current) run();
      else dismiss.queue(run);
    },
    onSaved: () => {
      void queryClient.invalidateQueries({ queryKey: ["economy"] });
      void refreshOffer().catch(() => undefined);
    },
  });

  async function readSaved(requestId: string) {
    const saved = await fetchSavedPlanPreview(requestId);
    if (saved.preview) {
      const preview = saved.preview;
      closeWizard();
      afterSheet(() => openPreview(preview, { source: "PLAN" }));
    } else if (saved.state === "GENERATED") {
      showSheet({
        resume: { ...newCoinQuote({ input: { source: "PLAN" }, progress: null }, saved.cost, requestId), resume: true },
      });
    }
  }

  /** `cost` is the Coin price confirmed in the sheet; null on the included path. */
  function openWizard(cost: number | null) {
    wizardLock.current = true;
    // A new confirm in the sheet is a new purchase, even for answers sent before.
    lastQuote.current = null;
    setPaid(cost);
    // The wizard opens at once; Puhu's reading lands in it when ready, and a failed read leaves
    // today's defaults.
    setBrief(null);
    setWizardError(null);
    void (cost === null ? fetchPlanAdaptationBrief() : fetchCoinPlanBrief()).then(setBrief, () => undefined);
    setWizardOpen(true);
  }

  function confirmSheet() {
    const current = sheetRef.current;
    if (!current) return;
    const resume = current.resume;
    if (resume) return afterSheet(() => void generate(resume.input, null, resume));
    const cost = offer?.cost;
    if (cost == null) return;
    const pending = current.pending;
    if (!pending) return afterSheet(() => openWizard(cost));
    setPaid(cost);
    const quote = newCoinQuote(pending, cost, newRequestId());
    lastQuote.current = quote;
    afterSheet(() => void generate(pending.input, pending.progress, quote));
  }

  async function open(input: CoachPlanAdaptationInput) {
    if (busyRef.current || wizardLock.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      // Lightening reads no brief: the scene draws Puhu's usual notes.
      if (input.source !== "PLAN") {
        setBrief(null);
        await generate(input);
        return;
      }
      const view = await refreshOffer();
      const step = planOpenStep(view);
      if (step === "saved" && view.latestRequestId) await readSaved(view.latestRequestId);
      else if (step === "wizard") afterSheet(() => openWizard(null));
      else showSheet();
    } catch (error) {
      fail(error);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  useImperativeHandle(ref, () => ({ open: (input) => void open(input) }));

  const openSaved = () => {
    const id = offer?.latestRequestId;
    if (id) void readSaved(id).catch(fail);
  };

  return (
    <>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ busy }}
          disabled={busy}
          hitSlop={4}
          onPress={() => void open({ source: "PLAN" })}
          // The web's ghost button: an outlined play chip with a ledge that sinks on press.
          style={({ pressed }) => [
            styles.cta,
            {
              borderRadius: radii.button,
              borderColor: palette.playLine,
              backgroundColor: palette.surface,
              borderBottomWidth: pressed ? 2 : 4,
              marginTop: pressed ? 2 : 0,
            },
          ]}
        >
          {busy ? (
            <ActivityIndicator size="small" color={palette.playSelectedInk} />
          ) : (
            <MagicWand2Icon size={16} color={palette.playSelectedInk} />
          )}
          <AppText variant="caption" numberOfLines={1} style={[styles.ctaText, { color: palette.playSelectedInk }]}>
            {t("coach_adaptation_cta")}
          </AppText>
        </Pressable>
        {offer?.latestRequestId ? (
          <Pressable accessibilityRole="button" hitSlop={4} onPress={openSaved} style={styles.saved}>
            <AppText variant="caption" numberOfLines={1} style={[styles.savedText, { color: palette.secondary }]}>
              {tCoin("saved")}
            </AppText>
          </Pressable>
        ) : null}
      </View>

      <Modal
        visible={wizardOpen || stage !== null}
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => (stage ? cancel() : backRef.current?.())}
        onDismiss={dismiss.flush}
      >
        <View style={[styles.host, { backgroundColor: palette.bg }]}>
          {/* Edge-to-edge Android does not resize for the keyboard, so both platforms pad (as the app root does). */}
          {wizardOpen ? (
            <KeyboardAvoidingView behavior="padding" style={styles.host}>
              <PlanPuhuWizard
                knownWeek={knownWeek}
                brief={brief}
                coinCost={paid}
                submitError={wizardError}
                backRef={backRef}
                onClose={closeWizard}
                onComplete={(input, progress) => {
                  if (busyRef.current) return;
                  // The scene covers the wizard, so the note keyboard goes with it.
                  Keyboard.dismiss();
                  // The wizard stays up underneath, so a failed request finds the answers still there.
                  const quote =
                    paid === null ? undefined : wizardCoinQuote(lastQuote.current, { input, progress }, paid, newRequestId);
                  lastQuote.current = quote ?? null;
                  void generate(input, progress, quote);
                }}
              />
            </KeyboardAvoidingView>
          ) : null}
          {stage ? (
            <PlanPuhuStage
              input={stage.input}
              knownWeek={knownWeek}
              brief={brief}
              progress={stage.progress}
              arrived={stage.arrived}
              onDone={finish}
              onCancel={cancel}
            />
          ) : null}
        </View>
      </Modal>

      <PlanPuhuCoinSheet
        offer={sheet ? offer : null}
        sheet={sheet}
        busy={busy}
        onArm={() => setSheet((current) => current && { ...current, armed: true, error: null })}
        onCancel={() => setSheet((current) => (current && !current.resume ? { ...current, armed: false } : null))}
        onConfirm={confirmSheet}
        onRetry={() => void open({ source: "PLAN" })}
        onSaved={openSaved}
        onClose={() => setSheet(null)}
        onDismiss={dismiss.flush}
      />

      {draft ? (
        <PlanPuhuPreview
          preview={draft.preview}
          input={draft.input}
          visible={draftOpen}
          onApplied={onApplied}
          onPlanChanged={onPlanChanged}
          onRegenerate={(input) => {
            if (input.source === "PLAN" && offer?.mode === "COIN")
              void refreshOffer().then(() => showSheet({ pending: { input, progress: null } }), fail);
            else void generate(input);
          }}
          onClose={() => setDraftOpen(false)}
        />
      ) : null}
    </>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
  },
  cta: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    borderWidth: 2,
    borderCurve: "continuous",
  },
  ctaText: {
    fontWeight: "800",
  },
  saved: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  savedText: {
    fontWeight: "700",
    textDecorationLine: "underline",
  },
  host: {
    flex: 1,
  },
});
