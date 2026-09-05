import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SystemEnvironmentService {
  constructor(private readonly config: ConfigService) {}

  read() {
    return {
      environment: this.config.get<string>('app.environment', 'development'),
      application: this.config.get<string>('app.name', 'estate-pro-api'),
      version: this.config.get<string>('app.version', '0.0.0'),
      nodeVersion: process.version,
      platform: process.platform,
      architecture: process.arch,
      deploymentId: this.config.get<string>('app.deploymentId') ?? null,
      buildSha: this.config.get<string>('app.buildSha') ?? null,
      region: this.config.get<string>('app.region') ?? null,
      uptimeSeconds: Math.floor(process.uptime()),
    };
  }
}
