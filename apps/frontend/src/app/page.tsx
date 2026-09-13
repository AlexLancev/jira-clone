'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { WorkspaceRole } from '@repo/shared';
import { LayoutGrid, LogOut, Plus, Shield } from 'lucide-react';
import { Guard, useAuth } from '@/components/Guard';
import { NotificationBell } from '@/components/NotificationBell';
import { useToast } from '@/components/Toast';
import { slugify } from '@/lib/ui';
import { getTrpcErrorMessage, trpc } from '@/utils/trpc';

export default function HomePage() {
  return (
    <Guard>
      <Dashboard />
    </Guard>
  );
}

function Dashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const { pushToast } = useToast();
  const utils = trpc.useUtils();
  const workspacesQuery = trpc.workspace.list.useQuery();
  const logout = trpc.auth.logout.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      router.replace('/login');
    },
  });
  const [name, setName] = useState('');
  const createWorkspace = trpc.workspace.create.useMutation({
    onSuccess: async (workspace) => {
      setName('');
      await utils.workspace.list.invalidate();
      pushToast({ variant: 'success', title: 'Workspace created' });
      router.push(`/workspaces/${workspace.id}/kanban`);
    },
    onError: (error) => {
      pushToast({
        variant: 'error',
        title: 'Could not create workspace',
        description: getTrpcErrorMessage(error),
      });
    },
  });

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 py-10">
      <div className="mb-10 flex items-start justify-between gap-4">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-cyan-300">
            <Shield className="h-3 w-3" />
            Enterprise
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-50">Workspaces</h1>
          <p className="mt-2 text-sm text-slate-400">
            Signed in as {user?.name} · {user?.systemRole}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <NotificationBell />
          <button
            type="button"
            onClick={() => logout.mutate()}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-300 hover:border-slate-700 hover:text-white"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </div>

      <form
        className="mb-8 flex gap-2 rounded-xl border border-slate-800 bg-slate-900/70 p-2"
        onSubmit={(event) => {
          event.preventDefault();
          const trimmed = name.trim();
          if (!trimmed) {
            return;
          }
          createWorkspace.mutate({ name: trimmed, slug: slugify(trimmed) || `ws-${Date.now()}` });
        }}
      >
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Create a workspace"
          className="h-10 flex-1 bg-transparent px-3 text-sm outline-none placeholder:text-slate-600"
        />
        <button
          type="submit"
          disabled={createWorkspace.isPending || name.trim().length === 0}
          className="inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-3 text-sm font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-40"
        >
          <Plus className="h-4 w-4" />
          Create
        </button>
      </form>

      <div className="grid gap-3 sm:grid-cols-2">
        {(workspacesQuery.data ?? []).map((workspace) => (
          <Link
            key={workspace.id}
            href={`/workspaces/${workspace.id}/kanban`}
            className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 transition hover:border-slate-700 hover:bg-slate-900"
          >
            <div className="mb-3 flex items-center justify-between">
              <LayoutGrid className="h-4 w-4 text-cyan-400" />
              <span className="rounded border border-slate-700 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-400">
                {workspace.currentRole ?? WorkspaceRole.MEMBER}
              </span>
            </div>
            <h2 className="text-base font-semibold text-slate-100">{workspace.name}</h2>
            <p className="mt-1 text-xs text-slate-500">/{workspace.slug}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
