"use client";
import { useRef, useState } from "react";
import { useLanguage } from "@/lib/i18n";

type Props = {
  label: string;
  hint?: string;
  accept?: string;
  capture?: "user" | "environment";
  onFile: (dataUri: string, file: File) => void;
};

export default function UploadBox({ label, hint, accept = "image/*", capture, onFile }: Props) {
  const { t } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    const reader = new FileReader();
    reader.onload = () => {
      onFile(reader.result as string, file);
      setBusy(false);
    };
    reader.onerror = () => setBusy(false);
    reader.readAsDataURL(file);
  }

  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      disabled={busy}
      className="w-full p-6 border-2 border-dashed border-zinc-300 rounded-xl text-center bg-white hover:border-zinc-500 hover:bg-zinc-50 transition disabled:opacity-50"
    >
      <div className="text-base font-medium">{label}</div>
      <div className="text-xs text-zinc-500 mt-1">{busy ? t("upload.reading") : hint || t("upload.click")}</div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        capture={capture}
        className="hidden"
        onChange={handleChange}
      />
    </button>
  );
}
