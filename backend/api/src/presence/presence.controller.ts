import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { PresenceService } from './presence.service';
import { HeartbeatDto } from './dto/heartbeat.dto';

@Controller('presence')
export class PresenceController {
  constructor(private readonly presence: PresenceService) {}

  /** POST /api/presence/heartbeat — registra latido y devuelve usuarios en línea. */
  @Post('heartbeat')
  @HttpCode(HttpStatus.OK)
  heartbeat(@Body() dto: HeartbeatDto): { online: number } {
    return { online: this.presence.heartbeat(dto.clientId) };
  }

  /** GET /api/presence/count — solo lectura del nº de usuarios en línea. */
  @Get('count')
  count(): { online: number } {
    return { online: this.presence.count() };
  }
}
