#!/bin/bash
# TenderBazaar Database Backup Script
# Usage: ./scripts/backup.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="./backups"
FILENAME="tenderbazaar_backup_${DATE}.sql.gz"

mkdir -p $BACKUP_DIR

echo "Starting backup..."
pg_dump $DATABASE_URL | gzip > "$BACKUP_DIR/$FILENAME"

echo "Backup saved to: $BACKUP_DIR/$FILENAME"
echo "Size: $(du -sh $BACKUP_DIR/$FILENAME | cut -f1)"

# Keep only last 30 backups
ls -t $BACKUP_DIR/*.sql.gz | tail -n +31 | xargs rm -f 2>/dev/null

echo "Backup complete!"
