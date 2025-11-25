# Kuno Messaging Platform - Roadmap

## ✅ MVP (Aktuell)

### Implementiert
- **Signal Protocol Verschlüsselung**
  - X3DH Key Exchange
  - PreKey Bundles
  - AES-GCM Verschlüsselung
  - Multi-Device Support (PreKeys pro Gerät)

- **Master Node (Node.js)**
  - User Registration & JWT Authentication
  - PreKey Management & Distribution
  - WebSocket Real-time Messaging
  - PostgreSQL für User/Device/PreKey Storage
  - Redis für Sessions

- **Standard Nodes (Go)**
  - Message Queue (30 Tage TTL)
  - CouchDB Integration
  - REST API für Message CRUD

- **Web Client (React)**
  - Chat UI mit Conversations
  - Signal Protocol Client-side Encryption
  - IndexedDB für lokale Keys
  - WebSocket Live-Updates

- **Infrastruktur**
  - Docker Compose Development & Production
  - Nginx mit SSL/TLS Support
  - Multi-Node CouchDB Replication (planned)
  - Automated Deployment Script

### Bekannte Einschränkungen
- ⚠️ **Keine Key Backups** - Gerät verloren = Nachrichten verloren
- ⚠️ **Keine Gruppen** - Nur 1:1 Chats
- ⚠️ **Keine Medien** - Nur Text Messages
- ⚠️ **Kein Raft Consensus** - Standard Nodes noch ohne Raft

---

## 🔄 Phase 1: Key Backup & Recovery

### 1.1 Encrypted Key Backup
**Ziel:** User können ihre Keys sichern und wiederherstellen

**Features:**
- User wählt Backup-Passphrase (min. 12 Zeichen)
- Keys werden mit Passphrase verschlüsselt (AES-256-GCM)
- Encrypted Backup wird auf Master Node gespeichert
- Backup-Status im UI anzeigen

**API Endpoints:**
```
POST /api/backup/create
  Body: { encryptedKeys: string, keyDerivationSalt: string }
  
POST /api/backup/restore
  Body: { passphrase: string }
  Returns: { encryptedKeys: string, keyDerivationSalt: string }
  
DELETE /api/backup/delete
```

**UI Changes:**
- Settings → "Backup Keys" Button
- Passphrase Input Modal
- "Keys backed up ✓" Indicator
- Import/Restore Flow für neue Geräte

### 1.2 QR-Code Export (Alternative)
**Ziel:** Offline Backup ohne Server

**Features:**
- Export Keys als verschlüsselten QR-Code
- User speichert QR selbst (Screenshot, Print)
- Import per Kamera-Scan oder File Upload

**Tech:**
- `qrcode.react` für QR Generation
- `html5-qrcode` für Scanning
- Verschlüsselung: User Passphrase + AES-256

---

## 🔄 Phase 2: Multi-Device Sync

### 2.1 Device Authorization
**Ziel:** Mehrere Geräte mit synchronisierten Keys

**Features:**
- Primary Device generiert QR-Code
- Secondary Device scannt QR → autorisiert
- Keys werden encrypted zwischen Geräten synchronisiert

**Flow:**
1. Primary: "Add Device" → QR-Code anzeigen
2. Secondary: "Link to existing account" → QR scannen
3. Primary: Bestätigung → Keys senden
4. Secondary: Keys empfangen & speichern

**DB Changes:**
```sql
-- Master Node
ALTER TABLE devices ADD COLUMN is_primary BOOLEAN DEFAULT false;
ALTER TABLE devices ADD COLUMN linked_to_device_id UUID REFERENCES devices(id);
```

### 2.2 Cross-Device Message Sync
**Ziel:** Messages auf allen Geräten verfügbar

**Features:**
- Standard Node sendet Message an alle User-Geräte
- WebSocket broadcast zu allen aktiven Sessions
- Offline Devices erhalten Messages beim nächsten Connect

---

## 🔄 Phase 3: Gruppenfeatures

### 3.1 Group Chats
**Ziel:** Verschlüsselte Gruppenchats (2-50 Teilnehmer)

**Features:**
- Group Creation & Member Management
- Sender Keys für effiziente Verschlüsselung
- Admin Rechte (add/remove members)

**DB Schema:**
```sql
CREATE TABLE groups (
  id UUID PRIMARY KEY,
  name VARCHAR(255),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE group_members (
  group_id UUID REFERENCES groups(id),
  user_id UUID REFERENCES users(id),
  is_admin BOOLEAN DEFAULT false,
  joined_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (group_id, user_id)
);

CREATE TABLE group_sender_keys (
  group_id UUID REFERENCES groups(id),
  device_id UUID REFERENCES devices(id),
  sender_key_id UUID,
  public_key TEXT,
  PRIMARY KEY (group_id, device_id)
);
```

