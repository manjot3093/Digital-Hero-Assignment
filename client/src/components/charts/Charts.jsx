import {
  Area, AreaChart, Bar, BarChart, Cell, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { AXIS_PROPS, CHART, TOOLTIP_STYLE } from './chartTheme.js';
import { money, monthLabel, number } from '../../lib/format.js';
import { EmptyState } from '../ui/Feedback.jsx';

/**
 * Every chart here renders data fetched from /api/admin/reports, which is
 * computed by SQL aggregates. Nothing is generated in the browser.
 */
function Frame({ title, subtitle, children, hasData, emptyHint, height = 260 }) {
  return (
    <section className="solid-panel p-5 sm:p-6">
      <header className="mb-5">
        <h3 className="font-display text-base font-semibold text-ivory">{title}</h3>
        {subtitle && <p className="mt-1 text-xs text-ivory-faint">{subtitle}</p>}
      </header>
      {hasData ? (
        <div style={{ width: '100%', height }}>
          <ResponsiveContainer width="100%" height="100%">
            {children}
          </ResponsiveContainer>
        </div>
      ) : (
        <EmptyState
          icon="▱"
          title="No data yet"
          description={emptyHint ?? 'This chart fills in as the platform records activity.'}
          className="border-0 bg-transparent py-8"
        />
      )}
    </section>
  );
}

export function SubscriberGrowthChart({ data = [] }) {
  return (
    <Frame
      title="Member growth"
      subtitle="Cumulative accounts, last 12 months"
      hasData={data.length > 0}
      emptyHint="Growth appears once accounts have been created."
    >
      <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
        <defs>
          <linearGradient id="growthFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART.jade} stopOpacity={0.45} />
            <stop offset="100%" stopColor={CHART.jade} stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="month" tickFormatter={monthLabel} {...AXIS_PROPS} />
        <YAxis {...AXIS_PROPS} width={46} allowDecimals={false} />
        <Tooltip
          {...TOOLTIP_STYLE}
          labelFormatter={monthLabel}
          formatter={(value, key) => [number(value), key === 'total' ? 'Total members' : 'New signups']}
        />
        <Area type="monotone" dataKey="total" stroke={CHART.jade} strokeWidth={2} fill="url(#growthFill)" />
        <Line type="monotone" dataKey="signups" stroke={CHART.gold} strokeWidth={1.5} dot={false} />
      </AreaChart>
    </Frame>
  );
}

export function CharityContributionChart({ data = [] }) {
  return (
    <Frame
      title="Charity contributions"
      subtitle="Recorded against subscription payments, by month"
      hasData={data.some((row) => row.amountMinor > 0)}
      emptyHint="Contributions are written when a payment succeeds."
    >
      <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -10 }}>
        <XAxis dataKey="month" tickFormatter={monthLabel} {...AXIS_PROPS} />
        <YAxis {...AXIS_PROPS} width={58} tickFormatter={(value) => money(value, { compact: true })} />
        <Tooltip
          {...TOOLTIP_STYLE}
          labelFormatter={monthLabel}
          formatter={(value) => [money(value), 'Raised']}
        />
        <Bar dataKey="amountMinor" fill={CHART.jade} radius={[6, 6, 0, 0]} maxBarSize={38} />
      </BarChart>
    </Frame>
  );
}

export function PrizePoolChart({ data = [] }) {
  return (
    <Frame
      title="Prize pool history"
      subtitle="Pool value per published draw"
      hasData={data.length > 0}
      emptyHint="Each published draw adds a point here."
    >
      <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -10 }}>
        <XAxis dataKey="month" tickFormatter={monthLabel} {...AXIS_PROPS} />
        <YAxis {...AXIS_PROPS} width={58} tickFormatter={(value) => money(value, { compact: true })} />
        <Tooltip
          {...TOOLTIP_STYLE}
          labelFormatter={monthLabel}
          formatter={(value) => [money(value), 'Pool']}
        />
        <Line type="monotone" dataKey="totalMinor" stroke={CHART.gold} strokeWidth={2.2} dot={{ r: 3, fill: CHART.gold }} />
      </LineChart>
    </Frame>
  );
}

