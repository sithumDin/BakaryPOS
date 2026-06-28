-- Add cost price to ingredients (used to compute production cost)
ALTER TABLE "Ingredient" ADD COLUMN "costPrice" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Add retail & wholesale selling prices to production items (used to compute profit)
ALTER TABLE "ProductionItem" ADD COLUMN "retailPrice" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "ProductionItem" ADD COLUMN "wholesalePrice" DOUBLE PRECISION NOT NULL DEFAULT 0;
