-- ============================================================================
-- CAMPUSFIX: SANDBOXED EVALUATION & TESTING CONFIGURATION
-- ============================================================================
-- Run this script manually in the Supabase SQL Editor ONLY during offline
-- development, thesis defense demonstrations, or synthetic test evaluation
-- when test accounts use arbitrary email domains (e.g., test.local, example.com).
--
-- DO NOT execute this file in a production university deployment.
-- ============================================================================

-- Insert wildcard domain row so arbitrary email domains are accepted
insert into public.allowed_email_domains (domain, description)
values ('%', 'Wildcard acceptance for sandboxed offline evaluation and testing')
on conflict (domain) do nothing;
