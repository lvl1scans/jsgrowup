// zscoreCalculator.mjs (or .js, with type: "module" in package.json)

// jsgrowup: z-score calculation for anthropometric indicators
// Adapted from pygrowup; BSD license
// Can be used to detect malnutrition, among other applications
// http://www.unhcr.org/45f6abc92.pdf
// Version 0.8.0, following pygrowup

// Import Decimal.js from JSDelivr CDN
import { Decimal as D } from 'https://cdn.jsdelivr.net/npm/decimal.js@10.6.0/decimal.min.js';
// Import Ramda from JSDelivr CDN
import * as R from 'https://cdn.jsdelivr.net/npm/ramda@0.31.3/dist/ramda.min.js';

// --- Constants ---
export const WEIGHT_FOR_LENGTH = 'wfl';
export const WEIGHT_FOR_HEIGHT = 'wfh';
export const WEIGHT_FOR_AGE = 'wfa';
export const LENGTH_HEIGHT_FOR_AGE = 'lhfa';
export const HEAD_CIRC_FOR_AGE = 'hcfa';
export const BODY_MASS_INDEX_FOR_AGE = 'bmifa';

export const AGE_0_2 = '0_2';
export const AGE_2_5 = '2_5';
export const AGE_0_5 = '0_5';
export const AGE_0_13 = '0_13';
export const AGE_2_20 = '2_20';

export const SEX_BOYS = 'boys';
export const SEX_GIRLS = 'girls';

// IMPORTANT: You MUST host your Z-score JSON data tables online (e.g., on GitHub and serve via JSDelivr,
// or on Cloudflare R2, Google Cloud Storage, AWS S3, etc.).
// Replace 'YOUR_GITHUB_USERNAME/YOUR_REPO_NAME' with the actual path to your 'tables' directory.
// For example: 'https://cdn.jsdelivr.net/gh/who/child-growth-standards/tables/'
const BASE_TABLES_URL = 'https://cdn.jsdelivr.net/gh/lvl1scans/jsgrowup/tables/';

// OBSERVATION CLASS
export class Observation {
    constructor(indicator, measurement, ageInMonths, sex, height, american) {
        this.indicator = indicator;
        this.measurement = measurement;
        this.position = null;
        this.ageInMonths = ageInMonths;
        this.sex = sex.toUpperCase();
        this.height = height;
        this.american = american;

        this.tableIndicator = null;
        this.tableAge = null;
        this.tableSex = null;

        if ([WEIGHT_FOR_HEIGHT, WEIGHT_FOR_LENGTH].includes(this.indicator)) {
            if (!height || height === '') {
                throw new Error('no length or height');
            }
        }
    }

    getZScores(calculator) {
        const tableName = this.tableNameForObservation;
        const table = calculator.tables[tableName];
        if ([WEIGHT_FOR_HEIGHT, WEIGHT_FOR_LENGTH].includes(this.indicator)) {
            if (!this.height) { throw new Error('NO HEIGHT'); }
            if (this.height < 45) { throw new Error('too short'); }
            if (this.height > 120) { throw new Error('too tall'); }
            /* find closest height from WHO table (which has data at a resolution
            of half a centimeter). */
            const closestHeight = (Math.round(this.height / 0.5)) * 0.5;
            const scores = table[closestHeight.toString()];
            return scores;
        }
        // all other indicators
        if (this.ageInWeeks <= 13) {
            const closestWeek = Math.floor(this.ageInWeeks);
            const scores = table[closestWeek.toString()];
            return scores;
        }
        // all other ages
        const closestMonth = Math.floor(this.ageInMonths);
        const scores = table[closestMonth.toString()];
        return scores;
    }

    get ageInWeeks() {
        return ((this.ageInMonths * 30.4374) / 7);
    }

