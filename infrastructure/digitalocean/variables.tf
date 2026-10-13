variable "region" {
  type        = string
  description = "DigitalOcean region"
  default     = "lon1"
}

variable "size" {
  type        = string
  description = "Droplet size, 4 vCPU 8 GiB initial allocation"
  default     = "s-4vcpu-8gb"
}

variable "admin_ssh_key_ids" {
  type        = list(string)
  description = "Existing DigitalOcean SSH key IDs/fingerprints for rescue/admin access"
}

variable "deploy_public_key" {
  type        = string
  description = "The public half of the GitHub Actions deployment SSH key"
}

variable "ssh_allowlist" {
  type        = list(string)
  description = "IPv4/IPv6 CIDRs allowed to SSH; configure for your trusted egress or GitHub-hosted runners"
  default     = ["0.0.0.0/0"]
}
