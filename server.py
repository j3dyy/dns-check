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

    # EDNS0 OPT RR (RFC 6891): Name=0, Type=41, UDP payload=4096, Extended RCODE=0, EDNS=0, Z=0, RDLEN=0
    packet += struct.pack(">BHHII", 0, 41, 4096, 0, 0)

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

        if rcode == 3:
            return {"success": True, "status": "nxdomain", "records": [], "ttl": None, "latency": latency}

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
            elif rtype in (2, 5):
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
            else:
                val = rdata_raw.hex()

            offset += rdlen

            if val:
                records.append({"value": val, "ttl": ttl, "type": qtype_str})
                if min_ttl is None or ttl < min_ttl:
                    min_ttl = ttl

        return {
            "success": True,
            "status": "synced" if records else "empty",
            "records": records,
            "ttl": min_ttl,
            "latency": latency
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


class DNSHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def do_GET(self):
        parsed = urlparse(self.path)

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
