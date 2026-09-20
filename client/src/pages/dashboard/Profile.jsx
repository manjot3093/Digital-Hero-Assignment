import { useEffect, useState } from 'react';
import api, { ApiError } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { date } from '../../lib/format.js';
import Button from '../../components/ui/Button.jsx';
import { PageHeader, Eyebrow, GlassPanel } from '../../components/ui/Panel.jsx';
import { Field, FormError, Input } from '../../components/ui/Form.jsx';
import { Badge } from '../../components/ui/Feedback.jsx';

/** Profile details and password change. Both hit their own validated endpoint. */
export default function DashboardProfile() {
  const { user, refreshUser, logout } = useAuth();
  const toast = useToast();

  const [profile, setProfile] = useState({ firstName: '', lastName: '', homeClub: '', handicap: '' });
  const [profileError, setProfileError] = useState(null);
  const [profileFields, setProfileFields] = useState({});
  const [savingProfile, setSavingProfile] = useState(false);

  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '' });
  const [passwordError, setPasswordError] = useState(null);
  const [passwordFields, setPasswordFields] = useState({});
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (!user) return;
    setProfile({
      firstName: user.firstName ?? '',
      lastName: user.lastName ?? '',
      homeClub: user.homeClub ?? '',
      handicap: user.handicap ?? '',
    });
  }, [user]);

  const saveProfile = async (event) => {
    event.preventDefault();
    setSavingProfile(true);
    setProfileError(null);
    setProfileFields({});
    try {
      await api.put('/users/me', {
        firstName: profile.firstName,
        lastName: profile.lastName,
        homeClub: profile.homeClub || null,
        handicap: profile.handicap === '' ? null : Number(profile.handicap),
      });
      await refreshUser();
      toast.success('Profile updated.');
    } catch (cause) {
      setProfileError(cause);
      if (cause instanceof ApiError) setProfileFields(cause.fieldErrors);
    } finally {
      setSavingProfile(false);
    }
  };

  const savePassword = async (event) => {
    event.preventDefault();
    setSavingPassword(true);
    setPasswordError(null);
    setPasswordFields({});
    try {
      await api.post('/auth/password', passwords);
      setPasswords({ currentPassword: '', newPassword: '' });
      toast.success('Password updated.');
    } catch (cause) {
      setPasswordError(cause);
      if (cause instanceof ApiError) setPasswordFields(cause.fieldErrors);
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <>
      <PageHeader title="Profile" description="Your details and account security." />

      <div className="grid gap-5 lg:grid-cols-[1fr_0.8fr]">
        <div className="solid-panel p-6 sm:p-7">
          <Eyebrow>Your details</Eyebrow>
          <form onSubmit={saveProfile} className="mt-5 space-y-5" noValidate>
            <FormError error={profileError} />

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="First name" error={profileFields.firstName} required>
                <Input
                  required
                  value={profile.firstName}
                  onChange={(event) => setProfile((c) => ({ ...c, firstName: event.target.value }))}
                  invalid={Boolean(profileFields.firstName)}
                />
              </Field>
              <Field label="Last name" error={profileFields.lastName} required>
                <Input
                  required
                  value={profile.lastName}
                  onChange={(event) => setProfile((c) => ({ ...c, lastName: event.target.value }))}
                  invalid={Boolean(profileFields.lastName)}
                />
              </Field>
            </div>

            <Field label="Home club" hint="Optional" error={profileFields.homeClub}>
              <Input
                value={profile.homeClub}
                onChange={(event) => setProfile((c) => ({ ...c, homeClub: event.target.value }))}
              />
            </Field>

            <Field label="Handicap" hint="Optional, −10 to 54" error={profileFields.handicap}>
              <Input
                type="number"
                step="0.1"
                min="-10"
                max="54"
                inputMode="decimal"
                value={profile.handicap}
                onChange={(event) => setProfile((c) => ({ ...c, handicap: event.target.value }))}
                invalid={Boolean(profileFields.handicap)}
              />
            </Field>

            <Button type="submit" loading={savingProfile}>
              Save changes
            </Button>
          </form>
        </div>

        <div className="space-y-5">
          <GlassPanel className="p-6">
            <Eyebrow>Account</Eyebrow>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between gap-4">
                <dt className="text-ivory-faint">Email</dt>
                <dd className="truncate text-ivory">{user?.email}</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-ivory-faint">Role</dt>
                <dd><Badge tone={user?.role === 'admin' ? 'coral' : 'neutral'}>{user?.role}</Badge></dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-ivory-faint">Status</dt>
                <dd><Badge status={user?.status}>{user?.status}</Badge></dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-ivory-faint">Member since</dt>
                <dd className="text-ivory">{date(user?.createdAt)}</dd>
              </div>
            </dl>
            <p className="mt-4 text-xs text-mist-400">
              Your email address is the identifier for your account and cannot be changed here.
            </p>
          </GlassPanel>

          <div className="solid-panel p-6">
            <Eyebrow>Change password</Eyebrow>
            <form onSubmit={savePassword} className="mt-5 space-y-4" noValidate>
              <FormError error={passwordError} />

              <Field label="Current password" error={passwordFields.currentPassword} required>
                <Input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={passwords.currentPassword}
                  onChange={(event) => setPasswords((c) => ({ ...c, currentPassword: event.target.value }))}
                  invalid={Boolean(passwordFields.currentPassword)}
                />
              </Field>

              <Field
                label="New password"
                hint="10+ characters, mixed case, one number"
                error={passwordFields.newPassword}
                required
              >
                <Input
                  type="password"
                  required
                  autoComplete="new-password"
                  value={passwords.newPassword}
                  onChange={(event) => setPasswords((c) => ({ ...c, newPassword: event.target.value }))}
                  invalid={Boolean(passwordFields.newPassword)}
                />
              </Field>

              <Button type="submit" variant="outline" loading={savingPassword}>
                Update password
              </Button>
            </form>
          </div>

          <button
            type="button"
            onClick={logout}
            className="w-full rounded-xl2 border border-white/[0.08] py-3 text-sm text-ivory-faint transition-colors hover:bg-white/[0.04] hover:text-ivory"
          >
            Sign out of this device
          </button>
        </div>
      </div>
    </>
  );
}
