import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { ForecastService } from './forecast.service';

@ApiTags('forecast')
@Controller('forecast')
export class ForecastController {
  constructor(private readonly forecastService: ForecastService) {}

  @Get('provinces')
  @ApiOperation({ summary: 'List all provinces (static, from DB)' })
  getProvinces() {
    return this.forecastService.getProvinces();
  }

  @Get('dates')
  @ApiOperation({ summary: 'List available simulation dates in a date range for a watershed' })
  @ApiQuery({ name: 'model', example: '7days' })
  @ApiQuery({ name: 'mb_code', example: '06' })
  @ApiQuery({ name: 'start', example: '2020-01-01' })
  @ApiQuery({ name: 'end', example: '2020-12-31' })
  getDates(
    @Query('model') model: string,
    @Query('mb_code') mbCode: string,
    @Query('start') start: string,
    @Query('end') end: string,
  ) {
    return this.forecastService.getDates(model, mbCode, start, end);
  }

  @Get(':level/detail')
  @ApiOperation({ summary: 'All raw fields for a level on a date' })
  @ApiQuery({ name: 'model', example: '7days' })
  @ApiQuery({ name: 'mb_code', example: '06' })
  @ApiQuery({ name: 'date', example: '2020-01-01' })
  @ApiQuery({ name: 'province_id', required: false, example: '50' })
  getDetail(
    @Param('level') level: string,
    @Query('model') model: string,
    @Query('mb_code') mbCode: string,
    @Query('date') date: string,
    @Query('province_id') provinceId?: string,
  ) {
    return this.forecastService.getDetail(level, model, date, mbCode, provinceId);
  }

  @Get(':level')
  @ApiOperation({ summary: 'Color data (id + value) for a level, mode, and date' })
  @ApiQuery({ name: 'model', example: '7days' })
  @ApiQuery({ name: 'mb_code', example: '06' })
  @ApiQuery({ name: 'mode', example: 'drought' })
  @ApiQuery({ name: 'date', example: '2020-01-01' })
  @ApiQuery({ name: 'province_id', required: false, example: '50' })
  getColorData(
    @Param('level') level: string,
    @Query('model') model: string,
    @Query('mb_code') mbCode: string,
    @Query('mode') mode: string,
    @Query('date') date: string,
    @Query('province_id') provinceId?: string,
  ) {
    return this.forecastService.getColorData(level, model, mode, date, mbCode, provinceId);
  }
}
