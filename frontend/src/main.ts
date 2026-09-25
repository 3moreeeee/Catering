import { bootstrapApplication } from '@angular/platform-browser';
import { ɵɵenableIncrementalHydrationRuntime as enableIncrementalHydrationRuntime } from '@angular/core';
import { appConfig } from './app/app.config';
import { App } from './app/app';

// Incremental hydration sets up its `hydrate on viewport | idle | timer` triggers
// once, at bootstrap, and only if its runtime is already on. The compiler turns
// the runtime on from the creation pass of whichever template holds a
// `hydrate on …` block — here the lazily loaded home page, which a zoneless app
// renders in a change-detection pass that runs *after* bootstrap. So the set-up
// ran against a runtime that was still off, registered nothing, and every home
// section stayed dehydrated until a click replayed an event: product cards
// never ran, and never asked for their prices. Turning the runtime on here is
// the same instruction the compiler emits, just early enough.
// Regression cover: e2e/hydration.spec.ts.
enableIncrementalHydrationRuntime();

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
