export const USER_PROFILE_TRANSACTION_POLICY = Object.freeze({
  userAndProfileCreateAtomic: false,
  userAndProfileUpdateAtomic: false,
  profileLifecycleIndependent: true,
  reason:
    'Step 46–56 exposes independent profile lifecycle operations. User creation/update is not part of the profile business operation, so a cross-aggregate transaction would add coupling without enforcing a required invariant.',
});
