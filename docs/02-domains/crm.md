# CRM Domain

`src/modules/crm` is a bounded-context boundary for customer/relationship workflows. The current repository does not claim a completed CRM application surface.

## Responsibility
CRM will own customer/contact records, relationship lifecycle, activities, and future lead/customer coordination with sales. It should consume identity and authorization outcomes through defined application interfaces.

## Workflow boundary
Authentication identifies the acting user. Authorization decides whether that user may access a CRM resource. CRM business rules should remain inside the CRM context rather than being embedded in controllers or authentication code.

## Current implementation truth
The module is scaffolded; therefore this document records the architectural responsibility and boundary only. No unimplemented CRM workflow is presented as available API behavior.
