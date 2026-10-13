# Bathos GitOps

A reusable deployment workflow for multiple independently released Bathos applications, with DigitalOcean Droplet infrastructure managed by OpenTofu.

## Intended operator experience

Each application's `main` push runs its own tests, then calls `.github/workflows/deploy-compose.yml` from this shared repository (once that repository is public or otherwise accessible to its callers). No routine manual deploys or changes to the shared repository. Infrastructure edits to this repository's `infrastructure/digitalocean/` automatically plan and apply when the one-time bootstrap is enabled. Destructive infrastructure changes fail closed.

The deployment workflow packages the caller's exact Git commit, uploads it by pinned-host-key SSH, runs Docker Compose on the Droplet, takes a pre-release PostgreSQL dump when a database already exists, checks health and restores the previous *application* release on failure. Data/schema migrations cannot be rolled back automatically. App configuration is read from **host-only** `/srv/bathos/secrets/<app>.env` files.

## Deployment prerequisites (one time)

1. Create a DigitalOcean account/API token, a Spaces bucket for remote OpenTofu state and its access key, and register an administrator SSH key. Never put tokens in a Git repository or chat.
2. Generate an independent SSH key pair for GitHub Actions -> Droplet deployment. Store only its **public** key in the OpenTofu input variable; store its private key in repository/organization Actions secrets.
3. Configure GitHub Action secrets `DIGITALOCEAN_TOKEN`, `DO_SPACES_ACCESS_KEY`, `DO_SPACES_SECRET_KEY` in this infrastructure repository. Configure vars `BATHOS_STATE_BUCKET`, `BATHOS_SPACES_REGION` (for example `lon1`), `BATHOS_ADMIN_SSH_KEY_IDS_JSON` (JSON list of existing key fingerprints), `BATHOS_DEPLOY_PUBLIC_KEY` (OpenSSH public key).
4. Configure `BATHOS_INFRA_ENABLED=true` when the remote state bucket exists; manually trigger the first infrastructure workflow or merge a change to `infrastructure/digitalocean/`. The first run provisions the Droplet (incurs hosting costs). Obtain its IPv4 from OpenTofu output.
5. Prepare an existing named Cloudflare Tunnel, its token and wildcard DNS/ingress pointing `*.bathos.org` at `http://traefik:80`. Put tunnel token only in `/srv/bathos/secrets/bathos-edge.env` as `CLOUDFLARE_TUNNEL_TOKEN=...`. Deploy `infrastructure/edge/compose.yml` with the shared workflow (app `bathos-edge`, no overlay). Existing public hosts need migration carefully to prevent traffic switching to the wrong instance.
6. For each app, create `/srv/bathos/secrets/<app>.env` (mode 0600) and enable `BATHOS_DEPLOY_ENABLED=true` only after its existing ownership/handover is accepted. Configure its GitHub Actions secrets `BATHOS_SSH_HOST`, `BATHOS_SSH_USER=deploy`, `BATHOS_SSH_PRIVATE_KEY`, `BATHOS_SSH_KNOWN_HOSTS` (verified through an authenticated out-of-band SSH host fingerprint, not blind ssh-keyscan).
7. Back up existing app databases and verify a restore before moving production traffic. Pre-release SQL dumps and DigitalOcean Droplet backups are additional recovery aids, **not** independently verified off-host database backups.

## Security / operating boundaries

- The Droplet inbound firewall permits SSH only; service traffic enters through Cloudflare Tunnel. SSH source CIDRs should be restricted where stable egress is available.
- The deploy user belongs to the Docker group (effectively root on that Droplet). Only trusted code on `main` may have the deployment secrets. Do not expose them to PR/fork workflows.
- Main-branch deploys are serialised per GitHub repository/application, without cancelling an in-progress release.
- Application Docker Compose projects have distinct names and volumes; Delegate and Cultivate do not share databases or service ownership.
- Existing Delegate handover and live local demo are outside the initial provisioning. No deploy, DNS cutover, database reset, or disposal happens merely by merging these files.
- GitHub Actions secrets and the cloud account must be configured outside this repository once. Changes to those secret **values** cannot be stored in Git securely.
- Traefik's read-only Docker socket grants metadata visibility and has operational risks; consider a Docker socket proxy or non-Docker provider when hardening beyond personal prototypes.

## Reusable calling workflow

See `examples/delegate/deploy.yml`. Copy that small caller into each app, changing `app`, Compose paths and health URL. When this repository is private, configure its Settings → Actions → General → Access to permit the calling repositories, or publish it as a dedicated public workflow-only repository.

**Initial integration:** Delegate can call its *local copy* of the reusable workflow, because the existing Bathos website repository is private and cannot be used as a reusable-workflow source by the public Delegate repository. The infrastructure code can live in the private Bathos repository. When a new public `bathos-gitops` repository is created, publish this bundle there and change each caller to `sighmoan1/bathos-gitops/.github/workflows/deploy-compose.yml@<pinned release tag>`.
