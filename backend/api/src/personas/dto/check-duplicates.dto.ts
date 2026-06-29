import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
  @ApiProperty({
    description: 'Nombre completo de la persona a verificar',
    example: 'Juan Pérez',
    maxLength: 120,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  nombre!: string;

  @ApiPropertyOptional({
    description: 'Cédula de identidad a verificar (opcional)',
    example: 'V-12.345.678',
    maxLength: 40,
    nullable: true,
  })
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
  @ApiProperty({
    description: 'Listado de filas a verificar para desduplicación',
    type: [DupRowDto],
  })
  @IsArray()
  @ArrayMaxSize(2000)
  @ValidateNested({ each: true })
  @Type(() => DupRowDto)
  rows!: DupRowDto[];
}
