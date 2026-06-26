import { ArrayMaxSize, IsArray, IsIn, IsString, MaxLength } from 'class-validator';

export const CAPACIDADES = ['abierto', 'al_limite', 'cerrado'] as const;
export type Capacidad = (typeof CAPACIDADES)[number];

export class UpdateCentroDto {
  @IsIn(CAPACIDADES)
  capacidad!: Capacidad;

  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  insumos_solicitados!: string[];
}
