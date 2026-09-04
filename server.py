#!/usr/bin/env python3
"""
DNS.usectl.com - Zero-Dependency Local Dev Server, DNS Resolver & SSL Edge Inspector
Provides:
  - Static file serving with MIME types & no-cache headers
  - /api/ssl?domain={domain} (Direct SSL certificate handshake & telemetry)
  - /api/dns?server={ip}&name={domain}&type={type} (Standard UDP DNS query with EDNS0)
"""
import http.server
import socketserver
import os
import sys
import json
import socket
import ssl
import struct
import time
import concurrent.futures
import urllib.request
import urllib.error
from urllib.parse import urlparse, parse_qs
from datetime import datetime, timezone

PORT = int(os.environ.get("PORT", 8082))
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

TYPE_MAP = {
    "A": 1,
    "NS": 2,
    "CNAME": 5,
    "SOA": 6,
    "PTR": 12,
    "MX": 15,
    "TXT": 16,
    "AAAA": 28,
    "CAA": 257
}

RTYPE_NAMES = {v: k for k, v in TYPE_MAP.items()}


def parse_name(data, offset):
    parts = []
    visited = set()
    orig_offset = offset
    stepped = False

    while True:
        if offset in visited or offset >= len(data):
            break
        visited.add(offset)
        length = data[offset]
        if length == 0:
            if not stepped:
                orig_offset = offset + 1
            break
        elif (length & 0xC0) == 0xC0:
            pointer = struct.unpack(">H", data[offset:offset+2])[0] & 0x3FFF
            if not stepped:
                orig_offset = offset + 2
                stepped = True
            offset = pointer
        else:
            offset += 1
            parts.append(data[offset:offset+length].decode("ascii", errors="ignore"))
            offset += length
            if not stepped:
                orig_offset = offset

    return ".".join(parts), orig_offset


