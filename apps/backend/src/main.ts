import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { WebSocketServer } from 'ws';
import { applyWSSHandler } from '@trpc/server/adapters/ws';
import type { Server as HttpServer } from 'node:http';
import { AppModule } from './app.module';
import { TrpcService } from './trpc/trpc.service';
import { getJwtSecret } from './auth/jwt';
import { appRouter } from './trpc/trpc.router';

async function bootstrap(): Promise<void> {
  getJwtSecret();

  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: 'http://localhost:3000',
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
    methods: ['GET', 'POST', 'OPTIONS'],
  });

  const trpcService = app.get(TrpcService);
  trpcService.applyMiddleware(app);

  await app.listen(4000);

  const httpServer = app.getHttpServer() as HttpServer;
  const wss = new WebSocketServer({
    server: httpServer,
    path: '/trpc',
    verifyClient: ({ origin }, callback) => {
      if (!origin || origin === 'http://localhost:3000') {
        callback(true);
        return;
      }
      callback(false, 403, 'Origin not allowed');
    },
  });

  applyWSSHandler({
    wss,
    router: appRouter,
    keepAlive: {
      enabled: true,
      pingMs: 30_000,
      pongWaitMs: 5_000,
    },
    createContext: ({ req, info }) => trpcService.createContext(req, info.connectionParams),
  });
}

void bootstrap();
