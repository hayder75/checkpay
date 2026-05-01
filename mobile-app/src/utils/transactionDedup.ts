type TxLike = {
  id?: string;
  txnId?: string | null;
  amount?: number;
  sender?: string | null;
  bank?: string | null;
  receivedAt?: string;
  createdAt?: string;
  synced?: boolean;
  isValidated?: boolean;
};

export const normalizeTxnId = (txnId?: string | null): string => {
  return String(txnId || '').trim().toUpperCase();
};

const normalizeToken = (value?: string | null): string => {
  return String(value || '').trim().toLowerCase();
};

const timestampOf = (tx: TxLike): number => {
  const candidate = tx.receivedAt || tx.createdAt;
  const value = candidate ? new Date(candidate).getTime() : 0;
  return Number.isFinite(value) ? value : 0;
};

const buildFallbackKey = (tx: TxLike): string => {
  const sender = normalizeToken(tx.sender);
  const bank = normalizeToken(tx.bank);
  const amount = Number(tx.amount || 0).toFixed(2);
  const timeBucket = Math.floor(timestampOf(tx) / 60000);
  return `fallback|${sender}|${bank}|${amount}|${timeBucket}`;
};

const choosePreferred = <T extends TxLike>(left: T, right: T): T => {
  if (!!left.synced !== !!right.synced) {
    return left.synced ? left : right;
  }

  if (!!left.isValidated !== !!right.isValidated) {
    return left.isValidated ? left : right;
  }

  return timestampOf(left) >= timestampOf(right) ? left : right;
};

export const dedupeTransactionsByIdentity = <T extends TxLike>(transactions: T[]): T[] => {
  const byIdentity = new Map<string, T>();

  for (const transaction of transactions) {
    const normalizedTxnId = normalizeTxnId(transaction.txnId);
    const key = normalizedTxnId ? `txn|${normalizedTxnId}` : buildFallbackKey(transaction);

    const existing = byIdentity.get(key);
    if (!existing) {
      byIdentity.set(key, transaction);
      continue;
    }

    byIdentity.set(key, choosePreferred(existing, transaction));
  }

  return Array.from(byIdentity.values());
};
