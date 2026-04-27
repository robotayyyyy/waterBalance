import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { BasinService } from './basin.service';

@ApiTags('basin')
@Controller('basin')
export class BasinController {
  constructor(private readonly basinService: BasinService) {}

  @Get('dates')
  @ApiOperation({ summary: 'List available simulation dates for a basin model and watershed' })
  @ApiQuery({ name: 'model', example: '7days' })
  @ApiQuery({ name: 'mb_code', example: '06' })
  getDates(
    @Query('model') model: string,
    @Query('mb_code') mbCode: string,
  ) {
    return this.basinService.getDates(model, mbCode);
  }

  @Get(':level/detail')
  @ApiOperation({ summary: 'Full detail rows for a basin level on a date' })
  @ApiQuery({ name: 'model', example: '7days' })
  @ApiQuery({ name: 'mb_code', example: '06' })
  @ApiQuery({ name: 'date', example: '2024-01-01' })
  getDetail(
    @Param('level') level: string,
    @Query('model') model: string,
    @Query('mb_code') mbCode: string,
    @Query('date') date: string,
  ) {
    return this.basinService.getDetail(level, model, date, mbCode);
  }

  @Get(':level')
  @ApiOperation({ summary: 'Color data (id + value) for a basin level, mode, and date' })
  @ApiQuery({ name: 'model', example: '7days' })
  @ApiQuery({ name: 'mb_code', example: '06' })
  @ApiQuery({ name: 'mode', example: 'drought' })
  @ApiQuery({ name: 'date', example: '2024-01-01' })
  getColorData(
    @Param('level') level: string,
    @Query('model') model: string,
    @Query('mb_code') mbCode: string,
    @Query('mode') mode: string,
    @Query('date') date: string,
  ) {
    return this.basinService.getColorData(level, model, mode, date, mbCode);
  }
}
