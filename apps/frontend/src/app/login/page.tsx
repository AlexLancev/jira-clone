'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/Guard';
import { useToast } from '@/components/Toast';
import { getTrpcErrorMessage, trpc } from '@/utils/trpc';

export default function LoginPage() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const { isAuthenticated, isLoading } = useAuth();
  const { pushToast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace('/');
    }
  }, [isAuthenticated, isLoading, router]);

  const login = trpc.auth.login.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      router.replace('/');
    },
    onError: (error) => {
      pushToast({
        variant: 'error',
        title: 'Sign in failed',
        description: getTrpcErrorMessage(error),
      });
    },
  });

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <form
        className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-black/40"
        onSubmit={(event) => {
          event.preventDefault();
          login.mutate({ email, password });
        }}
      >
        <p className="text-[11px] uppercase tracking-[0.2em] text-cyan-400">Enterprise Task Manager</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-50">Sign in</h1>
        <p className="mt-1 text-sm text-slate-500">Use your workspace credentials.</p>
        <label className="mt-6 block text-xs font-medium text-slate-400">
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-1 h-10 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 text-sm text-slate-100 outline-none focus:border-cyan-500"
          />
        </label>
        <label className="mt-4 block text-xs font-medium text-slate-400">
          Password
          <input
            type="password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-1 h-10 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 text-sm text-slate-100 outline-none focus:border-cyan-500"
          />
        </label>
        <button
          type="submit"
          disabled={login.isPending}
          className="mt-6 h-10 w-full rounded-lg bg-cyan-500 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:opacity-50"
        >
          {login.isPending ? 'Signing in…' : 'Continue'}
        </button>
        <p className="mt-4 text-center text-xs text-slate-500">
          No account?{' '}
          <Link href="/register" className="text-cyan-400 hover:text-cyan-300">
            Create one
          </Link>
        </p>
      </form>
    </main>
  );
}
