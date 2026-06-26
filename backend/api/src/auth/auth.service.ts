import { Injectable, UnauthorizedException } from '@nestjs/common';

/**
 * Validación de credenciales de administrador para acciones protegidas
 * (p. ej. la carga de listas por OCR/CSV). Las credenciales viven en variables
 * de entorno (ADMIN_USER / ADMIN_PASSWORD), nunca en el frontend.
 */
@Injectable()
export class AuthService {
  validate(usuario: string, password: string): { ok: true } {
    const u = process.env.ADMIN_USER ?? 'admin';
    const p = process.env.ADMIN_PASSWORD ?? '';
    if (p && usuario === u && password === p) {
      return { ok: true };
    }
    throw new UnauthorizedException('Usuario o contraseña inválidos');
  }
}
