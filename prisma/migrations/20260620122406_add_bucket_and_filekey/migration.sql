-- CreateEnum
CREATE TYPE "BucketType" AS ENUM ('public-bucket', 'private-bucket');

-- CreateTable
CREATE TABLE "profiles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '新用户',
    "avatar_url" TEXT,
    "credits" INTEGER NOT NULL DEFAULT 50,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "artworks" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '未命名画作',
    "canvas_json" TEXT,
    "thumbnail_url" TEXT,
    "bucket" "BucketType" NOT NULL DEFAULT 'public-bucket',
    "file_key" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_public" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "artworks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "to_email" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "html" TEXT NOT NULL,
    "image_data_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "artworks_is_public_idx" ON "artworks"("is_public");

-- CreateIndex
CREATE INDEX "artworks_user_id_idx" ON "artworks"("user_id");

-- CreateIndex
CREATE INDEX "artworks_created_at_idx" ON "artworks"("created_at");

-- CreateIndex
CREATE INDEX "artworks_bucket_idx" ON "artworks"("bucket");

-- CreateIndex
CREATE INDEX "email_logs_user_id_idx" ON "email_logs"("user_id");

-- AddForeignKey
ALTER TABLE "artworks" ADD CONSTRAINT "artworks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
