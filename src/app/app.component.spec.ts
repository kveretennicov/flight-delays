import { TestBed, async } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { DebugElement } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';

import { AppComponent } from './app.component';
import { DataService, HttpDataService } from './data.service';

describe('AppComponent', () => {
  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [
        AppComponent
      ],
      imports: [
        FormsModule,
        HttpClientModule,
      ],
      providers: [
        { provide: DataService, useClass: HttpDataService }
      ]
    }).compileComponents();
  }));
  it('should create the component', async(() => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.debugElement.componentInstance;
    expect(app).toBeTruthy();
  }));
  it(`should start in absolute delay calc mode`, async(() => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = <AppComponent>fixture.debugElement.componentInstance;
    expect(app.delayCalcMode).toEqual('absolute');
  }));
  it('should render app title in navbar', async(() => {
    const fixture = TestBed.createComponent(AppComponent);
    const compiled = fixture.debugElement.nativeElement;
    expect(compiled.querySelector('.navbar-brand').textContent).toContain('Flight Delays');
  }));
});