    get tableNameForObservation() {
        /* Choose a WHO/CDC table to use, making adjustments
        based on age, length, or height. If, for example, the
        indicator is set to wfl while the child is too long for
        the recumbent tables, this method will make the lookup
        in the wfh table. */

        if (this.sex === 'M') { this.tableSex = SEX_BOYS; }
        if (this.sex === 'F') { this.tableSex = SEX_GIRLS; }

        if ([WEIGHT_FOR_HEIGHT, WEIGHT_FOR_LENGTH].includes(this.indicator)) {
            if (this.indicator === WEIGHT_FOR_LENGTH && this.height > 86) {
                // console.log('too long for recumbent');
                this.tableIndicator = WEIGHT_FOR_HEIGHT;
                this.tableAge = AGE_2_5;
            } else if (this.indicator === WEIGHT_FOR_HEIGHT && this.height < 65) {
                // console.log('too short for standing');
                this.tableIndicator = WEIGHT_FOR_LENGTH;
                this.tableAge = AGE_0_2;
            } else {
                this.tableIndicator = this.indicator;
                if (this.tableIndicator === WEIGHT_FOR_LENGTH) { this.tableAge = AGE_0_2; }
                if (this.tableIndicator === WEIGHT_FOR_HEIGHT) { this.tableAge = AGE_2_5; }
            }
        } else if ([WEIGHT_FOR_AGE, LENGTH_HEIGHT_FOR_AGE, HEAD_CIRC_FOR_AGE].includes(
            this.indicator)) {
            /* weight for age has only one table per sex, as does head circumference for age
            and CDC goes unused before 24mos */
            this.tableIndicator = this.indicator;
            this.tableAge = AGE_0_5;
            if (this.ageInMonths <= 3) {
                if (this.ageInWeeks <= 13) {
                    this.tableAge = AGE_0_13;
                }
            }
            if (this.american && this.ageInMonths >= 24) {
                if (this.indicator === HEAD_CIRC_FOR_AGE) {
                    throw new Error(`TOO OLD ${this.ageInMonths}`);
                }
                this.tableAge = AGE_2_20;
            }
        } else if (this.indicator === BODY_MASS_INDEX_FOR_AGE) {
            this.tableIndicator = this.indicator;
            if (this.ageInMonths <= 3 && this.ageInWeeks <= 13) {
                this.tableAge = AGE_0_13;
            } else if (this.ageInMonths < 24) {
                this.tableAge = AGE_0_2;
            } else if (this.ageInMonths >= 24 && this.ageInMonths <= 60) {
                this.tableAge = AGE_2_5;
            } else if (this.ageInMonths > 60 && this.ageInMonths <= 240) {
                this.tableAge = AGE_2_20;
            } else if (this.ageInMonths > 240) {
                throw new Error(`TOO OLD ${this.ageInMonths}`);
            }
        }

        if (!this.tableIndicator || !this.tableSex || !this.tableAge) {
            throw new Error('DATA ERROR');
        } else {
            const tableName = `${this.tableIndicator}_${this.tableSex}_${this.tableAge}`;
            return tableName;
        }
    }
}

