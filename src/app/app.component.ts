import { Component, ElementRef, OnInit, SimpleChanges, ViewChild } from '@angular/core';
import * as d3 from 'd3';
import * as crossfilter from 'crossfilter2';
import * as dc from 'dc';

import { DataService } from './data.service';
import { DataPoint } from './data-point';

const januaryDaysOfMonth = d3.range(1, 32);
const weekDays = d3.range(7);
const weekDayNames = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'];
const hoursOfDay = d3.range(24);
const nullSign = '\u2205';

const fullDateTimeFormat = d3.time.format('%x %X');
const delayFormat = d3.format('.0f');
const delayRatioFormat = d3.format('.0%');
const meanDelayFormat = d3.format('.1f');
const meanDelayRatioFormat = d3.format('.1%');

const chartReferenceWidth = 700;
const chartReferenceHeight = 100;

type DelayCalcMode = 'absolute' | 'ratio';

interface DelayAgg {
  count: number;
  sumDelay: number;
  sumDelayRatio: number;
}

@Component({
  selector: 'flights-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {

  origins: string[];
  destinations: string[];
  isReady: boolean;

  private _selectedOrigin: string;
  private _selectedDestination: string;
  private _delayCalcMode: DelayCalcMode = 'absolute';

  @ViewChild('flightsWithLeastDelay') private flightsWithLeastDelayElementRef: ElementRef;
  @ViewChild('timeRangePicker') private timeRangePickerElementRef: ElementRef;
  @ViewChild('delaysByDayOfMonth') private delaysByDayOfMonthElementRef: ElementRef;
  @ViewChild('delaysByDayOfWeek') private delaysByDayOfWeekElementRef: ElementRef;
  @ViewChild('delaysByHourOfDay') private delaysByHourOfDayElementRef: ElementRef;
  @ViewChild('meanDelayForSelection') private meanDelayForSelectionElementRef: ElementRef;
  @ViewChild('dataCountsForSelection') private dataCountsForSelectionElementRef: ElementRef;

  // Initialized by initCharts().
  private dataSource: CrossFilter.CrossFilter<DataPoint>;
  private timeRangePicker: dc.BarChart;
  private delaysByDayOfMonthChart: dc.BarChart;
  private delaysByDayOfWeekChart: dc.BarChart;
  private delaysByHourOfDayChart: dc.BarChart;
  private meanDelayForSelectionDisplay: dc.NumberDisplayWidget;

  constructor(private dataService: DataService) {
  }

  ngOnInit(): void {
    this.initCharts();
    this.dataService
      .fetchAllOrigins()
      .subscribe(origins => {
        this.origins = origins;
        this.selectedOrigin = origins[0];
      });
  }

  get selectedOrigin(): string {
    return this._selectedOrigin;
  }
  set selectedOrigin(value: string) {
    this._selectedOrigin = value;
    // Start fetching connected destinations.
    this.isReady = false;
    this.dataService
      .fetchDestinationsOfOrigin(value)
      .subscribe(destinations => {
        this.destinations = destinations;
        this.selectedDestination = this.destinations[0];
      });
  }

  get selectedDestination(): string {
    return this._selectedDestination;
  }
  set selectedDestination(value: string) {
    this._selectedDestination = value;
    // Start fetching flight data for the connection.
    this.isReady = false;
    this.dataService
      .fetchFlightData(this.selectedOrigin, this.selectedDestination)
      .subscribe(flightData => {
        this.updateChartsData(flightData.flights);
        this.isReady = true;
      });
  }

  get delayCalcMode(): DelayCalcMode {
    return this._delayCalcMode;
  }
  set delayCalcMode(value: DelayCalcMode) {
    if (this._delayCalcMode === value) {
      return;
    }
    this._delayCalcMode = value;
    this.setChartsDelayCalcMode(value, true);
  }

  resetTimeRangeFilter(): void {
    this.timeRangePicker.filterAll();
    dc.redrawAll();
  }

  resetDelaysByDayOfMonthFilter(): void {
    this.delaysByDayOfMonthChart.filterAll();
    dc.redrawAll();
  }

  resetDelaysByDayOfWeekFilter(): void {
    this.delaysByDayOfWeekChart.filterAll();
    dc.redrawAll();
  }

  resetDelaysByHourOfDayFilter(): void {
    this.delaysByHourOfDayChart.filterAll();
    dc.redrawAll();
  }

  private initCharts(): void {

    function createDelayAgg(): DelayAgg {
      return {
        count: 0,
        sumDelay: 0,
        sumDelayRatio: 0,
      };
    }

    function reduceAdd(p: DelayAgg, v: DataPoint): DelayAgg {
      ++p.count;
      p.sumDelay += v.delayInMinutes;
      p.sumDelayRatio += v.delayRatio;
      return p;
    }

    function reduceRemove(p: DelayAgg, v: DataPoint): DelayAgg {
      --p.count;
      p.sumDelay -= v.delayInMinutes;
      p.sumDelayRatio -= v.delayRatio;
      return p;
    }

    const ndx = <CrossFilter.CrossFilter<DataPoint>>crossfilter();
    const flightTimeDimension = ndx.dimension((d: DataPoint) => d.departedOn);

    // Best flights.

    const flightDelayDimension = ndx.dimension((d: DataPoint) => d.delayInMinutes);

    const flightsWithLeastDelayElement = this.flightsWithLeastDelayElementRef.nativeElement;
    const flightsWithLeastDelayTable = dc.dataTable(flightsWithLeastDelayElement)
      .dimension(flightDelayDimension)
      .group((d: DataPoint) => 'this is not a group') // Grouping would screw up the order, so stick to single group for everything.
      .columns([
        {
          label: 'Departure',
          format: (d: DataPoint) => fullDateTimeFormat(d.departedOn)
        },
        {
          label: 'Delay, minutes',
          format: (d: DataPoint) => delayFormat(d.delayInMinutes)
        }
      ])
      .sortBy((d: DataPoint) => d.delayInMinutes)
      .showGroups(false)
      .size(3);

    // Time range.

    const flightsByDayGroup = flightTimeDimension
      .group(d3.time.day)
      .reduceCount();

    const timeRangePickerElement = this.timeRangePickerElementRef.nativeElement;
    const timeRangePicker = dc.barChart(timeRangePickerElement)
      .dimension(flightTimeDimension)
      .group(flightsByDayGroup)
      .x(d3.time.scale().domain([new Date(2017, 0, 0, 12), new Date(2017, 0, 31, 12)])) // XXX: hardcoded to January 2017
      .round(d3.time.day.round)
      .alwaysUseRounding(true)
      .xUnits(<any>d3.time.days)
      .yAxisLabel('Flights')
      .brushOn(true)
      .width(chartReferenceWidth)
      .height(chartReferenceHeight * 0.66)
      .centerBar(true);
    timeRangePicker.yAxis().ticks(2);

    // Delays by day of month.

    const dayOfMonthDimension = ndx.dimension((d: DataPoint) => d.departedOn.getDate());
    const delaysByDayOfMonthRawGroup = dayOfMonthDimension.group().reduce(
      reduceAdd,
      reduceRemove,
      createDelayAgg);
    const delaysByDayOfMonthGroup = ensureBins(
      delaysByDayOfMonthRawGroup,
      createDelayAgg,
      januaryDaysOfMonth); // XXX: hardcoded to January

    const delaysByDayOfMonthElement = this.delaysByDayOfMonthElementRef.nativeElement;
    const delaysByDayOfMonthChart = dc.barChart(delaysByDayOfMonthElement)
      .dimension(dayOfMonthDimension)
      .group(delaysByDayOfMonthGroup)
      .x(d3.scale.ordinal())
      .xUnits(dc.units.ordinal)
      .xAxisLabel('Day of Month')
      .filterPrinter((selectedDaysOfMonth: number[]) => numSorted(selectedDaysOfMonth).map(i => i.toString()).join(', '))
      .title((p: CrossFilter.Grouping<number, DelayAgg>) => {
        const lines = [
          `Day ${p.key}`,
          `Number of flights: ${p.value.count}`,
        ];
        if (p.value.count) {
          lines.push(`Mean delay: ${meanDelayFormat(p.value.sumDelay / p.value.count)} minutes`);
          lines.push(`Mean delay ratio: ${meanDelayRatioFormat(p.value.sumDelayRatio / p.value.count)}`);
        }
        return lines.join('\n');
      })
      .width(chartReferenceWidth)
      .height(chartReferenceHeight)
      .barPadding(0.1)
      .outerPadding(0.05);

    // Delays by day of week.

    const dayOfWeekDimension = ndx.dimension((d: DataPoint) => d.departedOn.getDay());
    const delaysByDayOfWeekRawGroup = dayOfWeekDimension.group().reduce(
      reduceAdd,
      reduceRemove,
      createDelayAgg);
    const delaysByDayOfWeekGroup = ensureBins(
      delaysByDayOfWeekRawGroup,
      createDelayAgg,
      weekDays);

    const delaysByDayOfWeekElement = this.delaysByDayOfWeekElementRef.nativeElement;
    const delaysByDayOfWeekChart = dc.barChart(delaysByDayOfWeekElement)
      .dimension(dayOfWeekDimension)
      .group(delaysByDayOfWeekGroup)
      .x(d3.scale.ordinal())
      .xUnits(dc.units.ordinal)
      .xAxisLabel('Day of Week')
      .filterPrinter((selectedDaysOfWeek: number[]) => numSorted(selectedDaysOfWeek).map(i => weekDayNames[i]).join(', '))
      .title((p: CrossFilter.Grouping<number, DelayAgg>) => {
        const lines = [
          weekDayNames[p.key],
          `Number of flights: ${p.value.count}`,
        ];
        if (p.value.count) {
          lines.push(`Mean delay: ${meanDelayFormat(p.value.sumDelay / p.value.count)} minutes`);
          lines.push(`Mean delay ratio: ${meanDelayRatioFormat(p.value.sumDelayRatio / p.value.count)}`);
        }
        return lines.join('\n');
      })
      .width(chartReferenceWidth)
      .height(chartReferenceHeight)
      .barPadding(0.1)
      .outerPadding(0.05);
    delaysByDayOfWeekChart
      .xAxis().tickFormat((dayOfWeek: number) => weekDayNames[dayOfWeek]);

    // Delays by hour of day.

    const hourOfDayDimension = ndx.dimension((d: DataPoint) => d.departedOn.getHours());
    const delaysByHourOfDayRawGroup = hourOfDayDimension.group().reduce(
      reduceAdd,
      reduceRemove,
      createDelayAgg);
    const delaysByHourOfDayGroup = ensureBins(
      delaysByHourOfDayRawGroup,
      createDelayAgg,
      hoursOfDay);

    const delaysByHourOfDayElement = this.delaysByHourOfDayElementRef.nativeElement;
    const delaysByHourOfDayChart = dc.barChart(delaysByHourOfDayElement)
      .dimension(hourOfDayDimension)
      .group(delaysByHourOfDayGroup)
      .x(d3.scale.ordinal())
      .xUnits(dc.units.ordinal)
      .xAxisLabel('Hour of Day')
      .filterPrinter((selectedHoursOfDay: number[]) => numSorted(selectedHoursOfDay).map(i => i.toString()).join(', '))
      .title((p: CrossFilter.Grouping<number, DelayAgg>) => {
        const lines = [
          `Hours ${p.key} to ${p.key + 1}`, // TODO: better hour format
          `Number of flights: ${p.value.count}`,
        ];
        if (p.value.count) {
          lines.push(`Mean delay: ${meanDelayFormat(p.value.sumDelay / p.value.count)} minutes`);
          lines.push(`Mean delay ratio: ${meanDelayRatioFormat(p.value.sumDelayRatio / p.value.count)}`);
        }
        return lines.join('\n');
      })
      .width(chartReferenceWidth)
      .height(chartReferenceHeight)
      .barPadding(0.1)
      .outerPadding(0.05);

    // Data counts for selection.

    const dataCountsForSelectionElement = this.dataCountsForSelectionElementRef.nativeElement;
    const dataCountsForSelection = dc.dataCount(dataCountsForSelectionElement)
      .dimension(ndx)
      .group(ndx.groupAll())
      .html({
        some: '%filter-count of %total-count records',
        all: 'all of %total-count records'
      });

    // Mean delay over selection.

    const meanDelayForSelectionElement = this.meanDelayForSelectionElementRef.nativeElement;
    const meanDelayForSelectionDisplay = dc.numberDisplay(meanDelayForSelectionElement)
      .group(ndx.groupAll().reduce(reduceAdd, reduceRemove, createDelayAgg));

    for (const chart of [timeRangePicker, delaysByDayOfMonthChart, delaysByDayOfWeekChart, delaysByHourOfDayChart]) {
      chart.elasticY(true);
      chart.turnOnControls();
      chart.controlsUseVisibility(true);
      // Note: this one is missing from typings.
      (<any>chart).useViewBoxResizing(true);
    }

    for (const delayChart of [delaysByDayOfMonthChart, delaysByDayOfWeekChart, delaysByHourOfDayChart]) {
      delayChart
        .label((p: {data: {value: DelayAgg}}) => {
          if (p.data.value.count) {
            return '';
          }
          return nullSign;
        })
        .renderHorizontalGridLines(true)
        .colors(['palevioletred', 'cadetblue'])
        .colorAccessor(<any>((p: {value: DelayAgg}) => p.value.sumDelay > 0 ? 0 : 1));
      delayChart.yAxis().ticks(4);
    }

    this.dataSource = ndx;
    this.timeRangePicker = timeRangePicker;
    this.delaysByDayOfMonthChart = delaysByDayOfMonthChart;
    this.delaysByDayOfWeekChart = delaysByDayOfWeekChart;
    this.delaysByHourOfDayChart = delaysByHourOfDayChart;
    this.meanDelayForSelectionDisplay = meanDelayForSelectionDisplay;

    this.setChartsDelayCalcMode(this.delayCalcMode, false);

    dc.renderAll();
  }

  private updateChartsData(dataPoints: DataPoint[]): void {
    this.dataSource.remove();
    this.dataSource.add(dataPoints);
    dc.redrawAll();
  }

  private setChartsDelayCalcMode(mode: DelayCalcMode, redraw: boolean): void {
    switch (mode) {
      case 'absolute': {
        this.meanDelayForSelectionDisplay
          .valueAccessor((p: DelayAgg) => p.sumDelay / p.count)
          .formatNumber((n: number) => isFinite(n) ? meanDelayFormat(n) : nullSign);
        for (const delayChart of [this.delaysByDayOfMonthChart, this.delaysByDayOfWeekChart, this.delaysByHourOfDayChart]) {
          delayChart
            .valueAccessor((p: CrossFilter.Grouping<number, DelayAgg>) => p.value.count ? (p.value.sumDelay / p.value.count) : 0)
            .yAxis()
              .tickFormat(delayFormat);
        }
      }
      break;
      case 'ratio': {
        this.meanDelayForSelectionDisplay
          .valueAccessor((p: DelayAgg) => p.sumDelayRatio / p.count)
          .formatNumber((n: number) => isFinite(n) ? meanDelayRatioFormat(n) : nullSign);
        for (const delayChart of [this.delaysByDayOfMonthChart, this.delaysByDayOfWeekChart, this.delaysByHourOfDayChart]) {
          delayChart
            .valueAccessor((p: CrossFilter.Grouping<number, DelayAgg>) => p.value.count ? (p.value.sumDelayRatio / p.value.count) : 0)
            .yAxis()
              .tickFormat(delayRatioFormat);
        }
      }
      break;
    }
    if (redraw) {
      for (const chart of [
        this.meanDelayForSelectionDisplay,
        this.delaysByDayOfMonthChart,
        this.delaysByDayOfWeekChart,
        this.delaysByHourOfDayChart
      ]) {
        chart.redraw();
      }
    }
  }
}

// Based on https://github.com/dc-js/dc.js/wiki/FAQ#ensure-that-bins-exist-even-if-there-are-no-values-in-them
function ensureBins<TDataPoint, TGroupKey extends number|string, TGroupValue>(
  group: CrossFilter.Group<TDataPoint, TGroupKey, TGroupValue>,
  newGroupValue: () => TGroupValue,
  keysToEnsure: TGroupKey[]
): {all: () => CrossFilter.Grouping<TGroupKey, TGroupValue>[]} {
  return {
    all: () => {
      const result = group.all().slice(0);
      const found: {[key: string]: boolean} = {};
      for (const r of result) {
        found[r.key.toString()] = true;
      }
      for (const k of keysToEnsure) {
        if (!found[k.toString()]) {
          result.push({
            key: k,
            value: newGroupValue()
          });
        }
      }
      return result;
    }
  };
}

function numSorted(a: number[]): number[] {
  const nums = a.map(x => +x);
  return nums.sort((lhs: number, rhs: number) => lhs - rhs);
}
