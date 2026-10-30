-- Money moves from free-form text ("1.250.000 ₫", "500000") to whole VND.
-- Hand-written so the values are converted in place; Prisma's generated
-- version would drop and re-add the columns, losing every amount.
-- VND has no minor unit, so every non-digit is formatting and is stripped.

-- Order
ALTER TABLE "Order"
  ALTER COLUMN "listedPrice" TYPE INTEGER USING COALESCE(NULLIF(regexp_replace("listedPrice", '[^0-9]', '', 'g'), ''), '0')::INTEGER,
  ALTER COLUMN "discount" TYPE INTEGER USING NULLIF(regexp_replace("discount", '[^0-9]', '', 'g'), '')::INTEGER,
  ALTER COLUMN "deliveryFee" TYPE INTEGER USING NULLIF(regexp_replace("deliveryFee", '[^0-9]', '', 'g'), '')::INTEGER,
  ALTER COLUMN "deposit" TYPE INTEGER USING NULLIF(regexp_replace("deposit", '[^0-9]', '', 'g'), '')::INTEGER,
  ALTER COLUMN "sellingPrice" TYPE INTEGER USING NULLIF(regexp_replace("sellingPrice", '[^0-9]', '', 'g'), '')::INTEGER,
  ALTER COLUMN "remainingBalance" TYPE INTEGER USING NULLIF(regexp_replace("remainingBalance", '[^0-9]', '', 'g'), '')::INTEGER,
  ALTER COLUMN "total" TYPE INTEGER USING COALESCE(NULLIF(regexp_replace("total", '[^0-9]', '', 'g'), ''), '0')::INTEGER;

-- Task
ALTER TABLE "Task"
  ALTER COLUMN "price" TYPE INTEGER USING NULLIF(regexp_replace("price", '[^0-9]', '', 'g'), '')::INTEGER;

-- User
ALTER TABLE "User" ALTER COLUMN "baseSalary" DROP DEFAULT;
ALTER TABLE "User"
  ALTER COLUMN "baseSalary" TYPE INTEGER USING NULLIF(regexp_replace("baseSalary", '[^0-9]', '', 'g'), '')::INTEGER;
ALTER TABLE "User" ALTER COLUMN "baseSalary" SET DEFAULT 0;
