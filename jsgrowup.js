(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.jsgrowup = f()}})(function(){var define,module,exports;return (function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
'use strict';

const Decimal = require('decimal.js');

const jsgrowup = {
  /**
   * LMS values are Box-Cox power (L), median (M), and coefficient of variation (S)
   *
   * @param {string} measurement The measurement to be looked up.
   * @param {string} indicator The indicator for which the measurement is being looked up.
   * @param {string} sex "male" or "female"
   * @param {object} tables The growth standard tables.
   */
  getLMS: (measurement, indicator, sex, tables) => {
    // ... (implementation of getLMS - this will be extensive)
  },

  /**
   * Calculate z-score for a given indicator.
   *
   * @param {string} indicator The indicator for which the z-score is being calculated.
   * @param {string} sex "male" or "female"
   * @param {number} measurement The measurement value.
   * @param {number} ageInDays The age in days.
   * @param {number} height The height in cm (required for weight-for-height).
   * @param {object} tables The growth standard tables.
   */
  zscoreForMeasurement: (indicator, sex, measurement, ageInDays, height, tables) => {
    // ... (implementation of zscoreForMeasurement - this will be extensive)
  },

  /**
   * The main calculator function.
   *
   * @param {object} options The options for the calculation.
   * @param {string} options.sex "male" or "female"
   * @param {number} options.ageInDays The age in days.
   * @param {number} options.weight The weight in kg.
   * @param {number} options.lenhei The length/height in cm.
   * @param {number} options.headc The head circumference in cm.
   * @param {string} options.oedema "y", "n", or "unknown"
   * @param {string} [options.dataSource='WHO'] "WHO" or "CDC"
   * @param {string} jsonURL The base URL for the JSON data tables.
   */
  calculator: async (options, jsonURL) => {
    const { sex, ageInDays, weight, lenhei, headc, oedema, dataSource = 'WHO' } = options;
    const results = {};

    const tablePaths = {
      'wfa': `/wfa_${sex === 'male' ? 'boys' : 'girls'}_0_5_zscores.json`,
      'lhfa': `/lhfa_${sex === 'male' ? 'boys' : 'girls'}_0_5_zscores.json`,
      'wfl': `/wfl_${sex === 'male' ? 'boys' : 'girls'}_0_2_zscores.json`,
      'wfh': `/wfh_${sex === 'male' ? 'boys' : 'girls'}_2_5_zscores.json`,
      'bfa': `/bmifa_${sex === 'male' ? 'boys' : 'girls'}_0_5_zscores.json`,
      'hfa': `/hcfa_${sex === 'male' ? 'boys' : 'girls'}_0_5_zscores.json`,
    };

    const fetchTable = async (path) => {
      const response = await fetch(`${jsonURL}${path}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch ${path}`);
      }
      return response.json();
    };

    const tables = {};
    for (const key in tablePaths) {
      tables[key] = await fetchTable(tablePaths[key]);
    }
    
    // ... (rest of the calculator logic using the fetched tables)
    
    return results;
  }
};

module.exports = jsgrowup;

},{"decimal.js":2}],2:[function(require,module,exports){
// The decimal.js library would be bundled here by Browserify.
// This is a placeholder for the actual library code.
// In a real build, the content of the decimal.js node module would be inserted here.
module.exports = require('decimal.js');
},{}]},{},[1])(1)
});
