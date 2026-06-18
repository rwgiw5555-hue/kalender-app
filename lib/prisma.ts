import { PrismaClient } from '@/app/generated/prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'

function createPrisma() {
  const adapter = new PrismaLibSql({ url: process.env.DATABASE_URL ?? 'file:./dev.db' })
  return new PrismaClient({ adapter } as never)
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }
export const prisma = globalForPrisma.prisma || createPrisma()
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
export default prisma
