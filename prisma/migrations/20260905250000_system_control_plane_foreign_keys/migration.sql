ALTER TABLE `system_integration_credentials`
  ADD CONSTRAINT `system_integration_credentials_integration_fk`
  FOREIGN KEY (`integration_id`) REFERENCES `system_integrations` (`id`) ON DELETE CASCADE;

ALTER TABLE `system_integration_runtime`
  ADD CONSTRAINT `system_integration_runtime_integration_fk`
  FOREIGN KEY (`integration_id`) REFERENCES `system_integrations` (`id`) ON DELETE CASCADE;

ALTER TABLE `system_integration_operations`
  ADD CONSTRAINT `system_integration_operations_integration_fk`
  FOREIGN KEY (`integration_id`) REFERENCES `system_integrations` (`id`) ON DELETE CASCADE;

ALTER TABLE `system_integration_events`
  ADD CONSTRAINT `system_integration_events_integration_fk`
  FOREIGN KEY (`integration_id`) REFERENCES `system_integrations` (`id`) ON DELETE CASCADE;

ALTER TABLE `system_integration_conflicts`
  ADD CONSTRAINT `system_integration_conflicts_integration_fk`
  FOREIGN KEY (`integration_id`) REFERENCES `system_integrations` (`id`) ON DELETE CASCADE;
