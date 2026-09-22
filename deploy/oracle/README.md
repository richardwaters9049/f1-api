# Oracle Always Free deployment

This runbook prepares a single Oracle Cloud Infrastructure (OCI) VM for the
existing Bun/Fastify API. It does not create an OCI account, VM, DNS record or
certificate. Keep `f1-api` on `127.0.0.1:8787`; Caddy is the only public-facing
service and obtains HTTPS certificates automatically.

The checked-in `f1-api.service` and `Caddyfile` are templates. Replace the
example hostname before activating Caddy. Do not put credentials in either file
or in Git.

## 1. Create the VM and network

1. In the OCI home region, create an **Always Free-eligible** `VM.Standard.A1.Flex`
   instance with an Ubuntu ARM64 image. One OCPU and 6 GB of memory are within
   the published A1 Always Free allowance. Check that the boot volume and every
   selected resource are marked Always Free before creation. A1 capacity is not
   guaranteed in every availability domain.
2. Assign a public IPv4 address. In the VM's network security group or security
   list, allow inbound TCP 80 and 443 from the internet. Restrict SSH (TCP 22)
   to your own IP address. Do **not** open port 8787 publicly. Check any host
   firewall rules as well.
3. Point an API subdomain's DNS `A` record at that public IPv4 address. Wait
   until DNS resolves before enabling the example Caddy configuration.

Oracle's [Always Free limits](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm)
and [Caddy's HTTPS prerequisites](https://caddyserver.com/docs/quick-starts/reverse-proxy)
are the source of truth for current limits and certificate requirements.

## 2. Install the API

Connect to the Ubuntu VM by SSH. Install `git`, `curl` and `unzip`, then create
an unprivileged `fgcapi` user:

```bash
sudo apt update
sudo apt install -y git curl unzip
sudo adduser --disabled-password --gecos "" fgcapi
sudo -iu fgcapi
```

As `fgcapi`, install Bun using the [official instructions](https://bun.com/docs/installation),
clone the pushed `f1-api` repository into `/home/fgcapi/f1-api`, and install
dependencies:

```bash
curl -fsSL https://bun.com/install | bash
git clone https://github.com/richardwaters9049/f1-api.git /home/fgcapi/f1-api
cd /home/fgcapi/f1-api
/home/fgcapi/.bun/bin/bun install --frozen-lockfile
/home/fgcapi/.bun/bin/bun run typecheck
/home/fgcapi/.bun/bin/bun run test
exit
```

If the repository is private, use a read-only deploy key or another approved
GitHub authentication method instead of placing a personal token in a command.
Do not continue if the tests fail.

Install the supplied systemd unit and start the API:

```bash
sudo cp /home/fgcapi/f1-api/deploy/oracle/f1-api.service /etc/systemd/system/f1-api.service
sudo systemctl daemon-reload
sudo systemctl enable --now f1-api
curl -fsS http://127.0.0.1:8787/api/health
```

The service restarts after a crash and on VM boot. In production, the API
fails if port 8787 is already occupied instead of silently moving to a port
that Caddy cannot reach. Local development retains its port fallback.

## 3. Enable HTTPS

Install Caddy using its [official Ubuntu package instructions](https://caddyserver.com/docs/install).
Copy the template, replace `api.example.com` with your actual API subdomain,
then validate and reload it:

```bash
sudo cp /home/fgcapi/f1-api/deploy/oracle/Caddyfile /etc/caddy/Caddyfile
sudoedit /etc/caddy/Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

Check the public endpoint, substituting your subdomain:

```bash
curl -fsS https://api.example.com/api/health
curl -fsS https://api.example.com/api/meta
curl -fsS https://api.example.com/api/live-timing/status
```

`/api/health` proves the process is responding; it does not prove the upstream
REST provider or live feed is healthy. Use `/api/meta` and
`/api/live-timing/status` for those checks. The live feed may connect while no
race session is active.

## 4. Connect Fast Girls Club

Only after the HTTPS checks pass, set the Next.js server-side environment
variable in its hosting platform:

```dotenv
F1_API_BASE_URL=https://api.example.com/api
```

Redeploy the Next.js app so its server-side API routes use the new value.
Do not set this to `localhost` on a different host. Keep the local development
setting `http://127.0.0.1:8787/api` unchanged.

## Operations and limitations

```bash
sudo systemctl status f1-api caddy
sudo journalctl -u f1-api -n 100 --no-pager
sudo journalctl -u caddy -n 100 --no-pager
```

For updates, pull the reviewed code as `fgcapi`, run `bun install
--frozen-lockfile`, `bun run typecheck` and `bun run test`, then restart
`f1-api` with `sudo systemctl restart f1-api`. Recheck health and metadata
afterwards. If the frontend must be rolled back, restore its previous
`F1_API_BASE_URL` and redeploy it.

OCI Always Free is self-managed and has no production availability guarantee.
Always Free capacity can be unavailable, and idle VMs may be reclaimed. Monitor
the service and keep this deployment reproducible from Git. The HTTP API is
read-only but publicly reachable through Caddy; review access controls and
request limits before promoting the service beyond a small public launch.