def query_dns_udp(server_ip, domain, qtype_str="A", timeout=3.0):
    qtype = TYPE_MAP.get(qtype_str.upper(), 1)
    clean_domain = domain.strip().strip(".")

    # DNS Header: ID, Flags (RD=1), QDCOUNT=1, ANCOUNT=0, NSCOUNT=0, ARCOUNT=1 (EDNS0)
    packet = struct.pack(">HHHHHH", 0x4a2c, 0x0100, 1, 0, 0, 1)

    # QNAME
    for p in clean_domain.split("."):
        packet += struct.pack("B", len(p)) + p.encode("ascii")
    packet += b"\x00"

    # QTYPE + QCLASS (IN=1)
    packet += struct.pack(">HH", qtype, 1)

    # EDNS0 OPT RR (RFC 6891 + RFC 3225): Name=0, Type=41, UDP payload=4096, Extended RCODE=0, DO=1 (DNSSEC OK), Z=0, RDLEN=0
    packet += struct.pack(">BHHII", 0, 41, 4096, 0x8000, 0)

    start_time = time.perf_counter()
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.settimeout(timeout)

    try:
        sock.sendto(packet, (server_ip, 53))
        data, _ = sock.recvfrom(4096)
        latency = round((time.perf_counter() - start_time) * 1000)

        # Header parsing
        flags = struct.unpack(">H", data[2:4])[0]
        rcode = flags & 0x000F
        ancount = struct.unpack(">H", data[6:8])[0]
        ad_flag = bool(flags & 0x0020)  # RFC 2535 / 4035 Authenticated Data

        if rcode == 3:
            return {"success": True, "status": "nxdomain", "records": [], "ttl": None, "latency": latency, "dnssec": ad_flag}

        # Skip question section
        _, offset = parse_name(data, 12)
        offset += 4  # QTYPE + QCLASS

        records = []
        min_ttl = None

        for _ in range(ancount):
            if offset >= len(data):
                break
            _, offset = parse_name(data, offset)
            rtype, rclass, ttl, rdlen = struct.unpack(">HHIH", data[offset:offset+10])
            offset += 10
            rdata_raw = data[offset:offset+rdlen]
            val = ""

            if rtype == 1 and rdlen == 4:
                val = socket.inet_ntoa(rdata_raw)
            elif rtype == 28 and rdlen == 16:
                val = socket.inet_ntop(socket.AF_INET6, rdata_raw)
            elif rtype in (2, 5, 12):
                val, _ = parse_name(data, offset)
            elif rtype == 15:
                pref = struct.unpack(">H", rdata_raw[:2])[0]
                mxname, _ = parse_name(data, offset + 2)
                val = f"{pref} {mxname}"
            elif rtype == 16:
                txt_parts = []
                s_off = 0
                while s_off < rdlen:
                    tlen = rdata_raw[s_off]
                    s_off += 1
                    txt_parts.append(rdata_raw[s_off:s_off+tlen].decode("utf-8", errors="ignore"))
                    s_off += tlen
                val = "".join(txt_parts)
            elif rtype == 6:  # SOA
                mname, next_off = parse_name(data, offset)
                rname, next_off = parse_name(data, next_off)
                val = f"{mname} {rname}"
            elif rtype == 257 and rdlen >= 2:  # CAA (RFC 6844)
                flags = rdata_raw[0]
                taglen = rdata_raw[1]
                if 2 + taglen <= rdlen:
                    tag = rdata_raw[2:2+taglen].decode("ascii", errors="ignore")
                    val_str = rdata_raw[2+taglen:].decode("utf-8", errors="ignore")
                    val = f'{flags} {tag} "{val_str}"'
            else:
                val = rdata_raw.hex()

            offset += rdlen

            if val:
                actual_type = RTYPE_NAMES.get(rtype, qtype_str)
                records.append({"value": val, "ttl": ttl, "type": actual_type})
                if min_ttl is None or ttl < min_ttl:
                    min_ttl = ttl

        return {
            "success": True,
            "status": "synced" if records else "empty",
            "records": records,
            "ttl": min_ttl,
            "latency": latency,
            "dnssec": ad_flag
        }
    except socket.timeout:
        return {"success": False, "status": "error", "error": "Query timed out (>3s)", "records": [], "latency": 3000}
    except Exception as e:
        return {"success": False, "status": "error", "error": str(e), "records": [], "latency": 0}
    finally:
        sock.close()


def get_ssl_cert_info(domain):
    clean = domain.strip().lower().split("/")[0].split(":")[0]
    ctx = ssl.create_default_context()
    ctx.check_hostname = True
    ctx.verify_mode = ssl.CERT_REQUIRED

    try:
        with socket.create_connection((clean, 443), timeout=4.0) as sock:
            with ctx.wrap_socket(sock, server_hostname=clean) as ssock:
                cert = ssock.getpeercert()
                tls_version = ssock.version()
                cipher = ssock.cipher()

                not_after_str = cert.get("notAfter")
                exp_dt = datetime.strptime(not_after_str, "%b %d %H:%M:%S %Y %Z").replace(tzinfo=timezone.utc)
                now_dt = datetime.now(timezone.utc)
                days_left = (exp_dt - now_dt).days

                issuer_dict = dict(x[0] for x in cert.get("issuer", []))
                issuer_org = issuer_dict.get("organizationName") or issuer_dict.get("commonName") or "Unknown Issuer"

                sans = [name for kind, name in cert.get("subjectAltName", []) if kind == "DNS"]

                return {
                    "success": True,
                    "domain": clean,
                    "valid": days_left > 0,
                    "daysRemaining": days_left,
                    "expiresAt": exp_dt.strftime("%Y-%m-%d %H:%M UTC"),
                    "issuer": issuer_org,
                    "tlsVersion": tls_version,
                    "cipher": cipher[0] if cipher else "Unknown",
                    "sans": sans[:8]
                }
    except ssl.SSLCertVerificationError as e:
        return {
            "success": False,
            "domain": clean,
            "valid": False,
            "error": f"Certificate Verification Failed: {e.verify_message}"
        }
    except (socket.timeout, TimeoutError):
        return {
            "success": False,
            "domain": clean,
            "error": "Connection timed out connecting to port 443"
        }
    except Exception as e:
        return {
            "success": False,
            "domain": clean,
            "error": str(e)
        }


