import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';
import { handleEnquiry, handleNewsletter } from './api/enquiry';
import { handleAssistant } from './api/assistant';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

/**
 * API routes, declared before the Angular catch-all.
 *
 * The order matters more than it looks. With no route here, a POST to
 * /api/contact fell through to the renderer, which answered `200 text/html`
 * with the homepage — and the contact form read that as a delivered enquiry.
 * Anything under /api must therefore be terminated here, including the methods
 * we do not implement, so that an unhandled call can never be mistaken for a
 * successful one.
 */
app.use('/api', express.json({ limit: '32kb' }));

app.post('/api/contact', (req, res) => {
  void handleEnquiry(req, res);
});

app.post('/api/newsletter', (req, res) => {
  void handleNewsletter(req, res);
});

app.post('/api/assistant', (req, res) => {
  void handleAssistant(req, res);
});

// Everything else under /api is a JSON 404, never a rendered page.
app.all('/api/{*splat}', (_req, res) => {
  res.status(404).json({ ok: false, code: 'not_found' });
});

// A malformed body reaches Express's error channel; answer it in JSON too.
app.use(
  '/api',
  (error: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (error) {
      res.status(400).json({ ok: false, code: 'bad_request' });
      return;
    }
    next();
  },
);

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) => (response ? writeResponseToNodeResponse(response, res) : next()))
    .catch(next);
});

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
