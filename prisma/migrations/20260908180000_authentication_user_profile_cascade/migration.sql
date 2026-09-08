-- User profiles are owned by their authentication user. Deleting the parent
-- must not leave an orphaned profile row or block user deletion.
ALTER TABLE `authentication_user_profiles`
  DROP FOREIGN KEY `authentication_user_profiles_user_id_fkey`;

ALTER TABLE `authentication_user_profiles`
  ADD CONSTRAINT `authentication_user_profiles_user_id_fkey`
    FOREIGN KEY (`user_id`) REFERENCES `authentication_users`(`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE;
