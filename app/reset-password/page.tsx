import { Suspense } from 'react';
import ResetPasswordClient from './reset-password-client';

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={(
        <div className="container mx-auto flex min-h-[80vh] items-center justify-center px-4">
          <div className="w-full max-w-md rounded-3xl border bg-white p-8 shadow-sm">
            <p className="text-center text-sm text-zinc-500">Loading reset form...</p>
          </div>
        </div>
      )}
    >
      <ResetPasswordClient />
    </Suspense>
  );
}
