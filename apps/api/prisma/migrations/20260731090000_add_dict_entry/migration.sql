-- 生词本 P1：离线英汉词典表（导入自 ECDICT，MIT）
-- 纯新增，不触碰任何既有表。
CREATE TABLE "DictEntry" (
    "word" TEXT NOT NULL,
    "phonetic" TEXT,
    "translation" TEXT NOT NULL,
    "definition" TEXT,
    "pos" TEXT,
    "collins" INTEGER,
    "oxford" BOOLEAN NOT NULL DEFAULT false,
    "tag" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "bnc" INTEGER,
    "frq" INTEGER,

    CONSTRAINT "DictEntry_pkey" PRIMARY KEY ("word")
);

CREATE INDEX "DictEntry_tag_idx" ON "DictEntry"("tag");
