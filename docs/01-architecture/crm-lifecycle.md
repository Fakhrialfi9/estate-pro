# CRM lifecycle contract

Lead status transitions are data-backed by `crm_lead_status_transitions` and are enforced by the application operation. Qualification, nurturing, reactivation and closure are explicit commands. The timeline is a read model assembled from lead history, activities, inquiries and communications; it does not persist duplicate event records. Lead conversion is a boundary contract: CRM validates qualification and produces an idempotency key for the Sales context, while Sales remains the owner of the next-domain record until its public conversion contract exists.
