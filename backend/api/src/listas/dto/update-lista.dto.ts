import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { ESTADOS_OCR, EstadoOcr } from './create-lista.dto';

/**
 * Actualización parcial de una entrada del pipeline OCR. Los campos no
 * enviados conservan su valor actual (el servicio hace el merge sobre la
 * fila existente antes de llamar a la RPC).
 */
export class UpdateListaDto {
  @ApiPropertyOptional({
    description: 'Estado del procesamiento OCR',
    enum: ESTADOS_OCR,
    example: 'completado',
  })
  @IsOptional()
  @IsIn(ESTADOS_OCR)
  estado?: EstadoOcr;

  @ApiPropertyOptional({
    description: 'Texto extraído mediante OCR',
    example: 'CENSO DE REFUGIADOS: 1. Jose Perez V-10123456...',
  })
  @IsOptional()
  @IsString()
  texto_extraido?: string;

  @ApiPropertyOptional({
    description: 'Cantidad de personas/registros detectados',
    example: 15,
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  registros_detectados?: number;

  @ApiPropertyOptional({
    description: 'Cantidad de personas/registros unificados',
    example: 2,
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  duplicados_unificados?: number;

  @ApiPropertyOptional({
    description: 'Nombre del archivo subido',
    example: 'lista_refugiados_escuela_bolivariana.pdf',
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  nombre_archivo?: string;

  @ApiPropertyOptional({
    description: 'Ruta de almacenamiento en Supabase Storage',
    example: 'listas/lista_refugiados_escuela_bolivariana.pdf',
    maxLength: 400,
  })
  @IsOptional()
  @IsString()
  @MaxLength(400)
  storage_path?: string;
}
