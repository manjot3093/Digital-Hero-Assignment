import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import api, { ApiError } from '../../lib/api.js';
import Button from '../../components/ui/Button.jsx';
import { Field, FormError, Input } from '../../components/ui/Form.jsx';
import { Eyebrow, GlassPanel } from '../../components/ui/Panel.jsx';

/**
 * Registration. Password rules mirror the Zod schema on the server exactly, so
 * the hints here match what the API will actually accept.
 */
export default function Register() {
  const { register } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const plan = params.get('plan');

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    homeClub: '',
    handicap: '',
  });
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
      const payload = {
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        password: form.password,
      };
      if (form.homeClub) payload.homeClub = form.homeClub;
      if (form.handicap !== '') payload.handicap = Number(form.handicap);

      await register(payload);
      toast.success('Account created. Next: choose a cause and start your membership.');

      // Carrying the plan through means checkout can start straight away.
      if (plan) {
        try {
          const result = await api.post('/subscription/checkout', { planCode: plan });
          if (result?.checkoutUrl) {
            window.location.href = result.checkoutUrl;
            return;
          }
        } catch {
          // Checkout can be retried from the dashboard; registration succeeded.
        }
      }
      navigate('/dashboard', { replace: true });
    } catch (cause) {
      setError(cause);
      if (cause instanceof ApiError) setFieldErrors(cause.fieldErrors);
      setSubmitting(false);
    }
  };

  return (
    <section className="mx-auto grid w-full max-w-6xl gap-14 px-5 py-16 sm:px-8 lg:grid-cols-[0.9fr_1fr] lg:items-center lg:py-24">
      <div className="hidden lg:block">
        <Eyebrow>Join</Eyebrow>
        <h1 className="mt-5 text-headline text-ivory">
          Two minutes
          <br />
          to your first entry<span className="text-coral-500">.</span>
        </h1>
        <ol className="mt-10 space-y-5">
          {[
            { n: '01', t: 'Create your account', d: 'Name, email, password. Club and handicap are optional.' },
            { n: '02', t: 'Choose a cause', d: 'Set the share of every payment that funds it — 10% minimum.' },
            { n: '03', t: 'Log five scores', d: 'Your Stableford points become your ticket for the monthly draw.' },
          ].map((step) => (
            <li key={step.n} className="flex gap-5">
              <span className="font-mono text-sm text-mist-500">{step.n}</span>
              <div>
                <p className="font-display text-base font-medium text-ivory">{step.t}</p>
                <p className="mt-1 text-sm text-ivory-faint">{step.d}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <GlassPanel className="p-7 sm:p-9">
        <h2 className="font-display text-2xl font-semibold text-ivory">Create your account</h2>
        <p className="mt-2 text-sm text-ivory-faint">
          Already a member? <Link to="/login" className="text-jade-400 underline underline-offset-4">Sign in</Link>.
        </p>
        {plan && (
          <p className="mt-4 rounded-xl border border-gold-500/25 bg-gold-950/40 px-4 py-3 text-sm text-gold-400">
            The {plan} plan is selected — you will go straight to checkout after signing up.
          </p>
        )}

        <form onSubmit={submit} className="mt-7 space-y-5" noValidate>
          <FormError error={error} />

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="First name" error={fieldErrors.firstName} required>
              <Input
                required
                autoComplete="given-name"
                value={form.firstName}
                onChange={set('firstName')}
                invalid={Boolean(fieldErrors.firstName)}
              />
            </Field>
            <Field label="Last name" error={fieldErrors.lastName} required>
              <Input
                required
                autoComplete="family-name"
                value={form.lastName}
                onChange={set('lastName')}
                invalid={Boolean(fieldErrors.lastName)}
              />
            </Field>
          </div>

          <Field label="Email address" error={fieldErrors.email} required>
            <Input
              type="email"
              required
              autoComplete="email"
              value={form.email}
              onChange={set('email')}
              invalid={Boolean(fieldErrors.email)}
            />
          </Field>

          <Field
            label="Password"
            hint="10+ characters, upper and lower case, one number"
            error={fieldErrors.password}
            required
          >
            <Input
              type="password"
              required
              autoComplete="new-password"
              value={form.password}
              onChange={set('password')}
              invalid={Boolean(fieldErrors.password)}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Home club" hint="Optional" error={fieldErrors.homeClub}>
              <Input value={form.homeClub} onChange={set('homeClub')} placeholder="Lahinch Golf Club" />
            </Field>
            <Field label="Handicap" hint="Optional" error={fieldErrors.handicap}>
              <Input
                type="number"
                step="0.1"
                min="-10"
                max="54"
                inputMode="decimal"
                value={form.handicap}
                onChange={set('handicap')}
              />
            </Field>
          </div>

          <Button type="submit" size="lg" className="w-full" loading={submitting}>
            Create account
          </Button>

          <p className="text-xs leading-relaxed text-mist-400">
            Creating an account does not start a subscription. You choose a plan and a cause from your
            dashboard, and payments run through Stripe in test mode for this build.
          </p>
        </form>
      </GlassPanel>
    </section>
  );
}
