import dns from "node:dns";

/**
 * Global DNS Fallback for Cloud Services (Neon PostgreSQL & Upstash Redis)
 *
 * Resolves cloud endpoints via trusted public DNS resolvers (8.8.8.8 and 1.1.1.1)
 * if local/institutional DNS servers refuse (RCODE_REFUSED) or fail to resolve
 * cloud domains such as *.neon.tech or *.upstash.io.
 */
const globalWithDns = globalThis as unknown as { __cloudDnsFallbackInitialized?: boolean };

if (typeof window === "undefined" && !globalWithDns.__cloudDnsFallbackInitialized) {
  globalWithDns.__cloudDnsFallbackInitialized = true;

  if (typeof dns !== "undefined" && typeof dns.lookup === "function") {
    const origLookup = dns.lookup.bind(dns);
    const { Resolver } = dns.promises;
    const resolver = new Resolver();
    resolver.setServers(["8.8.8.8", "1.1.1.1"]);

    type LookupCallback = (
      err: NodeJS.ErrnoException | null,
      address: unknown,
      family?: number
    ) => void;

    // Overriding lookup for reliable fallback without any-casts
    const customLookup = function (
      hostname: string,
      options: unknown,
      callback?: unknown
    ) {
      let actualCallback: LookupCallback;
      let actualOptions: { all?: boolean } = {};

      if (typeof options === "function") {
        actualCallback = options as LookupCallback;
        actualOptions = {};
      } else {
        actualCallback = (callback || (() => {})) as LookupCallback;
        if (options && typeof options === "object") {
          actualOptions = options as { all?: boolean };
        }
      }

      if (
        hostname &&
        typeof hostname === "string" &&
        (hostname.includes("neon.tech") || hostname.includes("upstash.io"))
      ) {
        resolver
          .resolve4(hostname)
          .then((ips) => {
            if (ips && ips.length > 0) {
              if (actualOptions && actualOptions.all) {
                actualCallback(
                  null,
                  ips.map((ip) => ({ address: ip, family: 4 }))
                );
              } else {
                actualCallback(null, ips[0], 4);
              }
            } else {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (origLookup as any)(hostname, options, actualCallback);
            }
          })
          .catch(() => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (origLookup as any)(hostname, options, actualCallback);
          });
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (origLookup as any)(hostname, options, actualCallback);
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (dns as any).lookup = customLookup;
  }
}


