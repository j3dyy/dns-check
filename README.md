# DNS.usectl.com ⚡

> **[dns.usectl.com](https://dns.usectl.com)** &bull; Zero-Bloat Global DNS &amp; SSL Propagation Radar.

Part of the **[usectl.com](https://usectl.com)** developer infrastructure suite.

Replaces slow, ad-ridden legacy tools with an ad-free, real-time edge propagation radar querying 20+ public DoH resolvers across 6 continents in parallel.

---

## 🌟 Key Features

- **Global Anycast & Regional Edge Resolvers**: Real-time queries to Cloudflare, Google, Quad9, OpenDNS, Control D, DNS.SB, AdGuard, and CIRA across US, Europe, Asia, Latin America, and Africa.
- **Comprehensive Record Support**: `A`, `AAAA`, `CNAME`, `MX`, `TXT`, `NS`, `CAA`, `SOA`, and `PTR`.
- **Expected Value Diff Matcher**: Enter your target IP or alias and immediately spot which edge resolvers are still serving stale cached records with remaining TTL.
- **Zero-Dependency SSL Inspector**: Inspect certificate expiration countdown, issuer, TLS 1.3 protocol, and SANs directly.
- **1-Click CLI Generator**: Copy ready-to-run `dig`, `nslookup`, and `curl DoH` terminal commands.
- **Lightweight & Fast**: Pure vanilla JS, zero frontend build step, dark mode by default, loads in <200ms.
- **AI & Agent Friendly**: Includes `/llms.txt`, `/llms-full.txt`, and Open Graph `summary_large_image`.

---

## 🚀 Running Locally

### Option 1: Python (Zero Dependency)
```bash
python3 server.py
```
Open **http://localhost:8082** in your browser.

### Option 2: Docker
```bash
# Build the Docker image
docker build -t dns-usectl .

# Run container
docker run -d -p 8082:8082 --name dns-usectl dns-usectl
```

---

## 🤝 Contributing

Contributions are welcomed via pull requests!
1. Add new DoH edge resolvers in `data/resolvers.json`.
2. Submit a PR to `github.com/j3dyy/dns-usectl`.
