import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ESTADOS, Estado } from './create-persona.dto';

/** Tipos de sitio por los que se puede filtrar el listado de personas. */
export const CENTRO_TIPOS = ['hospital', 'refugio'] as const;
export type CentroTipo = (typeof CENTRO_TIPOS)[number];

/**
 * Parámetros del listado paginado de personas
 * (GET /api/personas?page=&size=&q=&estado=&ubicacion=&centroId=&tipo=&all=).
 */
export class QueryPersonasDto {
  @ApiPropertyOptional({
    description: 'Número de página',
    default: 1,
    minimum: 1,
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Tamaño de página',
    default: 20,
    minimum: 1,
    maximum: 100,
    example: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  size?: number = 20;

  @ApiPropertyOptional({
    description: 'Búsqueda por nombre o cédula (substring, case-insensitive)',
    example: 'Juan',
    maxLength: 120,
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @ApiPropertyOptional({
    description: 'Filtro por estado de la persona',
    enum: ESTADOS,
    example: 'desaparecido',
  })
  @IsOptional()
  @IsIn(ESTADOS)
  estado?: Estado;

  @ApiPropertyOptional({
    description: 'Filtro por ubicación (substring)',
    example: 'Catia',
    maxLength: 160,
  })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  ubicacion?: string;

  @ApiPropertyOptional({
    description: 'Filtro por ID de un centro de acopio específico (UUID)',
    example: 'd3b07384-d113-49cd-a5d6-8ee3c2f54bf9',
  })
  @IsOptional()
  @IsUUID()
  centroId?: string;

  @ApiPropertyOptional({
    description: 'Filtro por tipo de centro (hospital | refugio)',
    enum: CENTRO_TIPOS,
    example: 'hospital',
  })
  @IsOptional()
  @IsIn(CENTRO_TIPOS)
  tipo?: CentroTipo;

  @ApiPropertyOptional({
    description: 'Si es true, desactiva la paginación y retorna todos los registros',
    default: false,
    example: false,
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  all?: boolean = false;
}
