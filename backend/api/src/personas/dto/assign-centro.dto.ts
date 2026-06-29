import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class AssignCentroDto {
  /** id del centro/sitio (hospital/refugio); null para desasignar. */
  @ApiPropertyOptional({
    description: 'ID del centro (hospital o refugio) al cual asignar la persona. Usar null para desasignar.',
    example: 'd3b07384-d113-49cd-a5d6-8ee3c2f54bf9',
    nullable: true,
  })
  @IsOptional()
  @IsUUID()
  centro_id?: string | null;
}
