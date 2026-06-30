import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
  @ApiProperty({
    description: 'Nombre completo de la persona',
    example: 'Juan Pérez',
    maxLength: 120,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  nombre!: string;

  @ApiPropertyOptional({
    description: 'Cédula de identidad (formato V-XX.XXX.XXX o E-XX.XXX.XXX)',
    example: 'V-12.345.678',
    maxLength: 40,
  })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  cedula?: string;

  @ApiProperty({
    description: 'Estado actual de la persona',
    enum: ESTADOS,
    example: 'desaparecido',
  })
  @IsIn(ESTADOS)
  estado!: Estado;

  @ApiProperty({
    description: 'Ubicación o último lugar avistado',
    example: 'Catia La Mar',
    maxLength: 160,
  })
  @IsString()
  @MaxLength(160)
  ubicacion!: string;

  @ApiProperty({
    description: 'Latitud geográfica',
    example: 10.6,
    minimum: -90,
    maximum: 90,
  })
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat!: number;

  @ApiProperty({
    description: 'Longitud geográfica',
    example: -67.03,
    minimum: -180,
    maximum: 180,
  })
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng!: number;

  @ApiPropertyOptional({
    description: 'Origen o medio del reporte',
    enum: FUENTES,
    example: 'web',
  })
  @IsOptional()
  @IsIn(FUENTES)
  fuente?: Fuente;

  @ApiPropertyOptional({
    description: 'Edad aproximada de la persona',
    example: 35,
    minimum: 0,
    maximum: 120,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(120)
  edad?: number;

  @ApiPropertyOptional({
    description: 'Teléfono de contacto del reportante o familiar',
    example: '+584121234567',
    maxLength: 60,
  })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  telefono_contacto?: string;

  @ApiPropertyOptional({
    description: 'Detalles adicionales sobre la persona o la desaparición',
    example: 'Visto por última vez saliendo de su casa vistiendo franela azul',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  detalle?: string;

  @ApiPropertyOptional({
    description: 'Nombre de la persona que realiza el reporte',
    example: 'María Pérez (Hermana)',
    maxLength: 120,
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  reportado_por?: string;

  @ApiPropertyOptional({
    description: 'Foto de la persona en base64 o URL',
  })
  @IsOptional()
  @IsString()
  foto_url?: string | null;
}
