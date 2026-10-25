import {clearCache} from './api.js';
import {clearChoropleth} from './tools/choropleth.js';

// Clear shared source responses and adapter results before a user refreshes the mounted tools.
export function refreshData() {
  clearCache();
  clearChoropleth();
}
