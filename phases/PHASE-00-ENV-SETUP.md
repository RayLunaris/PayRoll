# Phase 0: Environment Setup (Arch Linux)

**Objective:** Install dan konfigurasi semua dependencies di Arch Linux  
**Estimated Time:** 2-3 hours  
**Prerequisites:** Arch Linux terinstall, akses internet

---

## Tasks

### 0.1 Update System

```bash
# Update semua packages
sudo pacman -Syu

# Jika ada konflik, gunakan
sudo pacman -Syu --noconfirm
```

### 0.2 Install Node.js 22 LTS

```bash
# Install Node.js 22 LTS dari official repo
sudo pacman -S nodejs npm

# Verify installation
node -v  # Should show v22.x.x
npm -v   # Should show 10.x.x atau lebih
```

### 0.3 Install Package Manager (pnpm)

```bash
# Install pnpm via npm
npm install -g pnpm

# Verify
pnpm -v  # Should show 9.x.x atau lebih
```

### 0.4 Install Docker

```bash
# Install Docker
sudo pacman -S docker

# Install Docker Compose
sudo pacman -S docker-compose

# Enable dan start Docker service
sudo systemctl enable docker
sudo systemctl start docker

# Verify
docker --version
docker-compose --version
```

### 0.5 Konfigurasi Docker untuk User

```bash
# Tambahkan user ke group docker (agar tidak perlu sudo)
sudo usermod -aG docker $USER

# Logout dan login lagi, atau gunakan:
newgrp docker

# Verify (tidak perlu sudo)
docker run hello-world
```

### 0.6 Install Git

```bash
# Install Git
sudo pacman -S git

# Konfigurasi Git
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"

# Verify
git --version
```

### 0.7 Install Code Editor (Optional)

```bash
# Install VS Code (AUR)
yay -S visual-studio-code-bin

# Atau install melalui Flatpak
flatpak install flathub com.visualstudio.code

# Atau gunakan nano/vim yang sudah ada
```

### 0.8 Install Database Client (Optional)

```bash
# Install PostgreSQL client (untuk koneksi langsung)
sudo pacman -S postgresql

# Install Redis client
sudo pacman -S redis
```

### 0.9 Install Additional Tools

```bash
# Install curl (biasanya sudah ada)
sudo pacman -S curl

# Install wget
sudo pacman -S wget

# Install unzip
sudo pacman -S unzip

# Install build tools (untuk native modules)
sudo pacman -S base-devel
```

### 0.10 Konfigurasi Firewall (Optional)

```bash
# Enable UFW (jika menggunakan)
sudo pacman -S ufw
sudo ufw enable
sudo ufw allow 3000/tcp  # Frontend
sudo ufw allow 3001/tcp  # API Gateway
sudo ufw allow 5432/tcp  # PostgreSQL
sudo ufw allow 6379/tcp  # Redis
```

---

## Verification Checklist

- [x] Node.js 22+ terinstall (`node -v` -> v26.8.2)
- [x] npm terinstall (`npm -v` -> 12.0.2)
- [x] pnpm terinstall (`pnpm -v` -> 11.26.0)
- [x] Docker terinstall (`docker --version` -> 29.8.0)
- [x] Docker Compose terinstall (`docker-compose --version` -> 5.5.1)
- [x] Docker service running (`docker ps`)
- [x] User bisa jalankan docker tanpa sudo (`ray` in `docker` group)
- [x] Git terinstall (`git --version` -> 2.55.0)
- [x] Build tools terinstall (gcc 16.2.1, make 4.4.1, curl, wget, unzip)

---

## Troubleshooting

### Error: "permission denied while trying to connect to the Docker daemon socket"

```bash
# Pastikan user sudah di group docker
groups  # Cek apakah ada 'docker' di list

# Jika belum, tambahkan
sudo usermod -aG docker $USER

# Logout dan login lagi
```

### Error: "node: command not found"

```bash
# Cek path Node.js
which node
echo $PATH

# Jika tidak ditemukan, tambahkan ke PATH
export PATH="/usr/bin:$PATH"

# Tambahkan ke .bashrc agar persisten
echo 'export PATH="/usr/bin:$PATH"' >> ~/.bashrc
```

### Error: "docker-compose: command not found"

```bash
# Pastikan docker-compose terinstall
sudo pacman -S docker-compose

# Atau gunakan docker compose (tanpa dash)
docker compose version
```

### Error: "EACCES permission errors"

```bash
# Fix npm permission
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'

# Tambahkan ke PATH
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
```

---

## Next Phase

Setelah Phase 0 selesai, lanjut ke:
**[Phase 1: Project Structure Setup](./PHASE-01-PROJECT-STRUCTURE.md)**
