-- "Chủ shop" (boss) and admin had the same rights; there is one manager role now.
UPDATE "User" SET "role" = 'admin' WHERE "role" = 'boss';
UPDATE "PayrollLine" SET "role" = 'admin' WHERE "role" = 'boss';
