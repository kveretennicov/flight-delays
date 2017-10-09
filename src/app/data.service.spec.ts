import { TestBed, inject } from '@angular/core/testing';
import { HttpClientModule } from '@angular/common/http';

import { DataService, HttpDataService } from './data.service';

describe('DataService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        HttpClientModule,
      ],
      providers: [
        { provide: DataService, useClass: HttpDataService },
      ]
    });
  });

  let dataService: DataService;
  beforeEach(inject([DataService], (service: DataService) => {
    dataService = service;
  }));
  it('should be created', () => {
    expect(dataService).toBeTruthy();
  });
  it('should return LAX and TWF in the list of origins', done => {
    dataService.fetchAllOrigins().subscribe(origins => {
      expect(origins).toContain('LAX');
      expect(origins).toContain('TWF');
      done();
    });
  });
  it('should return DEN in the list of LAX destinations', done => {
    dataService.fetchDestinationsOfOrigin('LAX').subscribe(destinations => {
      expect(destinations).toContain('DEN');
      done();
    });
  });
  it('should not return DEN in the list of TWF destinations', done => {
    dataService.fetchDestinationsOfOrigin('TWF').subscribe(destinations => {
      expect(destinations).not.toContain('DEN');
      done();
    });
  });
  it('should return delay times for TWF->LAX connection', done => {
    dataService.fetchFlightData('TWF', 'LAX').subscribe(flightData => {
      const delays = flightData.flights.map(d => d.delayInMinutes);
      expect(delays).toContain(128);
      expect(delays).toContain(89);
      expect(delays).toContain(7);
      expect(delays).toContain(75);
      expect(delays.length).toBe(4);
      done();
    });
  });
});
