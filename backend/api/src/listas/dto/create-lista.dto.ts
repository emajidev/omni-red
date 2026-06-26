import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export const ESTADOS_OCR = [
  'subiendo',
  'escaneando',
  'desduplicando',
  'completado',
  'error',
] as const;
export type EstadoOcr = (typeof ESTADOS_OCR)[number];

export class CreateListaDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  nombre_archivo!: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  storage_path?: string;

  @IsOptional()
  @IsIn(ESTADOS_OCR)
  estado?: EstadoOcr;

  @IsOptional()
  @IsString()
  texto_extraido?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  registros_detectados?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  duplicados_unificados?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  subido_por?: string;
}
