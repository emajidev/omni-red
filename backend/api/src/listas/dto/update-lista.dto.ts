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
  @MaxLength(200)
  nombre_archivo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  storage_path?: string;
}
