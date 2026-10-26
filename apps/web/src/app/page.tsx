import { SchemeToggle } from "@/components/scheme-toggle";

/**
 * Bootstrap check page: the same card as apps/mobile/src/app/index.tsx with the same token classes,
 * so web and native can be compared. Replaced by the public site's home page later.
 */
export default function Home() {
  return (
    <main className="flex flex-col gap-4 p-6" data-testid="tokens-screen">
      <div className="flex flex-col gap-2 rounded-lg border border-subtle bg-surface-elevated p-4 shadow-sm" data-testid="tokens-card">
        <p className="text-lg font-semibold text-primary" data-testid="tokens-title">
          AMPM tokens
        </p>
        <p className="text-base text-muted" data-testid="tokens-body">
          Surface, text, border and brand colours from @ampm/tokens.
        </p>
        <div className="flex flex-row flex-wrap gap-2 pt-2">
          <span className="rounded-full bg-success-soft px-3 py-1 text-sm font-medium text-success">Verified</span>
          <span className="rounded-full bg-warning-soft px-3 py-1 text-sm font-medium text-warning">Awaiting confirmation</span>
          <span className="rounded-full bg-danger-soft px-3 py-1 text-sm font-medium text-danger">Conflict</span>
          <span className="rounded-full bg-info-soft px-3 py-1 text-sm font-medium text-info">Indicative</span>
        </div>
        <SchemeToggle />
      </div>
      <div className="rounded-lg bg-surface-inset p-4">
        <p className="font-mono text-sm text-primary">bg-surface-inset · text-primary · font-mono</p>
      </div>
    </main>
  );
}
