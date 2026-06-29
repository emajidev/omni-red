import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class HeartbeatDto {
  @ApiProperty({
    description: 'Identificador único del cliente/sesión activa',
    example: 'client_xyz789abc',
    minLength: 8,
    maxLength: 100,
  })
  @IsString()
  @MinLength(8)
  @MaxLength(100)
  clientId!: string;
}
