import { browser, by, element } from 'protractor';

export class AppPage {
  navigateTo() {
    return browser.get('/');
  }

  getTitleText() {
    return element(by.css('.navbar-brand')).getText();
  }

  getSelectedOriginText() {
    return element(by.css('#origin-picker option:checked')).getText();
  }

  getSelectedDestinationText() {
    return element(by.css('#destination-picker option:checked')).getText();
  }

  getTopFlightDelayText() {
    return element(by.css('#best-flights tr:nth-of-type(1) td:nth-of-type(2)')).getText();
  }

  getMeanDelayText() {
    return element(by.css('#selection-stats tr:nth-of-type(2) td')).getText();
  }

  switchToDelayRatioMode() {
    const delayRatioSwitch = element(by.css('#delay-calc-mode-switch label:nth-of-type(2)'));
    delayRatioSwitch.click();
  }
}
