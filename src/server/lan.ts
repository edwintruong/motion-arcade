import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { networkInterfaces } from "node:os";

const DIR = ".cert";

/** IPv4 addresses other devices on the network might reach this machine at. */
export function lanAddresses(): string[] {
  const own = Object.values(networkInterfaces())
    .flat()
    .filter((a) => a && a.family === "IPv4" && !a.internal)
    .map((a) => a!.address);
  // Under WSL2 the address phones can reach belongs to Windows; pass it in LAN_IP.
  const extra = (process.env.LAN_IP ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return [...new Set([...extra, ...own])];
}

/**
 * A self-signed certificate for LAN play. Phone motion sensors only work
 * over HTTPS, and no public certificate can cover a private IP address,
 * so each device has to accept this one once.
 */
export function lanCertificate(): { key: Buffer; cert: Buffer } {
  const names = ["DNS:localhost", "IP:127.0.0.1", ...lanAddresses().map((ip) => `IP:${ip}`)].join(",");
  const stamp = `${DIR}/names.txt`;
  if (!existsSync(stamp) || readFileSync(stamp, "utf8") !== names) {
    mkdirSync(DIR, { recursive: true });
    execFileSync(
      "openssl",
      [
        "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "365",
        "-keyout", `${DIR}/key.pem`, "-out", `${DIR}/cert.pem`,
        "-subj", "/CN=Motion Arcade (dev)", "-addext", `subjectAltName=${names}`,
      ],
      { stdio: "ignore" },
    );
    writeFileSync(stamp, names);
  }
  return { key: readFileSync(`${DIR}/key.pem`), cert: readFileSync(`${DIR}/cert.pem`) };
}
