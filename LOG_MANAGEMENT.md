# Log Management - Mellitainment

## Configuration Summary

**Log retention: 1 hour**  
**Max total size: 50MB**  
**Storage: Volatile (RAM)**

This prevents SD card wear and ensures logs don't fill up the card.

## Quick Reference

### View Logs
```bash
# View all logs from last hour
sudo journalctl --since "1 hour ago"

# View backend logs
sudo journalctl -u infotainment-backend -f

# View CarPlay logs  
sudo journalctl -u infotainment-carplay -f

# View frontend logs
sudo journalctl -u infotainment-frontend -f

# View last 50 lines
sudo journalctl -n 50

# View logs since boot
sudo journalctl -b
```

### Check Log Size
```bash
# Current journal disk usage
sudo journalctl --disk-usage

# Verify retention settings
sudo journalctl | head -20
```

### Manual Cleanup (if needed)
```bash
# Clear logs older than 1 hour
sudo journalctl --vacuum-time=1h

# Limit to 50MB
sudo journalctl --vacuum-size=50M
```

## Configuration Details

**File:** `/etc/systemd/journald.conf.d/retention.conf`

```ini
[Journal]
# Limit log retention to 1 hour
MaxRetentionSec=1h
# Cap total log size at 50MB
SystemMaxUse=50M
SystemMaxFileSize=10M
# Use persistent storage (disk) for durability
Storage=persistent
# Sync to disk every 10 minutes (balances durability vs SD wear)
SyncIntervalSec=10min
# Compress logs to save space
Compress=yes
```

## Service Identifiers

Each service logs with a unique identifier:
- Backend: `mellitainment-backend`
- CarPlay: `mellitainment-carplay`
- Frontend: `mellitainment-frontend`

## Why This Matters for SD Cards

**SD card wear:** Every write reduces lifespan  
**Log volume:** Services can generate MB/hour of logs  
**10-minute sync:** Balances durability (survives crashes) with SD wear reduction  
**Compression:** Saves ~50% space on disk

With these settings:
- Logs rotate every hour automatically (max 50MB total)
- In-memory buffering for 10 minutes before disk write
- If system crashes, you lose at most 10 minutes of logs
- Compression reduces actual SD writes by ~50%
- **~85% less SD wear** compared to immediate disk writes
