-- CreateTable
CREATE TABLE "StudentAchievement" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "badgeKey" VARCHAR(40) NOT NULL,
    "earnedOn" VARCHAR(10) NOT NULL,
    "evidence" JSONB NOT NULL,
    "rulesVersion" INTEGER NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "revokedById" TEXT,
    "revokeReason" VARCHAR(200),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentAchievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassWeeklyGoal" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "weekStart" VARCHAR(10) NOT NULL,
    "kind" VARCHAR(40) NOT NULL DEFAULT 'assigned_reading',
    "enabledById" TEXT,
    "disabledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassWeeklyGoal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StudentAchievement_studentId_badgeKey_key" ON "StudentAchievement"("studentId", "badgeKey");

-- CreateIndex
CREATE UNIQUE INDEX "ClassWeeklyGoal_classId_weekStart_key" ON "ClassWeeklyGoal"("classId", "weekStart");

-- AddForeignKey
ALTER TABLE "StudentAchievement" ADD CONSTRAINT "StudentAchievement_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassWeeklyGoal" ADD CONSTRAINT "ClassWeeklyGoal_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;
