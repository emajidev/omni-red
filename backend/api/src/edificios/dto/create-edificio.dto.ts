import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  ESTADOS_EDIFICIO,
  EstadoEdificio,
  NIVELES_DANO,
  NivelDano,
} from './batch-edificios.dto';

/** Reporte (alta individual) de un edificio afectado. */
export class CreateEdificioDto {
  @ApiProperty({
    description: 'Nombre del edificio o estructura afectada',
    example: 'Residencias Sol y Mar',
    maxLength: 120,
  })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nombre!: string;

  @ApiProperty({
    description: 'Ubicación o dirección física',
    example: 'Av. Principal de Caraballeda, La Guaira',
    maxLength: 160,
  })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  ubicacion!: string;

  @ApiProperty({
    description: 'Latitud geográfica',
    example: 10.605,
    minimum: -90,
    maximum: 90,
  })
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat!: number;

  @ApiProperty({
    description: 'Longitud geográfica',
    example: -66.852,
    minimum: -180,
    maximum: 180,
  })
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng!: number;

  @ApiPropertyOptional({
    description: 'Nivel de daño de la estructura',
    enum: NIVELES_DANO,
    example: 'severo',
  })
  @IsOptional()
  @IsIn(NIVELES_DANO)
  nivel_dano?: NivelDano;

  @ApiPropertyOptional({
    description: 'Número aproximado de personas atrapadas',
    example: 3,
    minimum: 0,
    maximum: 100000,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000)
  personas_atrapadas?: number;

  @ApiPropertyOptional({
    description: 'Estado de gestión/rescate del edificio',
    enum: ESTADOS_EDIFICIO,
    example: 'reportado',
  })
  @IsOptional()
  @IsIn(ESTADOS_EDIFICIO)
  estado?: EstadoEdificio;

  @ApiPropertyOptional({
    description: 'Teléfono o nombre de contacto del reportante en la zona',
    example: '0414-1112233',
    maxLength: 120,
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  contacto?: string;
}
