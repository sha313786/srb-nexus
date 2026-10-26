import dns from 'dns';

// Fallback DNS resolver using reliable public DNS servers (Google, Cloudflare)
const fallbackResolver = new dns.Resolver();
fallbackResolver.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4', '1.0.0.1']);

const originalLookup = dns.lookup;

/**
 * Patches dns.lookup to gracefully fall back to Google/Cloudflare public DNS
 * if the local network adapter (e.g. mobile hotspot or buggy local router)
 * returns EAI_AGAIN, ENOTFOUND, or times out.
 */
function patchDnsLookup(): void {
  (dns as any).lookup = function (
    hostname: string,
    options: any,
    callback?: (err: NodeJS.ErrnoException | null, address: any, family?: number) => void
  ) {
    let cb = callback;
    let opt = options;

    if (typeof options === 'function') {
      cb = options;
      opt = {};
    } else if (typeof options === 'number') {
      opt = { family: options };
    }

    originalLookup(hostname, opt, (err, address, family) => {
      if (err && (err.code === 'EAI_AGAIN' || err.code === 'ENOTFOUND' || err.code === 'ETIMEOUT')) {
        // Resolve using fallback public DNS
        fallbackResolver.resolve4(hostname, (resErr, addresses) => {
          if (resErr || !addresses || addresses.length === 0) {
            return cb ? cb(err, address, family) : undefined;
          }

          if (opt && typeof opt === 'object' && opt.all) {
            const results = addresses.map((addr) => ({ address: addr, family: 4 }));
            return cb ? cb(null, results as any) : undefined;
          }

          return cb ? cb(null, addresses[0], 4) : undefined;
        });
        return;
      }

      if (cb) {
        cb(err, address, family);
      }
    });
  };
}

patchDnsLookup();

export { fallbackResolver };
