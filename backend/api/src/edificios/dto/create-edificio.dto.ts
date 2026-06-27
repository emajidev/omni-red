import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  ESTADOS_EDIFICIO,
  EstadoEdificio,
  NIVELES_DANO,
  NivelDano,
} from './batch-edificios.dto';

/** Reporte (alta individual) de un edificio afectado. */
export class CreateEdificioDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nombre!: string;

  @IsString()
  @MinLength(2)
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
  @IsIn(NIVELES_DANO)
  nivel_dano?: NivelDano;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000)
  personas_atrapadas?: number;

  @IsOptional()
  @IsIn(ESTADOS_EDIFICIO)
  estado?: EstadoEdificio;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  contacto?: string;
}
