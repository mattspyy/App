import Link from "next/link";

type Props = {
  icon?: string;
  title: string;
  description?: string;
  ctaHref?: string;
  ctaLabel?: string;
};

export default function EmptyState({ icon = "✨", title, description, ctaHref, ctaLabel }: Props) {
  return (
    <div className="border border-dashed border-zinc-300 rounded-xl p-8 text-center bg-white">
      <div className="text-3xl mb-2" aria-hidden>{icon}</div>
      <div className="text-base font-medium text-zinc-900">{title}</div>
      {description && <div className="text-sm text-zinc-500 mt-1">{description}</div>}
      {ctaHref && ctaLabel && (
        <Link
          href={ctaHref}
          className="inline-block mt-4 bg-zinc-900 text-white text-sm px-4 py-2 rounded-md hover:bg-zinc-800 transition"
        >
          {ctaLabel}
        </Link>
      )}
    </div>
  );
}
