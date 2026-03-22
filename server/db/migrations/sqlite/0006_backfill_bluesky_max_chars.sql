UPDATE `target`
SET `credentials` = json_set(`credentials`, '$.maxCharacters', 300),
    `updated_at` = strftime('%s', 'now') * 1000
WHERE `type` = 'bluesky'
  AND json_extract(`credentials`, '$.maxCharacters') IS NULL;
