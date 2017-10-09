///  Note: these are for crossfilter1 and we use crossfilter2, but it's compatible enough.
/// <reference path="../node_modules/@types/crossfilter/index.d.ts" />

import { enableProdMode } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';

import { AppModule } from './app/app.module';
import { environment } from './environments/environment';

if (environment.production) {
  enableProdMode();
}

platformBrowserDynamic().bootstrapModule(AppModule)
  .catch(err => console.log(err));
