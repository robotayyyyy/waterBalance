import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { GeoService } from './geo.service';
import { CreateRiverDto } from './dto/create-river.dto';
import { CreateBasinDto } from './dto/create-basin.dto';
import { FindPointDto } from './dto/find-point.dto';

@ApiTags('geo')
@Controller('geo')
export class GeoController {
  constructor(private readonly geoService: GeoService) {}

  @Get('rivers')
  @ApiOperation({ summary: 'Get all rivers as GeoJSON' })
  @ApiQuery({ name: 'bbox', required: false, description: 'Bounding box: minLon,minLat,maxLon,maxLat' })
  async getRivers(@Query('bbox') bbox?: string) {
    return this.geoService.getRivers(bbox);
  }

  @Get('rivers/:id')
  @ApiOperation({ summary: 'Get river by ID' })
  async getRiver(@Param('id') id: string) {
    const river = await this.geoService.getRiverById(parseInt(id));
    if (!river) {
      throw new NotFoundException(`River with ID ${id} not found`);
    }
    return river;
  }

  @Get('basins')
  @ApiOperation({ summary: 'Get all basins as GeoJSON' })
  @ApiQuery({ name: 'bbox', required: false, description: 'Bounding box: minLon,minLat,maxLon,maxLat' })
  async getBasins(@Query('bbox') bbox?: string) {
    return this.geoService.getBasins(bbox);
  }

  @Get('basins/:id')
  @ApiOperation({ summary: 'Get basin by ID' })
  async getBasin(@Param('id') id: string) {
    const basin = await this.geoService.getBasinById(parseInt(id));
    if (!basin) {
      throw new NotFoundException(`Basin with ID ${id} not found`);
    }
    return basin;
  }

  @Post('basins/find-by-point')
  @ApiOperation({ summary: 'Find basin containing a point' })
  async findBasinByPoint(@Body() body: FindPointDto) {
    const basin = await this.geoService.findBasinByPoint(body.lon, body.lat);
    if (!basin) {
      throw new NotFoundException('No basin found at this location');
    }
    return basin;
  }

  @Post('rivers')
  @ApiOperation({ summary: 'Create a new river' })
  async createRiver(@Body() body: CreateRiverDto) {
    return this.geoService.createRiver(body.name, body.geometry);
  }

  @Post('basins')
  @ApiOperation({ summary: 'Create a new basin' })
  async createBasin(@Body() body: CreateBasinDto) {
    return this.geoService.createBasin(body.name, body.geometry);
  }
}
