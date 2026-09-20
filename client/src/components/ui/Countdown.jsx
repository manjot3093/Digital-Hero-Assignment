import { useEffect, useState } from 'react';

function remaining(target) {
  const ms = new Date(target).getTime() - Date.now();
  if (Number.isNaN(ms) || ms <= 0) return null;
  return {
    days: Math.floor(ms / 86_400_000),
    hours: Math.floor((ms % 86_400_000) / 3_600_000),
    minutes: Math.floor((ms % 3_600_000) / 60_000),
    seconds: Math.floor((ms % 60_000) / 1000),
  };
}

/** Countdown to the next draw. Ticks once a second and stops at zero. */
export function Countdown({ target, label = 'Draw closes in', compact = false }) {
  const [left, setLeft] = useState(() => remaining(target));

  useEffect(() => {
    setLeft(remaining(target));
    const timer = window.setInterval(() => setLeft(remaining(target)), 1000);
    return () => window.clearInterval(timer);
  }, [target]);

  if (!left) {
    return <p className="text-sm text-ivory-faint">{label.replace(/ in$/, '')} — closed</p>;
  }

  const units = [
    { value: left.days, suffix: 'd' },
    { value: left.hours, suffix: 'h' },
    { value: left.minutes, suffix: 'm' },
    { value: left.seconds, suffix: 's' },
  ];

  if (compact) {
    return (
      <span className="numeric font-mono text-sm text-gold-400">
        {units.map((unit) => `${String(unit.value).padStart(2, '0')}${unit.suffix}`).join(' ')}
      </span>
    );
  }

  return (
    <div>
      <p className="eyebrow mb-3">{label}</p>
      <div className="flex gap-2.5">
        {units.map((unit) => (
          <div
            key={unit.suffix}
            className="min-w-[3.6rem] rounded-xl border border-white/[0.09] bg-ink-800/80 px-3 py-2.5 text-center"
          >
            <span className="numeric block font-display text-2xl font-semibold text-ivory">
              {String(unit.value).padStart(2, '0')}
            </span>
            <span className="mt-0.5 block font-mono text-[0.6rem] uppercase tracking-[0.14em] text-mist-400">
              {unit.suffix}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Countdown;
