import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) { }

  /** POST /api/auth/login — valida credenciales de admin. 200 = ok, 401 = no. */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Autenticar administrador con usuario y contraseña (Solo para carga masiva de datos)',
    description:
      '⚠️ Este endpoint se usa **exclusivamente para la carga de archivos** (listas OCR / CSV). ' +
      'No es un inicio de sesión de propósito general. El token/sesión resultante solo se emplea ' +
      'para autorizar la subida de archivos al pipeline de procesamiento.',
  })
  @ApiResponse({
    status: 200,
    description: 'Credenciales válidas. Devuelve confirmación de acceso.',
    schema: { example: { ok: true, rol: 'admin' } },
  })
  @ApiResponse({
    status: 401,
    description: 'Credenciales inválidas.',
    schema: { example: { statusCode: 401, message: 'Credenciales inválidas' } },
  })
  login(@Body() dto: LoginDto) {
    return this.auth.validate(dto.usuario, dto.password);
  }
}
