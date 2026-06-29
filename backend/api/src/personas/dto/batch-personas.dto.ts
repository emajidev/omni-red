import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { CreatePersonaDto } from './create-persona.dto';

/**
 * Alta masiva de reportes (p. ej. al guardar una lista OCR). Cada registro
 * pasa por la RPC `reportar_persona` (con desduplicación) en una transacción.
 */
export class BatchPersonasDto {
  @ApiProperty({
    description: 'Listado de personas a crear en masa',
    type: [CreatePersonaDto],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(2000)
  @ValidateNested({ each: true })
  @Type(() => CreatePersonaDto)
  registros!: CreatePersonaDto[];
}
