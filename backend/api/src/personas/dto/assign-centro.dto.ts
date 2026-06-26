import { IsOptional, IsUUID } from 'class-validator';

export class AssignCentroDto {
  /** id del centro/sitio (hospital/refugio); null para desasignar. */
  @IsOptional()
  @IsUUID()
  centro_id?: string | null;
}
