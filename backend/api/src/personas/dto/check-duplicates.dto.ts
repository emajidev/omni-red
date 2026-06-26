import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class DupRowDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  nombre!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  cedula?: string | null;
}

/**
 * Comprueba contra la base qué filas (nombre/cédula) ya existen, usando la
 * misma huella de desduplicación del servidor (`calcular_hash_dedup`).
 */
export class CheckDuplicatesDto {
  @IsArray()
  @ArrayMaxSize(2000)
  @ValidateNested({ each: true })
  @Type(() => DupRowDto)
  rows!: DupRowDto[];
}
