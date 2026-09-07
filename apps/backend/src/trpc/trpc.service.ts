import { Injectable } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import type { IncomingMessage } from 'node:http';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { PrismaService } from '../prisma/prisma.service';
import { createTrpcContext, type TrpcContext } from './context';
import { appRouter } from './trpc.router';

@Injectable()
export class TrpcService {
  constructor(private readonly prisma: PrismaService) {}

  getRouter() {
    return appRouter;
  }

  createContext(
    req: IncomingMessage,
    connectionParams?: Record<string, unknown> | null,
    res: Parameters<typeof createTrpcContext>[0]['res'] = null,
  ): Promise<TrpcContext> {
    return createTrpcContext({
      req,
      res,
      prisma: this.prisma,
      connectionParams,
    });
  }

  applyMiddleware(app: INestApplication): void {
    app.use(
      '/trpc',
      createExpressMiddleware({
        router: appRouter,
        createContext: ({ req, res, info }) => this.createContext(req, info.connectionParams, res),
      }),
    );
  }
}
