-- Inspect messages data
SELECT id, "senderId", "receiverId", "createdAt", "isRead" 
FROM message 
ORDER BY "createdAt" DESC 
LIMIT 10;

-- Check what unique senderIds look like (first 10 chars)
SELECT DISTINCT LEFT("senderId", 12) as sender_prefix 
FROM message 
LIMIT 10;

-- Check unique receiverIds
SELECT DISTINCT LEFT("receiverId", 12) as receiver_prefix 
FROM message 
LIMIT 10;

-- Verify if senderIds are User.id
SELECT COUNT(*) as sender_matches_user 
FROM message m 
INNER JOIN "user" u ON u.id = m."senderId";

SELECT COUNT(*) as sender_matches_therapist 
FROM message m 
INNER JOIN therapist t ON t."userId" = m."senderId";

-- Patients with currentTherapist
SELECT 
  p.id as patient_id,
  LEFT(p."userId", 12) as patient_user_id,
  LEFT(p."currentTherapistid", 12) as current_therapist_id,
  LEFT(t."userId", 12) as therapist_user_id,
  u.name as patient_name,
  tu.name as therapist_name
FROM patient p
LEFT JOIN therapist t ON t.id = p."currentTherapistid"
LEFT JOIN "user" u ON u.id = p."userId"
LEFT JOIN "user" tu ON tu.id = t."userId"
WHERE p."currentTherapistid" IS NOT NULL
LIMIT 5;
</write_to_file>
</write_to_file>