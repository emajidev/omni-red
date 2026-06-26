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
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nombre!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(160)
  ubicacion!: string;

  @IsNumber()
  @Min(-90)
  @Max(90)
  lat!: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  lng!: number;

  @IsIn(TIPOS_CENTRO)
  tipo!: TipoCentro;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  contacto?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  responsable?: string;
}

/** Alta masiva de centros (acopio/refugio/hospital) desde CSV. */
export class BatchCentrosDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(2000)
  @ValidateNested({ each: true })
  @Type(() => CentroBatchItemDto)
  registros!: CentroBatchItemDto[];
}
