import type { ExpenseRecord } from "./types";

export type Balance = {
  userId: string;
  userName: string;
  totalPaid: number;
  totalOwed: number;
  net: number;
};

export type Settlement = {
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  toUserName: string;
  amount: number;
};

const EPSILON = 0.01;

function recordBase(r: ExpenseRecord): number {
  return r.baseAmount ?? r.amount;
}

export function calculateBalances(records: ExpenseRecord[]): Balance[] {
  const byUser = new Map<string, Balance>();
  function ensure(userId: string, userName: string): Balance {
    let b = byUser.get(userId);
    if (!b) {
      b = { userId, userName, totalPaid: 0, totalOwed: 0, net: 0 };
      byUser.set(userId, b);
    } else if (userName) {
      b.userName = userName;
    }
    return b;
  }

  for (const r of records) {
    if (r.splitType === "no_split") continue;
    if (!r.participants || r.participants.length === 0) continue;

    const base = recordBase(r);
    const payerId = r.payerId || r.userId;
    const payerName = r.payerName || r.userName;
    if (payerId) ensure(payerId, payerName).totalPaid += base;

    const n = r.participants.length;
    for (const p of r.participants) {
      const part = ensure(p.userId, p.userName);
      const share =
        r.splitType === "equal_split" || !r.splitType
          ? base / n
          : p.share ?? base / n;
      part.totalOwed += share;
    }
  }

  for (const b of byUser.values()) {
    b.totalPaid = Number(b.totalPaid.toFixed(2));
    b.totalOwed = Number(b.totalOwed.toFixed(2));
    b.net = Number((b.totalPaid - b.totalOwed).toFixed(2));
  }
  return Array.from(byUser.values()).sort((a, b) => b.net - a.net);
}

export function calculateSettlements(balances: Balance[]): Settlement[] {
  const creditors = balances
    .filter((b) => b.net > EPSILON)
    .map((b) => ({ ...b }))
    .sort((a, b) => b.net - a.net);
  const debtors = balances
    .filter((b) => b.net < -EPSILON)
    .map((b) => ({ ...b, net: -b.net }))
    .sort((a, b) => b.net - a.net);

  const transfers: Settlement[] = [];
  let ci = 0;
  let di = 0;
  while (ci < creditors.length && di < debtors.length) {
    const c = creditors[ci];
    const d = debtors[di];
    const amount = Number(Math.min(c.net, d.net).toFixed(2));
    if (amount > EPSILON) {
      transfers.push({
        fromUserId: d.userId,
        fromUserName: d.userName,
        toUserId: c.userId,
        toUserName: c.userName,
        amount,
      });
    }
    c.net -= amount;
    d.net -= amount;
    if (c.net <= EPSILON) ci += 1;
    if (d.net <= EPSILON) di += 1;
  }
  return transfers;
}
