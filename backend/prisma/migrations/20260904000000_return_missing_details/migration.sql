-- AlterTable: store user-entered missing piece details on each return record.
ALTER TABLE "Return" ADD COLUMN "missingDetails" TEXT;