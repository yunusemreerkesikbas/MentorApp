import { useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchNotebookSlotQuote, purchaseNotebookSlot } from "../../lib/coaching-api.js";
import { newRequestId } from "../../lib/request-id.js";
import { useTranslations } from "../../providers/i18n-provider.js";
import { FormSheet } from "../panel/primitives.js";
import { AppText, Button, Skeleton } from "../ui/index.js";

export function NotebookCapacity({ count, close }: { count: number; close: () => void }) {
  const t = useTranslations("notebooks");
  const client = useQueryClient();
  const pending = useRef<{ expectedCost: number; expectedPurchasedSlots: number; idempotencyKey: string } | null>(null);
  const quote = useQuery({ queryKey: ["notebook-slots"], queryFn: fetchNotebookSlotQuote });
  const buy = useMutation({ mutationFn: purchaseNotebookSlot, onSuccess: async result => {
    client.setQueryData(["notebook-slots"], result);
    await Promise.all([client.invalidateQueries({ queryKey: ["notebook"] }), client.invalidateQueries({ queryKey: ["economy"] })]); close();
  } });
  const offer = quote.data;
  return <FormSheet title={t("capacity")} visible onClose={close} closeDisabled={buy.isPending} closeLabel={t("close")}>
    <AppText>{t("capacityBody", { n: count })}</AppText>
    {quote.isPending ? <Skeleton height={48} /> : !offer ? <Button label={t("retry")} onPress={() => void quote.refetch()} /> :
      offer.canPurchase ? <Button label={t("buy", { cost: offer.cost })} loading={buy.isPending} onPress={() => {
        pending.current ??= { expectedCost: offer.cost, expectedPurchasedSlots: offer.purchasedSlots, idempotencyKey: newRequestId() };
        buy.mutate(pending.current);
      }} /> : offer.status === "INSUFFICIENT_COIN" ? <AppText tone="secondary">{t("balance", { n: offer.coinConfirmed, cost: offer.cost })}</AppText> : null}
    {buy.isError && <AppText tone="danger">{buy.error.message || t("error")}</AppText>}
  </FormSheet>;
}