KNOWN_ASN_PREFIXES = [
    # Cloudflare
    ("104.16.", "Cloudflare", "AS13335"),
    ("104.17.", "Cloudflare", "AS13335"),
    ("104.18.", "Cloudflare", "AS13335"),
    ("104.19.", "Cloudflare", "AS13335"),
    ("104.20.", "Cloudflare", "AS13335"),
    ("104.21.", "Cloudflare", "AS13335"),
    ("104.22.", "Cloudflare", "AS13335"),
    ("104.23.", "Cloudflare", "AS13335"),
    ("104.24.", "Cloudflare", "AS13335"),
    ("104.25.", "Cloudflare", "AS13335"),
    ("104.26.", "Cloudflare", "AS13335"),
    ("104.27.", "Cloudflare", "AS13335"),
    ("104.28.", "Cloudflare", "AS13335"),
    ("172.64.", "Cloudflare", "AS13335"),
    ("172.65.", "Cloudflare", "AS13335"),
    ("172.66.", "Cloudflare", "AS13335"),
    ("172.67.", "Cloudflare", "AS13335"),
    ("162.158.", "Cloudflare", "AS13335"),
    ("162.159.", "Cloudflare", "AS13335"),
    ("1.1.1.", "Cloudflare", "AS13335"),
    ("1.0.0.", "Cloudflare", "AS13335"),
    # Vercel
    ("76.76.21.", "Vercel", "AS396982"),
    ("76.223.126.", "Vercel", "AS396982"),
    # GitHub / Microsoft
    ("140.82.", "GitHub", "AS36459"),
    ("185.199.", "GitHub Pages", "AS36459"),
    ("20.", "Microsoft Azure", "AS8075"),
    ("51.", "Microsoft Azure", "AS8075"),
    # Google / Google Cloud
    ("8.8.8.", "Google Public DNS", "AS15169"),
    ("8.8.4.", "Google Public DNS", "AS15169"),
    ("142.250.", "Google", "AS15169"),
    ("172.217.", "Google", "AS15169"),
    ("34.", "Google Cloud", "AS15169"),
    ("35.", "Google Cloud", "AS15169"),
    # Amazon AWS
    ("13.224.", "Amazon CloudFront", "AS16509"),
    ("13.225.", "Amazon CloudFront", "AS16509"),
    ("13.32.", "Amazon CloudFront", "AS16509"),
    ("13.33.", "Amazon CloudFront", "AS16509"),
    ("13.35.", "Amazon CloudFront", "AS16509"),
    ("52.84.", "Amazon CloudFront", "AS16509"),
    ("54.230.", "Amazon CloudFront", "AS16509"),
    ("99.84.", "Amazon CloudFront", "AS16509"),
    ("143.204.", "Amazon CloudFront", "AS16509"),
    ("18.", "Amazon AWS", "AS16509"),
    ("52.", "Amazon AWS", "AS16509"),
    ("54.", "Amazon AWS", "AS16509"),
    # Fastly
    ("151.101.", "Fastly", "AS54113"),
    ("199.232.", "Fastly", "AS54113"),
    # Akamai
    ("23.", "Akamai", "AS20940"),
    ("104.64.", "Akamai", "AS20940"),
    # DigitalOcean
    ("138.68.", "DigitalOcean", "AS14061"),
    ("159.203.", "DigitalOcean", "AS14061"),
    ("165.227.", "DigitalOcean", "AS14061"),
    ("167.99.", "DigitalOcean", "AS14061"),
    # Hetzner
    ("159.69.", "Hetzner", "AS24940"),
    ("168.119.", "Hetzner", "AS24940"),
    ("65.108.", "Hetzner", "AS24940"),
    ("88.198.", "Hetzner", "AS24940"),
]


