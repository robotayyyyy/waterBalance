# Database Data Resilience Plan

## Current State

**What We Have:**
- Docker volume `postgres_data` with local driver
- Volume persists through container restarts/rebuilds
- `restart: unless-stopped` policy on postgres container

**What We DON'T Have:**
- No automated backups
- No backup testing procedures
- No off-site storage
- No replication
- No disaster recovery plan

## Volume Protection Analysis

### Current Volume Configuration
```yaml
volumes:
  postgres_data:
    driver: local
```

**Protects Against:**
- ✅ Container crashes and restarts
- ✅ Container deletion (`docker rm`)
- ✅ Docker daemon restarts
- ✅ Image rebuilds
- ✅ `docker-compose down` (without -v flag)

**Does NOT Protect Against:**
- ❌ `docker-compose down -v` (deletes volumes)
- ❌ `docker volume rm postgres_data`
- ❌ Host machine failure
- ❌ Disk corruption
- ❌ Accidental `DROP DATABASE`
- ❌ Ransomware/malicious deletion
- ❌ Human error in SQL queries

## Implementation Roadmap

### Phase 1: Immediate Actions (Day 1)

**1. Manual Backup Procedure**
```bash
# Create backup
docker exec postgres_db pg_dumpall -U postgres | gzip > backup_$(date +%Y%m%d).sql.gz

# Restore procedure
gunzip -c backup_YYYYMMDD.sql.gz | docker exec -i postgres_db psql -U postgres
```

**2. Test Restore**
```bash
# Create test database
docker exec postgres_db createdb -U postgres test_restore

# Restore to test DB
gunzip -c backup_YYYYMMDD.sql.gz | docker exec -i postgres_db psql -U postgres test_restore

# Verify
docker exec postgres_db psql -U postgres test_restore -c "\dt"

# Cleanup
docker exec postgres_db dropdb -U postgres test_restore
```

**3. Create Backup Directory**
```bash
mkdir -p /root/backups/postgres
```

### Phase 2: This Week

**1. Automated Daily Backups**

Create `/root/scripts/backup-db.sh`:
```bash
#!/bin/bash
BACKUP_DIR="/root/backups/postgres"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
CONTAINER="postgres_db"

mkdir -p $BACKUP_DIR

# Full database backup
docker exec $CONTAINER pg_dumpall -U postgres | gzip > \
  "$BACKUP_DIR/backup_$TIMESTAMP.sql.gz"

# Keep only last 7 days
find $BACKUP_DIR -name "backup_*.sql.gz" -mtime +7 -delete

echo "$(date): Backup completed - backup_$TIMESTAMP.sql.gz"
```

**2. Schedule with Cron**
```bash
chmod +x /root/scripts/backup-db.sh

# Add to crontab (daily at 2 AM)
0 2 * * * /root/scripts/backup-db.sh >> /var/log/db-backup.log 2>&1
```

**3. Backup Monitoring**
```bash
# Alert if no backup in last 25 hours
0 3 * * * [ -z "$(find /root/backups/postgres -name 'backup_*.sql.gz' -mtime -1)" ] && echo "ALERT: No recent backup!" | mail -s "Backup Failed" admin@example.com
```

### Phase 3: This Month

**1. Off-Site Backup Sync**

Option A - AWS S3:
```bash
# Install AWS CLI
apt-get install awscli

# Configure credentials
aws configure

# Add to backup script
aws s3 sync /root/backups/postgres s3://your-bucket/postgres-backups/ \
  --storage-class STANDARD_IA
```

Option B - Any Cloud (rclone):
```bash
# Install rclone
curl https://rclone.org/install.sh | bash

# Configure remote
rclone config

# Add to backup script
rclone sync /root/backups/postgres remote:postgres-backups/
```

**2. Monthly Restore Test**

