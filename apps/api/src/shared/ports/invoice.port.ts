/**
 * e-Arşiv invoice port (§7) — every B2C charge must produce an e-archive invoice.
 * The real API integrator arrives with Phase-0 paperwork; until then a logger stub
 * fulfils the contract so the call sites are final.
 */
export const INVOICE_PORT = Symbol("INVOICE_PORT");

export interface InvoicePort {
  issueForCharge(input: {
    userId: string;
    userEmail: string;
    amountMinor: number;
    currency: string;
    description: string;
    providerEventId: string;
  }): Promise<void>;
}
