import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isIP } from 'node:net';

const channels = ['EMAIL', 'WHATSAPP', 'SMS'] as const;
type Channel = (typeof channels)[number];

@Injectable()
export class CrmCommunicationHealthService {
  constructor(private readonly config: ConfigService) {}

  status() {
    return {
      channels: Object.fromEntries(
        channels.map((channel) => [channel, this.channelStatus(channel)]),
      ),
    };
  }

  private channelStatus(channel: Channel) {
    const raw = this.config.get<string>(`${channel.toLowerCase() === 'whatsapp' ? 'whatsapp' : channel.toLowerCase()}.providerUrl`);
    if (!raw) return { configured: false, reachable: false, reason: 'provider_not_configured' };
    try {
      const url = new URL(raw);
      if (url.protocol !== 'https:' || url.username || url.password || isIP(url.hostname))
        return { configured: true, reachable: false, reason: 'invalid_provider_endpoint' };
      return { configured: true, reachable: false, reason: 'health_check_not_executed' };
    } catch {
      return { configured: true, reachable: false, reason: 'invalid_provider_endpoint' };
    }
  }
}
