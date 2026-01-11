import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsObject } from 'class-validator';
import type { LineString } from 'geojson';

export class CreateRiverDto {
  @ApiProperty({ example: 'Colorado River' })
  @IsString()
  name: string;

  @ApiProperty({
    example: {
      type: 'LineString',
      coordinates: [
        [-97.7, 30.2],
        [-97.6, 30.3],
      ],
    },
  })
  @IsObject()
  geometry: LineString;
}
