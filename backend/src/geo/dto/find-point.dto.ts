import { ApiProperty } from '@nestjs/swagger';
import { IsNumber } from 'class-validator';

export class FindPointDto {
  @ApiProperty({ example: -97.7 })
  @IsNumber()
  lon: number;

  @ApiProperty({ example: 30.3 })
  @IsNumber()
  lat: number;
}
