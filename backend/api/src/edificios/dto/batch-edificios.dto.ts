import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export const NIVELES_DANO = ['parcial', 'severo', 'colapsado'] as const;
export const ESTADOS_EDIFICIO = ['reportado', 'en_rescate', 'despejado'] as const;
export type NivelDano = (typeof NIVELES_DANO)[number];
export type EstadoEdificio = (typeof ESTADOS_EDIFICIO)[number];

/** Un edificio caído dentro de una carga masiva. */
export class EdificioBatchItemDto {
  @ApiProperty({
    description: 'Nombre de la estructura o edificio',
    example: 'Centro Comercial Ciudad Chinita',
    maxLength: 120,
  })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nombre!: string;

  @ApiProperty({
    description: 'Ubicación o dirección',
    example: 'Maracaibo, Zulia',
    maxLength: 160,
  })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  ubicacion!: string;

  @ApiProperty({
    description: 'Latitud geográfica',
    example: 10.642,
    minimum: -90,
    maximum: 90,
  })
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat!: number;

  @ApiProperty({
    description: 'Longitud geográfica',
    example: -71.612,
    minimum: -180,
    maximum: 180,
  })
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng!: number;

  @ApiPropertyOptional({
    description: 'Nivel de daño estructural',
    enum: NIVELES_DANO,
    example: 'colapsado',
  })
  @IsOptional()
  @IsIn(NIVELES_DANO)
  nivel_dano?: NivelDano;

  @ApiPropertyOptional({
    description: 'Número de personas atrapadas estimado',
    example: 0,
    minimum: 0,
    maximum: 100000,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000)
  personas_atrapadas?: number;

  @ApiPropertyOptional({
    description: 'Estado de las labores en el sitio',
    enum: ESTADOS_EDIFICIO,
    example: 'despejado',
  })
  @IsOptional()
  @IsIn(ESTADOS_EDIFICIO)
  estado?: EstadoEdificio;

  @ApiPropertyOptional({
    description: 'Información de contacto',
    example: 'Protección Civil Zulia',
    maxLength: 120,
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  contacto?: string;
}

/** Alta masiva de edificios caídos desde CSV. */
export class BatchEdificiosDto {
  @ApiProperty({
    description: 'Listado de edificios a registrar en masa',
    type: [EdificioBatchItemDto],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(2000)
  @ValidateNested({ each: true })
  @Type(() => EdificioBatchItemDto)
  registros!: EdificioBatchItemDto[];
}
