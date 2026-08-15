-- Introduces Batch (shift → batch → staff) and makes ShiftEntry.batchId
-- required. Written by hand rather than generated so existing shifts keep
-- their entries: every existing shift gets one batch spanning the shift
-- window, and its entries are attached to that batch.

-- CreateTable
CREATE TABLE "Batch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shiftId" TEXT NOT NULL,
    "name" TEXT,
    "position" INTEGER NOT NULL,
    "startAt" DATETIME NOT NULL,
    "endAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Batch_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Batch_shiftId_idx" ON "Batch"("shiftId");

-- Backfill: one batch per existing shift, spanning the shift's own window.
INSERT INTO "Batch" ("id", "shiftId", "name", "position", "startAt", "endAt", "createdAt", "updatedAt")
SELECT
    'bf_' || "id",
    "id",
    NULL,
    1,
    "startAt",
    "endAt",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Shift";

-- RedefineTable: add the required batchId to ShiftEntry.
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_ShiftEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shiftId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "isSupervisor" BOOLEAN,
    "startAt" DATETIME NOT NULL,
    "endAt" DATETIME NOT NULL,
    "breakMinutes" INTEGER NOT NULL DEFAULT 60,
    "additionalPence" INTEGER NOT NULL DEFAULT 0,
    "paid" BOOLEAN NOT NULL DEFAULT false,
    "paidAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ShiftEntry_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ShiftEntry_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ShiftEntry_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "new_ShiftEntry" ("id", "shiftId", "batchId", "staffId", "isSupervisor", "startAt", "endAt", "breakMinutes", "additionalPence", "paid", "paidAt", "createdAt", "updatedAt")
SELECT "id", "shiftId", 'bf_' || "shiftId", "staffId", "isSupervisor", "startAt", "endAt", "breakMinutes", "additionalPence", "paid", "paidAt", "createdAt", "updatedAt"
FROM "ShiftEntry";

DROP TABLE "ShiftEntry";
ALTER TABLE "new_ShiftEntry" RENAME TO "ShiftEntry";

CREATE UNIQUE INDEX "ShiftEntry_shiftId_staffId_key" ON "ShiftEntry"("shiftId", "staffId");
CREATE UNIQUE INDEX "ShiftEntry_shiftId_isSupervisor_key" ON "ShiftEntry"("shiftId", "isSupervisor");
CREATE INDEX "ShiftEntry_batchId_idx" ON "ShiftEntry"("batchId");
CREATE INDEX "ShiftEntry_staffId_idx" ON "ShiftEntry"("staffId");
CREATE INDEX "ShiftEntry_paid_idx" ON "ShiftEntry"("paid");

PRAGMA foreign_keys=ON;
