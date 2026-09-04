# my-cal

A private calendar that runs entirely on your own machine. No accounts, no cloud, no tracking, and
your data lives in a single SQLite file. It's one page with Day, Week, Month, and Year views, plus
an optional morning push notification of today's and tomorrow's events.

It's built to be self-hosted and reached from your phone over Tailscale, so nothing is ever exposed
to the public internet.

## Features

- One page, four views. Day and Week are time grids with a current-time line; Month is a full grid;
  Year is twelve mini months. Click a slot or a day to add an event, click an event to edit it.
- Add, edit, and delete events by date and time (or all-day), with an optional note.
- Theme picker in settings: OLED, dark, or light, with an accent color. Your choice is saved in the
  browser.
- Optional morning digest: a push notification each day with today's and tomorrow's events, at a
  time you choose.
- Local and private. One SQLite file, no telemetry. The only thing that leaves your machine is the
  digest you set up.

## Requirements

Node 22.5 or newer. That's the only prerequisite. The database is Node's built-in SQLite, so there's
no native build, no external database, and no Docker.

## Run it

```bash
git clone <your-repo-url> my-cal
cd my-cal
npm install
npm run dev
```

Open http://localhost:5177 and start adding events. The calendar needs no configuration. Your data
is saved to `server/data/cal.db`; back it up by copying that file.

## Reaching it from your phone (Tailscale)

The dev server binds on all interfaces, so any device on your tailnet can open it. No port
forwarding, nothing public.

1. Run Tailscale on this machine and your phone (same tailnet).
2. On your phone, open `http://<this-machine>.ts.net:5177`, or `http://100.x.y.z:5177` using the
   tailnet IP from `tailscale ip`.

The API stays on localhost and the web app proxies `/api` to it, so only the calendar page is
reachable over the tailnet.

## Morning digest (optional)

Each morning at a time you pick, the server sends today's and tomorrow's events to your phone
through [ntfy](https://ntfy.sh), as long as it's running.

```bash
cp .env.example .env
```

1. Set `NTFY_TOPIC` in `.env` to a long, random string (it works like a password).
2. Install the ntfy app and subscribe to that exact topic.
3. Restart the server, open the gear menu, and hit "Send a test now".

You can change the send time and toggle the digest in the gear menu. Sends are logged to
`server/data/digest.log`.

## Production (one always-on process)

Build the client and let the server serve it and the API together on one port (5178):

```bash
npm run build
npm start
```

Keep this running for the digest to fire on schedule.

## Security

This app has no authentication by design. It's meant to run on your own machine and be reached over
a network you trust, like Tailscale or your home LAN, so don't expose the port to the public
internet. Your `.env` (which holds your ntfy topic) and your database are gitignored and never leave
your machine.

## Tech stack

Client: Vite, React, TypeScript, Tailwind, Framer Motion.
Server: Fastify, TypeScript, Node's built-in SQLite, and a small in-process scheduler.

## License

MIT. See [LICENSE](LICENSE).
