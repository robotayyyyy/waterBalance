import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { BasinService } from './basin.service';

@ApiTags('basin')
@Controller('basin')
export class BasinController {
  constructor(private readonly basinService: BasinService) {}

  @Get('dates')
  @ApiOperation({ summary: 'List available simulation dates for a basin model' })
  @ApiQuery({ name: 'model', example: '7days' })
  getDates(@Query('model') model: string) {
    return this.basinService.getDates(model);
  }

  @Get(':level/detail')
  @ApiOperation({ summary: 'Full detail rows for a basin level on a date' })
  @ApiQuery({ name: 'model', example: '7days' })
  @ApiQuery({ name: 'date', example: '2024-01-01' })
  @ApiQuery({ name: 'mb_code', required: false, example: '08' })
  getDetail(
    @Param('level') level: string,
    @Query('model') model: string,
    @Query('date') date: string,
    @Query('mb_code') mbCode?: string,
  ) {
    return this.basinService.getDetail(level, model, date, mbCode);
  }

  @Get(':level')
  @ApiOperation({ summary: 'Color data (id + value) for a basin level, mode, and date' })
  @ApiQuery({ name: 'model', example: '7days' })
  @ApiQuery({ name: 'mode', example: 'drought' })
  @ApiQuery({ name: 'date', example: '2024-01-01' })
  @ApiQuery({ name: 'mb_code', required: false, example: '08' })
  getColorData(
    @Param('level') level: string,
    @Query('model') model: string,
    @Query('mode') mode: string,
    @Query('date') date: string,
    @Query('mb_code') mbCode?: string,
  ) {
    return this.basinService.getColorData(level, model, mode, date, mbCode);
  }
}
