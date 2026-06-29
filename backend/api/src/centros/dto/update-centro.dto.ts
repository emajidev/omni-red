import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsIn, IsString, MaxLength } from 'class-validator';

export const CAPACIDADES = ['abierto', 'al_limite', 'cerrado'] as const;
export type Capacidad = (typeof CAPACIDADES)[number];

export class UpdateCentroDto {
  @ApiProperty({
    description: 'Estado de capacidad actual del centro',
    enum: CAPACIDADES,
    example: 'al_limite',
  })
  @IsIn(CAPACIDADES)
  capacidad!: Capacidad;

  @ApiProperty({
    description: 'Lista de insumos prioritarios solicitados',
    example: ['agua', 'medicinas'],
    maxItems: 30,
    type: [String],
  })
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  insumos_solicitados!: string[];
}
