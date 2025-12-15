import { PrismaClient } from '@prisma/client';

// Singleton pattern to prevent multiple PrismaClient instances
// Each instance opens its own connection pool, causing resource exhaustion
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma = global.__prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  global.__prisma = prisma;
}

// Ensure proper cleanup on process exit
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});
