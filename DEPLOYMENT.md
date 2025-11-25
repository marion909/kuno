# Kuno Deployment Guide

## Voraussetzungen

- Linux Server (Ubuntu 22.04 LTS empfohlen)
- Docker & Docker Compose installiert
- Domain mit DNS A-Record auf Server-IP
- Mindestens 4GB RAM, 2 CPU Cores, 50GB Storage

## Schnell-Deployment

### 1. Server vorbereiten

```bash
# Docker installieren
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Docker Compose installieren
sudo apt update
sudo apt install docker-compose-plugin -y
```

### 2. Repository auf Server kopieren

```bash
# Option A: Via Git
git clone git@github.com:marion909/kuno.git /opt/kuno
cd /opt/kuno

# Option B: Via rsync von lokalem PC
rsync -avz --exclude node_modules --exclude .git \
  C:\Projekte\Kuno/ user@server:/opt/kuno/
```

### 3. Environment konfigurieren

```bash
cd /opt/kuno
cp .env.production.example .env.production
nano .env.production

# Generiere sichere Secrets:
openssl rand -hex 32  # Für JWT_SECRET
openssl rand -hex 16  # Für Passwörter
```

### 4. SSL-Zertifikate mit Let's Encrypt

```bash
# Certbot installieren
sudo apt install certbot -y

# Zertifikat erstellen
sudo certbot certonly --standalone -d deine-domain.de

# Zertifikate kopieren
sudo mkdir -p nginx/ssl
sudo cp /etc/letsencrypt/live/deine-domain.de/fullchain.pem nginx/ssl/
sudo cp /etc/letsencrypt/live/deine-domain.de/privkey.pem nginx/ssl/
sudo chmod 644 nginx/ssl/*.pem
```

### 5. Deployment starten

```bash
chmod +x deploy.sh
./deploy.sh
```

### 6. Firewall konfigurieren

```bash
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
```

## Alternative: Einzelne Befehle

```bash
# 1. Environment laden
export $(cat .env.production | grep -v '^#' | xargs)

# 2. Images bauen
docker-compose -f docker-compose.prod.yml build

# 3. Starten
docker-compose -f docker-compose.prod.yml up -d

# 4. Status prüfen
docker-compose -f docker-compose.prod.yml ps

# 5. Logs ansehen
docker-compose -f docker-compose.prod.yml logs -f

# 6. Stoppen
docker-compose -f docker-compose.prod.yml down
```

## Monitoring

```bash
# Container Status
docker ps

# Logs live ansehen
docker-compose -f docker-compose.prod.yml logs -f master-node

# Resource Usage
docker stats

# Health Checks
curl http://localhost/health
```

## Updates

```bash
cd /opt/kuno
git pull  # oder rsync von lokal
./deploy.sh
```

## Backup

```bash
# Datenbanken sichern
docker exec kuno-postgres pg_dump -U kuno kuno > backup-$(date +%Y%m%d).sql

# CouchDB sichern
docker exec kuno-couchdb-1 curl -X GET http://admin:password@localhost:5984/_all_dbs

# Volumes sichern
docker run --rm -v kuno_postgres_data:/data -v $(pwd):/backup \
  alpine tar czf /backup/postgres-backup.tar.gz /data
```

## Skalierung

### Horizontale Skalierung - Mehr Standard Nodes

```bash
# In docker-compose.prod.yml weitere Standard Nodes hinzufügen
docker-compose -f docker-compose.prod.yml up -d --scale standard-node=5
```

### Vertikale Skalierung - Resource Limits

```yaml
# In docker-compose.prod.yml hinzufügen:
services:
  master-node:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '1'
          memory: 1G
```

## Troubleshooting

### Container startet nicht
```bash
docker logs kuno-master-node
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up
```

### Datenbank-Verbindung fehlschlägt
```bash
docker exec -it kuno-postgres psql -U kuno -d kuno
# In psql: \l (listet Datenbanken)
```

### WebSocket funktioniert nicht
- Prüfe Nginx-Config für WebSocket-Proxy
- Prüfe Firewall-Regeln
- Prüfe Browser-Console auf Fehler

### Performance-Probleme
```bash
# Resource Usage prüfen
docker stats

# Logs auf Fehler prüfen
docker-compose -f docker-compose.prod.yml logs --tail=100

# Datenbank-Performance
docker exec kuno-postgres psql -U kuno -c "SELECT * FROM pg_stat_activity;"
```

## Option 2: Managed Kubernetes (fortgeschritten)

Für größere Deployments empfiehlt sich Kubernetes:
- Helm Charts erstellen
- Auto-Scaling konfigurieren
- Multi-Region Deployment
- GitOps mit ArgoCD/Flux

## Option 3: Cloud-spezifische Lösungen

### AWS
- ECS mit Fargate für Container
- RDS für PostgreSQL
- ElastiCache für Redis
- ALB für Load Balancing

### Google Cloud
- Cloud Run für Container
- Cloud SQL für PostgreSQL
- Memorystore für Redis
- Cloud Load Balancing

### Azure
- Azure Container Instances
- Azure Database for PostgreSQL
- Azure Cache for Redis
- Azure Application Gateway

## Security Checklist

- [ ] SSL/TLS Zertifikate installiert
- [ ] Sichere Passwörter generiert
- [ ] Firewall konfiguriert
- [ ] Rate Limiting aktiv
- [ ] Security Headers gesetzt
- [ ] Regelmäßige Backups eingerichtet
- [ ] Updates automatisiert
- [ ] Monitoring eingerichtet
- [ ] Logs zentral gesammelt
- [ ] Intrusion Detection aktiv
