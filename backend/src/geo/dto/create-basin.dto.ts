import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsObject } from 'class-validator';
import type { Polygon } from 'geojson';

export class CreateBasinDto {
  @ApiProperty({ example: 'Upper Colorado Basin' })
  @IsString()
  name: string;

  @ApiProperty({
    example: {
      type: 'Polygon',
      coordinates: [
        [
          [-97.8, 30.1],
          [-97.4, 30.1],
          [-97.4, 30.5],
          [-97.8, 30.5],
          [-97.8, 30.1],
        ],
      ],
    },
  })
  @IsObject()
  geometry: Polygon;
}
