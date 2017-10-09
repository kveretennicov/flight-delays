import { AppPage } from './app.po';

describe('Flights Delays App', () => {
  let page: AppPage;

  beforeEach(() => {
    page = new AppPage();
    page.navigateTo();
  });

  it('should display app title', () => {
    expect(page.getTitleText()).toContain('Flight Delays');
  });
  it('should start with ABQ origin', () => {
    expect(page.getSelectedOriginText()).toBe('ABQ');
  });
  it('should start with LAX destination', () => {
    expect(page.getSelectedDestinationText()).toBe('LAX');
  });
  it('should start with correct best flight for ABQ->LAX', () => {
    expect(page.getTopFlightDelayText()).toBe('-27');
  });
  it('should start with correct mean absolute delay for ABQ->LAX', () => {
    expect(page.getMeanDelayText()).toBe('19.4');
  });

  describe('when switched to mean delay ratio mode', () => {

    beforeEach(() => {
      page.switchToDelayRatioMode();
    });

    it('should display correct mean delay ratio for ABQ->LAX', () => {
      expect(page.getMeanDelayText()).toBe('15.7%');
    });
  });
});
