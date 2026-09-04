'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import {
  SystemRole,
  WorkspaceRole,
  hasSystemRoleAtLeast,
  hasWorkspaceRoleAtLeast,
} from '@repo/shared';
import { ShieldAlert } from 'lucide-react';
import { trpc, type AuthUser } from '@/utils/trpc';

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  refetch: () => Promise<unknown>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const value = useMemo<AuthContextValue>(
    () => ({
      user: meQuery.data ?? null,
      isLoading: meQuery.isLoading,
      isAuthenticated: Boolean(meQuery.data),
      refetch: meQuery.refetch,
    }),
    [meQuery.data, meQuery.isLoading, meQuery.refetch],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

export function canPassGuard(options: {
  user: AuthUser | null;
  requireSystemRole?: SystemRole;
  requireWorkspaceRole?: WorkspaceRole;
  workspaceRole?: WorkspaceRole | null;
}): boolean {
  const { user, requireSystemRole, requireWorkspaceRole, workspaceRole } = options;
  if (!user) {
    return false;
  }

  if (requireSystemRole && !hasSystemRoleAtLeast(user.systemRole, requireSystemRole)) {
    return false;
  }

  if (requireWorkspaceRole) {
    if (hasSystemRoleAtLeast(user.systemRole, SystemRole.MODERATOR)) {
      return true;
    }
    if (!workspaceRole) {
      return false;
    }
    return hasWorkspaceRoleAtLeast(workspaceRole, requireWorkspaceRole);
  }

  return true;
}

interface GuardProps {
  children: ReactNode;
  requireSystemRole?: SystemRole;
  requireWorkspaceRole?: WorkspaceRole;
  workspaceRole?: WorkspaceRole | null;
  fallback?: ReactNode;
  deniedFallback?: ReactNode;
  redirectTo?: string;
  isReady?: boolean;
}

export function Guard({
  children,
  requireSystemRole,
  requireWorkspaceRole,
  workspaceRole,
  fallback,
  deniedFallback,
  redirectTo = '/login',
  isReady = true,
}: GuardProps) {
  const router = useRouter();
  const { user, isLoading, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace(redirectTo);
    }
  }, [isLoading, isAuthenticated, redirectTo, router]);

  if (isLoading || !isReady) {
    return (
      fallback ?? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-cyan-400" />
        </div>
      )
    );
  }

  if (!isAuthenticated || !user) {
    return (
      deniedFallback ??
      fallback ?? (
        <DeniedState
          title="Authentication required"
          description="Sign in to access this workspace."
        />
      )
    );
  }

  const allowed = canPassGuard({
    user,
    requireSystemRole,
    requireWorkspaceRole,
    workspaceRole,
  });

  if (!allowed) {
    return (
      deniedFallback ??
      fallback ?? (
        <DeniedState
          title="Access denied"
          description="Your role does not allow you to view this resource."
        />
      )
    );
  }

  return <>{children}</>;
}

function DeniedState({ title, description }: { title: string; description: string }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center rounded-2xl border border-slate-800 bg-slate-900/80 px-6 py-10 text-center">
      <ShieldAlert className="mb-3 h-8 w-8 text-rose-400" />
      <h2 className="text-lg font-semibold text-slate-100">{title}</h2>
      <p className="mt-2 text-sm text-slate-400">{description}</p>
    </div>
  );
}
