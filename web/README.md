# PDF Book Maker (Next.js)

React + Next.js app for the PDF Book Maker. The UI is a client React shell; the image/PDF engine lives in `src/lib/bookMaker.js`.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Build

```bash
npm run build
npm start
```

## Project layout

| Path | Purpose |
|------|---------|
| `src/components/BookMakerApp.tsx` | Client component; mounts the app |
| `src/components/bookMakerTemplate.ts` | Static book-maker UI markup |
| `src/lib/bookMaker.js` | Canvas editor, PDF, ZIP project save |
| `src/lib/imageCompress.ts` | Reusable compress + concurrent batch helpers |
| `browser-image-compression` | Underlying compressor (Web Worker) |