# Sandbox for the agents that run code (Michel Construit, Michel Vérifie): tests and git run here, never on the
# host. OpenClaw starts it with no network, a read-only root, all capabilities dropped and the jarvis uid, and
# passes none of the gateway's environment (so no secret). Built by deployment/configure-services.py.
FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends bash ca-certificates git python3 ripgrep jq \
    && rm -rf /var/lib/apt/lists/*
# Same node path as on the host, so the agents' command allowlists keep matching.
RUN mkdir -p /opt/jarvis-node/bin && ln -s /usr/local/bin/node /opt/jarvis-node/bin/node
WORKDIR /tmp
CMD ["sleep", "infinity"]
