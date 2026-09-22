# Deployment

## Web + mobile
```bash
npm install
npm start
```

- Desktop: `http://localhost:3000/`
- Mobile PWA: `http://localhost:3000/mobile`

## Embedded release artifacts
The workflow `.github/workflows/build-embedded.yml` automatically:
1. Builds Cardputer + CoreS3 firmware
2. Produces merged `.bin` files
3. Uploads artifacts on workflow runs
4. Attaches binaries to GitHub Releases

## Optional web flasher
You can host binaries in release assets and use an ESP Web Tools / ESP Web Flasher manifest for one-click browser flashing.
