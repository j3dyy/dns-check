/**
 * DNS.usectl.com - Authentic nslookup & dig Terminal Output Generator
 */

export function getNslookupCommand(domain, recordType, resolver) {
  const d = domain || "usectl.com";
  const t = recordType || "A";
  const s = resolver.ip || "1.1.1.1";
  return `nslookup -type=${t} ${d} ${s}`;
}

export function getDigCommand(domain, recordType, resolver) {
  const d = domain || "usectl.com";
  const t = recordType || "A";
  const s = resolver.ip || "1.1.1.1";
  return `dig +nocmd ${d} ${t} @${s} +noall +answer +stats`;
}

export function generateNslookupOutput(domain, recordType, resolver, result) {
  const d = domain || "usectl.com";
  const t = recordType || "A";
  const serverIp = resolver.ip || "1.1.1.1";

  const lines = [
    `Server:\t\t${serverIp}`,
    `Address:\t${serverIp}#53`,
    ``
  ];

  if (!result) {
    lines.push(`;; Querying ${resolver.name} (${serverIp})...`);
    return lines.join("\n");
  }

  if (result.status === "nxdomain") {
    lines.push(`** server can't find ${d}: NXDOMAIN`);
    lines.push(``);
    lines.push(`;; Response Time: ${result.latency} ms`);
    return lines.join("\n");
  }

  if (!result.success) {
    lines.push(`;; connection timed out; no servers could be reached`);
    if (result.error) lines.push(`;; Diagnostics: ${result.error}`);
    return lines.join("\n");
  }

  if (!result.records || result.records.length === 0) {
    lines.push(`*** Can't find ${d}: No answer of type ${t}`);
    lines.push(``);
    lines.push(`;; Response Time: ${result.latency} ms`);
    return lines.join("\n");
  }

  lines.push(`Non-authoritative answer:`);
  for (const rec of result.records) {
    const val = rec.value;
    if (t === "A" || t === "AAAA") {
      lines.push(`Name:\t${d}`);
      lines.push(`Address: ${val}`);
    } else if (t === "CNAME") {
      lines.push(`${d}\tcanonical name = ${val}.`);
    } else if (t === "MX") {
      lines.push(`${d}\tmail exchanger = ${val}.`);
    } else if (t === "TXT") {
      lines.push(`${d}\ttext = "${val}"`);
    } else if (t === "NS") {
      lines.push(`${d}\tnameserver = ${val}.`);
    } else if (t === "PTR") {
      lines.push(`${d}\tname = ${val}.`);
    } else if (t === "SOA") {
      lines.push(`${d}`);
      lines.push(`\torigin = ${val}`);
    } else {
      lines.push(`${d}\t${t}\t${val}`);
    }
  }

  lines.push(``);
  lines.push(`;; Query Time: ${result.latency} ms`);
  if (result.ttl) {
    lines.push(`;; Remaining TTL: ${result.ttl}s (${Math.floor(result.ttl / 60)}m ${result.ttl % 60}s)`);
  }
  lines.push(`;; Resolver: ${resolver.name} [${resolver.location}]`);

  return lines.join("\n");
}

export function generateDigOutput(domain, recordType, resolver, result) {
  const d = domain || "usectl.com";
  const t = recordType || "A";
  const serverIp = resolver.ip || "1.1.1.1";

  const lines = [
    `;; Got answer:`,
    `;; ->>HEADER<<- opcode: QUERY, status: ${result?.status === 'nxdomain' ? 'NXDOMAIN' : result?.success ? 'NOERROR' : 'SERVFAIL'}, id: 18942`,
    `;; flags: qr rd ra; QUERY: 1, ANSWER: ${result?.records?.length || 0}, AUTHORITY: 0, ADDITIONAL: 1`,
    ``,
    `;; QUESTION SECTION:`,
    `;${d}.\t\t\tIN\t${t}`,
    ``
  ];

  if (result && result.records && result.records.length > 0) {
    lines.push(`;; ANSWER SECTION:`);
    for (const rec of result.records) {
      lines.push(`${d}.\t\t${rec.ttl || 300}\tIN\t${t}\t${rec.value}`);
    }
    lines.push(``);
  }

  lines.push(`;; Query time: ${result?.latency || 0} msec`);
  lines.push(`;; SERVER: ${serverIp}#53(${serverIp}) (UDP)`);
  lines.push(`;; WHEN: ${new Date().toUTCString()}`);
  lines.push(`;; MSG SIZE  rcvd: ${result?.records?.length ? result.records.length * 48 + 56 : 40}`);

  return lines.join("\n");
}