export function ParticipationChart({ data = [] }) {
  return (
    <Frame
      title="Draw participation"
      subtitle="Entries against entitled members"
      hasData={data.length > 0}
    >
      <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
        <XAxis dataKey="month" tickFormatter={monthLabel} {...AXIS_PROPS} />
        <YAxis {...AXIS_PROPS} width={46} allowDecimals={false} />
        <Tooltip {...TOOLTIP_STYLE} labelFormatter={monthLabel} />
        <Legend wrapperStyle={{ fontSize: 11, color: CHART.axis }} />
        <Bar name="Entries" dataKey="entries" fill={CHART.jade} radius={[6, 6, 0, 0]} maxBarSize={22} />
        <Bar name="Subscribers" dataKey="subscribers" fill={CHART.mist} radius={[6, 6, 0, 0]} maxBarSize={22} />
      </BarChart>
    </Frame>
  );
}

export function WinnerDistributionChart({ data = [] }) {
  const palette = { 5: CHART.gold, 4: CHART.coral, 3: CHART.jade };
  const rows = data.map((row) => ({ ...row, label: `${row.matchCount}-match` }));
  return (
    <Frame
      title="Winner distribution"
      subtitle="Wins recorded by match tier"
      hasData={rows.length > 0}
      emptyHint="Winners appear once a draw has been published."
    >
      <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 8 }}>
        <XAxis type="number" {...AXIS_PROPS} allowDecimals={false} />
        <YAxis type="category" dataKey="label" {...AXIS_PROPS} width={72} />
        <Tooltip
          {...TOOLTIP_STYLE}
          formatter={(value, _key, entry) => [`${number(value)} · ${money(entry.payload.amountMinor)}`, 'Winners']}
        />
        <Bar dataKey="count" radius={[0, 6, 6, 0]} maxBarSize={26}>
          {rows.map((row) => (
            <Cell key={row.matchCount} fill={palette[row.matchCount] ?? CHART.mist} />
          ))}
        </Bar>
      </BarChart>
    </Frame>
  );
}

export function PlanSplitChart({ data = [] }) {
  const palette = [CHART.jade, CHART.gold, CHART.coral];
  return (
    <Frame
      title="Plan mix"
      subtitle="Active subscriptions by plan"
      hasData={data.some((row) => row.count > 0)}
      height={240}
    >
      <PieChart>
        <Pie
          data={data}
          dataKey="count"
          nameKey="name"
          innerRadius={58}
          outerRadius={88}
          paddingAngle={3}
          stroke="none"
        >
          {data.map((row, index) => (
            <Cell key={row.code} fill={palette[index % palette.length]} />
          ))}
        </Pie>
        <Tooltip {...TOOLTIP_STYLE} formatter={(value, name) => [number(value), name]} />
        <Legend wrapperStyle={{ fontSize: 11, color: CHART.axis }} />
      </PieChart>
    </Frame>
  );
}

export function ScoreSpreadChart({ data = [] }) {
  return (
    <Frame
      title="Stableford spread"
      subtitle="Retained scores across the membership"
      hasData={data.some((row) => row.count > 0)}
      height={240}
    >
      <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
        <XAxis dataKey="bucket" {...AXIS_PROPS} />
        <YAxis {...AXIS_PROPS} width={46} allowDecimals={false} />
        <Tooltip {...TOOLTIP_STYLE} formatter={(value) => [number(value), 'Scores']} />
        <Bar dataKey="count" fill={CHART.coral} radius={[6, 6, 0, 0]} maxBarSize={44} />
      </BarChart>
    </Frame>
  );
}

export function TopCharitiesChart({ data = [] }) {
  return (
    <Frame
      title="Leading causes"
      subtitle="Total raised per charity"
      hasData={data.some((row) => row.amountMinor > 0)}
      height={260}
    >
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 8 }}>
        <XAxis type="number" {...AXIS_PROPS} tickFormatter={(value) => money(value, { compact: true })} />
        <YAxis type="category" dataKey="name" {...AXIS_PROPS} width={132} />
        <Tooltip {...TOOLTIP_STYLE} formatter={(value) => [money(value), 'Raised']} />
        <Bar dataKey="amountMinor" fill={CHART.jadeSoft} radius={[0, 6, 6, 0]} maxBarSize={22} />
      </BarChart>
    </Frame>
  );
}