Create `/root/scripts/test-restore.sh`:
```bash
#!/bin/bash
LATEST_BACKUP=$(ls -t /root/backups/postgres/backup_*.sql.gz | head -1)

if [ -z "$LATEST_BACKUP" ]; then
  echo "ERROR: No backup found!"
  exit 1
fi

echo "Testing restore of: $LATEST_BACKUP"

# Create test database
docker exec postgres_db createdb -U postgres restore_test

# Restore
gunzip -c $LATEST_BACKUP | docker exec -i postgres_db psql -U postgres restore_test

# Basic validation
TABLES=$(docker exec postgres_db psql -U postgres restore_test -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public'")

if [ "$TABLES" -gt 0 ]; then
  echo "SUCCESS: Restore test passed - found $TABLES tables"
else
  echo "WARNING: No tables found in restored database"
fi

# Cleanup
docker exec postgres_db dropdb -U postgres restore_test

echo "Restore test completed: $(date)"
```

Schedule monthly:
```bash
# First day of month at 3 AM
0 3 1 * * /root/scripts/test-restore.sh >> /var/log/restore-test.log 2>&1
```

### Phase 4: Production Readiness

**1. Enable WAL Archiving (Point-in-Time Recovery)**

Update docker-compose.yml:
```yaml
postgres:
  image: postgres:16-alpine
  environment:
    POSTGRES_INITDB_ARGS: "-c wal_level=replica -c archive_mode=on -c archive_command='test ! -f /var/lib/postgresql/wal_archive/%f && cp %p /var/lib/postgresql/wal_archive/%f'"
  volumes:
    - postgres_data:/var/lib/postgresql/data
    - ./wal_archive:/var/lib/postgresql/wal_archive
```

**2. Database Replication (High Availability)**

Add replica service:
```yaml
services:
  postgres-replica:
    image: postgres:16-alpine
    container_name: postgres_replica
    environment:
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-postgres}
      POSTGRES_REPLICATION_MODE: slave
      POSTGRES_MASTER_HOST: postgres
      POSTGRES_MASTER_PORT: 5432
      POSTGRES_REPLICATION_USER: replicator
      POSTGRES_REPLICATION_PASSWORD: replicator_pass
    volumes:
      - postgres_replica_data:/var/lib/postgresql/data
    networks:
      - app-network

volumes:
  postgres_replica_data:
    driver: local
```

**3. Add Backup Service to Docker Compose**

```yaml
services:
  postgres-backup:
    image: postgres:16-alpine
    container_name: postgres_backup
    environment:
      PGHOST: postgres
      PGUSER: ${POSTGRES_USER:-postgres}
      PGPASSWORD: ${POSTGRES_PASSWORD:-postgres}
    volumes:
      - ./backups:/backups
    networks:
      - app-network
    entrypoint: /bin/sh
    command: |
      -c "while true; do
        sleep 86400;
        pg_dumpall -h postgres -U postgres | gzip > /backups/backup_$$(date +%Y%m%d_%H%M%S).sql.gz;
        find /backups -name 'backup_*.sql.gz' -mtime +7 -delete;
      done"
    depends_on:
      postgres:
        condition: service_healthy
```

**4. Monitoring & Alerts**

Key metrics to monitor:
- Backup success/failure
- Backup size (sudden changes indicate issues)
- Last backup timestamp
- Available disk space
- Database connection pool status
- WAL archive lag (if using replication)

## 3-2-1 Backup Strategy

**3 Copies:**
1. Production database (live data)
2. Local backup files (/root/backups/postgres)
3. Off-site backup (S3/cloud storage)

**2 Different Media:**
1. Docker volume (SSD/disk)
2. Compressed backup files (potentially different storage)

**1 Off-Site:**
1. Cloud storage (S3, Google Cloud, Azure, etc.)

## Recovery Procedures

### Scenario 1: Container Deleted, Volume Intact
```bash
# Simply restart the container
docker-compose up -d postgres
# Data automatically restored from postgres_data volume
```

### Scenario 2: Volume Deleted
```bash
# Recreate volume
docker volume create postgres_data

# Start container
docker-compose up -d postgres

# Restore from latest backup
LATEST=$(ls -t /root/backups/postgres/backup_*.sql.gz | head -1)
gunzip -c $LATEST | docker exec -i postgres_db psql -U postgres
```

### Scenario 3: Complete Host Failure
```bash
# On new host:
# 1. Install Docker
# 2. Clone repository
# 3. Download backup from off-site storage
aws s3 cp s3://your-bucket/postgres-backups/backup_latest.sql.gz .

# 4. Start postgres container
docker-compose up -d postgres

# 5. Restore
gunzip -c backup_latest.sql.gz | docker exec -i postgres_db psql -U postgres
```

