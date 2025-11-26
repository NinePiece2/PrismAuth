/*
  Warnings:

  - You are about to drop the column `customRoleId` on the `User` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_customRoleId_fkey";

-- DropIndex
DROP INDEX "User_customRoleId_idx";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "customRoleId";

-- CreateTable
CREATE TABLE "UserCustomRole" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "customRoleId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserCustomRole_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserCustomRole_userId_idx" ON "UserCustomRole"("userId");

-- CreateIndex
CREATE INDEX "UserCustomRole_customRoleId_idx" ON "UserCustomRole"("customRoleId");

-- CreateIndex
CREATE UNIQUE INDEX "UserCustomRole_userId_customRoleId_key" ON "UserCustomRole"("userId", "customRoleId");

-- AddForeignKey
ALTER TABLE "UserCustomRole" ADD CONSTRAINT "UserCustomRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCustomRole" ADD CONSTRAINT "UserCustomRole_customRoleId_fkey" FOREIGN KEY ("customRoleId") REFERENCES "CustomRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;
