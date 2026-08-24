import { Module } from '@nestjs/common';

import { TelemetryLifecycle } from './telemetry.lifecycle.js';

@Module({
  providers: [TelemetryLifecycle],
})
export class ObservabilityModule {}
