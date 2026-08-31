import { ProviderNotConfiguredError, type CommunicationProvider } from './communication-provider.js';
const build=(channel:'EMAIL'|'WHATSAPP'|'SMS'):CommunicationProvider=>({channel,async send(){throw new ProviderNotConfiguredError(channel);}});
export const emailProvider=build('EMAIL');
export const whatsappProvider=build('WHATSAPP');
export const smsProvider=build('SMS');
