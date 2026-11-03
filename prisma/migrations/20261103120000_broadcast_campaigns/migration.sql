-- broadcast_campaigns: admin broadcast campaign records.
--
-- This table was previously created at request time by the API server
-- (CREATE TABLE IF NOT EXISTS in the admin notifications service) and by
-- scripts/setup-broadcasts.ts, outside the Prisma schema and migrations. It
-- is now the BroadcastCampaign model in prisma/schema.prisma, and this
-- migration owns its creation.
--
-- IF NOT EXISTS is deliberate: databases that already received the table from
-- the runtime DDL keep their rows and are simply marked as having applied this
-- migration. The column definitions below are identical to the runtime DDL, so
-- an existing table and a freshly migrated one have the same shape.
--
-- CreateTable
CREATE TABLE IF NOT EXISTS "broadcast_campaigns" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "target" TEXT NOT NULL DEFAULT 'ALL',
    "status" TEXT NOT NULL DEFAULT 'DELIVERED',
    "delivered" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "opened" INTEGER NOT NULL DEFAULT 0,
    "sent_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "broadcast_campaigns_pkey" PRIMARY KEY ("id")
);
