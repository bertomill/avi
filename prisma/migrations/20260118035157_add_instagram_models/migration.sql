-- CreateTable
CREATE TABLE "InstagramAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "name" TEXT,
    "biography" TEXT,
    "profilePictureUrl" TEXT,
    "followerCount" INTEGER,
    "followingCount" INTEGER,
    "mediaCount" INTEGER,
    "userId" TEXT NOT NULL,
    "lastSyncedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InstagramAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InstagramMedia" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mediaId" TEXT NOT NULL,
    "caption" TEXT,
    "mediaType" TEXT NOT NULL,
    "mediaUrl" TEXT,
    "thumbnailUrl" TEXT,
    "permalink" TEXT,
    "timestamp" DATETIME,
    "likeCount" INTEGER,
    "commentsCount" INTEGER,
    "accountId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InstagramMedia_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "InstagramAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "InstagramAccount_accountId_key" ON "InstagramAccount"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "InstagramAccount_userId_key" ON "InstagramAccount"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "InstagramMedia_mediaId_key" ON "InstagramMedia"("mediaId");
