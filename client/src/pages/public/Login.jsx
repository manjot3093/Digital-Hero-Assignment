import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { ApiError } from '../../lib/api.js';
import Button from '../../components/ui/Button.jsx';
import { Field, FormError, Input } from '../../components/ui/Form.jsx';
import { Eyebrow, GlassPanel } from '../../components/ui/Panel.jsx';

/**
 * Sign in. The API returns a deliberately vague message for a bad email or a
 * bad password — it never confirms whether an address is registered.
 */
export default function Login() {
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setFieldErrors({});
    try {
      const user = await login(form);
      toast.success(`Welcome back, ${user.firstName}.`);
      const target = location.state?.from ?? (user.role === 'admin' ? '/admin' : '/dashboard');
      navigate(target, { replace: true });
    } catch (cause) {
      setError(cause);
      if (cause instanceof ApiError) setFieldErrors(cause.fieldErrors);
      setSubmitting(false);
    }
  };

  return (
    <section className="mx-auto grid w-full max-w-6xl gap-14 px-5 py-16 sm:px-8 lg:grid-cols-[1fr_0.9fr] lg:items-center lg:py-24">
      <div className="hidden lg:block">
        <Eyebrow>Members</Eyebrow>
        <h1 className="mt-5 text-headline text-ivory">
          Back for
          <br />
          another round<span className="text-jade-400">.</span>
        </h1>
        <p className="mt-6 max-w-md leading-relaxed text-ivory-dim">
          Log a score, adjust your charity share, check your numbers against the latest draw, or follow a
          claim through verification.
        </p>
        <ul className="mt-10 space-y-3 text-sm text-ivory-faint">
          <li className="flex gap-3"><span className="text-jade-400">→</span> Your last five Stableford rounds</li>
          <li className="flex gap-3"><span className="text-gold-400">→</span> This month&apos;s ticket and pool</li>
          <li className="flex gap-3"><span className="text-coral-400">→</span> Contribution history for your cause</li>
        </ul>
      </div>

      <GlassPanel as="div" className="p-7 sm:p-9">
        <h2 className="font-display text-2xl font-semibold text-ivory">Sign in</h2>
        <p className="mt-2 text-sm text-ivory-faint">
          No account yet? <Link to="/register" className="text-jade-400 underline underline-offset-4">Create one</Link>.
        </p>

        <form onSubmit={submit} className="mt-7 space-y-5" noValidate>
          <FormError error={error} />

          <Field label="Email address" error={fieldErrors.email} required>
            <Input
              type="email"
              name="email"
              autoComplete="email"
              required
              value={form.email}
              onChange={set('email')}
              invalid={Boolean(fieldErrors.email)}
              placeholder="you@example.com"
            />
          </Field>

          <Field label="Password" error={fieldErrors.password} required>
            <Input
              type="password"
              name="password"
              autoComplete="current-password"
              required
              value={form.password}
              onChange={set('password')}
              invalid={Boolean(fieldErrors.password)}
            />
          </Field>

          <Button type="submit" size="lg" className="w-full" loading={submitting}>
            Sign in
          </Button>
        </form>

        <div className="mt-7 rounded-xl border border-white/[0.08] bg-ink-800/60 px-4 py-3.5 text-xs leading-relaxed text-mist-400">
          <p className="mb-1.5 font-mono uppercase tracking-[0.12em] text-ivory-faint">Demo credentials</p>
          Administrator: admin@digitalheroes.test<br />
          Member: amara.okafor@example.test<br />
          Password for every seeded account: DigitalHeroes2026!
        </div>
      </GlassPanel>
    </section>
  );
}
