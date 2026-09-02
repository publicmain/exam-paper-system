import { PrismaClient } from '@prisma/client';
import { runVocabularyContentBatch, vocabularyContentProviderConfigured } from '../../src/vocab-v2/content-producer';

const prisma = new PrismaClient();

async function main() {
  if (!vocabularyContentProviderConfigured()) throw new Error('vocabulary_content_provider_not_configured');
  const result = await runVocabularyContentBatch(prisma, Number(process.env.VOCAB_CONTENT_BATCH_SIZE || 25));
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error}\n`);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
