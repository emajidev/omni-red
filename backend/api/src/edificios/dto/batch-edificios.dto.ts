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

  @IsOptional()
  @IsIn(NIVELES_DANO)
  nivel_dano?: NivelDano;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000)
  personas_atrapadas?: number;

  @IsOptional()
  @IsIn(ESTADOS_EDIFICIO)
  estado?: EstadoEdificio;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  contacto?: string;
}

/** Alta masiva de edificios caídos desde CSV. */
export class BatchEdificiosDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(2000)
  @ValidateNested({ each: true })
  @Type(() => EdificioBatchItemDto)
  registros!: EdificioBatchItemDto[];
}
