import { createTRPCReact } from '@trpc/react-query';
import {
  createWSClient,
  httpBatchLink,
  splitLink,
  wsLink,
  type TRPCClientErrorLike,
} from '@trpc/client';
import superjson from 'superjson';
import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from '@repo/backend';

export const trpc = createTRPCReact<AppRouter>();

export type RouterInputs = inferRouterInputs<AppRouter>;
export type RouterOutputs = inferRouterOutputs<AppRouter>;
export type TaskRecord = RouterOutputs['task']['list'][number];
export type AuthUser = RouterOutputs['auth']['me'];

export function getTrpcUrl(): string {
  return process.env.NEXT_PUBLIC_TRPC_URL ?? 'http://localhost:4000/trpc';
}

export function getTrpcWsUrl(): string {
  return process.env.NEXT_PUBLIC_TRPC_WS_URL ?? 'ws://localhost:4000/trpc';
}

export function createTrpcClient() {
  const wsClient = createWSClient({
    url: getTrpcWsUrl(),
    lazy: {
      enabled: true,
      closeMs: 5_000,
    },
  });

  return trpc.createClient({
    links: [
      splitLink({
        condition: (op) => op.type === 'subscription',
        true: wsLink({
          client: wsClient,
          transformer: superjson,
        }),
        false: httpBatchLink({
          url: getTrpcUrl(),
          transformer: superjson,
          fetch(url, options) {
            return fetch(url, {
              ...options,
              credentials: 'include',
            });
          },
        }),
      }),
    ],
  });
}

export function getTrpcErrorMessage(error: unknown): string {
  const clientError = error as TRPCClientErrorLike<AppRouter> | undefined;
  const code = clientError?.data?.code;
  const message = clientError?.message ?? (error instanceof Error ? error.message : 'Unexpected error');

  if (code === 'FORBIDDEN') {
    return 'Insufficient permissions to change this task.';
  }
  if (code === 'UNAUTHORIZED') {
    return 'Your session expired. Please sign in again.';
  }
  if (code === 'NOT_FOUND') {
    return 'Task was not found or has been deleted.';
  }
  if (code === 'CONFLICT') {
    return message;
  }

  return message;
}
