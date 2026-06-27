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
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  size?: number = 20;

  /** Búsqueda por nombre o cédula (substring, case-insensitive). */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  /** Filtro por estado (desaparecido | encontrado | fallecido | desconocido). */
  @IsOptional()
  @IsIn(ESTADOS)
  estado?: Estado;

  /** Filtro por ubicación (substring). */
  @IsOptional()
  @IsString()
  @MaxLength(160)
  ubicacion?: string;

  /** Filtro por un sitio concreto (hospital/refugio). */
  @IsOptional()
  @IsUUID()
  centroId?: string;

  /** Filtro por categoría de sitio: solo personas en hospitales o en refugios. */
  @IsOptional()
  @IsIn(CENTRO_TIPOS)
  tipo?: CentroTipo;

  /**
   * Si es true, ignora la paginación y devuelve todas las filas (lo usa el
   * mapa / métricas, que necesitan el conjunto completo). Tope de seguridad
   * aplicado en el servicio.
   */
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  all?: boolean = false;
}