def get_ip_asn_info(ip):
    ip_clean = ip.strip()
    # 1. Fast path prefix match
    for prefix, org, asn in KNOWN_ASN_PREFIXES:
        if ip_clean.startswith(prefix):
            return {
                "success": True,
                "ip": ip_clean,
                "asn": asn,
                "org": org,
                "source": "fastpath"
            }

    # 2. DNS Cymru lookup for any global IP: <reversed-ip>.origin.asn.cymru.com
    try:
        parts = ip_clean.split(".")
        if len(parts) == 4:
            rev_ip = f"{parts[3]}.{parts[2]}.{parts[1]}.{parts[0]}.origin.asn.cymru.com"
            res = query_dns_udp("1.1.1.1", rev_ip, "TXT", timeout=1.5)
            if res.get("success") and res.get("records"):
                txt_val = res["records"][0]["value"].strip('"')
                cymru_parts = [p.strip() for p in txt_val.split("|")]
                if cymru_parts:
                    asn_num = cymru_parts[0]
                    name_res = query_dns_udp("1.1.1.1", f"AS{asn_num}.asn.cymru.com", "TXT", timeout=1.5)
                    org_name = f"AS{asn_num}"
                    if name_res.get("success") and name_res.get("records"):
                        name_val = name_res["records"][0]["value"].strip('"')
                        name_parts = [p.strip() for p in name_val.split("|")]
                        if len(name_parts) >= 5:
                            org_name = name_parts[4]
                    return {
                        "success": True,
                        "ip": ip_clean,
                        "asn": f"AS{asn_num}",
                        "org": org_name,
                        "source": "cymru"
                    }
    except Exception:
        pass

    return {
        "success": False,
        "ip": ip_clean,
        "asn": "—",
        "org": "Cloud Provider",
        "source": "none"
    }


def check_http_health(domain):
    clean = domain.strip().lower().split("/")[0].split(":")[0]
    headers = {"User-Agent": "Mozilla/5.0 (compatible; usectl-dns/1.0; +https://dns.usectl.com)"}
    ctx = ssl.create_default_context()

    # Try HTTPS first
    url = f"https://{clean}"
    start_time = time.perf_counter()
    try:
        req = urllib.request.Request(url, headers=headers, method="HEAD")
        with urllib.request.urlopen(req, timeout=2.5, context=ctx) as resp:
            ttfb = round((time.perf_counter() - start_time) * 1000)
            status_code = resp.status
            server_hdr = resp.headers.get("Server", "Unknown")
            return {
                "success": True,
                "status": status_code,
                "statusText": "200 OK" if status_code == 200 else f"HTTP {status_code}",
                "server": server_hdr,
                "ttfb": ttfb,
                "url": resp.geturl(),
                "isHttps": True
            }
    except urllib.error.HTTPError as e:
        ttfb = round((time.perf_counter() - start_time) * 1000)
        return {
            "success": True,
            "status": e.code,
            "statusText": f"HTTP {e.code}",
            "server": e.headers.get("Server", "Unknown"),
            "ttfb": ttfb,
            "url": url,
            "isHttps": True
        }
    except Exception:
        # Fallback to HTTP port 80
        try:
            http_url = f"http://{clean}"
            start_time = time.perf_counter()
            req = urllib.request.Request(http_url, headers=headers, method="HEAD")
            with urllib.request.urlopen(req, timeout=2.5) as resp:
                ttfb = round((time.perf_counter() - start_time) * 1000)
                return {
                    "success": True,
                    "status": resp.status,
                    "statusText": "200 OK" if resp.status == 200 else f"HTTP {resp.status}",
                    "server": resp.headers.get("Server", "Unknown"),
                    "ttfb": ttfb,
                    "url": resp.geturl(),
                    "isHttps": False
                }
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "status": None
            }


