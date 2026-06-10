"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "@/lib/session";
import { CONFIDENCE_THRESHOLD, mergeCategoryOptions } from "@/lib/categories";
import { useCustomCategories } from "@/lib/customCategories";
import { saveExpenseWithOfflineFallback } from "@/lib/pendingSync";
import {
  CURRENCIES,
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
  type CategoryOption,
} from "@/lib/types";
import {
  Card,
  Alert,
  Button,
  TextField,
  BottomActionBar,
  SectionHeader,
  Badge,
} from "@/components/ui";
import { useLanguage, categoryLabel, paymentMethodLabel } from "@/lib/i18n";

// ---------- Types & form state ----------

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

type SmartAddHints = {
  payerName?: string | null;
  splitType?: SplitType | null;
  participantNames?: string[];
};

type PendingExpense = {
  analysis: AIAnalysisResult;
  imageUrl?: string;
  sourceType: SourceType;
  hints?: SmartAddHints;
};

// ---------- Pure helpers ----------

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

function formFromRecord(rec: ExpenseRecord, session: Session): FormState {
  const participantIds =
    rec.participants && rec.participants.length > 0
      ? rec.participants.map((p) => p.userId)
      : [rec.payerId || rec.userId];
  const customShares: Record<string, string> = {};
  if (rec.splitType === "custom_amount" && rec.participants) {
    for (const p of rec.participants) {
      if (typeof p.share === "number") customShares[p.userId] = String(p.share);
    }
  }
  return {
    merchant: rec.merchant ?? "",
    amount: rec.amount != null ? String(rec.amount) : "",
    currency: rec.currency || session.baseCurrency || "HKD",
    date: rec.date || todayIso(),
    country: rec.country ?? "",
    category: (rec.category as ExpenseCategory) || "Other",
    paymentMethod: rec.paymentMethod || "Cash",
    payerId: rec.payerId || rec.userId,
    payerName: rec.payerName || rec.userName,
    notes: rec.notes ?? "",
    groupId: rec.familyId || "",
    tripId: rec.tripId || "",
    splitType: rec.splitType || "equal_split",
    participantIds,
    splitTouched: true,
    customShares,
    expenseType: rec.expenseType || "one_time",
    spreadStartDate: rec.spreadStartDate ?? "",
    spreadEndDate: rec.spreadEndDate ?? "",
    sourceType: rec.sourceType || "manual",
    imageUrl: rec.imageUrl,
    aiConfidence: undefined,
    items: (rec.items || []).map((it) => ({
      id: it.id || newItemId(),
      name: it.name,
      totalPrice: String(it.totalPrice),
      quantity: it.quantity != null ? String(it.quantity) : "",
      unitPrice: it.unitPrice != null ? String(it.unitPrice) : "",
      category: it.category || "",
    })),
  };
}

function buildInitialForm(
  session: Session,
  isManual: boolean,
  initialGroupId: string,
  initialTripId: string,
  editId = "",
): FormState | null {
  if (editId) {
    if (typeof window === "undefined") return null;
    const raw = sessionStorage.getItem("fxt.editExpense");
    if (!raw) return null;
    try {
      const rec = JSON.parse(raw) as ExpenseRecord;
      if (rec.id !== editId) return null;
      return formFromRecord(rec, session);
    } catch {
      return null;
    }
  }
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
    const pending = JSON.parse(raw) as PendingExpense;
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

function readPendingHints(): SmartAddHints | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem("fxt.pendingExpense");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PendingExpense;
    return parsed.hints || null;
  } catch {
    return null;
  }
}

function normalizeName(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z0-9À-￿\s]/g, "");
}

function matchKnownUser(
  name: string,
  users: Array<{ userId: string; userName: string }>,
  session: Session,
): { userId: string; userName: string } | null {
  const n = normalizeName(name);
  if (!n) return null;
  if (n === "i" || n === "me" || n === "myself") {
    return { userId: session.userId, userName: session.username };
  }
  const exact = users.find((u) => normalizeName(u.userName) === n);
  if (exact) return exact;
  const partials = users.filter((u) => {
    const un = normalizeName(u.userName);
    return un && (un.includes(n) || n.includes(un));
  });
  if (partials.length === 1) return partials[0];
  return null;
}

// ---------- Top-level entrypoint ----------