### 3.2 Group Encryption (Sender Keys)
**Tech:**
- Jedes Device generiert Sender Key für Gruppe
- Sender Key wird an alle Mitglieder distribuiert
- Messages werden mit Sender Key verschlüsselt (1x encrypt, N receivers)

---

## 🔄 Phase 4: Media & Attachments

### 4.1 File Uploads
**Ziel:** Bilder, Videos, Dokumente versenden

**Features:**
- Client-side File Encryption vor Upload
- Master Node als Media Storage (oder S3)
- Thumbnail Generation für Bilder
- Max File Size: 100 MB

**Flow:**
1. User wählt Datei
2. Client verschlüsselt mit Message Key
3. Upload zu Master Node → File ID
4. Message mit File ID + Decryption Key senden
5. Empfänger lädt File → entschlüsselt client-side

### 4.2 Voice Messages
**Features:**
- Browser Audio Recording API
- Opus Codec für Kompression
- Max Länge: 5 Minuten

---

## 🔄 Phase 5: Mobile Apps

### 5.1 React Native App (iOS & Android)
**Ziel:** Native Apps mit gleicher Funktionalität wie Web

**Tech Stack:**
- React Native 0.73+
- React Native Signal Protocol (libsignal)
- SQLite für lokale Datenbank
- Push Notifications (FCM/APNS)

**Features:**
- Alle Web-Features
- Push Notifications für neue Messages
- Background Message Sync
- Biometric Authentication (FaceID/Fingerprint)

---

## 🔄 Phase 6: Production Readiness

### 6.1 Raft Consensus für Standard Nodes
**Ziel:** High Availability & Fault Tolerance

**Tech:**
- Raft Consensus Algorithm
- Leader Election
- Log Replication
- State Machine Replication

### 6.2 CouchDB Multi-Master Replication
**Ziel:** Eventual Consistency über alle Standard Nodes

**Config:**
- Bidirectional Replication zwischen allen 3 CouchDB Instances
- Conflict Resolution Strategy
- Replication Monitoring

### 6.3 Monitoring & Logging
**Tools:**
- Prometheus für Metrics
- Grafana für Dashboards
- Loki für Log Aggregation
- Alertmanager für Incidents

**Metrics:**
- Message Throughput (msg/sec)
- WebSocket Connections
- Database Query Performance
- Node Health Status

### 6.4 Automated Backups
**Schedule:**
- PostgreSQL: Daily Backup mit pg_dump
- CouchDB: Continuous Replication + Weekly Snapshot
- Retention: 30 Tage

### 6.5 Load Testing
**Ziel:** 10.000 concurrent users, 100 msg/sec

**Tools:**
- k6 für Load Testing
- Horizontal Scaling Tests
- Database Connection Pool Tuning

---

## 🔄 Phase 7: Advanced Features

### 7.1 Disappearing Messages
- Auto-delete nach X Sekunden/Minuten/Stunden
- Timer im UI anzeigen

### 7.2 Message Reactions
- Emoji Reactions (❤️ 👍 😂 etc.)
- Multiple Reactions pro Message

### 7.3 Read Receipts
- Optional: "Read by X at Y"
- Privacy-Setting: An/Aus

### 7.4 Typing Indicators
- "User is typing..." über WebSocket
- 3 Sekunden Debounce

### 7.5 Message Search
- Full-text Search in Conversations
- Filter nach Datum, Sender, Media Type

### 7.6 Voice/Video Calls
- WebRTC P2P Calls
- STUN/TURN Server für NAT Traversal
- End-to-End Encrypted

---

## 💰 Monetarisierung (Optional - Zukunft)

### Option A: Freemium Model
- **Free:** Basis Features, 5 GB Storage
- **Premium:** €4.99/Monat - Unbegrenzt Storage, Voice Calls, Custom Themes

### Option B: Self-Hosted Pro
- **Free:** Open Source für Self-Hosting
- **Managed:** €19.99/Monat - Hosted Version mit Support

### Option C: Enterprise
- On-Premise Deployment
- SSO Integration (LDAP/SAML)
- Compliance Features (GDPR, HIPAA)
- SLA & Support Contract

---

## 📋 Aktueller Status

**Was läuft:**
✅ MVP lokal entwickelt und getestet
✅ Docker Production Setup
✅ GitHub Repository
✅ Server Deployment in Progress

**Nächste Steps:**
1. ✅ Production Deployment abschließen (SSL, .env)
2. 🔄 Testing & Bug Fixes
3. 🔄 Phase 1: Key Backup implementieren
4. 🔄 Phase 2: Multi-Device Support
5. 🔄 Phase 6: Raft + CouchDB Replication

---

## Hinweise

- **Security First:** Alle Features mit Security Review
- **Privacy by Design:** Minimal Data Collection
- **Open Source:** Core bleibt Open Source (MIT/GPL)
- **Community:** Nach MVP Stabilisierung → Public Beta
