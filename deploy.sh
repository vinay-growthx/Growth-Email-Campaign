#!/bin/bash

# Define paths
PM2=pm2
NGINX_SITES_AVAILABLE=/etc/nginx/sites-available
NGINX_CONFIG=default

# Define PM2 app names and their respective .env files
APP_NAME_BLUE="app-blue"
APP_NAME_GREEN="app-green"
ENV_BLUE=.env.blue
ENV_GREEN=.env.green

# Port numbers used by the blue and green configurations
PORT_BLUE=4000
PORT_GREEN=4001

# Deploy function
deploy() {
  TARGET_APP_NAME=$1
  TARGET_ENV_FILE=$2
  OLD_PORT=$3
  NEW_PORT=$4

  # Pull latest code and install dependencies
  git pull
  npm install

  # Copy the correct .env file for the target
  # cp $TARGET_ENV_FILE .env

  # Start or restart the target app using PM2
  $PM2 restart ecosystem.config.js --only $TARGET_APP_NAME

  sleep 20
  # Replace the old port with the new port in the nginx config
  sudo sed -i "s/proxy_pass http:\/\/127.0.0.1:$OLD_PORT\/;/proxy_pass http:\/\/127.0.0.1:$NEW_PORT\/;/" $NGINX_SITES_AVAILABLE/$NGINX_CONFIG

  # Reload nginx to pick up the new configuration
  sudo nginx -s reload

  $PM2 logs --lines 50
}

# Check which version is running and deploy the other version
IS_BLUE_RUNNING=$($PM2 ls | grep "$APP_NAME_BLUE" | grep "online")

# Determine the old and new ports based on what is currently running
if [ "$IS_BLUE_RUNNING" ]; then
  echo "Blue is currently running. Deploying Green..."
  deploy $APP_NAME_GREEN $ENV_GREEN $PORT_BLUE $PORT_GREEN
else
  echo "Green is currently running. Deploying Blue..."
  deploy $APP_NAME_BLUE $ENV_BLUE $PORT_GREEN $PORT_BLUE
fi

echo "Deployment complete."
