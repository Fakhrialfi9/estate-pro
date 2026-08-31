export type ContactStatus = 'ACTIVE' | 'ARCHIVED';

export interface ContactProps {
  readonly uuid: string;
  readonly firstName: string;
  readonly lastName: string | null;
  readonly displayName: string;
  readonly companyName: string | null;
  readonly jobTitle: string | null;
  readonly status: ContactStatus;
  readonly ownerUserUuid: string | null;
  readonly source: string | null;
  readonly archivedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export type ContactPatch = Partial<Pick<ContactProps, 'firstName' | 'lastName' | 'displayName' | 'companyName' | 'jobTitle'>>;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class ContactEntity {
  private constructor(private readonly props: ContactProps) {}

  static create(props: ContactProps): ContactEntity {
    if (!UUID_RE.test(props.uuid)) throw new Error('Invalid contact UUID');
    if (!props.firstName.trim()) throw new Error('Contact first name is required');
    if (!props.displayName.trim()) throw new Error('Contact display name is required');
    if (props.status === 'ARCHIVED' && props.archivedAt === null) throw new Error('Archived contact requires archivedAt');
    return new ContactEntity({ ...props });
  }

  get uuid(): string { return this.props.uuid; }
  get status(): ContactStatus { return this.props.status; }
  get ownerUserUuid(): string | null { return this.props.ownerUserUuid; }
  get archivedAt(): Date | null { return this.props.archivedAt; }

  archive(at: Date = new Date()): ContactEntity {
    return new ContactEntity({ ...this.props, status: 'ARCHIVED', archivedAt: at, updatedAt: at });
  }

  update(patch: ContactPatch, now: Date = new Date()): ContactEntity {
    if (this.props.status === 'ARCHIVED') throw new Error('Archived contact cannot be mutated');
    return ContactEntity.create({ ...this.props, ...patch, updatedAt: now });
  }

  toProps(): ContactProps { return { ...this.props }; }
}