### Scenario 4: Accidental Data Deletion
```bash
# If caught quickly and WAL archiving enabled:
# Stop postgres
docker-compose stop postgres

# Restore base backup
# Apply WAL files up to point before deletion

# If no WAL archiving, restore from latest backup
# (Will lose data between backup and deletion)
```

## Retention Policy

**Recommended Schedule:**
- Daily backups: Keep 7 days
- Weekly backups: Keep 4 weeks (every Sunday)
- Monthly backups: Keep 12 months (1st of month)

**Implementation:**
```bash
# In backup script, add:
# Keep daily for 7 days
find $BACKUP_DIR -name "backup_*.sql.gz" -mtime +7 -delete

# Weekly backup (Sunday)
if [ $(date +%u) -eq 7 ]; then
  cp $BACKUP_DIR/backup_$TIMESTAMP.sql.gz $BACKUP_DIR/weekly/backup_week_$TIMESTAMP.sql.gz
fi
find $BACKUP_DIR/weekly -name "backup_week_*.sql.gz" -mtime +28 -delete

# Monthly backup (1st of month)
if [ $(date +%d) -eq 01 ]; then
  cp $BACKUP_DIR/backup_$TIMESTAMP.sql.gz $BACKUP_DIR/monthly/backup_month_$TIMESTAMP.sql.gz
fi
find $BACKUP_DIR/monthly -name "backup_month_*.sql.gz" -mtime +365 -delete
```

## Testing Schedule

**Weekly:**
- Verify backup files exist
- Check backup file sizes (detect corruption)

**Monthly:**
- Full restore test to temporary database
- Verify data integrity

**Quarterly:**
- Disaster recovery drill (restore to different host)
- Update documentation

**Annually:**
- Review and update retention policies
- Review storage costs
- Audit backup procedures

## Cost Considerations

**Storage Requirements:**
- Daily backups (7 days): ~7x DB size
- Weekly backups (4 weeks): ~4x DB size
- Monthly backups (12 months): ~12x DB size
- Total: ~23x DB size

**Example:**
- If DB is 1GB: ~23GB storage needed
- If DB is 10GB: ~230GB storage needed

**Cloud Storage Costs (Approximate):**
- AWS S3 Standard-IA: $0.0125/GB/month
- For 100GB: ~$1.25/month

## Security Considerations

**1. Encrypt Backups**
```bash
# Encrypt backup
gpg --symmetric --cipher-algo AES256 backup_file.sql.gz

# Decrypt
gpg --decrypt backup_file.sql.gz.gpg | docker exec -i postgres_db psql -U postgres
```

**2. Secure Credentials**
- Never commit backup scripts with hardcoded passwords
- Use environment variables or secrets management
- Restrict backup file permissions: `chmod 600`

**3. Access Control**
```bash
# Set restrictive permissions
chmod 700 /root/backups
chmod 600 /root/backups/postgres/*.sql.gz
```

## Documentation Checklist

- [ ] Backup procedure documented
- [ ] Restore procedure tested and documented
- [ ] Recovery time objective (RTO) defined
- [ ] Recovery point objective (RPO) defined
- [ ] Disaster recovery contact list
- [ ] Escalation procedures
- [ ] Off-site backup location documented

## Metrics to Track

1. **Backup Success Rate**: Should be 100%
2. **Backup Duration**: Track for performance issues
3. **Backup Size**: Monitor for unexpected growth
4. **Restore Test Success**: Should be 100%
5. **Time to Restore**: Critical for RTO planning

## Next Steps

1. ✅ Read this plan
2. ⬜ Create /root/backups/postgres directory
3. ⬜ Create /root/scripts directory
4. ⬜ Implement Phase 1 (manual backup)
5. ⬜ Test restore procedure
6. ⬜ Implement Phase 2 (automated backups)
7. ⬜ Set up monitoring
8. ⬜ Implement Phase 3 (off-site backups)
9. ⬜ Document RTO/RPO requirements
10. ⬜ Plan for Phase 4 (production features)
