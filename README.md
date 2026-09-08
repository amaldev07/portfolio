# Amaldev's portfolio

A playable developer portfolio, built with HTML, CSS, and JavaScript and hosted on Firebase. Edit the site in `public/`.

## Local development

With Node.js 18 or newer installed:

```sh
npm run dev
```

Open http://127.0.0.1:3000. `npm start` runs the same server. No dependency installation or build step is required for local preview. Refresh the browser after editing files. Set the `PORT` environment variable to use another port.

```sh
npm run check
```

Checks the portfolio's required files, local links and assets, linked HTML anchors, and JavaScript syntax. External URLs are not fetched.

## Deployment

Firebase Hosting serves `public/` with clean URLs, so `/resume` opens `resume.html`. The local server supports the same route.

**Pushing to `main` or `develop` triggers the existing GitHub workflow and deploys to the live site.** Pull requests from this repository create Firebase previews. For manual deployment with the Firebase CLI configured, run `firebase deploy`.
