import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    description: 'Nombre de usuario administrador',
    example: 'admin',
    maxLength: 120,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  usuario!: string;

  @ApiProperty({
    description: 'Contraseña de administrador',
    example: 'admin_password123',
    maxLength: 200,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  password!: string;
}
