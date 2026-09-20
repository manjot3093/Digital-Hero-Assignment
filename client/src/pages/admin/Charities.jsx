import { useState } from 'react';
import api, { ApiError } from '../../lib/api.js';
import useAsync from '../../lib/useAsync.js';
import { useToast } from '../../context/ToastContext.jsx';
import { date } from '../../lib/format.js';
import Button from '../../components/ui/Button.jsx';
import { PageHeader } from '../../components/ui/Panel.jsx';
import { Badge, EmptyState, ErrorState, LoadingPanel } from '../../components/ui/Feedback.jsx';
import { DataTable, Pagination } from '../../components/ui/DataTable.jsx';
import Modal, { ConfirmDialog } from '../../components/ui/Modal.jsx';
import { Field, FormError, Input, Textarea } from '../../components/ui/Form.jsx';

const EMPTY = {
  slug: '',
  name: '',
  tagline: '',
  description: '',
  category: '',
  region: '',
  heroImageUrl: '',
  logoUrl: '',
  websiteUrl: '',
  impactHeadline: '',
  isFeatured: false,
};

/** Directory administration: add, edit, feature, deactivate, and add events. */
export default function AdminCharities() {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [eventFor, setEventFor] = useState(null);
  const [deactivating, setDeactivating] = useState(null);
  const [busy, setBusy] = useState(false);

  const { data, loading, error, reload } = useAsync(
    () => api.get('/admin/charities', { query: { page, pageSize: 25, search } }),
    [page, search]
  );

  const deactivate = async () => {
    setBusy(true);
    try {
      await api.del(`/admin/charities/${deactivating.id}`);
      toast.success('Charity removed from the directory.');
      setDeactivating(null);
      await reload();
    } catch (cause) {
      toast.error(cause.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Charities"
        description="The directory members choose from. Deactivating hides a charity without deleting its contribution history."
        actions={
          <Button size="sm" onClick={() => setEditing(EMPTY)}>
            Add a charity
          </Button>
        }
      />

      <div className="mb-5 max-w-sm">
        <Input
          type="search"
          placeholder="Search the directory"
          onChange={(event) => {
            setPage(1);
            setSearch(event.target.value);
          }}
        />
      </div>

      {loading && <LoadingPanel rows={6} />}
      {error && <ErrorState error={error} onRetry={reload} />}

      {!loading && !error && (
        <>
          <DataTable
            rows={data.items}
            empty={
              <EmptyState
                icon="♥"
                title="No charities listed"
                description="Add the first organisation members can support."
                action={<Button onClick={() => setEditing(EMPTY)}>Add a charity</Button>}
              />
            }
            columns={[
              {
                key: 'name',
                header: 'Charity',
                render: (row) => (
                  <div>
                    <p className="text-ivory">{row.name}</p>
                    <p className="text-xs text-mist-400">{row.tagline}</p>
                  </div>
                ),
              },
              { key: 'category', header: 'Category' },
              { key: 'region', header: 'Region', render: (row) => row.region ?? '—' },
              {
                key: 'flags',
                header: 'State',
                render: (row) => (
                  <div className="flex flex-wrap gap-2">
                    {row.is_featured && <Badge tone="gold">Featured</Badge>}
                    <Badge tone={row.is_active ? 'jade' : 'mist'}>{row.is_active ? 'Listed' : 'Hidden'}</Badge>
                  </div>
                ),
              },
              { key: 'created_at', header: 'Added', render: (row) => date(row.created_at) },
              {
                key: 'actions',
                header: '',
                align: 'right',
                render: (row) => (
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setEditing({
                          id: row.id,
                          slug: row.slug,
                          name: row.name,
                          tagline: row.tagline ?? '',
                          description: row.description ?? '',
                          category: row.category ?? '',
                          region: row.region ?? '',
                          heroImageUrl: row.hero_image_url ?? '',
                          logoUrl: row.logo_url ?? '',
                          websiteUrl: row.website_url ?? '',
                          impactHeadline: row.impact_headline ?? '',
                          isFeatured: row.is_featured,
                        })
                      }
                    >
                      Edit
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setEventFor(row)}>
                      Event
                    </Button>
                    {row.is_active && (
                      <Button variant="ghost" size="sm" onClick={() => setDeactivating(row)}>
                        Hide
                      </Button>
                    )}
                  </div>
                ),
              },
            ]}
          />
          <Pagination
            page={data.pagination.page}
            pageCount={data.pagination.pageCount}
            total={data.pagination.total}
            onChange={setPage}
          />
        </>
      )}

      <CharityModal
        charity={editing}
        onClose={() => setEditing(null)}
        onSaved={async (message) => {
          setEditing(null);
          toast.success(message);
          await reload();
        }}
      />

      <EventModal
        charity={eventFor}
        onClose={() => setEventFor(null)}
        onSaved={async () => {
          setEventFor(null);
          toast.success('Event added.');
        }}
      />

      <ConfirmDialog
        open={Boolean(deactivating)}
        onClose={() => setDeactivating(null)}
        onConfirm={deactivate}
        loading={busy}
        title="Hide this charity?"
        description={
          deactivating
            ? `${deactivating.name} will no longer appear in the directory or be selectable. Existing contributions and member selections are untouched.`
            : ''
        }
        confirmLabel="Hide charity"
      />
    </>
  );
}

