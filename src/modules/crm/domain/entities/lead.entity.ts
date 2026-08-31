export type LeadStatusCode =
  | 'NEW'
  | 'CONTACTED'
  | 'QUALIFIED'
  | 'NURTURING'
  | 'CLOSED_WON'
  | 'CLOSED_LOST'
  | 'ARCHIVED';
export interface LeadProps {
  readonly uuid: string;
  readonly code: string;
  readonly contactUuid: string;
  readonly sourceUuid: string;
  readonly typeUuid: string;
  readonly campaignUuid: string | null;
  readonly status: LeadStatusCode;
  readonly ownerUserUuid: string | null;
  readonly score: number;
  readonly scoreVersion: number;
  readonly archivedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export class LeadEntity {
  private constructor(private readonly props: LeadProps) {}
  static create(props: LeadProps): LeadEntity {
    for (const [field, value] of Object.entries({
      uuid: props.uuid,
      contactUuid: props.contactUuid,
      sourceUuid: props.sourceUuid,
      typeUuid: props.typeUuid,
    }))
      if (!UUID_RE.test(value)) throw new Error(`Invalid lead ${field}`);
    if (!props.code.trim()) throw new Error('Lead code is required');
    if (!Number.isInteger(props.score) || props.score < 0)
      throw new Error('Lead score must be a non-negative integer');
    if (!Number.isInteger(props.scoreVersion) || props.scoreVersion < 1)
      throw new Error('Lead scoreVersion must be positive');
    return new LeadEntity({ ...props });
  }
  get uuid(): string {
    return this.props.uuid;
  }
  get status(): LeadStatusCode {
    return this.props.status;
  }
  get ownerUserUuid(): string | null {
    return this.props.ownerUserUuid;
  }
  get score(): number {
    return this.props.score;
  }
  get scoreVersion(): number {
    return this.props.scoreVersion;
  }
  get archivedAt(): Date | null {
    return this.props.archivedAt;
  }
  transitionTo(
    next: LeadStatusCode,
    isAllowed: (from: LeadStatusCode, to: LeadStatusCode) => boolean,
    now = new Date(),
  ): LeadEntity {
    if (this.props.archivedAt !== null)
      throw new Error('Archived lead cannot transition');
    if (next === this.props.status) return this;
    if (!isAllowed(this.props.status, next))
      throw new Error(
        `Invalid lead status transition: ${this.props.status} -> ${next}`,
      );
    return new LeadEntity({
      ...this.props,
      status: next,
      archivedAt: next === 'ARCHIVED' ? now : this.props.archivedAt,
      updatedAt: now,
    });
  }
  assign(ownerUserUuid: string | null, now = new Date()): LeadEntity {
    if (this.props.archivedAt !== null)
      throw new Error('Archived lead cannot be assigned');
    if (ownerUserUuid !== null && !UUID_RE.test(ownerUserUuid))
      throw new Error('Invalid assignee UUID');
    return new LeadEntity({ ...this.props, ownerUserUuid, updatedAt: now });
  }
  withScore(score: number, now = new Date()): LeadEntity {
    if (!Number.isInteger(score) || score < 0)
      throw new Error('Lead score must be a non-negative integer');
    return new LeadEntity({
      ...this.props,
      score,
      scoreVersion: this.props.scoreVersion + 1,
      updatedAt: now,
    });
  }
  archive(now = new Date()): LeadEntity {
    return new LeadEntity({
      ...this.props,
      status: 'ARCHIVED',
      archivedAt: now,
      updatedAt: now,
    });
  }
  toProps(): LeadProps {
    return { ...this.props };
  }
}
