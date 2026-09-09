import { Module } from '@nestjs/common';
import { WritingCheckController } from './writing-check.controller';
import { WritingCheckService } from './writing-check.service';

/** 写作自查（LanguageTool）。没配 LANGUAGETOOL_URL 时整个功能自动关闭。 */
@Module({
  controllers: [WritingCheckController],
  providers: [WritingCheckService],
})
export class WritingCheckModule {}
