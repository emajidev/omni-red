import { IsString, MaxLength, MinLength } from 'class-validator';

export class HeartbeatDto {
  @IsString()
  @MinLength(8)
  @MaxLength(100)
  clientId!: string;
}
