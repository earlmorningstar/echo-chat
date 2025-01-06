import { Metric } from 'web-vitals';

const reportWebVitals = async (onPerfEntry?: (metric: Metric) => void) => {
  if (onPerfEntry && onPerfEntry instanceof Function) {
    const webVitals = await import('web-vitals');
    webVitals.onCLS(onPerfEntry);
    webVitals.onFID(onPerfEntry);
    webVitals.onFCP(onPerfEntry);
    webVitals.onLCP(onPerfEntry);
    webVitals.onTTFB(onPerfEntry);
  }
};

export default reportWebVitals;