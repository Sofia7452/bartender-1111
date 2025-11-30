-- CreateTable
CREATE TABLE "dishes" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "cuisine" VARCHAR(100) NOT NULL,
    "requiredIngredients" JSONB NOT NULL,
    "cookingTime" INTEGER NOT NULL DEFAULT 30,
    "difficulty" INTEGER NOT NULL DEFAULT 3,
    "steps" JSONB NOT NULL,
    "source" VARCHAR(255),
    "tags" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dishes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_sets" (
    "id" UUID NOT NULL,
    "sessionId" VARCHAR(255) NOT NULL,
    "dishId" UUID NOT NULL,
    "name" VARCHAR(255),
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saved_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_set_recipes" (
    "id" UUID NOT NULL,
    "savedSetId" UUID NOT NULL,
    "recipeId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_set_recipes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "dishes_name_idx" ON "dishes"("name");

-- CreateIndex
CREATE INDEX "dishes_cuisine_idx" ON "dishes"("cuisine");

-- CreateIndex
CREATE UNIQUE INDEX "saved_sets_sessionId_dishId_key" ON "saved_sets"("sessionId", "dishId");

-- CreateIndex
CREATE INDEX "saved_sets_sessionId_idx" ON "saved_sets"("sessionId");

-- CreateIndex
CREATE INDEX "saved_sets_dishId_idx" ON "saved_sets"("dishId");

-- CreateIndex
CREATE UNIQUE INDEX "saved_set_recipes_savedSetId_recipeId_key" ON "saved_set_recipes"("savedSetId", "recipeId");

-- CreateIndex
CREATE INDEX "saved_set_recipes_savedSetId_idx" ON "saved_set_recipes"("savedSetId");

-- CreateIndex
CREATE INDEX "saved_set_recipes_recipeId_idx" ON "saved_set_recipes"("recipeId");

-- AddForeignKey
ALTER TABLE "saved_sets" ADD CONSTRAINT "saved_sets_dishId_fkey" FOREIGN KEY ("dishId") REFERENCES "dishes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_set_recipes" ADD CONSTRAINT "saved_set_recipes_savedSetId_fkey" FOREIGN KEY ("savedSetId") REFERENCES "saved_sets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_set_recipes" ADD CONSTRAINT "saved_set_recipes_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

