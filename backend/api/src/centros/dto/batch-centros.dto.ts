import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export const TIPOS_CENTRO = ['acopio', 'refugio', 'hospital'] as const;
export type TipoCentro = (typeof TIPOS_CENTRO)[number];

/** Un sitio (acopio/refugio/hospital) dentro de una carga masiva. */
export class CentroBatchItemDto {
  @ApiProperty({
    description: 'Nombre del centro',
    example: 'Polideportivo San Luis (Refugio)',
    maxLength: 120,
  })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nombre!: string;

  @ApiProperty({
    description: 'Dirección o ubicación del centro',
    example: 'El Cafetal, Caracas',
    maxLength: 160,
  })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  ubicacion!: string;

  @ApiProperty({
    description: 'Latitud geográfica',
    example: 10.468,
    minimum: -90,
    maximum: 90,
  })
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat!: number;

  @ApiProperty({
    description: 'Longitud geográfica',
    example: -66.832,
    minimum: -180,
    maximum: 180,
  })
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng!: number;

  @ApiProperty({
    description: 'Tipo de centro',
    enum: TIPOS_CENTRO,
    example: 'refugio',
  })
  @IsIn(TIPOS_CENTRO)
  tipo!: TipoCentro;

  @ApiPropertyOptional({
    description: 'Teléfono o contacto',
    example: '0424-9876543',
    maxLength: 60,
  })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  contacto?: string;

  @ApiPropertyOptional({
    description: 'Nombre del encargado o responsable',
    example: 'Sargento Juan Castro',
    maxLength: 120,
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  responsable?: string;
}

/** Alta masiva de centros (acopio/refugio/hospital) desde CSV. */
export class BatchCentrosDto {
  @ApiProperty({
    description: 'Listado de centros a registrar en masa',
    type: [CentroBatchItemDto],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(2000)
  @ValidateNested({ each: true })
  @Type(() => CentroBatchItemDto)
  registros!: CentroBatchItemDto[];
}
