import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
(async () => {
  const sessions = await p.morningQuizSession.findMany({
    select: { paperAssignmentId: true },
  });
  const assigns = await p.paperAssignment.findMany({
    where: { id: { in: sessions.map((s) => s.paperAssignmentId) } },
    select: { paperId: true },
  });
  const paperIds = assigns.map((a) => a.paperId);
  console.log('mq paperIds:', paperIds.length);
  const wmCount = await p.watermarkToken.count({
    where: { paperId: { in: paperIds } },
  });
  console.log('watermarkTokens to delete:', wmCount);
  const deleted = await p.watermarkToken.deleteMany({
    where: { paperId: { in: paperIds } },
  });
  console.log('deleted:', deleted.count);
  await p.$disconnect();
})();
