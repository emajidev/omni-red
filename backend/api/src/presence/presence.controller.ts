import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PresenceService } from './presence.service';
import { HeartbeatDto } from './dto/heartbeat.dto';

@ApiTags('Presence')
@Controller('presence')
export class PresenceController {
  constructor(private readonly presence: PresenceService) {}

  /** POST /api/presence/heartbeat — registra latido y devuelve usuarios en línea. */
  @Post('heartbeat')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Registrar latido de usuario activo y obtener el conteo en línea' })
  @ApiResponse({
    status: 200,
    description: 'Latido registrado. Devuelve el número de usuarios activos en este momento.',
    schema: { example: { online: 7 } },
  })
  heartbeat(@Body() dto: HeartbeatDto): { online: number } {
    return { online: this.presence.heartbeat(dto.clientId) };
  }

  /** GET /api/presence/count — solo lectura del nº de usuarios en línea. */
  @Get('count')
  @ApiOperation({ summary: 'Consultar el número de usuarios activos en este momento' })
  @ApiResponse({
    status: 200,
    description: 'Número de usuarios con sesión activa (heartbeat reciente).',
    schema: { example: { online: 7 } },
  })
  count(): { online: number } {
    return { online: this.presence.count() };
  }
}
