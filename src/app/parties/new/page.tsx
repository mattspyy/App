"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/session";
import { useLanguage } from "@/lib/i18n";
import { Card, Button, Alert, TextField, PageHeader, SectionHeader } from "@/components/ui";
import type { Party } from "@/lib/types";

export default function NewPartyPage() {
  const router = useRouter();
  const session = useSession();
  const { t } = useLanguage();
  const [partyName, setPartyName] = useState("");
  const [type, setType] = useState<"private" | "public">("private");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) router.replace("/login");
  }, [session, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!session) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/parties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: session.userId, partyName: partyName.trim(), type }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create group");
      const party = data.party as Party;
      router.push(`/parties/${party.partyId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.unknownError"));
    } finally {
      setSubmitting(false);
    }
  }

  if (!session) return <div style={{ color: "var(--color-ink-3)", fontSize: 13 }}>{t("states.loading")}</div>;

  const templates: Array<{ icon: string; label: string; name: string }> = [
    { icon: "\u{1F464}", label: t("groups.new.tplPersonal"), name: t("groups.new.tplPersonalName") },
    { icon: "\u{1F468}\u200D\u{1F469}\u200D\u{1F467}", label: t("groups.new.tplFamily"), name: t("groups.new.tplFamilyName") },
    { icon: "\u{1F46B}", label: t("groups.new.tplFriends"), name: t("groups.new.tplFriendsName") },
    { icon: "\u2708\uFE0F", label: t("groups.new.tplTravel"), name: t("groups.new.tplTravelName") },
  ];

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 460, margin: "0 auto", display: "flex", flexDirection: "column", gap: 18 }}>
      <PageHeader title={t("groups.new.title")} />

      {error && <Alert tone="accent" title={t("groups.new.errorTitle")}>{error}</Alert>}

      <section>
        <SectionHeader title={t("groups.new.quickStart")} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {templates.map((tpl) => (
            <button
              key={tpl.label}
              type="button"
              onClick={() => setPartyName(tpl.name)}
              className="fxt-focus"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 12px",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--color-line)",
                background: "var(--color-surface)",
                fontSize: 14,
                color: "var(--color-ink)",
                textAlign: "left",
                cursor: "pointer",
              }}
            >
              <span aria-hidden>{tpl.icon}</span>
              <span>{tpl.label}</span>
            </button>
          ))}
        </div>
      </section>

      <Card padding={18}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <TextField
            label={t("groups.new.nameLabel")}
            value={partyName}
            onChange={(e) => setPartyName(e.target.value)}
            required
            autoFocus
          />

          <fieldset style={{ border: 0, padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
            <legend
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "var(--color-ink-3)",
                marginBottom: 4,
              }}
            >
              {t("groups.new.typeLabel")}
            </legend>
            <label style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 14, color: "var(--color-ink)" }}>
              <input
                type="radio"
                name="type"
                value="private"
                checked={type === "private"}
                onChange={() => setType("private")}
                style={{ marginTop: 3, accentColor: "var(--color-accent)" }}
              />
              <span>
                <strong>{t("groups.new.typePrivate")}</strong> {t("groups.new.typePrivateDesc")}
              </span>
            </label>
            <label style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 14, color: "var(--color-ink)" }}>
              <input
                type="radio"
                name="type"
                value="public"
                checked={type === "public"}
                onChange={() => setType("public")}
                style={{ marginTop: 3, accentColor: "var(--color-accent)" }}
              />
              <span>
                <strong>{t("groups.new.typePublic")}</strong> {t("groups.new.typePublicDesc")}
              </span>
            </label>
          </fieldset>
        </div>
      </Card>

      <div>
        <Button type="submit" disabled={submitting || !partyName.trim()} variant="primary" size="lg">
          {submitting ? t("groups.new.submitting") : t("groups.new.submit")}
        </Button>
      </div>
    </form>
  );
}
