const { AllureReporter } = require('allure-playwright');

// During merge-reports Playwright fills config.projects between onConfigure
// and onBegin. Allure 3.14 reads the first project's paths in onConfigure.
module.exports = class MergedAllureReporter extends AllureReporter {
  onConfigure(config) { this.config = config; }
  onBegin(suite) {
    if (this.config.projects.length) super.onConfigure(this.config);
    super.onBegin(suite);
  }
};
