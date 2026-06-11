-- v6: super admin can restrict a café with a message.
-- When restricted_message is set, the owner's portal shows a banner and blocks navigation.

ALTER TABLE public.cafes
  ADD COLUMN IF NOT EXISTS restricted_message text;

COMMENT ON COLUMN public.cafes.restricted_message IS
  'When set, the café portal is locked and this message is shown to the owner. Cleared by super admin to restore access.';
