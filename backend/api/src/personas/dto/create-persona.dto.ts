import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export const ESTADOS = ['desaparecido', 'encontrado', 'fallecido', 'desconocido'] as const;
export const FUENTES = [
  'twitter',
  'telegram',
  'web',
  'ocr_lista',
  'llamada',
  'whatsapp',
] as const;

export type Estado = (typeof ESTADOS)[number];
export type Fuente = (typeof FUENTES)[number];

export class CreatePersonaDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  nombre!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  cedula?: string;

  @IsIn(ESTADOS)
  estado!: Estado;

  @IsString()
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
  @IsIn(FUENTES)
  fuente?: Fuente;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(120)
  edad?: number;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  telefono_contacto?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  detalle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  reportado_por?: string;
}
