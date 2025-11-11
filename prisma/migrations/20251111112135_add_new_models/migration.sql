-- CreateTable
CREATE TABLE "recipes" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "ingredients" JSONB NOT NULL,
    "steps" JSONB NOT NULL,
    "difficulty" INTEGER NOT NULL DEFAULT 1,
    "estimatedTime" INTEGER NOT NULL DEFAULT 0,
    "source" VARCHAR(255),
    "category" VARCHAR(50),
    "glassType" VARCHAR(50),
    "technique" VARCHAR(50),
    "garnish" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recipes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_favorites" (
    "id" UUID NOT NULL,
    "sessionId" VARCHAR(255) NOT NULL,
    "recipeId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_favorites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_documents" (
    "id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "content" TEXT NOT NULL,
    "milvusId" TEXT,
    "metadata" JSONB,
    "documentType" VARCHAR(50) NOT NULL DEFAULT 'pdf',
    "filePath" VARCHAR(255),
    "fileSize" BIGINT,
    "chunkCount" INTEGER NOT NULL DEFAULT 0,
    "isProcessed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recommendation_history" (
    "id" UUID NOT NULL,
    "sessionId" VARCHAR(255) NOT NULL,
    "ingredients" JSONB NOT NULL,
    "recommendedRecipes" JSONB NOT NULL,
    "queryType" VARCHAR(50),
    "searchMetadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recommendation_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_favorites_sessionId_recipeId_idx" ON "user_favorites"("sessionId", "recipeId");

-- CreateIndex
CREATE UNIQUE INDEX "user_favorites_sessionId_recipeId_key" ON "user_favorites"("sessionId", "recipeId");

-- CreateIndex
CREATE INDEX "knowledge_documents_title_idx" ON "knowledge_documents"("title");

-- CreateIndex
CREATE INDEX "recommendation_history_sessionId_createdAt_idx" ON "recommendation_history"("sessionId", "createdAt");

-- AddForeignKey
ALTER TABLE "user_favorites" ADD CONSTRAINT "user_favorites_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
