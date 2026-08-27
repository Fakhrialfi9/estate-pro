import type { ActorContext } from '../property-master.types.js';

export interface PropertyLifecycleRepository {
  verify(uuid: string, version: number, actor: ActorContext): Promise<unknown>;
  publish(uuid: string, version: number, actor: ActorContext): Promise<unknown>;
}

export const PROPERTY_LIFECYCLE_REPOSITORY = Symbol(
  'PROPERTY_LIFECYCLE_REPOSITORY',
);
