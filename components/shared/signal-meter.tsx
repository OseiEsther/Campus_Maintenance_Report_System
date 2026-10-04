import { cn } from '@/lib/utils';
import { BadgeCheck, Camera } from 'lucide-react';
import type { VerificationSignal, Corroboration } from '@/lib/types';

type Tier = 'new' | 'building' | 'strong' | 'verified';

function getTier(score: number): Tier {
  if (score >= 18) return 'verified';
  if (score >= 12) return 'strong';
  if (score >= 6) return 'building';
  return 'new';
}

const tierLabel: Record<Tier, string> = {
  new: 'New',
  building: 'Building',
  strong: 'Strong',
  verified: 'Verified',
};

const barColor: Record<Tier, string> = {
  new: 'bg-zinc-300',
  building: 'bg-blue-600',
  strong: 'bg-emerald-600',
  verified: 'bg-emerald-600',
};

const textColor: Record<Tier, string> = {
  new: 'text-zinc-500',
  building: 'text-blue-700',
  strong: 'text-emerald-700',
  verified: 'text-emerald-700',
};

function getBars(tier: Tier): number {
  return { new: 1, building: 2, strong: 3, verified: 4 }[tier];
}

export function SignalMeter({
  score,
  className,
  size = 'sm',
  showNumber = false,
}: {
  score: number;
  className?: string;
  size?: 'sm' | 'md';
  showNumber?: boolean;
}) {
  const tier = getTier(score);
  const filled = getBars(tier);

  return (
    <span
      className={cn('inline-flex items-center gap-1.5', className)}
      title={`Verification signal score: ${score}`}
    >
      <span className="flex items-end gap-0.5">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={cn(
              'w-1 rounded-xs transition-all',
              i < filled ? barColor[tier] : 'bg-zinc-200'
            )}
            style={{ height: size === 'sm' ? 4 + i * 2 : 6 + i * 3 }}
          />
        ))}
      </span>
      <span
        className={cn(
          'font-medium tracking-tight',
          textColor[tier],
          size === 'sm' ? 'text-[11px]' : 'text-xs'
        )}
      >
        {tierLabel[tier]}
      </span>
      {showNumber && (
        <span
          className={cn(
            'font-mono text-zinc-600 font-semibold',
            size === 'sm' ? 'text-[11px]' : 'text-xs'
          )}
        >
          {score}
        </span>
      )}
    </span>
  );
}

export function VerificationBreakdown({
  signals,
  corroborations,
  photoUrl,
}: {
  signals: VerificationSignal[];
  corroborations: Corroboration[];
  photoUrl: string | null;
}) {
  const corroborationSignals = signals.filter((s) =>
    s.label.toLowerCase().includes('corroborat')
  );
  const repSignals = signals.filter((s) =>
    s.label.toLowerCase().includes('rep-confirmed')
  );
  const photoSignals = signals.filter((s) =>
    s.label.toLowerCase().includes('photo')
  );
  const otherSignals = signals.filter(
    (s) =>
      !s.label.toLowerCase().includes('corroborat') &&
      !s.label.toLowerCase().includes('rep-confirmed') &&
      !s.label.toLowerCase().includes('photo')
  );

  return (
    <div className="space-y-2">
      {corroborations.length > 0 && (
        <div className="flex items-center gap-3 rounded-md bg-muted/40 px-3 py-2.5">
          <div className="flex -space-x-2">
            {corroborations.slice(0, 3).map((c) => (
              <div
                key={c.id}
                className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-card bg-primary/10 text-xs font-semibold text-primary"
              >
                {c.student_name.charAt(0)}
              </div>
            ))}
            {corroborations.length > 3 && (
              <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-card bg-muted text-xs font-medium text-muted-foreground">
                +{corroborations.length - 3}
              </div>
            )}
          </div>
          <span className="text-sm text-foreground">
            Confirmed by {corroborations.length}{' '}
            {corroborations.length === 1 ? 'person' : 'people'}
          </span>
          {corroborationSignals.length > 0 && (
            <span className="ml-auto text-sm font-semibold text-primary">
              +{corroborationSignals.reduce((sum, s) => sum + s.points, 0)}
            </span>
          )}
        </div>
      )}

      {repSignals.length > 0 && (
        <div className="flex items-center gap-2 rounded-md bg-muted/40 px-3 py-2.5">
          <BadgeCheck className="h-4 w-4 text-accent-teal" />
          <span className="text-sm text-foreground">Confirmed by Hall Rep</span>
          <span className="ml-auto text-sm font-semibold text-primary">
            +{repSignals.reduce((sum, s) => sum + s.points, 0)}
          </span>
        </div>
      )}

      {photoUrl ? (
        <div className="flex items-center gap-2 rounded-md bg-muted/40 px-3 py-2.5">
          <img
            src={photoUrl}
            alt=""
            className="h-8 w-8 rounded-md border border-border object-cover"
          />
          <span className="text-sm text-foreground">Photo attached</span>
          {photoSignals.length > 0 && (
            <span className="ml-auto text-sm font-semibold text-primary">
              +{photoSignals.reduce((sum, s) => sum + s.points, 0)}
            </span>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-md bg-muted/40 px-3 py-2.5">
          <Camera className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">No photo attached</span>
        </div>
      )}

      {otherSignals.map((signal) => (
        <div
          key={signal.id}
          className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2"
        >
          <span className="text-sm text-foreground">{signal.label}</span>
          <span className="text-sm font-semibold text-primary">
            +{signal.points}
          </span>
        </div>
      ))}
    </div>
  );
}
