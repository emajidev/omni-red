import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateCentroDto {
  @ApiProperty({
    description: 'Nombre del centro de acopio, refugio u hospital',
    example: 'Hospital Pérez de León',
    maxLength: 120,
  })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nombre!: string;

  @ApiProperty({
    description: 'Ubicación o dirección del centro',
    example: 'Petare, Caracas',
    maxLength: 160,
  })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  ubicacion!: string;

  @ApiProperty({
    description: 'Latitud geográfica',
    example: 10.478,
    minimum: -90,
    maximum: 90,
  })
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat!: number;

  @ApiProperty({
    description: 'Longitud geográfica',
    example: -66.82,
    minimum: -180,
    maximum: 180,
  })
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng!: number;

  @ApiPropertyOptional({
    description: 'Teléfono o medio de contacto del centro',
    example: '0212-2561234',
    maxLength: 60,
  })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  contacto?: string;

  @ApiPropertyOptional({
    description: 'Nombre del responsable del centro',
    example: 'Dr. Alejandro Rísquez',
    maxLength: 120,
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  responsable?: string;
}
