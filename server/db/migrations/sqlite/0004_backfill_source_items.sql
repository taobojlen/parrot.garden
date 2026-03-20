INSERT OR IGNORE INTO `source_item` (`id`, `source_id`, `item_guid`, `created_at`)
SELECT DISTINCT
  lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6))),
  c.source_id,
  pl.item_guid,
  s.created_at
FROM `post_log` pl
JOIN `connection` c ON c.id = pl.connection_id
JOIN `source` s ON s.id = c.source_id;