export async function buildTablesObject(includeCdc = false) {
    /*
    # WHO Growth Standards
    # http://www.who.int/childgrowth/standards/en/
    # WHO tab-separated txt files have been converted to json,
    # and the separate lhfa tables (0-2 and 2-5) have been combined
    */
    const whoTableNames = [
        'wfl_boys_0_2', 'wfl_girls_0_2',
        'wfh_boys_2_5', 'wfh_girls_2_5',
        'lhfa_boys_0_5', 'lhfa_girls_0_5',
        'hcfa_boys_0_5', 'hcfa_girls_0_5',
        'wfa_boys_0_5', 'wfa_girls_0_5',
        'wfa_boys_0_13', 'wfa_girls_0_13',
        'lhfa_boys_0_13', 'lhfa_girls_0_13',
        'hcfa_boys_0_13', 'hcfa_girls_0_13',
        'bmifa_boys_0_13', 'bmifa_girls_0_13',
        'bmifa_boys_0_2', 'bmifa_girls_0_2',
        'bmifa_boys_2_5', 'bmifa_girls_2_5'];

    // Use fetch API to load JSON data from the specified BASE_TABLES_URL
    const getTableUrl = tableName => `${BASE_TABLES_URL}${tableName}_zscores.json`;
    const getCdcTableUrl = tableName => `${BASE_TABLES_URL}${tableName}_zscores.cdc.json`;

    const loadJsonFile = async (url) => {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch table from ${url}: ${response.status} ${response.statusText}`);
        }
        return response.json();
    };

    const allowedIndexKeys = ['Length', 'Height', 'Month', 'Week'];
    const operativeIndexKey = R.pipe(R.keysIn, R.intersection(allowedIndexKeys), R.head);
    const reIndex = R.indexBy(R.chain(R.prop, operativeIndexKey));

    let allTables = {};

    try {
        const whoDataPromises = R.map(tableName => loadJsonFile(getTableUrl(tableName)), whoTableNames);
        const whoDataResults = await Promise.all(whoDataPromises);
        allTables = R.zipObj(whoTableNames, R.map(reIndex, whoDataResults));
    } catch (error) {
        console.error("Error loading WHO tables:", error);
        throw error;
    }

    if (includeCdc) {
        /*
        # CDC growth standards
        # http://www.cdc.gov/growthcharts/
        # CDC csv files have been converted to JSON, and the third standard
        # deviation has been fudged for the purpose of this tool.
        */
        const cdcTableNames = [
            'lhfa_boys_2_20',
            'lhfa_girls_2_20',
            'wfa_boys_2_20',
            'wfa_girls_2_20',
            'bmifa_boys_2_20',
            'bmifa_girls_2_20'];

        try {
            const cdcDataPromises = R.map(tableName => loadJsonFile(getCdcTableUrl(tableName)), cdcTableNames);
            const cdcDataResults = await Promise.all(cdcDataPromises);
            const cdcData = R.zipObj(cdcTableNames, R.map(reIndex, cdcDataResults));
            return R.merge(allTables, cdcData);
        } catch (error) {
            console.error("Error loading CDC tables:", error);
            throw error;
        }
    }
    return allTables;
}

// CALCULATOR CLASS
export class Calculator {
    constructor(adjustHeightData = false, adjustWeightScores = false, tables = null) {
        /*
        # Height adjustments are part of the WHO specification
        # (to correct for recumbent vs standing measurements),
        # but none of the existing software seems to implement this.
        # default is false so values are closer to those produced
        # by igrowup software
        */
        this.adjustHeightData = adjustHeightData;

        /*
        # WHO specs include adjustments to z-scores of weight-based
        # indicators that are greater than +/- 3 SDs. These adjustments
        # correct for right skewness and avoid making assumptions about
        # the distribution of data beyond the limits of the observed values.
        # However, when calculating z-scores in a live data collection
        # situation, z-scores greater than +/- 3 SDs are likely to indicate
        # data entry or anthropometric measurement errors and should not
        # be adjusted. Instead, these large z-scores should be used to
        # identify poor data quality and/or entry errors.
        # These z-score adjustments are appropriate only when there
        # is confidence in data quality.
        */
        this.adjustWeightScores = adjustWeightScores;

        this.tables = tables;
        if (!tables) { throw new Error('No data found'); }
    }

    zscoreForMeasurement(indicator, measurement, ageInMonths, sex, height = null,
        american = false) {
        if (!sex || (!['M', 'F', 'm', 'f'].includes(sex))) { throw new Error('Invalid sex value'); }
        if (!ageInMonths || parseInt(ageInMonths, 10) === 0) { throw new Error('Invalid age'); }
        if (!indicator || (![WEIGHT_FOR_LENGTH, WEIGHT_FOR_HEIGHT, LENGTH_HEIGHT_FOR_AGE,
            HEAD_CIRC_FOR_AGE, WEIGHT_FOR_AGE, BODY_MASS_INDEX_FOR_AGE].includes(indicator))) {
            throw new Error('Invalid indicator');
        }
        if (!measurement || parseInt(measurement, 10) === 0) {
            throw new Error('Invalid measurement');
        }

        const obs = new Observation(indicator, measurement, ageInMonths, sex, height, american);
        let m = parseFloat(measurement, 10);

        /*
        # indicator-specific methodology
        # (see section 5.1 of http://www.who.int/entity/childgrowth/standards/\
        #                                  technical_report/en/index.html)
        #
        # TODO accept a recumbent vs standing parameter for deciding
        # whether or not to do these adjustments rather than assuming
        # measurement orientation based on the measurement
        */
        if (indicator === WEIGHT_FOR_LENGTH) {
            if (m > 65.7 && m < 120.7) { m -= 0.7; }
        }
        if (indicator === WEIGHT_FOR_HEIGHT && this.adjustHeightData) {
            m += 0.7;
        }

        const zscores = obs.getZScores(this);
        if (!zscores) { throw new Error('Data error'); }

        const y = new D(m);
        const boxCox = new D(zscores.L);
        const median = new D(zscores.M);
        const coeffVariance = new D(zscores.S);

        /*
        ###
        # calculate z-score
        #
        # (see Chapter 7 of http://www.who.int/entity/childgrowth/standards/\
        #                                  technical_report/en/index.html)
        #
        #           [y/M(t)]^L(t) - 1
        #   Zind =  -----------------
        #               S(t)L(t)
        ###
        */
        const base = y.dividedBy(median);
        const power = base.pow(boxCox);
        const numerator = power.minus(1);
        const denominator = coeffVariance.times(boxCox);
        const zscore = numerator.dividedBy(denominator);
        const roundedZscore = zscore.toDecimalPlaces(2).toNumber();
        if (!this.adjustWeightScores) {
            return roundedZscore;
        }
        if ([LENGTH_HEIGHT_FOR_AGE, HEAD_CIRC_FOR_AGE,
            BODY_MASS_INDEX_FOR_AGE].includes(indicator)) {
            /*
            # return length/height-for-age (lhfa) without further processing
            # L(t) is always 1 for this indicator, so differences between
            # adjacent SDs (e.g., 2 SD and 3 SD) are constant for a specific
            # age but varied at different ages
            */
            return roundedZscore;
        }
        if (Math.abs(roundedZscore) <= 3) {
            return roundedZscore;
        }
        /*
        # weight-based indicators present right-skewed distributions
        # so use restricted application of LMS method (limiting Box-Cox
        # normal distribution to interval corresponding to z-scores where
        # empirical data are available. z-scores beyond +/- 3 SDs are
        # fixed to the distance between +/- 2 SDs and +/- 3 SD
        # this avoids making assumptions about the distribution of data
        # beyond the limits of observed values
        #
        #            _
        #           |
        #           |       Zind            if |Zind| <= 3
        #           |
        #           |
        #           |       y - SD3pos
        #   Zind* = | 3 + ( ----------- )   if Zind > 3
        #           |         SD23pos
        #           |
        #           |
        #           |
        #           |        y - SD3neg
        #           | -3 + ( ----------- )  if Zind < -3
        #           |          SD23neg
        #           |
        #           |_
        */
        function calcStdDev(sd) {
            /*
            #   e.g.,
            #
            #   SD3neg = M(t)[1 + L(t) * S(t) * (-3)]^ 1/L(t)
            #   SD2pos = M(t)[1 + L(t) * S(t) * (2)]^ 1/L(t)
            #
            ###
            */
            const sdbase = boxCox.times(coeffVariance).times(new D(sd)).plus(1);
            const sdexponent = new D(1).dividedBy(boxCox);
            const sdpower = sdbase.pow(sdexponent);
            return median.times(sdpower);
        }

        if (roundedZscore > 3) {
            console.log('zscore > 3');
            const sd2pos_c = calcStdDev(2);
            const sd3pos_c = calcStdDev(3);

            const sd23dist = sd3pos_c.minus(sd2pos_c); // Ensure Decimal.js subtraction

            //# compute final z-score
            //# zscore = D(3) + ((y - SD3pos_c)/SD23dist)
            const sub = y.minus(sd3pos_c);
            const div = sub.dividedBy(sd23dist);
            const revisedZscore = div.plus(3);
            return revisedZscore.toDecimalPlaces(2).toNumber();
        }

        if (roundedZscore < -3) {
            console.log('zscore < -3');
            const sd2neg_c = calcStdDev(-2);
            const sd3neg_c = calcStdDev(-3);

            const sd23dist = sd2neg_c.minus(sd3neg_c); // Ensure Decimal.js subtraction

            //# compute final z-score
            //# zscore = D(-3) + ((y - SD3neg_c)/SD23dist)
            const sub = y.minus(sd3neg_c);
            const div = sub.dividedBy(sd23dist);
            const revisedZscore = div.minus(3);
            return revisedZscore.toDecimalPlaces(2).toNumber();
        }
    }
}