function ConfirmInner() {
  const router = useRouter();
  const params = useSearchParams();
  const isManual = params.get("manual") === "1";
  const partyId = params.get("partyId") || "";
  const tripId = params.get("tripId") || "";
  const editId = params.get("edit") || "";
  const session = useSession();

  useEffect(() => {
    if (!session) router.replace("/login");
  }, [session, router]);

  if (!session) return <div style={{ color: "var(--color-ink-3)", fontSize: 13 }}>Loading…</div>;
  return (
    <ConfirmFormBody
      key={`${editId ? `edit=${editId}` : isManual ? "manual" : "ai"}|party=${partyId}|trip=${tripId}`}
      session={session}
      isManual={isManual}
      editId={editId}
      initialGroupId={partyId}
      initialTripId={tripId}
    />
  );
}

// ---------- The big form ----------

function ConfirmFormBody({
  session,
  isManual,
  editId,
  initialGroupId,
  initialTripId,
}: {
  session: Session;
  isManual: boolean;
  editId: string;
  initialGroupId: string;
  initialTripId: string;
}) {
  const router = useRouter();
  const { t, language } = useLanguage();
  const { categories: customCategories } = useCustomCategories(session.userId);
  const categoryOptions = mergeCategoryOptions(customCategories);
  const [form, setForm] = useState<FormState | null>(() =>
    buildInitialForm(session, isManual, initialGroupId, initialTripId, editId),
  );
  const [parties, setParties] = useState<Party[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [customMethods, setCustomMethods] = useState<string[]>([]);
  const [showAddMethod, setShowAddMethod] = useState(false);
  const [newMethodName, setNewMethodName] = useState("");
  const [addingMethod, setAddingMethod] = useState(false);
  const [categoryRules, setCategoryRules] = useState<
    Array<{ id: string; merchantKeyword: string; category: ExpenseCategory }>
  >([]);
  const [categoryTouched, setCategoryTouched] = useState(editId !== "");
  const [savingRule, setSavingRule] = useState(false);
  const [ruleSaved, setRuleSaved] = useState(false);
  const [knownUsers, setKnownUsers] = useState<Array<{ userId: string; userName: string }>>([
    { userId: session.userId, userName: session.username },
  ]);
  const [membersLoaded, setMembersLoaded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicates, setDuplicates] = useState<
    Array<{ id: string; merchant?: string; amount: number; currency: string; date: string }>
  >([]);
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
    setMembersLoaded(false);
    fetch(
      `/api/parties/${encodeURIComponent(groupId)}/members?userId=${encodeURIComponent(session.userId)}`,
    )
      .then((r) => (r.ok ? r.json() : { members: [] }))
      .then((b) => {
        if (cancelled) return;
        const members = (b.members as PartyMember[]) || [];
        const map = new Map<string, string>();
        map.set(session.userId, session.username);
        for (const m of members) map.set(m.userId, m.username);
        setKnownUsers(Array.from(map, ([userId, userName]) => ({ userId, userName })));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setMembersLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [form?.groupId, session.userId, session.username]);

  // If only a trip was supplied, resolve its parent group automatically.
  // A trip's stored familyId is its parent-group id when that maps to a real
  // group the user belongs to; otherwise (legacy trips store the creator's
  // userId there) fall back to the user's Personal group so a valid group is
  // always pre-selected. The user can still change it via the group picker.
  useEffect(() => {
    if (!form) return;
    if (form.groupId || !form.tripId) return;
    const trip = trips.find((x) => x.tripId === form.tripId);
    if (!trip) return;
    const parentGroup = parties.find((p) => p.partyId === trip.familyId);
    if (parentGroup) {
      setForm((f) => (f ? { ...f, groupId: parentGroup.partyId } : f));
      return;
    }
    const personal = parties
      .filter(
        (p) =>
          p.type === "private" &&
          p.createdBy === session.userId &&
          p.partyName === "Personal",
      )
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
    if (personal) {
      setForm((f) => (f ? { ...f, groupId: personal.partyId } : f));
    }
  }, [form, trips, parties, session.userId]);

  // Personal-group fallback: default to the user's Personal group when there's
  // no explicit group/trip context (mirrors server-side helper).
  useEffect(() => {
    if (!form) return;
    if (form.groupId || form.tripId) return;
    if (parties.length === 0) return;
    const personal = parties
      .filter(
        (p) =>
          p.type === "private" &&
          p.createdBy === session.userId &&
          p.partyName === "Personal",
      )
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
    if (personal) {
      setForm((f) => (f ? { ...f, groupId: personal.partyId } : f));
    }
  }, [form, parties, session.userId]);

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

  // Smart Add: resolve raw payer/participant names into structured fields once
  // group membership has loaded. Runs at most once per pending expense.
  const [pendingHints, setPendingHints] = useState<SmartAddHints | null>(() =>
    isManual ? null : readPendingHints(),
  );
  const hintsAppliedRef = useRef(false);

  useEffect(() => {
    if (!form || hintsAppliedRef.current) return;
    if (!pendingHints) {
      hintsAppliedRef.current = true;
      return;
    }
    const hasAnyHint =
      !!pendingHints.payerName ||
      !!pendingHints.splitType ||
      (pendingHints.participantNames?.length ?? 0) > 0;
    if (!hasAnyHint) {
      hintsAppliedRef.current = true;
      setPendingHints(null);
      return;
    }
    if (!form.groupId) return;
    if (!membersLoaded) return;

    hintsAppliedRef.current = true;
    const unmatched: string[] = [];
    const guidance: string[] = [];

    let nextPayerId = form.payerId;
    let nextPayerName = form.payerName;
    if (pendingHints.payerName) {
      const matched = matchKnownUser(pendingHints.payerName, knownUsers, session);
      if (matched) {
        nextPayerId = matched.userId;
        nextPayerName = matched.userName;
      } else {
        nextPayerName = pendingHints.payerName;
        unmatched.push(`Payer "${pendingHints.payerName}" (not in group)`);
      }
    }

    const matchedParticipantIds: string[] = [];
    if (pendingHints.participantNames && pendingHints.participantNames.length > 0) {
      for (const raw of pendingHints.participantNames) {
        const matched = matchKnownUser(raw, knownUsers, session);
        if (matched) {
          if (!matchedParticipantIds.includes(matched.userId)) {
            matchedParticipantIds.push(matched.userId);
          }
        } else {
          unmatched.push(`Participant "${raw}" (not in group)`);
        }
      }
    }

    let nextSplitType: SplitType = form.splitType;
    if (pendingHints.splitType === "no_split") {
      nextSplitType = "no_split";
    } else if (pendingHints.splitType === "equal_split") {
      nextSplitType = "equal_split";
    } else if (pendingHints.splitType === "custom_amount") {
      nextSplitType = "equal_split";
      guidance.push(t("confirm.customSplitGuidance"));
    }

    let nextParticipantIds = form.participantIds;
    if (nextSplitType === "equal_split") {
      const combined = [...matchedParticipantIds];
      if (!combined.includes(nextPayerId)) combined.unshift(nextPayerId);
      nextParticipantIds = combined.length > 0 ? combined : [nextPayerId];
    } else if (nextSplitType === "no_split") {
      nextParticipantIds = [];
    }

    const noteParts: string[] = [];
    if (form.notes.trim()) noteParts.push(form.notes.trim());
    if (unmatched.length > 0) noteParts.push(unmatched.join(" · "));
    if (guidance.length > 0) noteParts.push(guidance.join(" · "));
    const nextNotes = noteParts.join(" — ");

    setForm((f) =>
      f
        ? {
            ...f,
            payerId: nextPayerId,
            payerName: nextPayerName,
            splitType: nextSplitType,
            splitTouched: true,
            participantIds: nextParticipantIds,
            notes: nextNotes,
          }
        : f,
    );
    setPendingHints(null);
  }, [form, pendingHints, knownUsers, membersLoaded, session, t]);

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
      const stillValidTrip =
        f.tripId && trips.some((t) => t.tripId === f.tripId && t.familyId === groupId);
      return { ...f, groupId, tripId: stillValidTrip ? f.tripId : "" };
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    if (!form.groupId) {
      setError(t("confirm.errorPickGroup"));
      return;
    }
    const amt = Number(form.amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setError(t("confirm.errorAmount"));
      return;
    }
    if (form.expenseType === "spread_across_days") {
      if (!form.spreadStartDate || !form.spreadEndDate) {
        setError(t("confirm.errorPickStartEnd"));
        return;
      }
      if (form.spreadEndDate < form.spreadStartDate) {
        setError(t("confirm.errorEndAfterStart"));
        return;
      }
    }
    if (form.splitType === "equal_split" && form.participantIds.length === 0) {
      setError(t("confirm.errorParticipantsEqual"));
      return;
    }
    if (form.splitType === "custom_amount") {
      const sum = form.participantIds.reduce(
        (s2, id) => s2 + (Number(form.customShares[id]) || 0),
        0,
      );
      if (form.participantIds.length === 0) {
        setError(t("confirm.errorParticipantsCustom"));
        return;
      }
      if (Math.abs(sum - amt) > 0.5) {
        setError(
          `Custom shares (${sum.toFixed(2)}) must add up to the total amount (${amt.toFixed(2)})`,
        );
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
        spreadStartDate:
          form.expenseType === "spread_across_days" ? form.spreadStartDate || undefined : undefined,
        spreadEndDate:
          form.expenseType === "spread_across_days" ? form.spreadEndDate || undefined : undefined,
      };
      if (editId) {
        // Edit is body-authoritative: send clearable fields as explicit values
        // (empty strings) instead of `|| undefined`, so blanking a field clears
        // it on save rather than being dropped from the JSON body.
        const editBody = {
          ...payload,
          id: editId,
          merchant: form.merchant,
          notes: form.notes,
          country: form.country,
          tripId: form.tripId,
          paymentMethod: form.paymentMethod,
        };
        const res = await fetch("/api/expenses", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(editBody),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError((data as { error?: string }).error || "Failed to update");
          setSubmitting(false);
          return;
        }
        sessionStorage.removeItem("fxt.editExpense");
        router.back();
        return;
      }
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
      const data = result.data as {
        duplicates?: Array<{
          id: string;
          merchant?: string;
          amount: number;
          currency: string;
          date: string;
        }>;
      };
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

  if (!form) return <div style={{ color: "var(--color-ink-3)", fontSize: 13 }}>Loading…</div>;

  const lowConfidence = form.aiConfidence != null && form.aiConfidence < CONFIDENCE_THRESHOLD;
  const missingFields =
    form.aiConfidence != null
      ? [
          !form.merchant.trim() && "merchant",
          !form.amount.trim() && "amount",
          !form.date.trim() && "date",
        ].filter((x): x is string => Boolean(x))
      : [];
  const tripsForGroup = form.groupId ? trips.filter((t) => t.familyId === form.groupId) : [];

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 720, margin: "0 auto" }}>
      <header style={{ marginBottom: 4 }}>
        <div className="fxt-eyebrow" style={{ marginBottom: 8 }}>
          {editId ? t("confirm.eyebrowEdit") : isManual ? t("confirm.eyebrowManual") : form.sourceType === "smart_add" ? t("confirm.eyebrowSmart") : t("confirm.eyebrowAi")}
        </div>
        <h1
          className="fxt-display"
          style={{ fontSize: "clamp(28px, 4.6vw, 36px)", margin: 0, lineHeight: 1.1, letterSpacing: "-0.015em" }}
        >
          {editId ? t("confirm.titleEdit") : isManual ? t("confirm.titleManual") : t("confirm.titleConfirm")}
        </h1>
        <p style={{ color: "var(--color-ink-2)", fontSize: 13, margin: "8px 0 0", maxWidth: "56ch" }}>
          {t("confirm.subtitle")}
        </p>
      </header>

      {form.aiConfidence != null && (
        lowConfidence ? (
          <Alert tone="amber" title={t("confirm.aiConfidenceFmt", { pct: (form.aiConfidence * 100).toFixed(0) })}>
            {t("confirm.lowConfidence")}
          </Alert>
        ) : (
          <Alert tone="sage" title={t("confirm.aiConfidenceFmt", { pct: (form.aiConfidence * 100).toFixed(0) })}>
            {t("confirm.goodConfidence")}
          </Alert>
        )
      )}

      {missingFields.length > 0 && (
        <Alert tone="amber" title={t("confirm.missingTitle")}>
          {t("confirm.missingDescFmt", { fields: missingFields.join(", ") })}
        </Alert>
      )}

      {duplicates.length > 0 && savedRedirect && (
        <Alert tone="amber" title={t("confirm.duplicateTitle")}>
          <ul style={{ margin: "6px 0 10px", paddingLeft: 18, lineHeight: 1.5 }}>
            {duplicates.slice(0, 3).map((d) => (
              <li key={d.id}>
                {d.merchant || "—"} · {d.amount.toFixed(2)} {d.currency} · {d.date}
              </li>
            ))}
          </ul>
          <Button type="button" variant="secondary" size="sm" onClick={() => router.push(savedRedirect)}>
            {t("confirm.duplicateContinue")}
          </Button>
        </Alert>
      )}

      {form.imageUrl && (
        <Card padding={0} tone="soft">
          <div style={{ display: "flex", justifyContent: "center", padding: 12 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={form.imageUrl}
              alt="Receipt"
              style={{ maxHeight: 200, width: "auto", borderRadius: 8, objectFit: "contain" }}
            />
          </div>
        </Card>
      )}

      {error && <Alert tone="accent" title={t("confirm.errorSave")}>{error}</Alert>}

      {/* ESSENTIALS */}
      <section>
        <SectionHeader title={t("confirm.sectionEssentials")} />
        <Card padding={18}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Field label={t("confirm.fieldGroup")}>
              <NativeSelect
                value={form.groupId}
                onChange={(e) => setGroup(e.target.value)}
                required
              >
                <option value="">— Pick a group —</option>
                {parties.map((p) => (
                  <option key={p.partyId} value={p.partyId}>
                    {p.partyName}
                  </option>
                ))}
              </NativeSelect>
            </Field>

            {tripsForGroup.length > 0 && (
              <Field label={t("confirm.fieldTrip")}>
                <NativeSelect
                  value={form.tripId}
                  onChange={(e) => update("tripId", e.target.value)}
                  disabled={!form.groupId}
                >
                  <option value="">— No trip —</option>
                  {tripsForGroup.map((t) => (
                    <option key={t.tripId} value={t.tripId}>
                      {t.tripName}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            )}

            <TextField
              label={t("confirm.fieldMerchant")}
              value={form.merchant}
              onChange={(e) => update("merchant", e.target.value)}
              placeholder={t("confirm.fieldMerchantPlaceholder")}
            />

            <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 10 }}>
              <TextField
                label={t("confirm.fieldAmount")}
                inputMode="decimal"
                value={form.amount}
                onChange={(e) => update("amount", e.target.value)}
                required
              />
              <Field label={t("confirm.fieldCurrency")}>
                <NativeSelect value={form.currency} onChange={(e) => update("currency", e.target.value)}>
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            </div>

            <Field label={t("confirm.fieldDate")}>
              <input
                className="fxt-focus"
                type="date"
                value={form.date}
                onChange={(e) => update("date", e.target.value)}
                style={inputBaseStyle()}
              />
            </Field>
          </div>
        </Card>
      </section>

      {/* CATEGORY & PAYMENT */}
      <section>
        <SectionHeader title={t("confirm.sectionCategoryPayment")} />
        <Card padding={18}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Field label={t("confirm.fieldCategory")}>
                <NativeSelect
                  value={form.category}
                  onChange={(e) => {
                    setCategoryTouched(true);
                    setRuleSaved(false);
                    update("category", e.target.value as ExpenseCategory);
                  }}
                >
                  {categoryOptions.map((opt) => (
                    <option key={opt.name} value={opt.name}>
                      {categoryLabel(opt.name, language)}
                    </option>
                  ))}
                </NativeSelect>
              </Field>

              <Field label={t("confirm.fieldPaymentMethod")}>
                <NativeSelect
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
                  {PAYMENT_METHODS.map((p) => (
                    <option key={p} value={p}>
                      {paymentMethodLabel(p, language)}
                    </option>
                  ))}
                  {customMethods.length > 0 && (
                    <optgroup label={t("confirm.yourCustomMethods")}>
                      {customMethods.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {!PAYMENT_METHODS.includes(form.paymentMethod as typeof PAYMENT_METHODS[number]) &&
                    !customMethods.includes(form.paymentMethod) &&
                    form.paymentMethod && (
                      <option value={form.paymentMethod}>{form.paymentMethod}</option>
                    )}
                  <option value="__add__">{t("confirm.addCustomMethod")}</option>
                </NativeSelect>
              </Field>
            </div>

            {showAddMethod && (
              <Card padding={14} tone="soft">
                <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
                  <div style={{ flex: "1 1 200px", minWidth: 180 }}>
                    <TextField
                      label={t("confirm.newMethodLabel")}
                      placeholder={t("confirm.newMethodPlaceholder")}
                      value={newMethodName}
                      maxLength={40}
                      onChange={(e) => setNewMethodName(e.target.value)}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    onClick={handleAddMethod}
                    disabled={addingMethod || !newMethodName.trim()}
                  >
                    {addingMethod ? t("confirm.addingMethod") : t("confirm.addMethod")}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="md"
                    onClick={() => {
                      setShowAddMethod(false);
                      setNewMethodName("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </Card>
            )}

            {categoryTouched && form.merchant.trim() && (() => {
              const merchant = form.merchant.trim().toLowerCase();
              const existing = categoryRules.find((r) => {
                const kw = r.merchantKeyword.trim().toLowerCase();
                return (
                  kw &&
                  (merchant.includes(kw) || kw.includes(merchant)) &&
                  r.category === form.category
                );
              });
              if (ruleSaved || existing) {
                return (
                  <Alert tone="sage" title={`Rule saved · ${form.merchant.trim()} → ${form.category}`}>
                    Next time we&apos;ll set this category automatically.
                  </Alert>
                );
              }
              return (
                <Card padding={12} tone="soft">
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13, color: "var(--color-ink-2)" }}>
                      Save “{form.merchant.trim()}” → <strong style={{ color: "var(--color-ink)" }}>{form.category}</strong> as a rule?
                    </span>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={handleSaveRule}
                      disabled={savingRule}
                    >
                      {savingRule ? t("confirm.savingRule") : t("confirm.saveRule")}
                    </Button>
                  </div>
                </Card>
              );
            })()}
          </div>
        </Card>
      </section>

      {/* SPLIT */}
      <section>
        <SectionHeader
          title={t("confirm.splitTitle")}
          meta={form.splitType === "no_split" ? t("confirm.metaPersonal") : form.splitType === "equal_split" ? t("confirm.metaEqual") : t("confirm.metaCustom")}
        />
        <Card padding={18}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Field label={t("confirm.splitQuestion")}>
              <NativeSelect
                value={form.splitType}
                onChange={(e) => {
                  const next = e.target.value as SplitType;
                  setForm((f) => (f ? { ...f, splitType: next, splitTouched: true } : f));
                }}
              >
                <option value="no_split">No split (personal)</option>
                <option value="equal_split">{t("confirm.splitEqual")}</option>
                <option value="custom_amount">{t("confirm.splitCustom")}</option>
              </NativeSelect>
            </Field>

            {form.splitType === "equal_split" && (
              <div style={participantsBoxStyle()}>
                {knownUsers.map((u) => {
                  const selected = form.participantIds.includes(u.userId);
                  const amt = Number(form.amount);
                  const n = Math.max(1, form.participantIds.length);
                  const share = selected && Number.isFinite(amt) && amt > 0 ? amt / n : 0;
                  return (
                    <label key={u.userId} style={participantRowStyle()}>
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
                      <span style={{ flex: 1 }}>{u.userName || u.userId}</span>
                      {selected && share > 0 && (
                        <span className="fxt-mono" style={{ fontSize: 12, color: "var(--color-ink-3)" }}>
                          {share.toFixed(2)} {form.currency}
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            )}

            {form.splitType === "custom_amount" && (
              <div style={participantsBoxStyle()}>
                {knownUsers.map((u) => {
                  const selected = form.participantIds.includes(u.userId);
                  return (
                    <div key={u.userId} style={participantRowStyle()}>
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
                      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {u.userName || u.userId}
                      </span>
                      <input
                        className="fxt-focus"
                        inputMode="decimal"
                        placeholder="0.00"
                        value={form.customShares[u.userId] ?? ""}
                        disabled={!selected}
                        onChange={(e) => {
                          const v = e.target.value;
                          setForm((f) =>
                            f ? { ...f, customShares: { ...f.customShares, [u.userId]: v } } : f,
                          );
                        }}
                        style={{ ...inputBaseStyle(), maxWidth: 88, padding: "6px 8px" }}
                      />
                      <span className="fxt-mono" style={{ fontSize: 11, color: "var(--color-ink-3)" }}>{form.currency}</span>
                    </div>
                  );
                })}
                <CustomSharesSummary form={form} />
              </div>
            )}
          </div>
        </Card>
      </section>

      {/* ADVANCED — collapsible */}
      <details
        style={{
          background: "var(--color-bg-soft)",
          border: "1px solid var(--color-line-soft)",
          borderRadius: "var(--radius-xl)",
          overflow: "hidden",
        }}
      >
        <summary
          className="fxt-focus"
          style={{
            cursor: "pointer",
            padding: "14px 18px",
            listStyle: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <span style={{ fontFamily: "var(--font-serif)", fontWeight: 600, fontSize: 15, color: "var(--color-ink)" }}>
            More details
          </span>
          <span className="fxt-mono" style={{ fontSize: 11, color: "var(--color-ink-3)", letterSpacing: "0.08em" }}>
            COUNTRY · MULTI-DAY · PAYER · NOTES
          </span>
        </summary>
        <div style={{ padding: "0 18px 18px", display: "flex", flexDirection: "column", gap: 14 }}>
          <TextField
            label={t("confirm.fieldCountry")}
            value={form.country}
            onChange={(e) => update("country", e.target.value)}
            placeholder={t("confirm.fieldCountryPlaceholder")}
          />

          <Field label={t("confirm.fieldExpenseType")}>
            <NativeSelect
              value={form.expenseType}
              onChange={(e) => update("expenseType", e.target.value as ExpenseType)}
            >
              <option value="one_time">One-time (single day)</option>
              <option value="spread_across_days">Spread across days (hotel, rental, pass)</option>
            </NativeSelect>
          </Field>

          {form.expenseType === "spread_across_days" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Field label={t("confirm.fieldStart")}>
                <input
                  className="fxt-focus"
                  type="date"
                  value={form.spreadStartDate}
                  onChange={(e) => update("spreadStartDate", e.target.value)}
                  style={inputBaseStyle()}
                />
              </Field>
              <Field label={t("confirm.fieldEnd")}>
                <input
                  className="fxt-focus"
                  type="date"
                  value={form.spreadEndDate}
                  onChange={(e) => update("spreadEndDate", e.target.value)}
                  style={inputBaseStyle()}
                />
              </Field>
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
                  <div
                    style={{
                      gridColumn: "span 2",
                      fontFamily: "var(--font-mono)",
                      fontSize: 12,
                      color: "var(--color-ink-3)",
                      letterSpacing: "0.04em",
                    }}
                  >
                    {daily.toFixed(2)} {form.currency} / DAY × {days} DAY{days === 1 ? "" : "S"}
                  </div>
                );
              })()}
            </div>
          )}

          <TextField
            label={t("confirm.fieldPayerName")}
            value={form.payerName}
            onChange={(e) => update("payerName", e.target.value)}
          />

          <Field label={t("confirm.fieldNotes")}>
            <textarea
              className="fxt-focus"
              rows={2}
              value={form.notes}
              onChange={(e) => update("notes", e.target.value)}
              style={{ ...inputBaseStyle(), minHeight: 60, resize: "vertical", lineHeight: 1.5 }}
            />
          </Field>
        </div>
      </details>

      <ItemsSection form={form} setForm={setForm} categoryOptions={categoryOptions} />

      <BottomActionBar>
        <Button type="submit" disabled={submitting} variant="accent" size="lg" full>
          {submitting ? t("confirm.submitting") : editId ? t("confirm.submitEdit") : t("confirm.submit")}
        </Button>
        <Button type="button" onClick={() => router.back()} variant="secondary" size="lg">
          Cancel
        </Button>
      </BottomActionBar>
    </form>
  );
}

// ---------- Items section ----------

function ItemsSection({
  form,
  setForm,
  categoryOptions,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState | null>>;
  categoryOptions: CategoryOption[];
}) {
  const { t, language } = useLanguage();
  function updateItem(id: string, patch: Partial<FormItem>) {
    setForm((f) => (f ? { ...f, items: f.items.map((it) => (it.id === id ? { ...it, ...patch } : it)) } : f));
  }
  function removeItem(id: string) {
    setForm((f) => (f ? { ...f, items: f.items.filter((it) => it.id !== id) } : f));
  }
  function addItem() {
    setForm((f) => (f ? { ...f, items: [...f.items, blankItem()] } : f));
  }
  const itemTotal = form.items.reduce((s, it) => {
    const n = Number(it.totalPrice);
    return s + (Number.isFinite(n) ? n : 0);
  }, 0);
  const expenseAmount = Number(form.amount);
  const sumMismatch =
    form.items.length > 0 &&
    Number.isFinite(expenseAmount) &&
    expenseAmount > 0 &&
    Math.abs(itemTotal - expenseAmount) > 0.5;

  return (
    <section>
      <SectionHeader
        title={`Receipt items (${form.items.length})`}
        meta={form.items.length > 0 ? `SUM ${itemTotal.toFixed(2)} ${form.currency}` : undefined}
        action={
          sumMismatch ? <Badge tone="amber" size="sm">≠ {expenseAmount.toFixed(2)}</Badge> : undefined
        }
      />
      <Card padding={14}>
        {form.items.length === 0 ? (
          <div style={{ fontSize: 13, color: "var(--color-ink-3)", padding: "6px 4px 10px" }}>
            We couldn&apos;t detect individual items, but you can still save the total amount.
          </div>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
            {form.items.map((it) => (
              <li
                key={it.id}
                style={{
                  background: "var(--color-bg-soft)",
                  border: "1px solid var(--color-line-soft)",
                  borderRadius: "var(--radius-md)",
                  padding: 12,
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                  <input
                    className="fxt-focus"
                    placeholder={t("confirm.itemName")}
                    value={it.name}
                    onChange={(e) => updateItem(it.id, { name: e.target.value })}
                    style={{ ...inputBaseStyle(), flex: 1 }}
                  />
                  <button
                    type="button"
                    onClick={() => removeItem(it.id)}
                    aria-label={t("confirm.itemRemove")}
                    style={{
                      background: "transparent",
                      border: 0,
                      color: "var(--color-ink-3)",
                      cursor: "pointer",
                      padding: "8px 6px",
                      fontSize: 14,
                    }}
                  >
                    ✕
                  </button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                  <SmallField label={t("confirm.itemQty")}>
                    <input
                      className="fxt-focus"
                      inputMode="decimal"
                      value={it.quantity}
                      onChange={(e) => updateItem(it.id, { quantity: e.target.value })}
                      style={inputBaseStyle()}
                    />
                  </SmallField>
                  <SmallField label={t("confirm.itemUnit")}>
                    <input
                      className="fxt-focus"
                      inputMode="decimal"
                      value={it.unitPrice}
                      onChange={(e) => updateItem(it.id, { unitPrice: e.target.value })}
                      style={inputBaseStyle()}
                    />
                  </SmallField>
                  <SmallField label={t("confirm.itemTotal")}>
                    <input
                      className="fxt-focus"
                      inputMode="decimal"
                      value={it.totalPrice}
                      onChange={(e) => updateItem(it.id, { totalPrice: e.target.value })}
                      required
                      style={inputBaseStyle()}
                    />
                  </SmallField>
                </div>
                <SmallField label={t("confirm.itemCategory")}>
                  <NativeSelect
                    value={it.category}
                    onChange={(e) => updateItem(it.id, { category: e.target.value as ExpenseCategory | "" })}
                  >
                    <option value="">— Same as receipt —</option>
                    {categoryOptions.map((opt) => (
                      <option key={opt.name} value={opt.name}>
                        {categoryLabel(opt.name, language)}
                      </option>
                    ))}
                  </NativeSelect>
                </SmallField>
              </li>
            ))}
          </ul>
        )}

        <button
          type="button"
          onClick={addItem}
          className="fxt-focus"
          style={{
            marginTop: form.items.length > 0 ? 12 : 4,
            width: "100%",
            padding: "12px",
            background: "transparent",
            border: "1px dashed var(--color-line)",
            borderRadius: "var(--radius-md)",
            color: "var(--color-ink-2)",
            fontSize: 13,
            cursor: "pointer",
            transition: "border-color 120ms ease, color 120ms ease",
          }}
        >
          + Add item
        </button>
      </Card>
    </section>
  );
}

// ---------- Persistence helpers ----------

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
  const sum = form.participantIds.reduce(
    (s, id) => s + (Number(form.customShares[id]) || 0),
    0,
  );
  const total = Number(form.amount);
  const ok = Number.isFinite(total) && total > 0 && Math.abs(sum - total) <= 0.5;
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        paddingTop: 8,
        marginTop: 4,
        borderTop: "1px solid var(--color-line-soft)",
      }}
    >
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.06em", color: "var(--color-ink-3)" }}>
        SHARES TOTAL
      </span>
      <span
        className="fxt-mono"
        style={{
          fontSize: 13,
          color: ok ? "var(--color-ink)" : "var(--color-amber-ink)",
          fontWeight: 500,
        }}
      >
        {sum.toFixed(2)} {form.currency}
        {Number.isFinite(total) && total > 0 && !ok && ` (≠ ${total.toFixed(2)})`}
      </span>
    </div>
  );
}

// ---------- Inline UI helpers ----------

function inputBaseStyle(): React.CSSProperties {
  return {
    display: "block",
    width: "100%",
    background: "var(--color-surface)",
    border: "1px solid var(--color-line)",
    borderRadius: "var(--radius-md)",
    padding: "10px 12px",
    fontSize: 14,
    fontFamily: "var(--font-sans)",
    color: "var(--color-ink)",
    outline: "none",
    lineHeight: 1.4,
  };
}

function participantsBoxStyle(): React.CSSProperties {
  return {
    background: "var(--color-bg-soft)",
    border: "1px solid var(--color-line-soft)",
    borderRadius: "var(--radius-md)",
    padding: 10,
    display: "flex",
    flexDirection: "column",
    gap: 6,
  };
}

function participantRowStyle(): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "8px 10px",
    background: "var(--color-surface)",
    border: "1px solid var(--color-line-soft)",
    borderRadius: 8,
    fontSize: 14,
    color: "var(--color-ink)",
  };
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "block" }}>
      <span
        style={{
          display: "block",
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--color-ink-3)",
          marginBottom: 6,
        }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

function SmallField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "block" }}>
      <span
        style={{
          display: "block",
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--color-ink-3)",
          marginBottom: 4,
        }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

function NativeSelect({
  children,
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...rest}
      className={["fxt-focus", rest.className].filter(Boolean).join(" ")}
      style={{
        ...inputBaseStyle(),
        appearance: "none",
        paddingRight: 30,
        backgroundImage:
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 10 10'><path d='M2 3.5l3 3 3-3' fill='none' stroke='%2374706b' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/></svg>\")",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 10px center",
        backgroundSize: "10px 10px",
        ...rest.style,
      }}
    >
      {children}
    </select>
  );
}

// ---------- Page export ----------

export default function ConfirmPage() {
  return (
    <Suspense fallback={<div style={{ color: "var(--color-ink-3)", fontSize: 13 }}>Loading…</div>}>
      <ConfirmInner />
    </Suspense>
  );
}
