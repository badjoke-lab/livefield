# Livefield

Livefield is an unofficial Twitch observation site with three core views:

- Heatmap
- Day Flow
- Rivalry Radar

It also includes lightweight support pages such as Method, About, Donate, and Status.

This repository currently targets a Twitch-only MVP.

## Current focus

- keep the shell lightweight
- stabilize the three page roles
- connect Twitch collection and page-oriented APIs
- preserve low-load behavior before adding heavier features

## Stack

- Cloudflare Pages for the static web app
- Cloudflare Pages Functions for lightweight read APIs
- Cloudflare Workers Cron for collection jobs
- D1 for persistent storage
- KV only where a tiny latest-cache is truly needed

## Page roles

- Heatmap = Now
- Day Flow = Today
- Rivalry Radar = Compare
- Donate = Support

## Support Livefield

If Livefield is useful to you, you can support the project here:

- Donate: https://buy.stripe.com/dRm8wIcJ99jGfbJ5kLcIE01
- Site donate page: https://livefield.pages.dev/donate/

Support helps with uptime, data collection, storage, and future improvements.
