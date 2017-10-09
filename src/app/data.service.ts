import { Injectable } from '@angular/core';
import { Observable } from 'rxjs/Observable';
import { HttpClient } from '@angular/common/http';
import 'rxjs/add/observable/of';
import 'rxjs/add/observable/zip';
import 'rxjs/add/operator/delay';
import 'rxjs/add/operator/do';
import 'rxjs/add/operator/map';

import { DataPoint } from './data-point';

export interface FlightData {
  flights: DataPoint[];
}

export abstract class DataService {
  abstract fetchAllOrigins(): Observable<string[]>;
  abstract fetchDestinationsOfOrigin(origin: string): Observable<string[]>;
  abstract fetchFlightData(origin: string, destination: string): Observable<FlightData>;
}

const FAKE_DATA = {
  origins: ['abc', 'def'],
  destinationsByOrigin: {
    'abc': ['abc-1', 'abc-2', 'abc-3'],
    'def': ['def-1', 'def-2', 'def-3']
  },
  flightDataByConnection: {
    'abc,abc-1': <FlightData>{
      flights: [
        {
          departedOn: new Date(2017, 0, 1, 1),
          delayInMinutes: 5,
          delayRatio: 0.01
        },
        {
          departedOn: new Date(2017, 0, 1, 2),
          delayInMinutes: 1,
          delayRatio: 0.01
        },
        {
          departedOn: new Date(2017, 0, 2, 2),
          delayInMinutes: 10,
          delayRatio: 0.2
        },
        {
          departedOn: new Date(2017, 0, 3, 11),
          delayInMinutes: -7,
          delayRatio: -0.03
        },
        {
          departedOn: new Date(2017, 0, 12, 11),
          delayInMinutes: 0,
          delayRatio: 0.0
        },
        {
          departedOn: new Date(2017, 0, 31, 16),
          delayInMinutes: 3,
          delayRatio: 0.02
        }
      ]
    },
    'def,def-1': <FlightData>{
      flights: [],
    }
  }
}

@Injectable()
export class FakeDataService extends DataService {

  private static readonly latencyInMilliseconds: number = 300;

  fetchAllOrigins(): Observable<string[]> {
    return Observable.of(FAKE_DATA.origins)
      .delay(FakeDataService.latencyInMilliseconds);
  }

  fetchDestinationsOfOrigin(origin: string): Observable<string[]> {
    return Observable.of(FAKE_DATA.destinationsByOrigin[origin])
      .delay(FakeDataService.latencyInMilliseconds);
  }

  fetchFlightData(origin: string, destination: string): Observable<FlightData> {
    const connection = `${origin},${destination}`;
    const flightData = FAKE_DATA.flightDataByConnection[connection];
    return Observable.of(flightData)
      .delay(FakeDataService.latencyInMilliseconds);
  }
}

interface Connections {
  [origin: string]: string[];
}

@Injectable()
export class HttpDataService extends DataService {

  private static readonly artificialLatencyInMilliseconds: number = 0;

  private cachedConnections: Connections;

  constructor(private http: HttpClient) {
    super();
  }

  fetchAllOrigins(): Observable<string[]> {
    return this.fetchConnections()
      .map(c => Object.keys(c).sort())
      .delay(HttpDataService.artificialLatencyInMilliseconds);
  }

  fetchDestinationsOfOrigin(origin: string): Observable<string[]> {
    return this.fetchConnections()
      .map(c => c[origin] || [])
      .map(d => d.concat().sort())
      .delay(HttpDataService.artificialLatencyInMilliseconds);
  }

  fetchFlightData(origin: string, destination: string): Observable<FlightData> {
    const departedOnObservable = this.http
      .get<number[]>(`data/p-${origin}-${destination}-departedOn.json`)
      .map(timestamps => timestamps.map(t => new Date(t * 1000)));
    const delayInMinutesObservable = this.http
      .get<number[]>(`data/p-${origin}-${destination}-delayInMinutes.json`);
      const delayRatioObservable = this.http
        .get<number[]>(`data/p-${origin}-${destination}-delayRatio.json`);
    return Observable.zip(
      departedOnObservable,
      delayInMinutesObservable,
      delayRatioObservable,
      (departedOnArray: Date[], delayInMinutesArray: number[], delayRatioArray: number[]) => {
        const flights = new Array<DataPoint>(); // PERF: possible memory churn
        for (let i = 0; i < departedOnArray.length; ++i) {
          flights.push({
            departedOn: departedOnArray[i],
            delayInMinutes: delayInMinutesArray[i],
            delayRatio: delayRatioArray[i],
          });
        }
        return <FlightData>{
          flights: flights
        };
      })
      .delay(HttpDataService.artificialLatencyInMilliseconds);
  }

  private fetchConnections(): Observable<Connections> {
    if (this.cachedConnections) {
      return Observable.of(this.cachedConnections);
    }
    return this.http
      .get<Connections>('data/connections.json')
      .do(c => {
        this.cachedConnections = c;
      });
  }
}
