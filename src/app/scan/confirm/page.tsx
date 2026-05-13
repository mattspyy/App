"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "@/lib/session";
import { CONFIDENCE_THRESHOLD } from "@/lib/categories";
import { saveExpenseWithOfflineFallback } from "@/lib/pendingSync";
import {
  CURRENCIES,
  EXPENSE_CATEGORIES,
  PAYMENT_METHODS,
  type AIAnalysisResult,
  type ExpenseCategory,
  type ExpenseItem,
  type ExpenseRecord,
  type Party,
  type PartyMember,
  type ExpenseType,
  type Session,
  type SourceType,
  type SplitParticipant,
  type SplitType,
  type Trip,
} from "@/lib/types";

type FormItem = {
  id: string;
  name: string;
  totalPrice: string;
  quantity: string;
  unitPrice: string;
  category: ExpenseCategory | "";
};

type FormState = {
  merchant: string;
  amount: string;
  currency: string;
  date: string;
  country: string;
  category: ExpenseCategory;
  paymentMethod: string;
  payerId: string;
  payerName: string;
  notes: string;
  groupId: string;
  tripId: string;
  splitType: SplitType;
  participantIds: string[];
  splitTouched: boolean;
  customShares: Record<string, string>;
  expenseType: ExpenseType;
  spreadStartDate: string;
  spreadEndDate: string;
  sourceType: SourceType;
  imageUrl?: string;
  aiConfidence?: number;
  items: FormItem[];
};

