"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/session";
import { useLanguage, type TranslateFn } from "@/lib/i18n";
import type { Party } from "@/lib/types";
import EmptyState from "@/components/EmptyState";
import Avatar from "@/components/Avatar";
import {
  PageHeader,
  ButtonLink,
  Button,
  Card,
  Badge,
  Alert,
  TextField,
  SectionHeader,
} from "@/components/ui";

function isPersonal(p: Party, userId: string): boolean {
  return p.type === "private" && p.createdBy === userId && p.partyName === "Personal";
}

export default function PartiesPage() {
  const router = useRouter();
  const session = useSession();
  const { t } = useLanguage();
  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinMsg, setJoinMsg] = useState<{ tone: "sage" | "accent"; text: string } | null>(null);

  useEffect(() => {
    if (!session) {
      router.replace("/login");
      return;
    }
    fetch(`/api/parties?userId=${encodeURIComponent(session.userId)}`)
      .then(async (r) => ({ ok: r.ok, body: await r.json() }))
      .then(({ ok, body }) => {
        if (!ok) throw new Error(body.error || "Failed to load groups");
        setParties(body.parties || []);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Unknown error"))
      .finally(() => setLoading(false));
  }, [session, router]);

  const { personal, others } = useMemo(() => {
    if (!session) return { personal: null as Party | null, others: [] as Party[] };
    let p: Party | null = null;
    const rest: Party[] = [];
    for (const party of parties) {
      if (!p && isPersonal(party, session.userId)) p = party;
      else rest.push(party);
    }
    return { personal: p, others: rest };
  }, [parties, session]);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!session || !joinCode.trim()) return;
    setJoining(true);
    setJoinMsg(null);
    try {
      const res = await fetch("/api/parties/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: session.userId, partyCode: joinCode.trim().toUpperCase() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to join");
      setJoinMsg({ tone: "sage", text: t("groups.joinedFmt", { name: data.party.partyName }) });
      setJoinCode("");
      setParties((prev) =>
        prev.find((p) => p.partyId === data.party.partyId) ? prev : [...prev, data.party],
      );
    } catch (err) {
      setJoinMsg({ tone: "accent", text: err instanceof Error ? err.message : "Unknown error" });
    } finally {
      setJoining(false);
    }
  }

  if (!session || loading)
    return (
      <div style={{ color: "var(--color-ink-3)", fontSize: 13, padding: 16 }}>{t("common.loading")}</div>
    );
  if (error) return <Alert tone="accent" title={t("groups.errorTitle")}>{error}</Alert>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <PageHeader
        eyebrow={`${t("groups.eyebrowGreeting", { name: session.username })} \u00B7 ${t("groups.inviteCodeLabel")} ${session.inviteCode}`}
        title={<>{t("groups.title")} <em style={{ fontStyle: "italic", color: "var(--color-accent)" }}>{t("groups.titleAccent")}</em></>}
        description={t("groups.description")}
        actions={
          <ButtonLink href="/parties/new" variant="accent" size="md">
            {t("groups.newGroup")}
          </ButtonLink>
        }
      />

      {parties.length === 0 ? (
        <EmptyState
          icon="\u{1F465}"
          title={t("groups.empty.title")}
          description={t("groups.empty.description")}
          ctaHref="/parties/new"
          ctaLabel={t("groups.empty.cta")}
        />
      ) : (
        <>
          {personal && (
            <section>
              <SectionHeader title={t("groups.justForYou")} meta={t("groups.personalMeta")} />
              <GroupCard party={personal} highlight t={t} />
            </section>
          )}

          {others.length > 0 && (
            <section>
              <SectionHeader title={t("groups.shared")} meta={`${others.length} ${t("groups.totalSuffix")}`} />
              <ul
                style={{
                  listStyle: "none",
                  margin: 0,
                  padding: 0,
                  display: "grid",
                  gap: 12,
                  gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
                }}
              >
                {others.map((p) => (
                  <li key={p.partyId}>
                    <GroupCard party={p} t={t} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      <section>
        <SectionHeader title={t("groups.joinTitle")} meta={t("groups.joinMeta")} />
        <Card padding={18}>
          <form
            onSubmit={handleJoin}
            style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}
          >
            <div style={{ flex: "1 1 220px", minWidth: 200 }}>
              <TextField
                label={t("groups.joinCodeLabel")}
                placeholder={t("groups.joinCodePlaceholder")}
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                maxLength={12}
              />
            </div>
            <Button type="submit" disabled={joining || !joinCode.trim()} variant="secondary">
              {joining ? t("groups.joining") : t("groups.joinButton")}
            </Button>
          </form>
          {joinMsg && (
            <div style={{ marginTop: 12 }}>
              <Alert tone={joinMsg.tone}>{joinMsg.text}</Alert>
            </div>
          )}
        </Card>
      </section>
    </div>
  );
}

function GroupCard({ party, highlight = false, t }: { party: Party; highlight?: boolean; t: TranslateFn }) {
  const isPublic = party.type === "public";
  return (
    <Link
      href={`/parties/${party.partyId}`}
      className="fxt-focus"
      style={{
        display: "block",
        textDecoration: "none",
        background: highlight ? "var(--color-accent-soft)" : "var(--color-surface)",
        border: `1px solid ${
          highlight
            ? "color-mix(in oklch, var(--color-accent) 25%, var(--color-line))"
            : "var(--color-line)"
        }`,
        borderRadius: "var(--radius-xl)",
        padding: 18,
        color: "var(--color-ink)",
        transition: "border-color 120ms ease, transform 120ms ease, box-shadow 120ms ease",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          <Avatar name={party.partyName} size={36} />
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontFamily: "var(--font-serif)",
                fontWeight: 600,
                fontSize: 17,
                lineHeight: 1.25,
                color: "var(--color-ink)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {party.partyName}
            </div>
            <div className="fxt-mono" style={{ fontSize: 11, color: "var(--color-ink-3)", marginTop: 2 }}>
              {isPublic && party.partyCode ? `${t("groups.cardCodePrefix")} ${party.partyCode}` : t("groups.cardPrivateLabel")}
            </div>
          </div>
        </div>
        <Badge tone={highlight ? "accent" : isPublic ? "sage" : "neutral"} size="sm">
          {highlight ? t("groups.cardPersonal") : isPublic ? t("groups.cardPublic") : t("groups.cardPrivate")}
        </Badge>
      </div>
    </Link>
  );
}
