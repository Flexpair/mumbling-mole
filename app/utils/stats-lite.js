/**
 * Lightweight incremental statistics calculator
 * Replaces stats-incremental (~50KB) with ~1KB implementation
 * Uses Welford's method (an online algorithm) for numerically stable variance calculation
 */
export default class Stats {
  constructor() {
    this.n = 0;
    this.mean = 0;
    this._m2 = 0; // Sum of squares of differences from the current mean
  }

  /**
   * Add a new value to the running statistics
   * @param {number} value - The value to add
   */
  update(value) {
    this.n++;
    const delta = value - this.mean;
    this.mean += delta / this.n;
    const delta2 = value - this.mean;
    this._m2 += delta * delta2;
  }

  /**
   * Get the current variance (sample variance)
   * @returns {number} - The variance, or 0 if n < 2
   */
  get variance() {
    return this.n < 2 ? 0 : this._m2 / (this.n - 1);
  }

  /**
   * Get the current standard deviation
   * @returns {number} - The standard deviation
   */
  get standardDeviation() {
    return Math.sqrt(this.variance);
  }

  /**
   * Get all statistics as an object (compatible with stats-incremental API)
   * @returns {object|null} - Object with n, mean, variance, or null if no data
   */
  getAll() {
    if (this.n === 0) return null;
    return {
      n: this.n,
      mean: this.mean,
      variance: this.variance,
      standardDeviation: this.standardDeviation
    };
  }

  /**
   * Reset all statistics
   */
  reset() {
    this.n = 0;
    this.mean = 0;
    this._m2 = 0;
  }
}
