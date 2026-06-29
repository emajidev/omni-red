import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
  @ApiProperty({
    description: 'Nombre del archivo original subido para OCR',
    example: 'lista_refugiados_escuela_bolivariana.pdf',
    maxLength: 200,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  nombre_archivo!: string;

  @ApiPropertyOptional({
    description: 'Ruta de almacenamiento en Supabase Storage (opcional)',
    example: 'listas/lista_refugiados_escuela_bolivariana.pdf',
    maxLength: 400,
  })
  @IsOptional()
  @IsString()
  @MaxLength(400)
  storage_path?: string;

  @ApiPropertyOptional({
    description: 'Estado del procesamiento OCR',
    enum: ESTADOS_OCR,
    example: 'escaneando',
  })
  @IsOptional()
  @IsIn(ESTADOS_OCR)
  estado?: EstadoOcr;

  @ApiPropertyOptional({
    description: 'Texto extraído del archivo mediante OCR',
    example: 'CENSO DE REFUGIADOS: 1. Jose Perez V-10123456...',
  })
  @IsOptional()
  @IsString()
  texto_extraido?: string;

  @ApiPropertyOptional({
    description: 'Cantidad de personas/registros detectados en el archivo',
    example: 15,
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  registros_detectados?: number;

  @ApiPropertyOptional({
    description: 'Cantidad de personas/registros unificados (ya existían)',
    example: 2,
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  duplicados_unificados?: number;

  @ApiPropertyOptional({
    description: 'Usuario o administrador que subió el archivo',
    example: 'admin_maria',
    maxLength: 120,
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  subido_por?: string;
}
