export type PropertyAgentContext = {
  propertyUuid: string;
  countryUuid?: string;
  provinceUuid?: string;
  cityUuid?: string;
  districtUuid?: string;
  subdistrictUuid?: string;
};

export interface PropertyAgentContextPort {
  getContext(propertyUuid: string): Promise<PropertyAgentContext | null>;
}

export const PROPERTY_AGENT_CONTEXT_PORT = Symbol('PROPERTY_AGENT_CONTEXT_PORT');
