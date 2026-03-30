-- Fix existing verification URLs to use API route format
UPDATE requests 
SET verification_url = REPLACE(
  verification_url, 
  'identity-verifications/', 
  '/api/identity-verifications/'
)
WHERE verification_url LIKE 'identity-verifications/%';

UPDATE requests 
SET verification_url = REPLACE(
  verification_url, 
  'documents/', 
  '/api/identity-verifications/'
)
WHERE verification_url LIKE 'documents/%';

-- Show updated records
SELECT id, verification_url FROM requests WHERE verification_url IS NOT NULL;