def get_all_domain_records(domain, server_ip="1.1.1.1"):
    clean_domain = domain.strip().strip(".")
    types_to_query = ["A", "AAAA", "CNAME", "MX", "NS", "TXT", "CAA", "SOA"]
    results = {}
    is_dnssec = False

    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        future_to_type = {
            executor.submit(query_dns_udp, server_ip, clean_domain, t, 3.0): t
            for t in types_to_query
        }
        # Also query _dmarc in parallel
        dmarc_future = executor.submit(query_dns_udp, server_ip, f"_dmarc.{clean_domain}", "TXT", 3.0)

        for future in concurrent.futures.as_completed(future_to_type):
            t = future_to_type[future]
            try:
                res = future.result()
                if res.get("dnssec"):
                    is_dnssec = True
                if res.get("success") and res.get("records"):
                    results[t] = res["records"]
                else:
                    results[t] = []
            except Exception:
                results[t] = []

        # Process DMARC
        dmarc_data = {"hasDmarc": False, "policy": "none", "records": [], "rua": ""}
        try:
            dmarc_res = dmarc_future.result()
            if dmarc_res.get("success") and dmarc_res.get("records"):
                dmarc_data["records"] = dmarc_res["records"]
                dmarc_data["hasDmarc"] = True
                for rec in dmarc_res["records"]:
                    val = rec.get("value", "")
                    if "v=DMARC1" in val:
                        for part in val.split(";"):
                            part = part.strip()
                            if part.startswith("p="):
                                dmarc_data["policy"] = part.split("=")[1].strip().lower()
                            elif part.startswith("rua="):
                                dmarc_data["rua"] = part.split("=")[1].strip()
        except Exception:
            pass

    total_count = sum(len(recs) for recs in results.values())
    return {
        "success": True,
        "domain": clean_domain,
        "records": results,
        "dmarc": dmarc_data,
        "dnssec": is_dnssec,
        "totalCount": total_count
    }


class DNSHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def do_GET(self):
        parsed = urlparse(self.path)

        # /api/records?domain=...
        if parsed.path == "/api/records":
            params = parse_qs(parsed.query)
            domain = params.get("domain", [""])[0]
            if not domain:
                self.send_json_response({"success": False, "error": "Missing domain query parameter"}, status=400)
                return
            self.send_json_response(get_all_domain_records(domain))
            return

        # /api/asn?ip=...
        if parsed.path == "/api/asn":
            params = parse_qs(parsed.query)
            ip = params.get("ip", [""])[0]
            if not ip:
                self.send_json_response({"success": False, "error": "Missing ip parameter"}, status=400)
                return
            self.send_json_response(get_ip_asn_info(ip))
            return

        # /api/http?domain=...
        if parsed.path == "/api/http":
            params = parse_qs(parsed.query)
            domain = params.get("domain", [""])[0]
            if not domain:
                self.send_json_response({"success": False, "error": "Missing domain parameter"}, status=400)
                return
            self.send_json_response(check_http_health(domain))
            return

        # /api/ssl?domain=...
        if parsed.path == "/api/ssl":
            params = parse_qs(parsed.query)
            domain = params.get("domain", [""])[0]
            if not domain:
                self.send_json_response({"success": False, "error": "Missing domain query parameter"}, status=400)
                return
            self.send_json_response(get_ssl_cert_info(domain))
            return

        # /api/dns?server=...&name=...&type=...
        if parsed.path == "/api/dns":
            params = parse_qs(parsed.query)
            server = params.get("server", ["1.1.1.1"])[0]
            name = params.get("name", [""])[0]
            qtype = params.get("type", ["A"])[0]
            if not name:
                self.send_json_response({"success": False, "error": "Missing name query parameter"}, status=400)
                return
            dns_res = query_dns_udp(server, name, qtype)
            self.send_json_response(dns_res)
            return

        super().do_GET()

    def send_json_response(self, data, status=200):
        body = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.end_headers()
        self.wfile.write(body)

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Access-Control-Allow-Origin", "*")
        super().end_headers()


if __name__ == "__main__":
    with socketserver.TCPServer(("", PORT), DNSHandler) as httpd:
        print(f"\n⚡ [DNS.usectl.com] Radar running at http://localhost:{PORT}")
        print(f"📁 Root directory: {DIRECTORY}\n")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down DNS Radar server...")
            sys.exit(0)
