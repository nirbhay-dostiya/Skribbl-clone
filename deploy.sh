#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# deploy.sh  —  Run this ONCE on your EC2 instance to install everything,
#               and then any time you want to redeploy after a git push.
#
# Usage:
#   chmod +x deploy.sh
#   ./deploy.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

APP_DIR="/opt/skribbl"
NGINX_STATIC="/var/www/skribbl"
REPO_URL="https://github.com/nirbhay-dostiya/Skribbl-clone.git"
BRANCH="main"

###############################################################################
# 1. Install system dependencies (idempotent)
###############################################################################
install_deps() {
  echo "==> Installing system dependencies..."

  # Docker
  if ! command -v docker &>/dev/null; then
    curl -fsSL https://get.docker.com | sh
    sudo usermod -aG docker "$USER"
    sudo systemctl enable --now docker
  fi

  # Docker Compose v2
  if ! docker compose version &>/dev/null; then
    sudo apt-get install -y docker-compose-plugin 2>/dev/null || \
    sudo yum install -y docker-compose-plugin 2>/dev/null || true
  fi

  # Node 20 (for building React)
  if ! command -v node &>/dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs 2>/dev/null || \
    sudo yum install -y nodejs 2>/dev/null || true
  fi

  # Nginx
  if ! command -v nginx &>/dev/null; then
    sudo apt-get install -y nginx 2>/dev/null || \
    sudo yum install -y nginx 2>/dev/null || true
    sudo systemctl enable nginx
  fi

  echo "==> Dependencies OK"
}

###############################################################################
# 2. Clone / pull latest code
###############################################################################
fetch_code() {
  echo "==> Fetching latest code..."
  if [ -d "$APP_DIR/.git" ]; then
    git -C "$APP_DIR" fetch origin
    git -C "$APP_DIR" reset --hard "origin/$BRANCH"
  else
    sudo git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
    sudo chown -R "$USER":"$USER" "$APP_DIR"
  fi
  echo "==> Code updated"
}

###############################################################################
# 3. Load secrets from .env file
###############################################################################
load_env() {
  ENV_FILE="$APP_DIR/.env.prod"
  if [ ! -f "$ENV_FILE" ]; then
    echo ""
    echo "ERROR: $ENV_FILE not found!"
    echo "Create it with:"
    echo "  echo 'MYSQL_ROOT_PASSWORD=<strong-root-password>' >> $ENV_FILE"
    echo "  echo 'MYSQL_PASSWORD=<strong-app-password>'      >> $ENV_FILE"
    exit 1
  fi
  # shellcheck disable=SC1090
  set -a; source "$ENV_FILE"; set +a
  echo "==> Secrets loaded from $ENV_FILE"
}

###############################################################################
# 4. Build React frontend
###############################################################################
build_frontend() {
  echo "==> Building React frontend..."
  cd "$APP_DIR/frontend"
  npm ci --silent
  npm run build
  sudo mkdir -p "$NGINX_STATIC"
  sudo rsync -a --delete dist/ "$NGINX_STATIC/"
  echo "==> Frontend built → $NGINX_STATIC"
}

###############################################################################
# 5. Install Nginx config
###############################################################################
configure_nginx() {
  echo "==> Configuring Nginx..."
  sudo cp "$APP_DIR/nginx/nginx.conf" /etc/nginx/sites-available/skribbl
  sudo ln -sf /etc/nginx/sites-available/skribbl /etc/nginx/sites-enabled/skribbl
  sudo rm -f /etc/nginx/sites-enabled/default   # remove default placeholder
  sudo nginx -t
  sudo systemctl reload nginx
  echo "==> Nginx configured"
}

###############################################################################
# 6. Build & start Docker containers (backend + MySQL)
###############################################################################
start_containers() {
  echo "==> Starting Docker containers..."
  cd "$APP_DIR"
  docker compose -f docker-compose.prod.yml pull mysql 2>/dev/null || true
  docker compose -f docker-compose.prod.yml build backend
  docker compose -f docker-compose.prod.yml up -d
  echo "==> Containers started"
  docker compose -f docker-compose.prod.yml ps
}

###############################################################################
# Main
###############################################################################
install_deps
fetch_code
load_env
build_frontend
configure_nginx
start_containers

echo ""
echo "✅  Deployment complete!"
echo "   Visit: http://$(curl -sf http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || hostname -I | awk '{print $1}')"
