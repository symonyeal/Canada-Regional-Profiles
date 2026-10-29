import {clearCache} from './transport.js';
import {clearChoropleth} from './tools/choropleth.js';
import {clearCohorts} from './tools/common.js';

// Clear shared source responses and adapter results before a user refreshes the mounted tools.
export function refreshData() {
  clearCache();
  clearChoropleth();
  clearCohorts();
}
