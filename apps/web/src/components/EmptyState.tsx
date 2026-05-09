import { ReactNode } from 'react';

/**
 * U5 — generic empty-state card.
 *
 * Used when an API returned an empty array, a feature was disabled, or a
 * fetch failed. Shows a small SVG illustration + headline + description
 * + optional CTA. Designed to be friendly without being childish — fits
 * an exam-school context.
 */
export function EmptyState({
  variant = 'default',
  title,
  description,
  action,
  className = '',
}: {
  variant?: 'default' | 'no-paper' | 'no-history' | 'no-attendance' | 'no-students' | 'offline';
  title: string;
  description?: ReactNode;
  action?: { label: string; onClick: () => void };
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`max-w-md mx-auto py-10 px-6 text-center text-gray-700 ${className}`}
    >
      <EmptyIllustration variant={variant} />
      <h3 className="mt-4 text-lg font-semibold text-gray-900">{title}</h3>
      {description && (
        <p className="mt-1 text-sm text-gray-600 leading-relaxed">{description}</p>
      )}
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

function EmptyIllustration({ variant }: { variant: string }) {
  // Minimal monoline SVG illustrations. Each variant gives the user a
  // visual hint of what's actually missing without resorting to emoji
  // (emojis read inconsistently across iOS / Android / Windows).
  switch (variant) {
    case 'no-paper':
      return (
        <svg className="mx-auto" width="72" height="72" viewBox="0 0 72 72" aria-hidden>
          <rect x="14" y="10" width="44" height="52" rx="4" fill="#fef3c7" stroke="#d97706" strokeWidth="2" />
          <line x1="22" y1="22" x2="48" y2="22" stroke="#92400e" strokeWidth="2" strokeLinecap="round" />
          <line x1="22" y1="32" x2="40" y2="32" stroke="#92400e" strokeWidth="2" strokeLinecap="round" />
          <circle cx="36" cy="50" r="6" fill="none" stroke="#92400e" strokeWidth="2" />
          <line x1="36" y1="46" x2="36" y2="54" stroke="#92400e" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case 'no-history':
      return (
        <svg className="mx-auto" width="72" height="72" viewBox="0 0 72 72" aria-hidden>
          <circle cx="36" cy="36" r="22" fill="#e0e7ff" stroke="#4338ca" strokeWidth="2" />
          <line x1="36" y1="22" x2="36" y2="36" stroke="#4338ca" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="36" y1="36" x2="46" y2="42" stroke="#4338ca" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      );
    case 'no-attendance':
      return (
        <svg className="mx-auto" width="72" height="72" viewBox="0 0 72 72" aria-hidden>
          <rect x="12" y="14" width="48" height="44" rx="3" fill="#dcfce7" stroke="#16a34a" strokeWidth="2" />
          <line x1="20" y1="26" x2="52" y2="26" stroke="#16a34a" strokeWidth="2" />
          <line x1="20" y1="36" x2="52" y2="36" stroke="#16a34a" strokeWidth="2" />
          <line x1="20" y1="46" x2="40" y2="46" stroke="#16a34a" strokeWidth="2" />
        </svg>
      );
    case 'no-students':
      return (
        <svg className="mx-auto" width="72" height="72" viewBox="0 0 72 72" aria-hidden>
          <circle cx="36" cy="26" r="9" fill="#fee2e2" stroke="#b91c1c" strokeWidth="2" />
          <path d="M18 56 c0 -10 8 -16 18 -16 s18 6 18 16" fill="none" stroke="#b91c1c" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case 'offline':
      return (
        <svg className="mx-auto" width="72" height="72" viewBox="0 0 72 72" aria-hidden>
          <path d="M14 36 a22 22 0 0 1 44 0" fill="none" stroke="#737373" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="14" y1="14" x2="58" y2="58" stroke="#dc2626" strokeWidth="3" strokeLinecap="round" />
          <circle cx="36" cy="48" r="3" fill="#dc2626" />
        </svg>
      );
    default:
      return (
        <svg className="mx-auto" width="72" height="72" viewBox="0 0 72 72" aria-hidden>
          <circle cx="36" cy="36" r="24" fill="#f3f4f6" stroke="#9ca3af" strokeWidth="2" />
          <line x1="28" y1="38" x2="44" y2="38" stroke="#6b7280" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      );
  }
}
