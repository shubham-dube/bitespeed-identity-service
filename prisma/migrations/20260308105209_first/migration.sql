-- CreateEnum
CREATE TYPE "LinkPrecedence" AS ENUM ('primary', 'secondary');

-- CreateTable
CREATE TABLE "contacts" (
    "id" SERIAL NOT NULL,
    "phoneNumber" TEXT,
    "email" TEXT,
    "linkedId" INTEGER,
    "linkPrecedence" "LinkPrecedence" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contacts_email_idx" ON "contacts"("email");

-- CreateIndex
CREATE INDEX "contacts_phoneNumber_idx" ON "contacts"("phoneNumber");

-- CreateIndex
CREATE INDEX "contacts_linkedId_idx" ON "contacts"("linkedId");

-- CreateIndex
CREATE INDEX "contacts_linkPrecedence_idx" ON "contacts"("linkPrecedence");

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_linkedId_fkey" FOREIGN KEY ("linkedId") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
