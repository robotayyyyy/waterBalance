import { Module } from '@nestjs/common';
import { BasinController } from './basin.controller';
import { BasinService } from './basin.service';

@Module({
  controllers: [BasinController],
  providers: [BasinService],
})
export class BasinModule {}
