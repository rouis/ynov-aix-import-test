-- CreateEnum
CREATE TYPE "TokenType" AS ENUM ('ACTIVATION', 'PASSWORD_RESET');

-- AlterTable
ALTER TABLE "AccountToken" ADD COLUMN     "type" "TokenType" NOT NULL DEFAULT 'ACTIVATION';
