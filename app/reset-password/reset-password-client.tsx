'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { confirmPasswordReset } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

function validatePassword(value: string): string {
  const errors: string[] = [];
  if (value.length < 8) errors.push('8 characters');
  if (!/[A-Z]/.test(value)) errors.push('one uppercase letter');
  if (!/[a-z]/.test(value)) errors.push('one lowercase letter');
  if (!/[0-9]/.test(value)) errors.push('one number');
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(value)) errors.push('one special character');
  return errors.length > 0 ? `Password must contain at least: ${errors.join(', ')}.` : '';
}

export default function ResetPasswordClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const uid = searchParams.get('uid') || '';
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const missingToken = useMemo(() => !uid || !token, [uid, token]);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSuccessMessage('');

    if (missingToken) {
      setError('Reset link is invalid. Please request a new one.');
      return;
    }

    const passwordValidationError = validatePassword(password);
    if (passwordValidationError) {
      setError(passwordValidationError);
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    try {
      setIsSubmitting(true);
      const result = await confirmPasswordReset({ uid, token, new_password: password });
      setSuccessMessage(result.detail || 'Password reset successful.');
      setTimeout(() => {
        router.push('/login');
      }, 1200);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not reset password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto flex min-h-[80vh] items-center justify-center px-4">
      <div className="w-full max-w-md space-y-8 rounded-3xl border bg-white p-8 shadow-sm">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">Reset your password</h1>
          <p className="mt-2 text-sm text-zinc-500">Create a new secure password for your account.</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">New Password</label>
              <Input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Confirm New Password</label>
              <Input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
          </div>

          {missingToken && (
            <p className="text-sm text-red-600">
              This reset link is missing required values. Request a new link from the forgot password page.
            </p>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          {successMessage && <p className="text-sm text-green-700">{successMessage}</p>}

          <Button type="submit" className="w-full rounded-full" size="lg" disabled={isSubmitting || missingToken}>
            {isSubmitting ? 'Resetting...' : 'Reset Password'}
          </Button>
        </form>

        <div className="text-center text-sm">
          <Link href="/forgot-password" className="font-medium text-zinc-900 hover:underline">
            Request a new reset link
          </Link>
        </div>
      </div>
    </div>
  );
}
