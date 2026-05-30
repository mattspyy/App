"use client";
import { useState } from "react";
import { EXPENSE_CATEGORIES } from "@/lib/types";
import { useCustomCategories } from "@/lib/customCategories";
import { useLanguage } from "@/lib/i18n";
import { Card, SectionHeader, Button, Badge } from "@/components/ui";

const MAX = 20;
const DEFAULT_COLOR = "#6B7280";

function matchesBuiltin(name: string): boolean {
  const lower = name.trim().toLowerCase();
  return (EXPENSE_CATEGORIES as readonly string[]).some((c) => c.toLowerCase() === lower);
}

export default function CustomCategoriesSection({ userId }: { userId: string }) {
  const { t } = useLanguage();
  const { categories, reload } = useCustomCategories(userId);
  const [name, setName] = useState("");
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = name.trim();
  const builtinWarn = trimmed.length > 0 && matchesBuiltin(trimmed);
  const atLimit = categories.length >= MAX;
  const canAdd = trimmed.length > 0 && !builtinWarn && !atLimit && !busy;

  async function handleAdd() {
    if (!canAdd) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/custom-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, name: trimmed, color }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add");
      setName("");
      setColor(DEFAULT_COLOR);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.unknownError"));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(catName: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/custom-categories?userId=${encodeURIComponent(userId)}&name=${encodeURIComponent(catName)}`,
        { method: "DELETE" },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to remove");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.unknownError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <SectionHeader
        title={t("settings.customCategories")}
        meta={t("settings.customCatCountFmt", { count: categories.length, max: MAX })}
      />
      <Card padding={18}>
        <p style={{ fontSize: 13, color: "var(--color-ink-2)", margin: "0 0 12px", lineHeight: 1.5 }}>
          {t("settings.customCatDesc")}
        </p>

        {categories.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--color-ink-3)", margin: "0 0 12px" }}>
            {t("settings.customCatNone")}
          </p>
        ) : (
          <ul style={{ listStyle: "none", margin: "0 0 14px", padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            {categories.map((c) => (
              <li
                key={c.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 12px",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--color-line)",
                  background: "var(--color-surface)",
                }}
              >
                <span
                  aria-hidden
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 4,
                    background: c.color || DEFAULT_COLOR,
                    border: "1px solid var(--color-line-soft)",
                    flex: "0 0 auto",
                  }}
                />
                <span style={{ flex: 1, fontSize: 14, color: "var(--color-ink)" }}>{c.name}</span>
                <button
                  type="button"
                  onClick={() => handleDelete(c.name)}
                  disabled={busy}
                  className="text-xs"
                  style={{
                    padding: "4px 10px",
                    borderRadius: 999,
                    border: "1px solid var(--color-line)",
                    background: "var(--color-surface)",
                    color: "var(--color-ink-2)",
                    cursor: "pointer",
                  }}
                >
                  {t("budget.remove")}
                </button>
              </li>
            ))}
          </ul>
        )}

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("settings.customCatNamePlaceholder")}
            maxLength={40}
            className="fxt-focus"
            style={{
              flex: "1 1 160px",
              minWidth: 140,
              background: "var(--color-surface)",
              border: "1px solid var(--color-line)",
              borderRadius: "var(--radius-md)",
              padding: "10px 12px",
              fontSize: 14,
              color: "var(--color-ink)",
              outline: "none",
            }}
          />
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            aria-label={t("settings.customCatColor")}
            style={{
              width: 40,
              height: 40,
              padding: 0,
              border: "1px solid var(--color-line)",
              borderRadius: "var(--radius-md)",
              background: "var(--color-surface)",
              cursor: "pointer",
            }}
          />
          <Button variant="primary" size="md" onClick={handleAdd} disabled={!canAdd}>
            {t("settings.customCatAdd")}
          </Button>
        </div>

        {builtinWarn && (
          <div style={{ marginTop: 10 }}>
            <Badge tone="accent" size="sm">{t("settings.customCatBuiltinWarn")}</Badge>
          </div>
        )}
        {error && (
          <p style={{ fontSize: 12, color: "#b91c1c", margin: "10px 0 0" }}>{error}</p>
        )}
      </Card>
    </section>
  );
}
