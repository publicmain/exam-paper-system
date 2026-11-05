-- 2026-11-05 完整化第 3 期：文章逐句朗读音频。只加表。
CREATE TABLE "SentenceAudio" (
    "textHash" TEXT NOT NULL,
    "voice" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "contentType" TEXT NOT NULL DEFAULT 'audio/mpeg',
    "bytes" BYTEA NOT NULL,
    "byteLength" INTEGER NOT NULL,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SentenceAudio_pkey" PRIMARY KEY ("textHash")
);
