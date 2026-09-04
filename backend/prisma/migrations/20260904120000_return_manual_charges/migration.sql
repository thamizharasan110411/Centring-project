-- Manual overdue charge + days and damage details recorded on each return
ALTER TABLE "Return" ADD COLUMN "overdueCharge" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "Return" ADD COLUMN "overdueDays" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Return" ADD COLUMN "damageDetails" TEXT;