function CharityModal({ charity, onClose, onSaved }) {
  const isEdit = Boolean(charity?.id);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState(null);
  const [fields, setFields] = useState({});
  const [saving, setSaving] = useState(false);
  const [loadedFor, setLoadedFor] = useState(null);

  const key = charity?.id ?? (charity ? 'new' : null);
  if (charity && loadedFor !== key) {
    setLoadedFor(key);
    setForm(charity);
  }
  if (!charity && loadedFor !== null) setLoadedFor(null);

  const set = (name) => (event) =>
    setForm((current) => ({
      ...current,
      [name]: event.target.type === 'checkbox' ? event.target.checked : event.target.value,
    }));

  const submit = async () => {
    setSaving(true);
    setError(null);
    setFields({});
    try {
      // Empty optional URL fields must be omitted, not sent as "".
      const payload = {
        slug: form.slug,
        name: form.name,
        description: form.description,
        category: form.category,
        isFeatured: Boolean(form.isFeatured),
      };
      ['tagline', 'region', 'impactHeadline'].forEach((name) => {
        if (form[name]) payload[name] = form[name];
      });
      ['heroImageUrl', 'logoUrl', 'websiteUrl'].forEach((name) => {
        if (form[name]) payload[name] = form[name];
      });

      if (isEdit) {
        await api.put(`/admin/charities/${charity.id}`, payload);
        await onSaved(`${form.name} updated.`);
      } else {
        await api.post('/admin/charities', payload);
        await onSaved(`${form.name} added to the directory.`);
      }
    } catch (cause) {
      setError(cause);
      if (cause instanceof ApiError) setFields(cause.fieldErrors);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={Boolean(charity)}
      onClose={onClose}
      size="lg"
      title={isEdit ? 'Edit charity' : 'Add a charity'}
      description="Everything here appears on the public profile."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} loading={saving}>
            {isEdit ? 'Save changes' : 'Add charity'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <FormError error={error} />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" error={fields.name} required>
            <Input value={form.name} onChange={set('name')} invalid={Boolean(fields.name)} />
          </Field>
          <Field label="Slug" hint="lowercase-with-hyphens" error={fields.slug} required>
            <Input value={form.slug} onChange={set('slug')} invalid={Boolean(fields.slug)} />
          </Field>
        </div>

        <Field label="Tagline" hint="One line" error={fields.tagline}>
          <Input value={form.tagline} onChange={set('tagline')} maxLength={160} />
        </Field>

        <Field label="Description" hint="At least a paragraph" error={fields.description} required>
          <Textarea rows={5} value={form.description} onChange={set('description')} invalid={Boolean(fields.description)} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Category" error={fields.category} required>
            <Input value={form.category} onChange={set('category')} invalid={Boolean(fields.category)} />
          </Field>
          <Field label="Region" error={fields.region}>
            <Input value={form.region} onChange={set('region')} />
          </Field>
        </div>

        <Field label="Impact headline" error={fields.impactHeadline}>
          <Input value={form.impactHeadline} onChange={set('impactHeadline')} maxLength={160} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Hero image URL" error={fields.heroImageUrl}>
            <Input type="url" value={form.heroImageUrl} onChange={set('heroImageUrl')} />
          </Field>
          <Field label="Website URL" error={fields.websiteUrl}>
            <Input type="url" value={form.websiteUrl} onChange={set('websiteUrl')} />
          </Field>
        </div>

        <label className="flex items-center gap-3 text-sm text-ivory-dim">
          <input
            type="checkbox"
            checked={Boolean(form.isFeatured)}
            onChange={set('isFeatured')}
            className="h-4 w-4 rounded border-white/20 bg-ink-800 accent-gold-500"
          />
          Feature this charity on the homepage and at the top of the directory
        </label>
      </div>
    </Modal>
  );
}

function EventModal({ charity, onClose, onSaved }) {
  const [form, setForm] = useState({ title: '', description: '', venue: '', startsAt: '' });
  const [error, setError] = useState(null);
  const [fields, setFields] = useState({});
  const [saving, setSaving] = useState(false);

  const set = (name) => (event) => setForm((current) => ({ ...current, [name]: event.target.value }));

  const submit = async () => {
    setSaving(true);
    setError(null);
    setFields({});
    try {
      const payload = { title: form.title, startsAt: new Date(form.startsAt).toISOString() };
      if (form.description) payload.description = form.description;
      if (form.venue) payload.venue = form.venue;
      await api.post(`/admin/charities/${charity.id}/events`, payload);
      setForm({ title: '', description: '', venue: '', startsAt: '' });
      await onSaved();
    } catch (cause) {
      setError(cause);
      if (cause instanceof ApiError) setFields(cause.fieldErrors);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={Boolean(charity)}
      onClose={onClose}
      title="Add an event"
      description={charity ? `A fundraiser or golf day for ${charity.name}.` : ''}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} loading={saving} disabled={!form.title || !form.startsAt}>
            Add event
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <FormError error={error} />
        <Field label="Title" error={fields.title} required>
          <Input value={form.title} onChange={set('title')} />
        </Field>
        <Field label="Description" error={fields.description}>
          <Textarea rows={3} value={form.description} onChange={set('description')} maxLength={600} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Venue" error={fields.venue}>
            <Input value={form.venue} onChange={set('venue')} />
          </Field>
          <Field label="Starts" error={fields.startsAt} required>
            <Input type="datetime-local" value={form.startsAt} onChange={set('startsAt')} />
          </Field>
        </div>
      </div>
    </Modal>
  );
}
