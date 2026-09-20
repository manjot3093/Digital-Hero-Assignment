import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../../lib/api.js';
import useAsync from '../../lib/useAsync.js';
import { money, number } from '../../lib/format.js';
import { Eyebrow, GlassPanel } from '../../components/ui/Panel.jsx';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/Feedback.jsx';
import { Input } from '../../components/ui/Form.jsx';
import Reveal from '../../components/ui/Reveal.jsx';

/** Directory with search, category filtering and a featured-only toggle. */
export default function Charities() {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get('search') ?? '');
  const category = params.get('category') ?? '';
  const featuredOnly = params.get('featured') === '1';

  const { data, loading, error, reload } = useAsync(
    () =>
      api.get('/charities', {
        query: {
          search: params.get('search') ?? '',
          category: category || undefined,
          featured: featuredOnly ? true : undefined,
          pageSize: 48,
        },
      }),
    [params.toString()]
  );

  const impact = useAsync(() => api.get('/charities/impact'), []);

  const charities = data?.charities ?? [];
  const featured = useMemo(() => charities.filter((item) => item.is_featured), [charities]);
  const rest = useMemo(() => charities.filter((item) => !item.is_featured), [charities]);

  const update = (next) => {
    const merged = new URLSearchParams(params);
    Object.entries(next).forEach(([key, value]) => {
      if (value) merged.set(key, value);
      else merged.delete(key);
    });
    setParams(merged, { replace: true });
  };

  return (
    <>
      <section className="mx-auto w-full max-w-7xl px-5 pb-10 pt-16 sm:px-8">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
          <div>
            <Eyebrow>Charity directory</Eyebrow>
            <h1 className="mt-5 text-display text-ivory">
              Choose who
              <br />
              your golf funds<span className="text-jade-400">.</span>
            </h1>
            <p className="mt-6 max-w-xl leading-relaxed text-ivory-dim">
              Every member directs a share of their subscription to one of these organisations. You can
              also give directly, without subscribing, from any profile below.
            </p>
          </div>

          <GlassPanel className="grid grid-cols-3 gap-4 p-6">
            {[
              { label: 'Raised', value: money(impact.data?.totalMinor ?? 0, { compact: true }), tone: 'text-jade-400' },
              { label: 'Causes', value: number(impact.data?.charitiesSupported ?? 0), tone: 'text-ivory' },
              { label: 'Givers', value: number(impact.data?.contributors ?? 0), tone: 'text-ivory' },
            ].map((item) => (
              <div key={item.label}>
                <p className="eyebrow">{item.label}</p>
                <p className={`numeric mt-2 font-display text-2xl font-semibold ${item.tone}`}>{item.value}</p>
              </div>
            ))}
          </GlassPanel>
        </div>
      </section>

      {/* Filters */}
      <section className="sticky top-16 z-30 border-y border-white/[0.07] bg-ink-900/85 backdrop-blur-panel">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-5 py-4 sm:px-8 lg:flex-row lg:items-center">
          <form
            className="flex-1"
            onSubmit={(event) => {
              event.preventDefault();
              update({ search });
            }}
          >
            <label className="sr-only" htmlFor="charity-search">Search charities</label>
            <Input
              id="charity-search"
              type="search"
              value={search}
              placeholder="Search by name, cause or description"
              onChange={(event) => setSearch(event.target.value)}
              onBlur={() => update({ search })}
            />
          </form>

          <div className="-mx-1 flex gap-1.5 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => update({ category: '', featured: '' })}
              className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm transition-colors ${
                !category && !featuredOnly ? 'bg-white/[0.09] text-ivory' : 'text-ivory-faint hover:text-ivory'
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => update({ featured: featuredOnly ? '' : '1', category: '' })}
              className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm transition-colors ${
                featuredOnly ? 'bg-gold-950 text-gold-400' : 'text-ivory-faint hover:text-ivory'
              }`}
            >
              Featured
            </button>
            {(data?.categories ?? []).map((item) => (
              <button
                key={item.category}
                type="button"
                onClick={() => update({ category: category === item.category ? '' : item.category, featured: '' })}
                className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm transition-colors ${
                  category === item.category ? 'bg-jade-950 text-jade-400' : 'text-ivory-faint hover:text-ivory'
                }`}
              >
                {item.category}
                <span className="ml-1.5 text-xs text-mist-500">{item.count}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-5 py-12 sm:px-8">
        {error && <ErrorState error={error} onRetry={reload} />}

        {loading && (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-80" />
            ))}
          </div>
        )}

        {!loading && !error && charities.length === 0 && (
          <EmptyState
            icon="⌕"
            title="No charities match that search"
            description="Try a different term, or clear the filters to see the whole directory."
            action={
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setParams(new URLSearchParams(), { replace: true });
                }}
                className="rounded-xl border border-white/15 px-4 py-2 text-sm text-ivory transition-colors hover:bg-white/[0.06]"
              >
                Clear filters
              </button>
            }
          />
        )}

        {!loading && !error && charities.length > 0 && (
          <>
            {featured.length > 0 && !category && (
              <div className="mb-12">
                <p className="eyebrow mb-5">Featured</p>
                <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                  {featured.map((charity, index) => (
                    <CharityCard key={charity.id} charity={charity} delay={index * 0.05} highlight />
                  ))}
                </div>
              </div>
            )}

            {rest.length > 0 && (
              <>
                {featured.length > 0 && !category && <p className="eyebrow mb-5">All causes</p>}
                <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                  {rest.map((charity, index) => (
                    <CharityCard key={charity.id} charity={charity} delay={index * 0.04} />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </section>
    </>
  );
}

function CharityCard({ charity, delay = 0, highlight = false }) {
  return (
    <Reveal delay={delay}>
      <Link
        to={`/charities/${charity.slug}`}
        className={`group flex h-full flex-col overflow-hidden rounded-panel border bg-ink-700/55 transition-colors ${
          highlight ? 'border-gold-500/25 hover:border-gold-500/50' : 'border-white/[0.08] hover:border-jade-500/40'
        }`}
      >
        <div className="relative h-44 overflow-hidden bg-ink-600">
          {charity.hero_image_url ? (
            <img
              src={charity.hero_image_url}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover opacity-85 transition-transform duration-700 group-hover:scale-[1.04]"
            />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-jade-950 via-ink-700 to-ink-600" />
          )}
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 bg-gradient-to-t from-ink-900 to-transparent px-4 pb-3 pt-10">
            <span className="rounded-full border border-white/15 bg-ink-900/70 px-2.5 py-1 font-mono text-[0.6rem] uppercase tracking-[0.12em] text-ivory-dim">
              {charity.category}
            </span>
            {charity.region && <span className="text-xs text-ivory-faint">{charity.region}</span>}
          </div>
        </div>

        <div className="flex flex-1 flex-col p-5">
          <h3 className="font-display text-lg font-semibold text-ivory">{charity.name}</h3>
          <p className="mt-2 flex-1 text-sm leading-relaxed text-ivory-faint">{charity.tagline}</p>
          <div className="mt-5 flex items-center justify-between border-t border-white/[0.06] pt-4 text-sm">
            <span className="text-jade-400">{money(charity.raised_minor, { compact: true })} raised</span>
            <span className="text-ivory-faint">{number(charity.supporter_count)} members</span>
          </div>
        </div>
      </Link>
    </Reveal>
  );
}