function newItemId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function blankItem(): FormItem {
  return { id: newItemId(), name: "", totalPrice: "", quantity: "", unitPrice: "", category: "" };
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function buildInitialForm(
  session: Session,
  isManual: boolean,
  initialGroupId: string,
  initialTripId: string,
): FormState | null {
  const common = {
    payerId: session.userId,
    payerName: session.username,
    groupId: initialGroupId,
    tripId: initialTripId,
    splitType: "equal_split" as SplitType,
    participantIds: [session.userId],
    splitTouched: false,
    customShares: {} as Record<string, string>,
    expenseType: "one_time" as ExpenseType,
    spreadStartDate: "",
    spreadEndDate: "",
  };
  if (isManual) {
    return {
      ...common,
      merchant: "",
      amount: "",
      currency: session.baseCurrency || "HKD",
      date: todayIso(),
      country: "",
      category: "Other",
      paymentMethod: "Cash",
      notes: "",
      sourceType: "manual",
      items: [],
    };
  }
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem("fxt.pendingExpense");
  if (!raw) return null;
  try {
    const pending = JSON.parse(raw) as {
      analysis: AIAnalysisResult;
      imageUrl?: string;
      sourceType: SourceType;
    };
    const a = pending.analysis;
    return {
      ...common,
      merchant: a.merchant ?? "",
      amount: a.amount != null ? String(a.amount) : "",
      currency: a.currency || session.baseCurrency || "HKD",
      date: a.date || todayIso(),
      country: a.country ?? "",
      category: (a.category as ExpenseCategory) || "Other",
      paymentMethod: a.paymentMethod || "Cash",
      notes: a.notes ?? "",
      sourceType: pending.sourceType,
      imageUrl: pending.imageUrl,
      aiConfidence: a.confidence,
      items: (a.items || []).map((it) => ({
        id: newItemId(),
        name: it.name,
        totalPrice: String(it.totalPrice),
        quantity: it.quantity != null ? String(it.quantity) : "",
        unitPrice: it.unitPrice != null ? String(it.unitPrice) : "",
        category: it.category || "",
      })),
    };
  } catch {
    return null;
  }
}

function ConfirmInner() {
  const router = useRouter();
  const params = useSearchParams();
  const isManual = params.get("manual") === "1";
  const partyId = params.get("partyId") || "";
  const tripId = params.get("tripId") || "";
  const session = useSession();

  useEffect(() => {
    if (!session) router.replace("/login");
  }, [session, router]);

  if (!session) return <div className="text-sm text-zinc-500">Loading…</div>;
  return (
    <ConfirmFormBody
      key={`${isManual ? "manual" : "ai"}|party=${partyId}|trip=${tripId}`}
      session={session}
      isManual={isManual}
      initialGroupId={partyId}
      initialTripId={tripId}
    />
  );
}

function ConfirmFormBody({
  session,
  isManual,
  initialGroupId,
  initialTripId,
}: {
  session: Session;
  isManual: boolean;
  initialGroupId: string;
  initialTripId: string;
}) {
  const router = useRouter();
  const [form, setForm] = useState<FormState | null>(() => buildInitialForm(session, isManual, initialGroupId, initialTripId));
  const [parties, setParties] = useState<Party[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [customMethods, setCustomMethods] = useState<string[]>([]);
  const [showAddMethod, setShowAddMethod] = useState(false);
  const [newMethodName, setNewMethodName] = useState("");
  const [addingMethod, setAddingMethod] = useState(false);
  const [categoryRules, setCategoryRules] = useState<Array<{ id: string; merchantKeyword: string; category: ExpenseCategory }>>([]);
  const [categoryTouched, setCategoryTouched] = useState(false);
  const [savingRule, setSavingRule] = useState(false);
  const [ruleSaved, setRuleSaved] = useState(false);
  const [knownUsers, setKnownUsers] = useState<Array<{ userId: string; userName: string }>>([
    { userId: session.userId, userName: session.username },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicates, setDuplicates] = useState<Array<{ id: string; merchant?: string; amount: number; currency: string; date: string }>>([]);
  const [savedRedirect, setSavedRedirect] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/parties?userId=${encodeURIComponent(session.userId)}`)
      .then((r) => (r.ok ? r.json() : { parties: [] }))
      .then((b) => setParties(b.parties || []))
      .catch(() => setParties([]));
    fetch(`/api/trips?userId=${encodeURIComponent(session.userId)}`)
      .then((r) => (r.ok ? r.json() : { trips: [] }))
      .then((b) => setTrips(b.trips || []))
      .catch(() => setTrips([]));
      fetch(`/api/payment-methods?userId=${encodeURIComponent(session.userId)}`)
      .then((r) => (r.ok ? r.json() : { methods: [] }))
      .then((b) => setCustomMethods(b.methods || []))
      .catch(() => setCustomMethods([]));
    fetch(`/api/category-rules?userId=${encodeURIComponent(session.userId)}`)
      .then((r) => (r.ok ? r.json() : { rules: [] }))
      .then((b) => setCategoryRules(b.rules || []))
      .catch(() => setCategoryRules([]));
  }, [session.userId]);

  async function handleAddMethod() {
    const name = newMethodName.trim();
    if (!name) return;
    setAddingMethod(true);
    try {
      const res = await fetch("/api/payment-methods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: session.userId, name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add method");
      const saved: string = data.method || name;
      setCustomMethods((prev) => Array.from(new Set([...prev, saved])).sort());
      setForm((f) => (f ? { ...f, paymentMethod: saved } : f));
      setNewMethodName("");
      setShowAddMethod(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setAddingMethod(false);
    }
  }

  // Refresh known users from members of the chosen group.
  useEffect(() => {
    const groupId = form?.groupId;
    if (!groupId) return;
    let cancelled = false;
    fetch(`/api/parties/${encodeURIComponent(groupId)}/members?userId=${encodeURIComponent(session.userId)}`)
      .then((r) => (r.ok ? r.json() : { members: [] }))
      .then((b) => {
        if (cancelled) return;
        const members = (b.members as PartyMember[]) || [];
        const map = new Map<string, string>();
        map.set(session.userId, session.username);
        for (const m of members) map.set(m.userId, m.username);
        setKnownUsers(Array.from(map, ([userId, userName]) => ({ userId, userName })));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [form?.groupId, session.userId, session.username]);

  // If only a trip was supplied, resolve its parent group automatically.
  useEffect(() => {
    if (!form) return;
    if (form.groupId || !form.tripId) return;
    const t = trips.find((x) => x.tripId === form.tripId);
    if (t && t.familyId) {
      setForm((f) => (f ? { ...f, groupId: t.familyId } : f));
    }
  }, [form, trips]);

  // Auto-apply category rule when merchant matches a saved rule (until user manually overrides).
  useEffect(() => {
    if (!form || categoryTouched) return;
    const merchant = form.merchant.trim().toLowerCase();
    if (!merchant) return;
    const match = categoryRules.find((r) => {
      const kw = r.merchantKeyword.trim().toLowerCase();
      if (!kw) return false;
      return merchant.includes(kw) || kw.includes(merchant);
    });
    if (match && match.category && match.category !== form.category) {
      setForm((f) => (f ? { ...f, category: match.category } : f));
    }
  }, [form, categoryRules, categoryTouched]);

  async function handleSaveRule() {
    if (!form || !form.merchant.trim()) return;
    setSavingRule(true);
    try {
      const res = await fetch("/api/category-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: session.userId,
          merchantKeyword: form.merchant.trim(),
          category: form.category,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save rule");
      const rule = data.rule as { id: string; merchantKeyword: string; category: ExpenseCategory };
      setCategoryRules((prev) => {
        const next = prev.filter((r) => r.id !== rule.id);
        next.push({ id: rule.id, merchantKeyword: rule.merchantKeyword, category: rule.category });
        return next;
      });
      setRuleSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSavingRule(false);
    }
  }

    // Default split based on group size: personal (1 member) → no_split, else equal_split.
  useEffect(() => {
    if (!form || form.splitTouched) return;
    const isPersonal = knownUsers.length <= 1;
    const target: SplitType = isPersonal ? "no_split" : "equal_split";
    if (form.splitType !== target) {
      setForm((f) => (f ? { ...f, splitType: target } : f));
    }
  }, [knownUsers.length, form]);

  useEffect(() => {
    if (form === null && !isManual) router.replace("/scan");
  }, [form, isManual, router]);

  function update<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((f) => (f ? { ...f, [k]: v } : f));
  }

  function setGroup(groupId: string) {
    setForm((f) => {
      if (!f) return f;
      // Clear trip if the chosen group doesn't own it.
      const stillValidTrip = f.tripId && trips.some((t) => t.tripId === f.tripId && t.familyId === groupId);
      return { ...f, groupId, tripId: stillValidTrip ? f.tripId : "" };
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    if (!form.groupId) {
      setError("Pick a group for this expense");
      return;
    }
    const amt = Number(form.amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setError("Amount must be a positive number");
      return;
    }
    if (form.expenseType === "spread_across_days") {
      if (!form.spreadStartDate || !form.spreadEndDate) {
        setError("Pick a start and end date for the spread");
        return;
      }
      if (form.spreadEndDate < form.spreadStartDate) {
        setError("Spread end date must be on or after the start date");
        return;
      }
    }
    if (form.splitType === "equal_split" && form.participantIds.length === 0) {
      setError("Pick at least one participant for an equal split");
      return;
    }
    if (form.splitType === "custom_amount") {
      const sum = form.participantIds.reduce((s2, id) => s2 + (Number(form.customShares[id]) || 0), 0);
      if (form.participantIds.length === 0) {
        setError("Pick at least one participant for a custom split");
        return;
      }
      if (Math.abs(sum - amt) > 0.5) {
        setError(`Custom shares (${sum.toFixed(2)}) must add up to the total amount (${amt.toFixed(2)})`);
        return;
      }
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload: Partial<ExpenseRecord> = {
        familyId: form.groupId,
        tripId: form.tripId || undefined,
        status: "confirmed",
        userId: session.userId,
        userName: session.username,
        payerId: form.payerId || session.userId,
        payerName: form.payerName || session.username,
        merchant: form.merchant || undefined,
        amount: amt,
        currency: form.currency,
        baseCurrency: session.baseCurrency || form.currency,
        category: form.category,
        country: form.country || undefined,
        date: form.date,
        paymentMethod: form.paymentMethod || undefined,
        sourceType: form.sourceType,
        imageUrl: form.imageUrl,
        aiConfidence: form.aiConfidence,
        notes: form.notes || undefined,
        splitType: form.splitType,
        participants:
          form.splitType === "no_split" || form.participantIds.length === 0
            ? undefined
            : buildParticipants(form, amt, knownUsers),
        items: buildItems(form),
        expenseType: form.expenseType,
        spreadStartDate: form.expenseType === "spread_across_days" ? form.spreadStartDate || undefined : undefined,
        spreadEndDate: form.expenseType === "spread_across_days" ? form.spreadEndDate || undefined : undefined,
      };
      const result = await saveExpenseWithOfflineFallback(payload);
      sessionStorage.removeItem("fxt.pendingExpense");
      const redirectTo = form.tripId
        ? `/trips/${encodeURIComponent(form.tripId)}`
        : `/parties/${encodeURIComponent(form.groupId)}`;
      if (!result.ok) {
        setError(`Saved offline — will sync when you're back online. (${result.reason})`);
        setTimeout(() => router.push(redirectTo), 1200);
        return;
      }
      const data = result.data as { duplicates?: Array<{ id: string; merchant?: string; amount: number; currency: string; date: string }> };
      const dupes = Array.isArray(data.duplicates) ? data.duplicates : [];
      if (dupes.length > 0) {
        setDuplicates(dupes);
        setSavedRedirect(redirectTo);
        return;
      }
      router.push(redirectTo);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  }

  if (!form) return <div className="text-sm text-zinc-500">Loading…</div>;

  const lowConfidence = form.aiConfidence != null && form.aiConfidence < CONFIDENCE_THRESHOLD;
  const missingFields = form.aiConfidence != null
    ? [
        !form.merchant.trim() && "merchant",
        !form.amount.trim() && "amount",
        !form.date.trim() && "date",
      ].filter((x): x is string => Boolean(x))
    : [];
  const tripsForGroup = form.groupId ? trips.filter((t) => t.familyId === form.groupId) : [];

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-xl">
      <h1 className="text-2xl font-semibold">{isManual ? "Manual add" : "Confirm expense"}</h1>

      {form.aiConfidence != null && (
        <div className={`text-xs px-3 py-2 rounded ${lowConfidence ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-800"}`}>
          AI confidence: {(form.aiConfidence * 100).toFixed(0)}%
          {lowConfidence && " — low confidence, please review carefully"}
        </div>
      )}
      {missingFields.length > 0 && (
        <div className="text-xs px-3 py-2 rounded bg-amber-50 text-amber-800 border border-amber-200">
          AI couldn&apos;t fill: {missingFields.join(", ")}. Please complete before saving.
        </div>
      )}

      {duplicates.length > 0 && savedRedirect && (
        <div className="rounded-md border border-amber-300 bg-amber-50 text-amber-900 p-3 text-sm space-y-2">
          <div className="font-medium">Saved, but a possible duplicate was detected.</div>
          <ul className="list-disc pl-5 space-y-0.5">
            {duplicates.slice(0, 3).map((d) => (
              <li key={d.id}>
                {d.merchant || "—"} · {d.amount.toFixed(2)} {d.currency} · {d.date}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => router.push(savedRedirect)}
            className="px-3 py-1.5 rounded-md border border-amber-400 bg-white text-amber-900 text-xs"
          >
            Got it, continue
          </button>
        </div>
      )}
      {form.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={form.imageUrl} alt="receipt" className="max-h-48 rounded border border-zinc-200" />
      )}

      {error && <div className="bg-red-50 text-red-700 text-sm p-3 rounded">{error}</div>}

      <Field label="Group">
        <select className="input" value={form.groupId} onChange={(e) => setGroup(e.target.value)} required>
          <option value="">— Pick a group —</option>
          {parties.map((p) => <option key={p.partyId} value={p.partyId}>{p.partyName}</option>)}
        </select>
      </Field>

      <Field label="Trip (optional)">
        <select
          className="input"
          value={form.tripId}
          onChange={(e) => update("tripId", e.target.value)}
          disabled={!form.groupId}
        >
          <option value="">— No trip —</option>
          {tripsForGroup.map((t) => <option key={t.tripId} value={t.tripId}>{t.tripName}</option>)}
        </select>
      </Field>

      <Field label="Merchant"><input className="input" value={form.merchant} onChange={(e) => update("merchant", e.target.value)} /></Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount"><input className="input" inputMode="decimal" value={form.amount} onChange={(e) => update("amount", e.target.value)} required /></Field>
        <Field label="Currency">
          <select className="input" value={form.currency} onChange={(e) => update("currency", e.target.value)}>
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Date"><input className="input" type="date" value={form.date} onChange={(e) => update("date", e.target.value)} /></Field>
        <Field label="Country"><input className="input" value={form.country} onChange={(e) => update("country", e.target.value)} placeholder="e.g. UK" /></Field>
      </div>

      <div className="space-y-2">
        <div className="text-xs text-zinc-600">Expense type</div>
        <select
          className="input"
          value={form.expenseType}
          onChange={(e) => update("expenseType", e.target.value as ExpenseType)}
        >
          <option value="one_time">One-time (single day)</option>
          <option value="spread_across_days">Spread across days (hotel, rental, pass)</option>
        </select>
        {form.expenseType === "spread_across_days" && (
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="text-[11px] text-zinc-500">Start</span>
              <input
                className="input"
                type="date"
                value={form.spreadStartDate}
                onChange={(e) => update("spreadStartDate", e.target.value)}
              />
            </label>
            <label className="block">
              <span className="text-[11px] text-zinc-500">End</span>
              <input
                className="input"
                type="date"
                value={form.spreadEndDate}
                onChange={(e) => update("spreadEndDate", e.target.value)}
              />
            </label>
            {(() => {
              const total = Number(form.amount);
              if (!Number.isFinite(total) || total <= 0) return null;
              if (!form.spreadStartDate || !form.spreadEndDate) return null;
              const start = new Date(form.spreadStartDate);
              const end = new Date(form.spreadEndDate);
              if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return null;
              const days = Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1;
              const daily = total / days;
              return (
                <div className="col-span-2 text-xs text-zinc-500">
                  {daily.toFixed(2)} {form.currency} / day × {days} day{days === 1 ? "" : "s"}
                </div>
              );
            })()}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Category">
          <select
            className="input"
            value={form.category}
            onChange={(e) => {
              setCategoryTouched(true);
              setRuleSaved(false);
              update("category", e.target.value as ExpenseCategory);
            }}
          >
            {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Payment method">
          <div className="space-y-2">
            <select
              className="input"
              value={form.paymentMethod}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "__add__") {
                  setShowAddMethod(true);
                  return;
                }
                update("paymentMethod", v);
              }}
            >
              {PAYMENT_METHODS.map((p) => <option key={p} value={p}>{p}</option>)}
              {customMethods.length > 0 && (
                <optgroup label="Your custom methods">
                  {customMethods.map((m) => <option key={m} value={m}>{m}</option>)}
                </optgroup>
              )}
              {!PAYMENT_METHODS.includes(form.paymentMethod as typeof PAYMENT_METHODS[number])
                && !customMethods.includes(form.paymentMethod)
                && form.paymentMethod && (
                  <option value={form.paymentMethod}>{form.paymentMethod}</option>
                )}
              <option value="__add__">+ Add custom method…</option>
            </select>
            {showAddMethod && (
              <div className="flex gap-2">
                <input
                  className="input"
                  placeholder="e.g. Suica, Wise, HSBC Visa"
                  value={newMethodName}
                  maxLength={40}
                  onChange={(e) => setNewMethodName(e.target.value)}
                />
                <button
                  type="button"
                  onClick={handleAddMethod}
                  disabled={addingMethod || !newMethodName.trim()}
                  className="px-3 py-2 rounded-md border border-zinc-300 bg-white text-sm disabled:opacity-50"
                >
                  {addingMethod ? "Adding…" : "Add"}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowAddMethod(false); setNewMethodName(""); }}
                  className="px-3 py-2 rounded-md border border-zinc-300 bg-white text-sm"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </Field>
      </div>

      {categoryTouched && form.merchant.trim() && (() => {
        const merchant = form.merchant.trim().toLowerCase();
        const existing = categoryRules.find((r) => {
          const kw = r.merchantKeyword.trim().toLowerCase();
          return kw && (merchant.includes(kw) || kw.includes(merchant)) && r.category === form.category;
        });
        if (ruleSaved || existing) {
          return (
            <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded p-2">
              ✓ Rule saved · {form.merchant.trim()} → {form.category}
            </div>
          );
        }
        return (
          <div className="text-xs text-zinc-600 bg-zinc-50 border border-zinc-200 rounded p-2 flex items-center justify-between gap-2">
            <span>Save &ldquo;{form.merchant.trim()}&rdquo; → {form.category} as a rule?</span>
            <button
              type="button"
              onClick={handleSaveRule}
              disabled={savingRule}
              className="px-2 py-1 rounded border border-zinc-300 bg-white text-zinc-800 disabled:opacity-50"
            >
              {savingRule ? "Saving…" : "Save rule"}
            </button>
          </div>
        );
      })()}

      <div className="space-y-2">
        <div className="text-xs text-zinc-600">Split</div>
        <select
          className="input"
          value={form.splitType}
          onChange={(e) => {
            const next = e.target.value as SplitType;
            setForm((f) => (f ? { ...f, splitType: next, splitTouched: true } : f));
          }}
        >
          <option value="no_split">No split (personal)</option>
          <option value="equal_split">Equal split</option>
          <option value="custom_amount">Custom amount</option>
        </select>

        {form.splitType === "equal_split" && (
          <div className="border border-zinc-200 rounded-md p-2 space-y-1">
            {knownUsers.map((u) => {
              const selected = form.participantIds.includes(u.userId);
              const amt = Number(form.amount);
              const n = Math.max(1, form.participantIds.length);
              const share = selected && Number.isFinite(amt) && amt > 0 ? amt / n : 0;
              return (
                <label key={u.userId} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={(e) => {
                      const next = e.target.checked
                        ? Array.from(new Set([...form.participantIds, u.userId]))
                        : form.participantIds.filter((id) => id !== u.userId);
                      update("participantIds", next);
                    }}
                  />
                  <span>{u.userName || u.userId}</span>
                  {selected && share > 0 && (
                    <span className="ml-auto text-xs text-zinc-500">{share.toFixed(2)} {form.currency}</span>
                  )}
                </label>
              );
            })}
          </div>
        )}

        {form.splitType === "custom_amount" && (
          <div className="border border-zinc-200 rounded-md p-2 space-y-1">
            {knownUsers.map((u) => {
              const selected = form.participantIds.includes(u.userId);
              return (
                <div key={u.userId} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={(e) => {
                      setForm((f) => {
                        if (!f) return f;
                        const nextIds = e.target.checked
                          ? Array.from(new Set([...f.participantIds, u.userId]))
                          : f.participantIds.filter((id) => id !== u.userId);
                        const nextShares = { ...f.customShares };
                        if (!e.target.checked) delete nextShares[u.userId];
                        return { ...f, participantIds: nextIds, customShares: nextShares };
                      });
                    }}
                  />
                  <span className="flex-1 truncate">{u.userName || u.userId}</span>
                  <input
                    className="input max-w-[6.5rem]"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={form.customShares[u.userId] ?? ""}
                    disabled={!selected}
                    onChange={(e) => {
                      const v = e.target.value;
                      setForm((f) => (f ? { ...f, customShares: { ...f.customShares, [u.userId]: v } } : f));
                    }}
                  />
                  <span className="text-xs text-zinc-500">{form.currency}</span>
                </div>
              );
            })}
            <CustomSharesSummary form={form} />
          </div>
        )}
      </div>

      <Field label="Payer name"><input className="input" value={form.payerName} onChange={(e) => update("payerName", e.target.value)} /></Field>
      <Field label="Notes"><textarea className="input" rows={2} value={form.notes} onChange={(e) => update("notes", e.target.value)} /></Field>

      <ItemsSection form={form} setForm={setForm} />

      <div className="md:static sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] md:bottom-auto -mx-4 sm:-mx-6 md:mx-0 px-4 sm:px-6 md:px-0 py-3 md:py-0 bg-white md:bg-transparent border-t md:border-0 border-zinc-200 z-10 flex gap-2">
        <button type="submit" disabled={submitting} className="flex-1 md:flex-none bg-zinc-900 text-white px-4 py-3 md:py-2 rounded-md disabled:opacity-50 font-medium">
          {submitting ? "Saving…" : "Save expense"}
        </button>
        <button type="button" onClick={() => router.back()} className="px-4 py-3 md:py-2 rounded-md border border-zinc-300 bg-white">Cancel</button>
      </div>
    </form>
  );
}

function ItemsSection({
  form,
  setForm,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState | null>>;
}) {
  function updateItem(id: string, patch: Partial<FormItem>) {
    setForm((f) => f ? { ...f, items: f.items.map((it) => it.id === id ? { ...it, ...patch } : it) } : f);
  }
  function removeItem(id: string) {
    setForm((f) => f ? { ...f, items: f.items.filter((it) => it.id !== id) } : f);
  }
  function addItem() {
    setForm((f) => f ? { ...f, items: [...f.items, blankItem()] } : f);
  }
  const itemTotal = form.items.reduce((s, it) => {
    const n = Number(it.totalPrice);
    return s + (Number.isFinite(n) ? n : 0);
  }, 0);
  const expenseAmount = Number(form.amount);
  const sumMismatch = form.items.length > 0
    && Number.isFinite(expenseAmount)
    && expenseAmount > 0
    && Math.abs(itemTotal - expenseAmount) > 0.5;

  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-medium text-zinc-900">Receipt items ({form.items.length})</h2>
        {form.items.length > 0 && (
          <div className="text-xs text-zinc-500">
            Items sum: {itemTotal.toFixed(2)} {form.currency}
            {sumMismatch && <span className="ml-2 text-amber-700">≠ {expenseAmount.toFixed(2)}</span>}
          </div>
        )}
      </div>

      {form.items.length === 0 ? (
        <div className="text-sm text-zinc-500 border border-dashed border-zinc-300 rounded-md p-3 bg-white">
          We couldn&apos;t detect individual items, but you can still save the total amount.
        </div>
      ) : (
        <ul className="space-y-2">
          {form.items.map((it) => (
            <li key={it.id} className="bg-white border border-zinc-200 rounded-md p-3 space-y-2">
              <div className="flex items-start gap-2">
                <input
                  className="input flex-1"
                  placeholder="Item name"
                  value={it.name}
                  onChange={(e) => updateItem(it.id, { name: e.target.value })}
                />
                <button
                  type="button"
                  onClick={() => removeItem(it.id)}
                  aria-label="Remove item"
                  className="text-zinc-400 hover:text-red-600 px-2 py-2 text-sm"
                >
                  ✕
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <label className="block">
                  <span className="text-[11px] text-zinc-500">Qty</span>
                  <input className="input" inputMode="decimal" value={it.quantity} onChange={(e) => updateItem(it.id, { quantity: e.target.value })} />
                </label>
                <label className="block">
                  <span className="text-[11px] text-zinc-500">Unit</span>
                  <input className="input" inputMode="decimal" value={it.unitPrice} onChange={(e) => updateItem(it.id, { unitPrice: e.target.value })} />
                </label>
                <label className="block">
                  <span className="text-[11px] text-zinc-500">Total</span>
                  <input className="input" inputMode="decimal" value={it.totalPrice} onChange={(e) => updateItem(it.id, { totalPrice: e.target.value })} required />
                </label>
              </div>
              <label className="block">
                <span className="text-[11px] text-zinc-500">Item category</span>
                <select
                  className="input"
                  value={it.category}
                  onChange={(e) => updateItem(it.id, { category: e.target.value as ExpenseCategory | "" })}
                >
                  <option value="">— Same as receipt —</option>
                  {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={addItem}
        className="w-full px-3 py-2 rounded-md border border-dashed border-zinc-300 bg-white text-sm text-zinc-600 hover:border-zinc-400 hover:text-zinc-900 transition"
      >
        + Add item
      </button>
    </section>
  );
}

function buildItems(form: FormState): ExpenseItem[] | undefined {
  const items = form.items
    .map((it) => {
      const total = Number(it.totalPrice);
      if (!it.name.trim() || !Number.isFinite(total)) return null;
      const qty = it.quantity ? Number(it.quantity) : undefined;
      const unit = it.unitPrice ? Number(it.unitPrice) : undefined;
      return {
        id: it.id,
        name: it.name.trim(),
        totalPrice: total,
        quantity: Number.isFinite(qty) ? qty : undefined,
        unitPrice: Number.isFinite(unit) ? unit : undefined,
        category: it.category || undefined,
      } as ExpenseItem;
    })
    .filter((it): it is ExpenseItem => it !== null);
  return items.length > 0 ? items : undefined;
}

function buildParticipants(
  form: FormState,
  amount: number,
  knownUsers: Array<{ userId: string; userName: string }>,
): SplitParticipant[] {
  const nameOf = new Map(knownUsers.map((u) => [u.userId, u.userName] as const));
  if (form.splitType === "custom_amount") {
    return form.participantIds.map((userId) => ({
      userId,
      userName: nameOf.get(userId) || userId,
      share: Number(Number(form.customShares[userId] || "0").toFixed(2)),
    }));
  }
  const n = form.participantIds.length;
  const share = n > 0 ? Number((amount / n).toFixed(2)) : 0;
  return form.participantIds.map((userId) => ({
    userId,
    userName: nameOf.get(userId) || userId,
    share,
  }));
}

function CustomSharesSummary({ form }: { form: FormState }) {
  const sum = form.participantIds.reduce((s, id) => s + (Number(form.customShares[id]) || 0), 0);
  const total = Number(form.amount);
  const ok = Number.isFinite(total) && total > 0 && Math.abs(sum - total) <= 0.5;
  return (
    <div className="flex items-baseline justify-between text-xs pt-1">
      <span className="text-zinc-500">Shares total</span>
      <span className={ok ? "text-zinc-700" : "text-amber-700"}>
        {sum.toFixed(2)} {form.currency}
        {Number.isFinite(total) && total > 0 && !ok && ` (≠ ${total.toFixed(2)})`}
      </span>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs text-zinc-600">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

export default function ConfirmPage() {
  return (
    <Suspense fallback={<div className="text-sm text-zinc-500">Loading…</div>}>
      <ConfirmInner />
    </Suspense>
  );
}
