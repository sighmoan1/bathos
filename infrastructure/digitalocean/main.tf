terraform {
  required_version = ">= 1.8.0"
  required_providers {
    digitalocean = {
      source  = "digitalocean/digitalocean"
      version = "~> 2.0"
    }
  }
  # Configured by the GitHub Action using an encrypted DigitalOcean Spaces bucket.
  backend "s3" {}
}

provider "digitalocean" {}

resource "digitalocean_droplet" "bathos" {
  name       = "bathos-apps-01"
  image      = "ubuntu-24-04-x64"
  region     = var.region
  size       = var.size
  ssh_keys   = var.admin_ssh_key_ids
  monitoring = true
  backups    = true
  tags       = ["bathos", "gitops", "applications"]
  user_data  = templatefile("${path.module}/cloud-init.yaml.tftpl", {
    deploy_public_key = var.deploy_public_key
  })
  lifecycle {
    # Never replace a stateful machine automatically (even if user_data changes).
    prevent_destroy = true
  }
}

resource "digitalocean_firewall" "bathos" {
  name        = "bathos-outbound-tunnel-only"
  droplet_ids = [digitalocean_droplet.bathos.id]
  inbound_rule {
    protocol         = "tcp"
    port_range       = "22"
    source_addresses = var.ssh_allowlist
  }
  outbound_rule {
    protocol              = "tcp"
    port_range            = "all"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }
  outbound_rule {
    protocol              = "udp"
    port_range            = "all"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }
}

output "droplet_ipv4" {
  description = "Deploy target; place in GitHub Actions secret BATHOS_SSH_HOST"
  value       = digitalocean_droplet.bathos.ipv4_address
}
