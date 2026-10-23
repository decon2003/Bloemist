-- The order's only note was labelled "Nội dung thiệp" (card message), so
-- what is there is the card text. It becomes its own field and "notes" is
-- now the special note for the florists.
ALTER TABLE "Order" ADD COLUMN "cardMessage" TEXT;
UPDATE "Order" SET "cardMessage" = "notes", "notes" = NULL WHERE "notes" IS NOT NULL AND "notes" <> '';
