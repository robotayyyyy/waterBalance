# Ubuntu Deployment Guide: Next.js + NestJS + PostgreSQL

Complete guide for deploying your Docker-based application stack on Ubuntu Server (20.04 LTS, 22.04 LTS, or 24.04 LTS).

## Table of Contents
- [System Requirements](#system-requirements)
- [Ubuntu Initial Setup](#ubuntu-initial-setup)
- [Docker Installation on Ubuntu](#docker-installation-on-ubuntu)
- [Firewall Configuration (UFW)](#firewall-configuration-ufw)
- [Application Deployment](#application-deployment)
- [Nginx Setup on Ubuntu](#nginx-setup-on-ubuntu)
- [SSL Certificate Setup](#ssl-certificate-setup)
- [System Optimization](#system-optimization)
- [Monitoring and Logging](#monitoring-and-logging)
- [Backup and Maintenance](#backup-and-maintenance)
- [Security Hardening](#security-hardening)
- [Troubleshooting Ubuntu-Specific Issues](#troubleshooting-ubuntu-specific-issues)

## System Requirements

### Minimum Requirements
- **Ubuntu Version**: 20.04 LTS, 22.04 LTS, or 24.04 LTS (64-bit)
- **CPU**: 2 vCPUs
- **RAM**: 4GB (8GB recommended for production)
- **Storage**: 20GB SSD (50GB+ recommended)
- **Network**: Public IP address

### Recommended EC2 Instance Types
- **Development**: t3.medium (2 vCPU, 4GB RAM)
- **Production**: t3.large (2 vCPU, 8GB RAM) or t3.xlarge (4 vCPU, 16GB RAM)
- **Database-heavy**: r6i.large (2 vCPU, 16GB RAM)

## Ubuntu Initial Setup

### 1. Connect to Your Ubuntu Server

```bash
# SSH into your server (replace with your details)
ssh -i your-key.pem ubuntu@your-ec2-public-ip

# Or if using password authentication
ssh ubuntu@your-server-ip
```

### 2. Update System Packages

```bash
# Update package index
sudo apt update

# Upgrade all packages
sudo apt upgrade -y

# Clean up
sudo apt autoremove -y
sudo apt autoclean

# Check Ubuntu version
lsb_release -a
```

### 3. Set System Timezone

```bash
# List available timezones
timedatectl list-timezones

# Set timezone (example: US Eastern)
sudo timedatectl set-timezone America/New_York

# Or UTC (recommended for servers)
sudo timedatectl set-timezone UTC

# Verify
timedatectl
```

### 4. Configure Hostname

```bash
# Set hostname
sudo hostnamectl set-hostname your-app-server

# Update /etc/hosts
sudo nano /etc/hosts
```

Add this line:
```
127.0.0.1   your-app-server
```

### 5. Create Swap Space (If Needed)

Recommended if you have less than 8GB RAM:

```bash
# Check if swap exists
sudo swapon --show
free -h

# Create 4GB swap file
sudo fallocate -l 4G /swapfile

# Set permissions
sudo chmod 600 /swapfile

# Make it a swap file
sudo mkswap /swapfile

# Enable swap
sudo swapon /swapfile

# Make it permanent
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Verify
sudo swapon --show
free -h
```

### 6. Install Essential Packages

```bash
# Install commonly needed tools
sudo apt install -y \
    curl \
    wget \
    git \
    nano \
    vim \
    htop \
    net-tools \
    build-essential \
    software-properties-common \
    apt-transport-https \
    ca-certificates \
    gnupg \
    lsb-release \
    ufw \
    unzip

# Install monitoring tools
sudo apt install -y \
    sysstat \
    iotop \
    iftop \
    ncdu
```

## Docker Installation on Ubuntu

### Method 1: Official Docker Installation (Recommended)

```bash
# Remove old Docker versions (if any)
sudo apt remove -y docker docker-engine docker.io containerd runc

# Add Docker's official GPG key
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Set up the Docker repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Update package index
sudo apt update

# Install Docker Engine, CLI, and plugins
sudo apt install -y \
    docker-ce \
    docker-ce-cli \
    containerd.io \
    docker-buildx-plugin \
    docker-compose-plugin

# Verify installation
docker --version
docker compose version

# Test Docker
sudo docker run hello-world
```

### Method 2: Convenience Script (Quick Install)

```bash
# Download and run Docker installation script
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Verify
docker --version
```

### Post-Installation Steps

#### 1. Add Your User to Docker Group

```bash
# Add current user to docker group (avoid using sudo)
sudo usermod -aG docker $USER

# Add ubuntu user specifically (on EC2)
sudo usermod -aG docker ubuntu

# Apply group changes (re-login or use newgrp)
newgrp docker

# Verify (should work without sudo)
docker ps
docker compose version
```

#### 2. Configure Docker to Start on Boot

```bash
# Enable Docker service
sudo systemctl enable docker.service
sudo systemctl enable containerd.service

# Check status
sudo systemctl status docker

# Start Docker if not running
sudo systemctl start docker
```

#### 3. Configure Docker Daemon (Optional but Recommended)

```bash
# Create daemon.json configuration
sudo nano /etc/docker/daemon.json
```

Add this configuration:
```json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  },
  "storage-driver": "overlay2",
  "metrics-addr": "127.0.0.1:9323",
  "experimental": false,
  "live-restore": true
}
```

```bash
# Restart Docker to apply changes
sudo systemctl restart docker

# Verify configuration
docker info
```

## Firewall Configuration (UFW)

### 1. Install and Enable UFW

```bash
# UFW is usually pre-installed on Ubuntu
# If not installed:
sudo apt install -y ufw

# Check status
sudo ufw status

# Set default policies
sudo ufw default deny incoming
sudo ufw default allow outgoing
```

### 2. Configure Essential Rules

```bash
# IMPORTANT: Allow SSH first (prevent lockout!)
sudo ufw allow 22/tcp comment 'SSH'

# Or limit SSH to prevent brute force
sudo ufw limit 22/tcp comment 'SSH rate limit'

# Allow HTTP and HTTPS (for Nginx)
sudo ufw allow 80/tcp comment 'HTTP'
sudo ufw allow 443/tcp comment 'HTTPS'

# For development: Allow application ports (optional)
# Only do this if not using Nginx reverse proxy
sudo ufw allow from YOUR_IP_ADDRESS to any port 3000 comment 'Next.js dev'
sudo ufw allow from YOUR_IP_ADDRESS to any port 3001 comment 'NestJS dev'

# Or allow from anywhere (NOT recommended for production)
# sudo ufw allow 3000/tcp comment 'Next.js'
# sudo ufw allow 3001/tcp comment 'NestJS'

# Enable firewall
sudo ufw --force enable

# Verify rules
sudo ufw status numbered
sudo ufw status verbose
```

### 3. UFW Management Commands

```bash
# View all rules with numbers
sudo ufw status numbered

# Delete rule by number
sudo ufw delete 3

# Delete rule by specification
sudo ufw delete allow 3000/tcp

# Disable firewall temporarily
sudo ufw disable

# Enable firewall
sudo ufw enable

# Reset all rules
sudo ufw reset

# Show listening ports
sudo ufw show listening
```

### 4. Advanced UFW Rules

```bash
# Allow from specific IP range
sudo ufw allow from 192.168.1.0/24 to any port 5432 comment 'PostgreSQL from local network'

# Allow specific IP to specific port
sudo ufw allow from 1.2.3.4 to any port 3000

# Deny from specific IP
sudo ufw deny from 1.2.3.4

# Allow Docker subnet (if needed)
sudo ufw allow from 172.17.0.0/16

# Log dropped connections
sudo ufw logging on
sudo ufw logging medium
```

## Application Deployment

### 1. Prepare Application Directory

```bash
# Create application directory
sudo mkdir -p /opt/myapp
sudo chown -R $USER:$USER /opt/myapp
cd /opt/myapp

# Or use home directory
mkdir -p ~/myapp
cd ~/myapp
```

### 2. Clone Your Repository

```bash
# If using Git
git clone https://github.com/yourusername/your-repo.git .

# Or upload files using SCP
# From your local machine:
# scp -i your-key.pem -r ./project-folder ubuntu@your-server-ip:/home/ubuntu/myapp/
```

### 3. Set Up Environment Variables

```bash
# Create .env file
nano .env
```

Add your configuration:
```bash
# Database Configuration
POSTGRES_USER=myuser
POSTGRES_PASSWORD=SecurePassword123!
POSTGRES_DB=myapp_production
POSTGRES_PORT=5432

# NestJS Configuration
NESTJS_PORT=3001
NODE_ENV=production
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
CORS_ORIGIN=https://yourdomain.com

# Next.js Configuration
NEXTJS_PORT=3000
NEXT_PUBLIC_API_URL=https://yourdomain.com/api

# Optional: Additional configurations
TZ=UTC
```

```bash
# Set proper permissions
chmod 600 .env

# Verify
cat .env
```

### 4. Create Required Directories

```bash
# Create directories for Docker volumes and logs
mkdir -p logs
mkdir -p init-scripts
mkdir -p backups

# Set permissions
chmod 755 logs init-scripts backups
```

### 5. Deploy with Docker Compose

```bash
# Make sure you're in the project directory
cd /opt/myapp

# Build and start services
docker compose up -d --build

# View logs
docker compose logs -f

# Check status
docker compose ps

# Verify all containers are healthy
docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
```

### 6. Verify Deployment

```bash
# Test locally
curl http://localhost:3000
curl http://localhost:3001/health

# Check container logs
docker compose logs nextjs
docker compose logs nestjs
docker compose logs postgres

# Check resource usage
docker stats --no-stream
```

## Nginx Setup on Ubuntu

### 1. Install Nginx

```bash
# Update package list
sudo apt update

# Install Nginx
sudo apt install -y nginx

# Start and enable Nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# Check status
sudo systemctl status nginx

# Test from browser: http://your-server-ip
# You should see "Welcome to nginx"
```

### 2. Configure Nginx for Your Application

```bash
# Remove default configuration
sudo rm /etc/nginx/sites-enabled/default

# Create new configuration
sudo nano /etc/nginx/sites-available/myapp
```

Add this configuration:
```nginx
# HTTP server - redirect to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name yourdomain.com www.yourdomain.com;

    # For Let's Encrypt validation
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    # Redirect all HTTP to HTTPS
    location / {
        return 301 https://$server_name$request_uri;
    }
}

# HTTPS server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL certificates (will be added by Certbot)
    # ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Logging
    access_log /var/log/nginx/myapp_access.log;
    error_log /var/log/nginx/myapp_error.log;

    # Client max body size
    client_max_body_size 10M;

    # Next.js frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # NestJS API
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Health check endpoint
    location /health {
        proxy_pass http://localhost:3001/health;
        access_log off;
    }

    # Deny access to hidden files
    location ~ /\. {
        deny all;
        access_log off;
        log_not_found off;
    }
}
```

### 3. Enable and Test Configuration

```bash
# Create symbolic link to enable site
sudo ln -s /etc/nginx/sites-available/myapp /etc/nginx/sites-enabled/

# Test Nginx configuration
sudo nginx -t

# If test passes, reload Nginx
sudo systemctl reload nginx

# Check status
sudo systemctl status nginx
```

### 4. Configure Nginx Performance (Optional)

```bash
# Edit main Nginx configuration
sudo nano /etc/nginx/nginx.conf
```

Optimize these settings:
```nginx
user www-data;
worker_processes auto;
pid /run/nginx.pid;
include /etc/nginx/modules-enabled/*.conf;

events {
    worker_connections 2048;
    use epoll;
    multi_accept on;
}

http {
    # Basic Settings
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    server_tokens off;

    # Buffer sizes
    client_body_buffer_size 128k;
    client_max_body_size 10m;
    client_header_buffer_size 1k;
    large_client_header_buffers 4 4k;
    output_buffers 1 32k;
    postpone_output 1460;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml text/javascript application/json application/javascript application/xml+rss application/rss+xml font/truetype font/opentype application/vnd.ms-fontobject image/svg+xml;
    gzip_disable "msie6";

    # Other configurations...
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # Logging
    access_log /var/log/nginx/access.log;
    error_log /var/log/nginx/error.log;

    # Virtual Host Configs
    include /etc/nginx/conf.d/*.conf;
    include /etc/nginx/sites-enabled/*;
}
```

```bash
# Test and reload
sudo nginx -t
sudo systemctl reload nginx
```

## SSL Certificate Setup

### 1. Install Certbot

```bash
# Update package list
sudo apt update

# Install Certbot and Nginx plugin
sudo apt install -y certbot python3-certbot-nginx

# Verify installation
certbot --version
```

### 2. Obtain SSL Certificate

```bash
# Make sure your domain points to your server
# Check DNS: dig yourdomain.com
# Or: nslookup yourdomain.com

# Obtain certificate (Certbot will automatically configure Nginx)
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Follow the prompts:
# - Enter email address
# - Agree to terms of service
# - Choose whether to redirect HTTP to HTTPS (recommended: Yes)
```

### 3. Test Auto-Renewal

```bash
# Certbot sets up auto-renewal automatically
# Test renewal process
sudo certbot renew --dry-run

# Check renewal timer
sudo systemctl status certbot.timer

# Enable timer if not active
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer
```

### 4. Verify SSL Configuration

```bash
# Check certificate details
sudo certbot certificates

# Test SSL configuration
curl -I https://yourdomain.com

# Or use SSL Labs
# Visit: https://www.ssllabs.com/ssltest/analyze.html?d=yourdomain.com
```

## System Optimization

### 1. Optimize Kernel Parameters

```bash
# Edit sysctl configuration
sudo nano /etc/sysctl.conf
```

Add these optimizations:
```bash
# Network optimizations
net.core.somaxconn = 65535
net.ipv4.tcp_max_syn_backlog = 8192
net.ipv4.tcp_fin_timeout = 30
net.ipv4.tcp_keepalive_time = 300
net.ipv4.tcp_keepalive_probes = 5
net.ipv4.tcp_keepalive_intvl = 15

# File system optimizations
fs.file-max = 2097152
fs.inotify.max_user_watches = 524288

# Memory management
vm.swappiness = 10
vm.dirty_ratio = 60
vm.dirty_background_ratio = 2
```

```bash
# Apply changes
sudo sysctl -p

# Verify
sudo sysctl -a | grep -E "somaxconn|tcp_max_syn_backlog|file-max"
```

### 2. Increase File Limits

```bash
# Edit limits configuration
sudo nano /etc/security/limits.conf
```

Add these lines:
```bash
* soft nofile 65535
* hard nofile 65535
* soft nproc 65535
* hard nproc 65535
root soft nofile 65535
root hard nofile 65535
root soft nproc 65535
root hard nproc 65535
```

```bash
# Verify (requires re-login)
ulimit -n
ulimit -u
```

### 3. Configure Log Rotation

```bash
# Create log rotation config for Docker
sudo nano /etc/logrotate.d/docker-compose
```

Add:
```bash
/opt/myapp/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    create 0644 ubuntu ubuntu
}
```

```bash
# Test log rotation
sudo logrotate -d /etc/logrotate.d/docker-compose
```

## Monitoring and Logging

### 1. Install Monitoring Tools

```bash
# htop for process monitoring
sudo apt install -y htop

# iotop for I/O monitoring
sudo apt install -y iotop

# nethogs for network monitoring
sudo apt install -y nethogs

# ncdu for disk usage
sudo apt install -y ncdu
```

### 2. Monitor Docker Containers

```bash
# View container stats in real-time
docker stats

# View logs
docker compose logs -f --tail=100

# View specific service logs
docker compose logs -f nextjs
docker compose logs -f nestjs
docker compose logs -f postgres

# Save logs to file
docker compose logs > /opt/myapp/logs/docker-$(date +%Y%m%d).log
```

### 3. System Monitoring Commands

```bash
# CPU and memory usage
htop

# Disk usage
df -h
ncdu /opt/myapp

# Network connections
sudo netstat -tulpn
sudo ss -tulpn

# Check open ports
sudo lsof -i -P -n | grep LISTEN

# System resource usage
vmstat 1 10
iostat -x 1 10

# Process tree
ps auxf
```

### 4. Set Up Log Viewing

```bash
# View Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# View system logs
sudo journalctl -u nginx -f
sudo journalctl -u docker -f

# View application logs
tail -f /opt/myapp/logs/*.log
```

### 5. Create Monitoring Script

```bash
# Create monitoring script
nano ~/monitor.sh
```

```bash
#!/bin/bash

echo "=== System Status at $(date) ==="
echo ""

echo "--- CPU and Memory ---"
top -bn1 | head -5

echo ""
echo "--- Disk Usage ---"
df -h | grep -E '^/dev/|Filesystem'

echo ""
echo "--- Docker Containers ---"
docker compose -f /opt/myapp/docker-compose.yml ps

echo ""
echo "--- Network Connections ---"
sudo netstat -tulpn | grep -E ':(80|443|3000|3001|5432)'

echo ""
echo "--- Service Status ---"
systemctl status nginx docker | grep Active
```

```bash
# Make executable
chmod +x ~/monitor.sh

# Run it
./monitor.sh
```

## Backup and Maintenance

### 1. Database Backup Script

```bash
# Create backup script
sudo nano /opt/myapp/backup-db.sh
```

```bash
#!/bin/bash

# Configuration
BACKUP_DIR="/opt/myapp/backups"
DATE=$(date +%Y%m%d_%H%M%S)
CONTAINER_NAME="postgres_db"
DB_USER="myuser"
DB_NAME="myapp_production"
RETENTION_DAYS=7

# Create backup directory
mkdir -p $BACKUP_DIR

# Create backup
docker exec $CONTAINER_NAME pg_dump -U $DB_USER $DB_NAME | gzip > $BACKUP_DIR/db_backup_$DATE.sql.gz

# Check if backup was successful
if [ $? -eq 0 ]; then
    echo "Backup successful: db_backup_$DATE.sql.gz"

    # Remove old backups
    find $BACKUP_DIR -name "db_backup_*.sql.gz" -mtime +$RETENTION_DAYS -delete
    echo "Old backups removed (older than $RETENTION_DAYS days)"
else
    echo "Backup failed!"
    exit 1
fi

# List current backups
echo "Current backups:"
ls -lh $BACKUP_DIR
```

```bash
# Make executable
chmod +x /opt/myapp/backup-db.sh

# Test it
./backup-db.sh
```

### 2. Schedule Automated Backups

```bash
# Edit crontab
crontab -e
```

Add this line (daily backup at 2 AM):
```bash
0 2 * * * /opt/myapp/backup-db.sh >> /opt/myapp/logs/backup.log 2>&1
```

```bash
# Verify cron job
crontab -l

# Check cron logs
grep CRON /var/log/syslog
```

### 3. Database Restore Procedure

```bash
# List available backups
ls -lh /opt/myapp/backups/

# Restore from backup
gunzip < /opt/myapp/backups/db_backup_YYYYMMDD_HHMMSS.sql.gz | \
  docker exec -i postgres_db psql -U myuser -d myapp_production

# Or restore to new database
gunzip < /opt/myapp/backups/db_backup_YYYYMMDD_HHMMSS.sql.gz | \
  docker exec -i postgres_db psql -U myuser -d new_database_name
```

### 4. Full System Backup

```bash
# Create full backup script
sudo nano /opt/myapp/full-backup.sh
```

```bash
#!/bin/bash

BACKUP_DIR="/opt/myapp/backups/full"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup application files
tar -czf $BACKUP_DIR/app_$DATE.tar.gz \
    --exclude='/opt/myapp/node_modules' \
    --exclude='/opt/myapp/backups' \
    --exclude='/opt/myapp/logs' \
    /opt/myapp

# Backup Docker volumes
docker run --rm \
    -v postgres_data:/data \
    -v $BACKUP_DIR:/backup \
    ubuntu tar -czf /backup/postgres_volume_$DATE.tar.gz /data

echo "Full backup completed: $DATE"
```

### 5. Update and Maintenance

```bash
# Create update script
nano ~/update-system.sh
```

```bash
#!/bin/bash

echo "Starting system update..."

# Update Ubuntu packages
sudo apt update
sudo apt upgrade -y
sudo apt autoremove -y
sudo apt autoclean

# Update Docker images
cd /opt/myapp
docker compose pull
docker compose up -d --build

# Clean up Docker
docker system prune -f

echo "Update completed!"
```

## Security Hardening

### 1. Secure SSH Configuration

```bash
# Edit SSH configuration
sudo nano /etc/ssh/sshd_config
```

Update these settings:
```bash
# Disable root login
PermitRootLogin no

# Disable password authentication (use keys only)
PasswordAuthentication no
PubkeyAuthentication yes

# Change SSH port (optional, makes it harder to find)
# Port 2222

# Disable empty passwords
PermitEmptyPasswords no

# Limit login attempts
MaxAuthTries 3

# Set login grace time
LoginGraceTime 30

# Allow specific users only
AllowUsers ubuntu your-username
```

```bash
# Restart SSH service
sudo systemctl restart sshd

# IMPORTANT: Test SSH in a new terminal before closing current session!
```

### 2. Install and Configure Fail2Ban

```bash
# Install Fail2Ban
sudo apt install -y fail2ban

# Create local configuration
sudo cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local
sudo nano /etc/fail2ban/jail.local
```

Update configuration:
```ini
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5
destemail = your-email@example.com
sendername = Fail2Ban

[sshd]
enabled = true
port = ssh
logpath = /var/log/auth.log
maxretry = 3

[nginx-http-auth]
enabled = true
port = http,https
logpath = /var/log/nginx/error.log

[nginx-noscript]
enabled = true
port = http,https
logpath = /var/log/nginx/access.log
```

```bash
# Start and enable Fail2Ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban

# Check status
sudo fail2ban-client status
sudo fail2ban-client status sshd
```

### 3. Configure Automatic Security Updates

```bash
# Install unattended-upgrades
sudo apt install -y unattended-upgrades apt-listchanges

# Configure automatic updates
sudo dpkg-reconfigure -plow unattended-upgrades

# Edit configuration
sudo nano /etc/apt/apt.conf.d/50unattended-upgrades
```

Enable security updates:
```bash
Unattended-Upgrade::Allowed-Origins {
    "${distro_id}:${distro_codename}-security";
    "${distro_id}ESMApps:${distro_codename}-apps-security";
    "${distro_id}ESM:${distro_codename}-infra-security";
};

Unattended-Upgrade::AutoFixInterruptedDpkg "true";
Unattended-Upgrade::MinimalSteps "true";
Unattended-Upgrade::Remove-Unused-Kernel-Packages "true";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
Unattended-Upgrade::Automatic-Reboot "false";
```

### 4. Harden Docker Security

```bash
# Create Docker daemon security config
sudo nano /etc/docker/daemon.json
```

Add security settings:
```json
{
  "icc": false,
  "userns-remap": "default",
  "no-new-privileges": true,
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
```

```bash
# Restart Docker
sudo systemctl restart docker
```

### 5. Set Up Intrusion Detection

```bash
# Install AIDE (Advanced Intrusion Detection Environment)
sudo apt install -y aide

# Initialize AIDE database
sudo aideinit

# Move database
sudo mv /var/lib/aide/aide.db.new /var/lib/aide/aide.db

# Run check
sudo aide --check

# Schedule daily checks
echo "0 3 * * * root /usr/bin/aide --check | mail -s 'AIDE Report' your-email@example.com" | sudo tee -a /etc/crontab
```

## Troubleshooting Ubuntu-Specific Issues

### 1. Docker Permission Issues

```bash
# If you get permission denied
sudo usermod -aG docker $USER
newgrp docker

# Reset Docker socket permissions
sudo chmod 666 /var/run/docker.sock

# Or restart Docker
sudo systemctl restart docker
```

### 2. Port Already in Use

```bash
# Find process using port
sudo lsof -i :3000
sudo netstat -tulpn | grep :3000

# Kill process
sudo kill -9 <PID>

# Or find and kill in one command
sudo fuser -k 3000/tcp
```

### 3. Out of Disk Space

```bash
# Check disk usage
df -h
du -sh /*
ncdu /

# Clean Docker resources
docker system prune -a --volumes

# Clean apt cache
sudo apt clean
sudo apt autoclean
sudo apt autoremove

# Clean old logs
sudo journalctl --vacuum-time=3d
```

### 4. Container Won't Start

```bash
# Check container logs
docker compose logs <service-name>

# Check system logs
sudo journalctl -u docker -n 100

# Restart Docker
sudo systemctl restart docker

# Rebuild and restart
docker compose down
docker compose up -d --build --force-recreate
```

### 5. Nginx Issues

```bash
# Test configuration
sudo nginx -t

# Check error logs
sudo tail -f /var/log/nginx/error.log

# Restart Nginx
sudo systemctl restart nginx

# Check Nginx status
sudo systemctl status nginx

# Check if port 80/443 is in use
sudo lsof -i :80
sudo lsof -i :443
```

### 6. Database Connection Issues

```bash
# Check if PostgreSQL container is running
docker compose ps postgres

# Check PostgreSQL logs
docker compose logs postgres

# Test connection
docker compose exec postgres psql -U myuser -d myapp_production

# Check from NestJS container
docker compose exec nestjs sh
# Inside container:
nc -zv postgres 5432
```

### 7. Memory Issues

```bash
# Check memory usage
free -h
htop

# Check container memory
docker stats

# Increase swap if needed (see earlier section)

# Restart containers
docker compose restart
```

## Quick Reference Commands

### System Management
```bash
# Check system info
lsb_release -a
uname -a
hostnamectl

# Check services
sudo systemctl status nginx
sudo systemctl status docker

# View logs
sudo journalctl -xe
sudo journalctl -u nginx -f
```

### Docker Commands
```bash
# Start services
docker compose up -d

# Stop services
docker compose down

# View logs
docker compose logs -f

# Rebuild
docker compose up -d --build

# Clean up
docker system prune -a
```

### Firewall Commands
```bash
# Check status
sudo ufw status numbered

# Add rule
sudo ufw allow 80/tcp

# Remove rule
sudo ufw delete <number>

# Reload
sudo ufw reload
```

### Monitoring
```bash
# System resources
htop
docker stats

# Disk usage
df -h
ncdu /

# Network
sudo netstat -tulpn
sudo ss -tulpn
```

## Automated Deployment Script

Here's a complete deployment script for Ubuntu:

```bash
# Save as: deploy-ubuntu.sh
nano ~/deploy-ubuntu.sh
```

```bash
#!/bin/bash

set -e  # Exit on error

echo "========================================"
echo "Ubuntu Deployment Script"
echo "========================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Functions
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}→ $1${NC}"
}

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    print_error "Please do not run as root"
    exit 1
fi

print_info "Updating system packages..."
sudo apt update && sudo apt upgrade -y
print_success "System updated"

print_info "Installing essential packages..."
sudo apt install -y curl wget git nano htop net-tools ufw
print_success "Essential packages installed"

print_info "Installing Docker..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    print_success "Docker installed"
else
    print_success "Docker already installed"
fi

print_info "Configuring firewall..."
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
print_success "Firewall configured"

print_info "Installing Nginx..."
if ! command -v nginx &> /dev/null; then
    sudo apt install -y nginx
    sudo systemctl enable nginx
    sudo systemctl start nginx
    print_success "Nginx installed"
else
    print_success "Nginx already installed"
fi

print_info "Installing Certbot..."
if ! command -v certbot &> /dev/null; then
    sudo apt install -y certbot python3-certbot-nginx
    print_success "Certbot installed"
else
    print_success "Certbot already installed"
fi

print_info "Creating application directory..."
sudo mkdir -p /opt/myapp
sudo chown -R $USER:$USER /opt/myapp
print_success "Application directory created"

echo ""
echo "========================================"
echo "Deployment Complete!"
echo "========================================"
echo ""
echo "Next steps:"
echo "1. Clone your repository to /opt/myapp"
echo "2. Create .env file with your configuration"
echo "3. Run: cd /opt/myapp && docker compose up -d"
echo "4. Configure Nginx with your domain"
echo "5. Run: sudo certbot --nginx -d yourdomain.com"
echo ""
echo "IMPORTANT: Log out and log back in for Docker group changes to take effect!"
```

```bash
# Make executable
chmod +x ~/deploy-ubuntu.sh

# Run it
./deploy-ubuntu.sh
```

This comprehensive guide covers everything you need to deploy and manage your Docker-based application on Ubuntu!
