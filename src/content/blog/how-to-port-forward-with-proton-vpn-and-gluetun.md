---
title: "How to port forward with Proton VPN and Gluetun (built in NAT-PMP)"
description: "Guide on how to port forward with Proton VPN and Gluetun which now has NAT-PMP functionality built in."
pubDate: "Jul 08 2023"
heroImage: "/assets/posts/port-forward-gluetun-protonvpn/gluetun-protonvpn.jpg"
categories: self-hosted, docker
---

Due to recent changes with Mullvad, they no longer allow port forwarding which I was using extensively for qBittorrent. Therefore, as I was already using Proton Mail, I thought I would just switch to Proton VPN after the port forward deactivation on Mullvad. Proton VPN uses NAT-PMP for port forwarding so setting it up is a little different to how it was done with Mullvad. There was a tool I saw by soxfor called [qbittorrent-natmap](https://github.com/soxfor/qbittorrent-natmap) but luckily, NAT-PMP was implemented directly within Gluetun ([PR](https://github.com/qdm12/gluetun/pull/1543) & [GitHub issue](https://github.com/qdm12/gluetun/issues/1488)). This guide is tailored to Proton VPN but you may still find this guide helpful for other VPN providers, be sure to check the [Gluetun Wiki](https://github.com/qdm12/gluetun-wiki) too.

## Prerequisites

- Proton VPN account/subscription
- Docker
- Your application that you want to port forward, e.g. qBittorrent

## Useful resources

- [Gluetun](https://github.com/qdm12/gluetun)
  - [Proton VPN wiki entry](https://github.com/qdm12/gluetun-wiki/blob/main/setup/providers/protonvpn.md)
  - [VPN port forward wiki entry](https://github.com/qdm12/gluetun-wiki/blob/main/setup/advanced/vpn-port-forwarding.md)
- [Proton VPN manual port forward guide](https://protonvpn.com/support/port-forwarding-manual-setup/)

## Generate VPN Configuration on ProtonVPN

I am using WireGuard but if you would like to use OpenVPN then the steps and configuration options are pretty similar. If there's anything vastly different then I would recommend viewing the Gluetun wiki.

1. Navigate to [ProtonVPN](https://protonvpn.com) and login.
2. Click on "Downloads" in the left hand side bar.
   ![Downloads page](/assets/posts/port-forward-gluetun-protonvpn/protonvpn-downloads-page.png "ProtonVPN Downloads page")
3. Scroll down to "[WireGuard configuration](https://account.protonvpn.com/downloads#wireguard-configuration)."
   ![WG Config](/assets/posts/port-forward-gluetun-protonvpn/protonvpn-wg-config.png "ProtonVPN WireGuard config page")
   - "SAVED CONFIGURATION" at the top is the previous configurations you have created. You will not have any if this is your first configuration.
   - Fill out the fields provided and make sure "NAT-PMP (Port Forwarding) is selected in section 3 - Select VPN Options.
   - For which server to choose, I chose a local server that supports P2P with decent overhead for load (this doesn't guarantee that load will not be high in the future obviously).
4. Once created, you can save the configuration file. Make a note of the Private Key as it's only displayed on creation. That should be all on ProtonVPN, we can proceed to setting up Gluetun.

## Setting up Gluetun and creating container

I used the docker-compose template on the Gluetun Github repo to get the container running. Modify the docker-compose.yml below to fit your setup and config. You will most likely only need to change the ports exposed, volume and then the environment varibles.

```yaml
version: "3"
services:
  gluetun:
    image: qmcgaw/gluetun:latest
    container_name: gluetun
    # line above must be uncommented to allow external containers to connect.
    # See https://github.com/qdm12/gluetun-wiki/blob/main/setup/connect-a-container-to-gluetun.md#external-container-to-gluetun
    cap_add:
      - NET_ADMIN
    devices:
      - /dev/net/tun:/dev/net/tun
    ports:
      - 8888:8888/tcp # HTTP proxy
      - 8388:8388/tcp # Shadowsocks
      - 8388:8388/udp # Shadowsocks
      # Other services
      # qBittorrent
      - QBITTORRENT_WEB_UI_PORT:QBITTORRENT_WEB_UI_PORT
      # Other containers that are being routed via the container where you still want access the resources like web ui on local network
      - PORT:PORT
    volumes:
      - /path/to/store/gluetun/config:/gluetun
    environment:
      # I specify the PUID and PGID but this is optional (default is 1000,1000), description from Wiki "User ID/Group ID to run as non root and for ownership of files written"
      #- PUID=UID
      #- PGID=GID
      # See https://github.com/qdm12/gluetun-wiki/tree/main/setup#setup
      - VPN_SERVICE_PROVIDER=custom
      - VPN_TYPE=wireguard
      # OpenVPN:
      #- OPENVPN_USER=
      #- OPENVPN_PASSWORD=
      # Wireguard:
      - WIREGUARD_PUBLIC_KEY= # "PublicKey" under [Peer] in WG Config
      - WIREGUARD_PRIVATE_KEY= # "PrivateKey" under [Interface] in WG Config - only shown on config creation
      - WIREGUARD_ADDRESSES=IP/Prefix Length # "Address" under [Interface] in WG Config
      - VPN_ENDPOINT_IP=IP # "Endpoint" under [Peer] in WG Config
      - VPN_ENDPOINT_PORT=51820 # should be the default 51820 but can confirm by seeing the port after IP in "Endpoint"
      - VPN_DNS_ADDRESS=IP # "DNS" under [Interface] in WG Config
      - VPN_PORT_FORWARDING=on
      - VPN_PORT_FORWARDING_PROVIDER=protonvpn
      # Timezone for accurate log times
      - TZ=Europe/London # Change to your TZ
      # Server list updater
      # See https://github.com/qdm12/gluetun-wiki/blob/main/setup/servers.md#update-the-vpn-servers-list
      - UPDATER_PERIOD=24h
```

## Utilising Gluetun container for other containers

I use `network_mode: "container:gluetun"` as my containers are separated out in different docker-compose stacks. Change this to `network_mode: "service:gluetun"` if your other container is in the same docker-compose stack.

- Visit [Connect a container to Gluetun](https://github.com/qdm12/gluetun-wiki/blob/main/setup/connect-a-container-to-gluetun.md#connect-a-container-to-gluetun) for more info.
- See my qBittorrent docker-compose.yml for reference
  ```yaml
  version: "2.4"
  services:
  qbittorrent:
    image: lscr.io/linuxserver/qbittorrent:latest
    container_name: qbittorrent
    network_mode: container:gluetun
    environment:
      - PUID=UID_FOR_MY_USER
      - PGID=GID_FOR_MY_USER
      - TZ=Europe/London
      - UMASK=022
      - WEBUI_PORT=PORT_I_USE_FOR_QB_WEBUI
    volumes:
      - /path/to/qbittorrent/config:/config
      - /path/to/downloads:/downloads
    restart: unless-stopped
  ```

## Updating qBittorrent listen port

My use for port forwarding is to use it with qBittorrent. Once Gluetun uses NAT-PMP to forward a port, it keeps the same port forwarded. If your internet connection drops or you restart the Gluetun container, the qBittorrent listen port is still on the previous forwarded port. Therefore, we need a way to update the listen port. I have provided my bash script below where I run the script every 5 minutes via a cronjob. The [Github issue](https://github.com/qdm12/gluetun/issues/1488) talking about NAT-PMP implementation for ProtonVPN has a few users describing their method to update the listen port on qBittorrent so it's worth a read to see what works best for you and if needed, you can always modify the script/s or create one.

- E.g. [SnoringDragon docker implentation to update the port](https://github.com/qdm12/gluetun/issues/1488#issuecomment-1622936712)

### My script to change listen port on qBittorrent

Uses curl and jq. Runs every 5 minutes with a cronjob.

```bash
#!/bin/bash

# Configuration variables - change this for your setup
gluetun_container_name="GLUETUN_CONTAINER_NAME"
qbittorrent_container_name="QBITTORRENT_CONTAINER_NAME"
gluetun_origin="http://GLUETUN_IP:GLUETUN_HTTP_CONTROL_SERVER_PORT"
qb_origin="http://QBITTORRENT_IP:QBITTORRENT_WEBUI_PORT"
####################################################################

# Arrays for URLs
declare -A gluetun_urls=(
  ["pub_ip"]="$gluetun_origin/v1/publicip/ip"
  ["portforwarded"]="$gluetun_origin/v1/openvpn/portforwarded"
)

declare -A qbittorrent_urls=(
  #used for getting and setting listen_port
  ["prefs"]="$qb_origin/api/v2/app/preferences"
  ["setPrefs"]="$qb_origin/api/v2/app/setPreferences"
)


# Function to check if a Docker container is running
is_container_running() {
  local container_name="$1"
  docker inspect -f '{{.State.Running}}' "$container_name" 2>/dev/null
 # echo "Container $container_name status: $status"
}

get_vpn_external_ip() {
  local url="$1"
  curl -s "$url" | jq -r .'public_ip'
}

# Function to send a GET request and extract the port from the response
get_port_from_url() {
  local url="$1"
  local port_key

  # Try 'port' key first
  port_key=$(curl -s "$url" | jq -r '.port')

  if [ "$port_key" == "null" ]; then
    # If 'port' key is null, try 'listen_port' key
    port_key=$(curl -s "$url" | jq -r '.listen_port')
  fi

  echo "$port_key"
}

# Function to send a POST request with JSON data
send_post_request() {
  local url="$1"
  local port="$2"
  curl -s -X POST -d json={\"listen_port\":$port} "$url"
}

# Outputs container names
echo "Gluetun container name: $gluetun_container_name - Gluetun Origin URL: $gluetun_origin"
echo "qBittorrent container name: $qbittorrent_container_name - qBittorrent Origin URL: $qb_origin"

# Check if both containers are running
if [[ $(is_container_running "$gluetun_container_name") == $(is_container_running "$qbittorrent_container_name") ]]; then
  echo "Both Gluetun and qBittorrent containers are running. Continuing."

  external_ip=$(get_vpn_external_ip "${gluetun_urls["pub_ip"]}")
  if [ -z "$external_ip" ]; then
    echo "External IP is empty. Exiting script due to potential VPN or internet connection issue."
    exit 1
  else
    echo "External IP is $external_ip therefore VPN is up"
  fi

  gluetun_port=$(get_port_from_url "${gluetun_urls["portforwarded"]}")
  qbittorrent_port=$(get_port_from_url "${qbittorrent_urls["prefs"]}")

  echo "Gluetun forwarded port is $gluetun_port"
  echo "qBittorrent listen port is $qbittorrent_port"
  if [ "$gluetun_port" -eq "$qbittorrent_port" ]; then
    echo "qBittorrent listen port is already set to $qbittorrent_port. No need to change. Exiting script."
  else
    echo "Updating qBittorrent listen port to Gluetun forwarded port $gluetun_port."
    send_post_request "${qbittorrent_urls["setPrefs"]}" "$gluetun_port"
    qbittorrent_port=$(get_port_from_url "${qbittorrent_urls["prefs"]}")
    echo "qBittorrent listen port updated to $qbittorrent_port. Exiting script."
  fi
else
  echo "Either Gluetun or qBittorrent container is not running. Exiting script."
fi
```

We should now be setup using Gluetun for VPN connectivity to ProtonVPN as well as having other containers using the Gluetun container for network connectivity.
